/**
 * accessdb-bridge: HTTP server bridging .accdb files to JSON for CEF TypeScript
 *
 * Endpoints:
 *   GET  /health              → {ok:true}
 *   GET  /tables?file=<path>  → {ok:true, tables:[...]}
 *   POST /query               → {ok:true, columns:[...], rows:[[...],...]}
 *   OPTIONS /*                → 200 (CORS preflight)
 *
 * Auth: every request (except OPTIONS) must include X-Bridge-Token header
 *       matching the BRIDGE_TOKEN env var set by the Tauri host process.
 *
 * CORS headers are included on all responses to support CEF browser context.
 */
import { getOrLoad, runQuery } from './db'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Token',
}

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

export function log(event: string, data?: Record<string, unknown>): void {
  console.error(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS })
}

function err(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: JSON_HEADERS },
  )
}

// ── Handler factory ───────────────────────────────────────────────────────────

/**
 * Create a request handler bound to a specific auth token.
 * Exported for testing — tests call makeHandler(testToken) directly.
 */
export function makeHandler(token: string) {
  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url)

    // CORS preflight — no token check needed
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS })
    }

    // Token auth on every non-preflight request
    const receivedToken = req.headers.get('x-bridge-token')
    if (receivedToken !== token) {
      log('auth_failed', { 
        method: req.method, 
        path: url.pathname,
        received_length: receivedToken?.length ?? 0,
        expected_length: token.length
      })
      return err(403, 'Forbidden')
    }

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      return ok({ ok: true })
    }

    // GET /tables?file=<path>
    if (req.method === 'GET' && url.pathname === '/tables') {
      const file = url.searchParams.get('file')
      if (!file) return err(400, 'Missing file parameter')
      log('tables', { file })
      try {
        const entry = await getOrLoad(file)
        return ok({ ok: true, tables: entry.mdb.getTableNames() })
      } catch (e) {
        log('tables_error', { file, error: (e as Error).message })
        return err(400, (e as Error).message)
      }
    }

    // POST /query  body: {file, sql}
    if (req.method === 'POST' && url.pathname === '/query') {
      let body: { file?: string; sql?: string }
      try {
        body = await req.json() as { file?: string; sql?: string }
      } catch {
        return err(400, 'Invalid JSON body')
      }

      const { file, sql } = body
      if (!file) return err(400, 'Missing file field')
      if (!sql || !sql.trim()) return err(400, 'Missing sql field')

      log('query', { file, sql })
      try {
        const entry = await getOrLoad(file)
        const result = runQuery(entry.db, sql)
        return ok({ ok: true, data: result })
      } catch (e) {
        const errorMsg = (e as Error).message;
        log('query_error', { file, sql, error: errorMsg })
        return err(400, `Query Error: ${errorMsg}`)
      }
    }

    // POST /api  body: { __cmd, param, ... }
    if (req.method === 'POST' && url.pathname === '/api') {
      let body: { __cmd?: string; param?: any };
      try {
        body = await req.json() as { __cmd?: string; param?: any };
      } catch {
        return err(400, 'Invalid JSON body');
      }

      const { __cmd } = body;
      if (!__cmd) return err(400, 'Missing __cmd field');

      log('hmi_command', { cmd: __cmd });

      // Specialized HiView Handlers
      switch (__cmd) {
        case 'start_runtime':
          return ok({ ok: true, data: 'debug' });

        case 'req_project':
          try {
            // Default project path - should be configurable
            const projectPath = 'C:\\HiView\\Project\\project.hprj';
            const entry = await getOrLoad(projectPath);
            const data = runQuery(entry.db, 'SELECT * FROM ProjectConfig');
            return ok({ ok: true, state: 1, data: data[0] || {} });
          } catch (e) {
            return ok({ ok: true, state: 0, error: (e as Error).message });
          }

        case 'getvalue2':
          // For now, return mock values or query DB if tags are mapped
          return ok({ ok: true, data: [] });

        default:
          return ok({ ok: true, info: `Command ${__cmd} received but not fully implemented.` });
      }
    }

    return err(404, 'Not found')
  }
}

// ── Start server (only when run directly, not when imported by tests) ─────────

if (import.meta.main) {
  const PORT = parseInt(process.env.BRIDGE_PORT ?? '3456', 10)
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    log('fatal', { reason: 'invalid_port', value: process.env.BRIDGE_PORT })
    process.exit(1)
  }

  const TOKEN = process.env.BRIDGE_TOKEN
  if (!TOKEN) {
    log('fatal', { reason: 'no_bridge_token' })
    process.exit(1)
  }

  Bun.serve({
    hostname: '127.0.0.1',
    port: PORT,
    fetch: makeHandler(TOKEN),
  })

  log('bridge_start', { port: PORT, pid: process.pid })
}
