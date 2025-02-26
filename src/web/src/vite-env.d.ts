/// <reference types="vite/client" />

interface ImportMetaEnv extends Record<string, string> {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_AUTH_ENDPOINT: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_MAX_RETRIES: string;
  readonly VITE_CACHE_DURATION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}