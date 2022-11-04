import { TransformResult, ViteDevServer } from 'vite';
import { ResolvedConfig, WatchItem } from './config';

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

export interface ViteBurnerServer extends Omit<ViteDevServer, 'config'> {
  config: ResolvedConfig;
  pathToId(file: string): string;
  invalidateFile(file: string): Promise<void>;
  fetchModule(file: string): Promise<TransformResult | null>;
  onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void): void;
  buildStart(): Promise<void>;
}
