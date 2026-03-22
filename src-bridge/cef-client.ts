/**
 * accessdb-bridge CEF TypeScript client
 *
 * DROP-IN REPLACEMENT for the legacy Access DB COM pattern.
 *
 * SETUP REQUIRED (one-time, in C++ CEF host):
 *   1. Read %TEMP%\.accessdb-bridge-token at startup
 *   2. Inject into TypeScript context before page load:
 *        browser->GetMainFrame()->ExecuteJavaScript(
 *          "window.__BRIDGE_TOKEN__ = '" + token + "';", "", 0);
 *
 * USAGE in CEF TypeScript:
 *   await initDB("C:\\path\\to\\data.accdb")
 *   const tables = await getTables()
 *   const result = await queryDB("SELECT * FROM Employees WHERE Dept = 'IT'")
 *   // result.columns → ["EmpID", "Name", "Dept"]
 *   // result.rows    → [["1", "Alice", "IT"], ...]
 */

// ── Config ────────────────────────────────────────────────────────────────────

const BRIDGE_PORT = 3456
const BRIDGE = `http://127.0.0.1:${BRIDGE_PORT}`

// Token is injected by the C++ host from %TEMP%\.accessdb-bridge-token
// Falls back to empty string so auth failures are explicit (403), not silent
declare const __BRIDGE_TOKEN__: string | undefined
const TOKEN: string = (typeof __BRIDGE_TOKEN__ !== 'undefined' ? __BRIDGE_TOKEN__ : '')

let currentFile: string | null = null

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function bridgeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input as string, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Token': TOKEN,
      ...(init?.headers ?? {}),
    },
  })
  return res
}

// ── waitForBridge ─────────────────────────────────────────────────────────────

/**
 * Poll /health until the bridge is ready or timeout is reached.
 * Call this once at startup before any DB operations.
 * Throws if the bridge does not start within maxMs.
 *
 * @example
 *   try {
 *     await waitForBridge()
 *   } catch {
 *     showError("데이터베이스 서비스를 시작할 수 없습니다.")
 *     return
 *   }
 */
export async function waitForBridge(maxMs = 5000, intervalMs = 500): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const res = await bridgeFetch(`${BRIDGE}/health`)
      if (res.ok) return
      if (res.status === 403) throw new Error('Bridge authentication failed — check token injection')
    } catch (e) {
      if (e instanceof Error && e.message.includes('authentication failed')) throw e
      // Connection refused — bridge not started yet
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`accessdb-bridge did not start within ${maxMs}ms`)
}

// ── initDB ────────────────────────────────────────────────────────────────────

/**
 * Point the client at a specific .accdb file and warm up the cache.
 * Equivalent to the legacy "CEF initializes and reads DB on startup" pattern.
 *
 * @param filePath  Absolute Windows path to the .accdb file.
 *                  e.g. "C:\\Users\\user\\data\\MyDB.accdb"
 * @returns         List of table names in the database.
 */
export async function initDB(filePath: string): Promise<string[]> {
  const res = await bridgeFetch(`${BRIDGE}/tables?file=${encodeURIComponent(filePath)}`)
  const body = await res.json() as { ok: boolean; tables?: string[]; error?: string }
  if (!body.ok) throw new Error(body.error ?? 'initDB failed')
  currentFile = filePath
  return body.tables ?? []
}

// ── getTables ─────────────────────────────────────────────────────────────────

/**
 * Get all table names from the currently open database.
 * Requires initDB() to have been called first.
 */
export async function getTables(): Promise<string[]> {
  if (!currentFile) throw new Error('Call initDB() first')
  return initDB(currentFile)
}

// ── queryDB ───────────────────────────────────────────────────────────────────

export interface QueryResult {
  columns: string[]
  rows: (string | number | boolean | null)[][]
}

/**
 * Run a SQL SELECT against the current database.
 * Equivalent to the legacy native handler that returned JSON.
 *
 * BEFORE (legacy COM pattern):
 *   const json = await nativeHandler("queryDB", sql)
 *   const { columns, rows } = JSON.parse(json)
 *
 * AFTER (bridge pattern):
 *   const { columns, rows } = await queryDB(sql)
 *
 * @param sql  SQL query string. Only SELECT is meaningful — the database
 *             is in-memory read-only (mutations don't persist to the .accdb).
 */
export async function queryDB(sql: string): Promise<QueryResult> {
  if (!currentFile) throw new Error('Call initDB() first')
  const res = await bridgeFetch(`${BRIDGE}/query`, {
    method: 'POST',
    body: JSON.stringify({ file: currentFile, sql }),
  })
  const body = await res.json() as { ok: boolean; columns?: string[]; rows?: unknown[][]; error?: string }
  if (!body.ok) throw new Error(body.error ?? 'queryDB failed')
  return {
    columns: body.columns ?? [],
    rows: (body.rows ?? []) as (string | number | boolean | null)[][],
  }
}

// ── Migration guide ───────────────────────────────────────────────────────────
//
// LEGACY PATTERN (CEF + COM):
//   // On CEF init (C++ side):
//   std::string json = ReadDbAndSerialize("data.accdb");  // COM
//   frame->ExecuteJavaScript("window.__DB__ = " + json, "", 0);
//
//   // In TypeScript (reading initial data):
//   const db = window.__DB__  // pre-loaded JSON blob
//
//   // For on-demand queries (C++ native handler):
//   const result = await nativeHandler("query", sql)
//
// NEW PATTERN (bridge):
//   // In TypeScript (startup):
//   await waitForBridge()
//   const tables = await initDB("C:\\path\\data.accdb")
//
//   // For on-demand queries (HTTP):
//   const { columns, rows } = await queryDB("SELECT * FROM Employees")
