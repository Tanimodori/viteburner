import EventEmitter from 'node:events';

declare module 'vite' {
  interface ViteDevServer {
    emitter: EventEmitter;
  }
}
