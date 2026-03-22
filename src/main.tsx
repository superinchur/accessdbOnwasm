// Polyfill Buffer for mdb-reader (uses Node.js Buffer API internally)
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
