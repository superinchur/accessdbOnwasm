/**
 * accessdb-bridge server tests
 * Run with: bun test src-bridge/server.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { makeHandler } from './server'

// ── Test server setup ────────────────────────────────────────────────────────

const TEST_PORT = 13457
const TEST_TOKEN = 'test-secret-token-xyz'
const BASE = `http://127.0.0.1:${TEST_PORT}`

let server: ReturnType<typeof Bun.serve>

beforeAll(() => {
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: TEST_PORT,
    fetch: makeHandler(TEST_TOKEN),
  })
})

afterAll(() => {
  server.stop(true)
})

function req(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'X-Bridge-Token': TEST_TOKEN,
      'Content-Type': 'application/json',
      ...(opts?.headers as Record<string, string> ?? {}),
    },
  })
}

// ── GET /health ───────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns {ok:true} with 200', async () => {
    const res = await req('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('includes CORS Allow-Origin: * header', async () => {
    const res = await req('/health')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('returns Content-Type: application/json', async () => {
    const res = await req('/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('Token auth', () => {
  it('returns 403 with no token', async () => {
    const res = await fetch(`${BASE}/health`)
    expect(res.status).toBe(403)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 with wrong token', async () => {
    const res = await fetch(`${BASE}/health`, {
      headers: { 'X-Bridge-Token': 'wrong-token' },
    })
    expect(res.status).toBe(403)
  })

  it('returns 403 with empty token', async () => {
    const res = await fetch(`${BASE}/health`, {
      headers: { 'X-Bridge-Token': '' },
    })
    expect(res.status).toBe(403)
  })
})

// ── OPTIONS preflight ─────────────────────────────────────────────────────────

describe('OPTIONS preflight', () => {
  it('returns 200 without auth token', async () => {
    const res = await fetch(`${BASE}/health`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })

  it('returns CORS Allow-Methods including POST', async () => {
    const res = await fetch(`${BASE}/health`, { method: 'OPTIONS' })
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
  })

  it('returns CORS Allow-Headers including X-Bridge-Token', async () => {
    const res = await fetch(`${BASE}/health`, { method: 'OPTIONS' })
    expect(res.headers.get('access-control-allow-headers')).toContain('X-Bridge-Token')
  })
})

// ── GET /tables ───────────────────────────────────────────────────────────────

describe('GET /tables', () => {
  it('returns 400 when file param is missing', async () => {
    const res = await req('/tables')
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error.toLowerCase()).toContain('file')
  })

  it('returns 400 when file does not exist (ENOENT)', async () => {
    const res = await req('/tables?file=' + encodeURIComponent('C:\\no-such-file.accdb'))
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('ENOENT')
  })
})

// ── POST /query ───────────────────────────────────────────────────────────────

describe('POST /query', () => {
  it('returns 400 for invalid JSON body', async () => {
    const res = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: { 'X-Bridge-Token': TEST_TOKEN, 'Content-Type': 'application/json' },
      body: 'not valid json }{',
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('JSON')
  })

  it('returns 400 when file field is missing', async () => {
    const res = await req('/query', {
      method: 'POST',
      body: JSON.stringify({ sql: 'SELECT 1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error.toLowerCase()).toContain('file')
  })

  it('returns 400 when sql field is missing', async () => {
    const res = await req('/query', {
      method: 'POST',
      body: JSON.stringify({ file: 'test.accdb' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error.toLowerCase()).toContain('sql')
  })

  it('returns 400 when sql is whitespace only', async () => {
    const res = await req('/query', {
      method: 'POST',
      body: JSON.stringify({ file: 'test.accdb', sql: '   ' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
  })

  it('returns 400 when file does not exist (ENOENT)', async () => {
    const res = await req('/query', {
      method: 'POST',
      body: JSON.stringify({ file: 'C:\\no-such-file.accdb', sql: 'SELECT 1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('ENOENT')
  })
})

// ── 404 ───────────────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 for unknown path', async () => {
    const res = await req('/unknown-endpoint')
    expect(res.status).toBe(404)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(false)
  })
})
