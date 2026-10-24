/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NASA_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
