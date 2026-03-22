# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1.0] - 2026-03-22

### Added
- `src/hmi/`: SVG-based HMI frontend system for CEF applications
  - `IDataSource` interface — repository pattern for pluggable data sources
  - `DbSource` — pull source via bridge `/query` endpoint
  - `ShmSource` — pull source via bridge `/shm` endpoint (Windows shared memory)
  - `WsSource` — push source example via WebSocket (cache-and-return pattern)
  - `DataBinder` — polls `IDataSource[]`, merges results, updates `[data-hmi-tag]` DOM elements
  - `ScreenHost` — fetches SVG files, re-executes embedded `<script>` tags, manages binder lifecycle
  - `data-hmi-tag` attribute binding with `data-on`/`data-off` state classes and `data-value` for SVG scripts
  - `src/hmi/screens/plant1.svg` — demo SVG with PUMP_001, VALVE_001, TANK_001 tags
- `src-bridge/shm.ts`: Windows named shared memory reader via Bun FFI (`kernel32.dll`)
- `GET /shm?name=<n>&size=<n>` endpoint on bridge — exposes shared memory as `{ok:true, tags:{...}}`
- `npm run dev:hmi` and `npm run build:hmi` scripts using `vite.hmi.config.ts`
- `.vscode/launch.json` — VS Code debug configs for bridge dev server and bun:test

### Fixed
- `popup.ts`: replaced `fetchTagValues` import (removed in refactor) with `DbSource`; replaced `innerHTML` string interpolation with DOM API to prevent XSS; added `'` escaping in SQL WHERE clause

## [0.2.0] - 2026-03-22

### Added
- `accessdb-bridge`: Bun HTTP sidecar that bridges `.accdb` files to JSON via a local HTTP API (`GET /health`, `GET /tables`, `POST /query`)
- Token-based authentication (`X-Bridge-Token`) using a UUID generated per Tauri session and shared via `%TEMP%\.accessdb-bridge-token`
- `src-bridge/db.ts`: mdb-reader → bun:sqlite in-memory loading with per-file cache, inflight deduplication, and cache-poisoning protection
- `src-bridge/server.ts`: Testable `makeHandler(token)` factory with `import.meta.main` guard; full CORS support for CEF browser contexts
- `src-bridge/cef-client.ts`: Drop-in TypeScript client (`waitForBridge`, `initDB`, `getTables`, `queryDB`) replacing the legacy CEF + COM pattern
- `src-bridge/server.test.ts`: bun:test suite covering all 17 HTTP paths (auth, preflight, endpoints, error cases)
- `src-tauri/src/lib.rs`: Tauri sidecar integration — auto-spawn bridge on app start, auto-kill on exit via `BridgeState(CommandChild)`, `get_bridge_token` command
- `npm run build:bridge` script — compiles bridge to standalone Windows exe via `bun build --compile`
- `TODOS.md` tracking known follow-up items (CEF CSP validation, multi-instance port collision, cache LRU limit)

### Changed
- `src-tauri/Cargo.toml`: added `tauri-plugin-shell` and `uuid` dependencies
- `src-tauri/capabilities/default.json`: added `shell:allow-execute` and `shell:allow-spawn` permissions
- `src-tauri/tauri.conf.json`: added `externalBin` bundle entry for the bridge executable
- `.gitignore`: added `src-tauri/binaries/*.exe` and `*.accdb`/`*.mdb` exclusions

## [0.1.0] - initial

- Initial Tauri + React + Vite + sql.js scaffold
