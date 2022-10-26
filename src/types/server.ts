import { TransformResult, ViteDevServer } from 'vite';
import { HmrData } from '..';
import { ResolvedConfig } from './config';

export interface ViteBurnerServer extends Omit<ViteDevServer, 'config'> {
  config: ResolvedConfig;
  pathToId(file: string): string;
  fetchModule(file: string): Promise<TransformResult | null>;
  onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void): void;
  buildStart(): Promise<void>;
}
