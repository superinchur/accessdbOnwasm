import type { IDataSource } from './data-source'

const BRIDGE = 'http://127.0.0.1:3456'

function token(): string {
  return (typeof (window as any).__BRIDGE_TOKEN__ !== 'undefined'
    ? (window as any).__BRIDGE_TOKEN__
    : 'dev-test-token')
}

export class DbSource implements IDataSource {
  constructor(
    private readonly file: string,
    private readonly sql: string,
    private readonly tagCol = 0,
    private readonly valueCol = 1,
  ) {}

  async fetch(): Promise<Record<string, string>> {
    const res = await fetch(`${BRIDGE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': token() },
      body: JSON.stringify({ file: this.file, sql: this.sql }),
    })
    const body = await res.json() as { ok: boolean; rows: unknown[][]; error?: string }
    if (!body.ok) throw new Error(body.error ?? 'DbSource.fetch failed')

    const result: Record<string, string> = {}
    for (const row of body.rows) {
      result[String(row[this.tagCol])] = row[this.valueCol] != null
        ? String(row[this.valueCol])
        : ''
    }
    return result
  }
}
