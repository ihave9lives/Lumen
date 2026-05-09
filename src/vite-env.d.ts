/// <reference types="vite/client" />

declare interface Window {
  __TAURI_INTERNALS__?: unknown;
  __TAURI_IPC__?: unknown;
}
