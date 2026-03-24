# Implementation Guide: AccessDB on WASM

This guide explains how to build a browser-based SQL tool for Microsoft Access files using React, `mdb-reader`, and `sql.js`.

## Core Architecture
The app works as a bridge:
1. **Binary Parsing**: `mdb-reader` parses the [.mdb](file:///e:/project/accessdbOnwasm/test.mdb)/[.accdb](file:///e:/project/accessdbOnwasm/test.accdb) file in the browser.
2. **Data Migration**: Extracted data is loaded into an in-memory SQLite database (`sql.js`).
3. **SQL Querying**: Users run standard SQLite SQL against the in-memory database.

## Key Implementation Steps

### 1. Project Setup
Initialize a Vite + React + TypeScript project and install dependencies.
```bash
npm create vite@latest accessdb-on-wasm -- --template react-ts
npm i mdb-reader sql.js @codemirror/lang-sql vite-plugin-node-polyfills buffer
```

### 2. Vite Configuration
`mdb-reader` requires `Buffer`. Configure Vite to provide node polyfills.
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills({ include: ['buffer'] })],
});
```

### 3. The DB Bridge ([src/db.ts](file:///e:/project/accessdbOnwasm/src/db.ts))
Implement the logic to initialize the SQL engine and migrate data.
- **Initialize**: Load `sql-wasm.wasm` and create a new database.
- **Load File**: Use `MDBReader` to get table names.
- **Lazy Loading**: Only load table data into SQLite when needed (on query or click) to save memory and time.
- **Chunking**: Insert rows in chunks (e.g., 500 rows) using transactions to keep the UI responsive.

### 4. React UI ([src/App.tsx](file:///e:/project/accessdbOnwasm/src/App.tsx))
Build the interface with:
- **DropZone**: For file selection (Drag & Drop).
- **Sidebar**: Listing tables from `mdb-reader`.
- **Query Editor**: Using CodeMirror for SQL syntax highlighting.
- **Results Table**: Displaying `sql.js` output.

## Verification
- Test with small [.mdb](file:///e:/project/accessdbOnwasm/test.mdb) files (Legacy).
- Test with large [.accdb](file:///e:/project/accessdbOnwasm/test.accdb) files (Modern).
- Verify standard SQL queries (e.g., `SELECT`, `JOIN`, `GROUP BY`).
