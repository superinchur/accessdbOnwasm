/**
 * Bridge: mdb-reader → sql.js in-memory SQLite
 * Tables are loaded lazily — only when first queried or clicked.
 */
import initSqlJs, { Database } from 'sql.js'
import MDBReader from 'mdb-reader'

let db: Database | null = null
let mdb: MDBReader | null = null
const loadedTables = new Set<string>()

export async function initSqlEngine(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  })
  db = new SQL.Database()
}

export function loadMdbFile(buffer: ArrayBuffer): string[] {
  // mdb-reader expects a Buffer (Node) or Uint8Array
  mdb = new MDBReader(Buffer.from(buffer))
  loadedTables.clear()
  if (db) {
    // Drop all existing tables from previous file
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    if (tables.length && tables[0].values) {
      for (const [name] of tables[0].values) {
        db.run(`DROP TABLE IF EXISTS \`${name}\``)
      }
    }
  }
  return mdb.getTableNames()
}

export async function ensureTableLoaded(
  tableName: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ rowCount: number }> {
  if (!db || !mdb) throw new Error('Engine not initialized')
  if (loadedTables.has(tableName)) {
    const res = db.exec(`SELECT COUNT(*) FROM \`${tableName}\``)
    const count = res[0]?.values[0]?.[0] as number ?? 0
    return { rowCount: count }
  }

  const table = mdb.getTable(tableName)
  const columns = table.getColumnNames()
  const columnDefs = columns
    .map(c => `\`${c}\` TEXT`)
    .join(', ')

  db.run(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs})`)

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
        `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
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
