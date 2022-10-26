import { HmrContext, Plugin } from 'vite';
import { relative } from 'path';
import { WatchManager } from './watch';
import { WatchItem, ViteBurnerConfig } from '@/types';

declare module 'vite' {
  interface ViteDevServer {
    watchManager: WatchManager;
  }
}

export interface HmrOptions {
  watch?: WatchItem[];
}

export interface HmrData extends WatchItem {
  file: string;
  event: string;
  initial: boolean;
  timestamp: number;
}

const parseOptions = (options?: ViteBurnerConfig) => {
  const cwd = options?.cwd;
  return {
    watch: options?.watch ?? [],
    ignoreInitial: options?.ignoreInitial ?? false,
    ...(cwd && { cwd }),
  };
};

export const hmrPluginName = 'viteburner:hmr';

export function hmrPlugin(): Plugin {
  let watchManager: WatchManager;
  return {
    name: hmrPluginName,
    configResolved(config) {
      const { watch, ...options } = parseOptions(config.viteburner);
      watchManager = new WatchManager(watch, {
        cwd: config.root,
        persistent: true,
        ...options,
      });
    },
    configureServer(server) {
      server.watchManager = watchManager;
    },
    handleHotUpdate(context: HmrContext) {
      const file = relative(context.server.config.root, context.file);
      // using micromatch to test if the file matches any of the patterns
      const matched = watchManager.findItem(file);
      // if matched, ignore hmr and return
      if (matched) {
        return [];
      }
      // trigger hmr otherwise
      return;
    },
  };
}

export default hmrPlugin;
