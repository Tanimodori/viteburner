import { WatchItem } from './config';

export interface HmrData extends WatchItem {
  file: string;
  event: string;
  initial: boolean;
  timestamp: number;
}

declare module 'vite' {
  interface ViteDevServer {
    /** vite internal _importGlobMap for detemine glob hmr */
    _importGlobMap: Map<string, string[]>;
  }
}
