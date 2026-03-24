import type { IDataSource } from './data-source'

const BRIDGE = 'http://127.0.0.1:3456'

function token(): string {
  return (typeof (window as any).__BRIDGE_TOKEN__ !== 'undefined'
    ? (window as any).__BRIDGE_TOKEN__
    : 'dev-test-token')
}

export class ShmSource implements IDataSource {
  constructor(
    private readonly name: string,
    private readonly size = 4096,
  ) {}

  async fetch(): Promise<Record<string, string>> {
    const res = await fetch(
      `${BRIDGE}/shm?name=${encodeURIComponent(this.name)}&size=${this.size}`,
      { headers: { 'X-Bridge-Token': token() } },
    )
    const body = await res.json() as { ok: boolean; tags?: Record<string, string>; error?: string }
    if (!body.ok) throw new Error(body.error ?? 'ShmSource.fetch failed')
    return body.tags ?? {}
  }
}
