import { WatchItem } from './config';

export interface HmrData extends WatchItem {
  file: string;
  event: string;
  initial: boolean;
  timestamp: number;
}

/** The daemon's state, as data for a caller to render however it likes. */
export interface ViteBurnerStatus {
  /** Whether the game is the active client of the websocket port. */
  connected: boolean;
  /** The port the game connects to. */
  port: number;
  /** How many watched files are still waiting to sync. */
  pending: number;
}

declare module 'vite' {
  interface ViteDevServer {
    /** vite internal _importGlobMap for detemine glob hmr */
    _importGlobMap: Map<string, string[]>;
  }
}
