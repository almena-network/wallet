/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** A development mediator to offer instead of the public one — see `mediator.ts`. */
  readonly VITE_MEDIATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
