import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    // Polyfill Node.js globals (Buffer, process, etc.) for mdb-reader in browser/WebView2
    nodePolyfills({ include: ['buffer', 'process'] }),
  ],

  // Tauri: don't clear Rust's log output in the terminal
  clearScreen: false,

  server: {
    port: 1420,
    // Tauri expects a fixed port; fail fast if it's taken
    strictPort: true,
    // Force IPv4 — Node 17+ on Windows resolves localhost to ::1 (IPv6)
    // which is often blocked; 127.0.0.1 is always available
    host: '127.0.0.1',
  },

  // Expose TAURI_ENV_* vars (platform, debug flag, etc.) to the frontend
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // WebView2 (Windows) is Chromium 105+
    target: 'chrome105',
    // Disable minification in debug builds so DevTools are usable
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  optimizeDeps: {
    // sql.js must be pre-bundled (CJS→ESM) so the default import works.
    include: ['sql.js'],
    // Prevent esbuild from trying to bundle the WASM binary itself
    exclude: ['sql.js/dist/sql-wasm.wasm'],
  },

  // Treat .wasm files as static assets so Vite gives them a stable URL
  assetsInclude: ['**/*.wasm'],
})
