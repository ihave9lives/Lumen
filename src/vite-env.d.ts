/// <reference types="vite/client" />

declare interface Window {
  __TAURI_INTERNALS__?: unknown;
  __TAURI_IPC__?: unknown;
}

// Type declarations for modules without types
declare module 'framer-motion';
declare module 'lucide-react';
declare module 'react-router-dom';
declare module 'react-router';