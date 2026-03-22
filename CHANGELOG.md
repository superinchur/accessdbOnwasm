# Changelog

All notable changes to this project will be documented in this file.

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
