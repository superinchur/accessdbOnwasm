/**
 * Bridge: mdb-reader → sql.js in-memory SQLite
 * Tables are loaded lazily — only when first queried or clicked.
 */
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
// Import WASM as a Vite asset URL — avoids esbuild mangling the binary path
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import MDBReader from 'mdb-reader'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let mdb: MDBReader | null = null
const loadedTables = new Set<string>()

/**
 * Strip backticks from an identifier to prevent SQLite backtick-quoting injection.
 * Backtick is the only character that can break out of `...`-quoted SQLite identifiers.
 * MDB names may legitimately contain spaces and special chars — all are safe except `.
 */
function safeId(name: string): string {
  return name.replace(/`/g, '')
}

export async function initSqlEngine(): Promise<void> {
  SQL = await initSqlJs({
    // Use the Vite-resolved asset URL so the path is always correct
    // regardless of dev/prod or how sql.js is bundled
    locateFile: () => sqlWasmUrl,
  })
  db = new SQL.Database()
}

export function loadMdbFile(buffer: ArrayBuffer): string[] {
  // Close old DB and free WASM heap memory before opening a new file.
  // This also guarantees no stale tables from the previous file remain.
  if (db) {
    db.close()
    db = SQL ? new SQL.Database() : null
  }
  // mdb-reader expects a Buffer (Node) or Uint8Array
  mdb = new MDBReader(Buffer.from(buffer))
  loadedTables.clear()
  return mdb.getTableNames()
}

export async function ensureTableLoaded(
  tableName: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ rowCount: number }> {
  if (!db || !mdb) throw new Error('Engine not initialized')
  if (loadedTables.has(tableName)) {
    const res = db.exec(`SELECT COUNT(*) FROM \`${safeId(tableName)}\``)
    const count = res[0]?.values[0]?.[0] as number ?? 0
    return { rowCount: count }
  }

  const table = mdb.getTable(tableName)
  const columns = table.getColumnNames()
  const columnDefs = columns
    .map(c => `\`${safeId(c)}\` TEXT`)
    .join(', ')

  db.run(`CREATE TABLE IF NOT EXISTS \`${safeId(tableName)}\` (${columnDefs})`)

  const rows = table.getData()
  const CHUNK = 500
  const total = rows.length

  for (let i = 0; i < total; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    db.run('BEGIN TRANSACTION')
    for (const row of chunk) {
      const placeholders = columns.map(() => '?').join(', ')
      const values = columns.map(c => {
        const v = (row as Record<string, unknown>)[c]
        if (v === null || v === undefined) return null
        if (v instanceof Date) return v.toISOString()
        return String(v)
      })
      db.run(
        `INSERT INTO \`${safeId(tableName)}\` (${columns.map(c => `\`${safeId(c)}\``).join(', ')}) VALUES (${placeholders})`,
        values,
      )
    }
    db.run('COMMIT')
    onProgress?.(Math.min(i + CHUNK, total), total)
    // Yield to browser between chunks
    await new Promise(r => setTimeout(r, 0))
  }

  loadedTables.add(tableName)
  return { rowCount: total }
}

export function runQuery(sql: string): {
  columns: string[]
  rows: (string | number | boolean | null)[][]
} {
  if (!db) throw new Error('SQL engine not initialized')
  const results = db.exec(sql)
  if (!results.length) return { columns: [], rows: [] }
  const { columns, values } = results[0]
  return {
    columns,
    rows: values as (string | number | boolean | null)[][],
  }
}

export function isTableLoaded(name: string) {
  return loadedTables.has(name)
}
