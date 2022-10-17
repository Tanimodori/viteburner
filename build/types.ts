import { HMREmitter } from 'vite-node/hmr';

declare module 'vite' {
  interface ViteDevServer {
    emitter: HMREmitter;
  }
}
