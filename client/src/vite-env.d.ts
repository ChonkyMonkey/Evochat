/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOGGER: string;
  readonly VITE_LOGGER_FILTER: string;
  readonly VITE_PADDLE_CLIENT_TOKEN: string
  readonly VITE_PADDLE_ENVIRONMENT: 'sandbox' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
