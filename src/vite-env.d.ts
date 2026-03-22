/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

// Allow importing .wasm files as URLs via ?url suffix
declare module '*.wasm?url' {
  const url: string
  export default url
}
