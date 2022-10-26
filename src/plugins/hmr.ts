import { HmrContext, Plugin } from 'vite';
import { relative } from 'path';
import { WatchManager } from './watch';
import { ResolvedConfig } from '@/types';

declare module 'vite' {
  interface ViteDevServer {
    watchManager: WatchManager;
  }
}

export const hmrPluginName = 'viteburner:hmr';

export function hmrPlugin(): Plugin {
  let watchManager: WatchManager;
  return {
    name: hmrPluginName,
    configResolved(config) {
      const { root, viteburner } = config as ResolvedConfig;
      const { watch, ignoreInitial } = viteburner;
      watchManager = new WatchManager(watch, {
        cwd: root,
        persistent: true,
        ignoreInitial,
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
