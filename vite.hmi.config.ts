import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src/hmi'),
  server: {
    port: 5174,
  },
  build: {
    outDir: resolve(__dirname, 'dist/hmi'),
    emptyOutDir: true,
  },
})
