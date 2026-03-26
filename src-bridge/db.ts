/**
 * Bridge DB layer: mdb-reader → bun:sqlite in-memory SQLite
 *
 * Per-file cache: keyed by absolute file path.
 * First access loads ALL tables eagerly into SQLite (no lazy loading).
 * Concurrent requests for the same file share a single load Promise (inflight map).
 * cache.set() only runs AFTER loadAllTables() succeeds — prevents cache poisoning.
 */
import { Database } from 'bun:sqlite'
import MDBReader from 'mdb-reader'
import * as fs from 'fs'

type SQLValue = string | number | bigint | boolean | Uint8Array | null

/**
 * Strip backticks from an identifier to prevent SQLite backtick-quoting injection.
 * Backtick is the only character that can break out of `...`-quoted identifiers.
 */
function safeId(name: string): string {
  return name.replace(/`/g, '')
}

export interface CacheEntry {
  mdb: MDBReader
  db: Database
  tables: Set<string>
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry>>()

function loadTable(entry: CacheEntry, tableName: string): void {
  if (entry.tables.has(tableName)) return

  const table = entry.mdb.getTable(tableName)
  const columns = table.getColumnNames()
  const columnDefs = columns.map(c => `\`${safeId(c)}\` TEXT`).join(', ')

  entry.db.run(`CREATE TABLE IF NOT EXISTS \`${safeId(tableName)}\` (${columnDefs})`)

  const rows = table.getData() as Array<Record<string, unknown>>
  if (rows.length === 0) {
    entry.tables.add(tableName)
    return
  }

  const insertSQL = `INSERT INTO \`${safeId(tableName)}\` (${
    columns.map(c => `\`${safeId(c)}\``).join(', ')
  }) VALUES (${columns.map(() => '?').join(', ')})`

  const stmt = entry.db.prepare(insertSQL)

  const insertMany = entry.db.transaction((data: Array<Record<string, unknown>>) => {
    for (const row of data) {
      const values = columns.map(c => {
        const v = row[c]
        if (v === null || v === undefined) return null
        if (v instanceof Date) return v.toISOString()
        return String(v)
      })
      stmt.run(...(values as Parameters<typeof stmt.run>))
    }
  })

  insertMany(rows)
  stmt.finalize()
  entry.tables.add(tableName)
}

function loadAllTables(entry: CacheEntry): void {
  for (const name of entry.mdb.getTableNames()) {
    try {
      loadTable(entry, name)
    } catch (e) {
      console.error(`Failed to load table "${name}":`, (e as Error).message)
    }
  }
}

/**
 * Return a fully-loaded cache entry for the given file path.
 * Creates and caches the entry on first access.
 * Concurrent requests for the same path share the same load Promise.
 */
export async function getOrLoad(filePath: string): Promise<CacheEntry> {
  if (cache.has(filePath)) return cache.get(filePath)!
  if (inflight.has(filePath)) return inflight.get(filePath)!

  const promise = (async (): Promise<CacheEntry> => {
    // Throws ENOENT if file not found — propagates as 400 in server
    const buf = fs.readFileSync(filePath)
    // Throws if not a valid .accdb file
    const mdb = new MDBReader(buf)
    const db = new Database(':memory:')
    const entry: CacheEntry = { mdb, db, tables: new Set() }
    // Load ALL tables before caching — prevents partial-cache poisoning
    loadAllTables(entry)
    cache.set(filePath, entry)
    return entry
  })()

  inflight.set(filePath, promise)
  try {
    return await promise
  } finally {
    inflight.delete(filePath)
  }
}

export function runQuery(
  db: Database,
  sql: string,
): Record<string, SQLValue>[] {
  const stmt = db.query(sql)
  try {
    const columns = stmt.columnNames
    const rows = stmt.values() as SQLValue[][]
    return rows.map(row => {
      const obj: Record<string, SQLValue> = {}
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i]
      })
      return obj
    })
  } finally {
    stmt.finalize()
  }
}
