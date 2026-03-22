# accessdb-on-wasm

A Tauri desktop app for querying Microsoft Access (`.accdb`) databases.

## Architecture

```
Tauri host ──spawn──▶ accessdb-bridge (Bun HTTP sidecar)
                           │
                    mdb-reader reads .accdb
                    bun:sqlite loads all tables in-memory
                           │
CEF / WebView ◀── HTTP ──▶ http://127.0.0.1:3456
                    X-Bridge-Token: <uuid>
```

The bridge eliminates the legacy CEF + COM dependency. Your TypeScript frontend talks to a
local HTTP API instead of native COM bindings.

## Quick Start

```bash
# Install dependencies
npm install

# Dev mode (Vite + Tauri)
npm run tauri dev

# Build bridge binary
npm run build:bridge

# Full production build
npm run tauri:build
```

## accessdb-bridge API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/tables?file=<path>` | ✓ | List table names |
| POST | `/query` | ✓ | Run SQL SELECT |

Auth: include `X-Bridge-Token: <token>` header. The token is a UUID generated at startup,
written to `%TEMP%\.accessdb-bridge-token`.

### CEF TypeScript Usage

```typescript
import { waitForBridge, initDB, queryDB } from './src-bridge/cef-client'

await waitForBridge()
await initDB('C:\\path\\to\\data.accdb')
const { columns, rows } = await queryDB('SELECT * FROM Employees')
```

## Development

```bash
# Run bridge tests
bun test src-bridge/server.test.ts

# Build bridge standalone exe
npm run build:bridge
```

## Known Limitations

- All column values stored as TEXT in SQLite (display-oriented; numeric operators use lexicographic comparison)
- No cache eviction — each `.accdb` file stays in memory for the process lifetime
- Port 3456 hardcoded — multi-instance support deferred (see TODOS.md)

See [TODOS.md](TODOS.md) for planned improvements.
