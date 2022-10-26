import { TransformResult, ViteDevServer } from 'vite';
import { ResolvedConfig, WatchItem } from './config';

export interface HmrData extends WatchItem {
  file: string;
  event: string;
  initial: boolean;
  timestamp: number;
}

export interface ViteBurnerServer extends Omit<ViteDevServer, 'config'> {
  config: ResolvedConfig;
  pathToId(file: string): string;
  fetchModule(file: string): Promise<TransformResult | null>;
  onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void): void;
  buildStart(): Promise<void>;
}
