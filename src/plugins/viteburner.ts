import { Plugin, UserConfig } from 'vite';
import { HmrData, ViteBurnerInlineConfig, ViteBurnerServer } from '@/types';
import { logger } from '@/console';
import { WsManager, WsAdapter } from '@/ws';
import { resolve } from 'pathe';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { handleKeyInput, loadConfig } from '..';
import { WatchManager } from './watch';

declare module 'vite' {
  interface ViteDevServer {
    watchManager: WatchManager;
  }
}

export const hmrPluginName = 'viteburner:hmr';
export const virtualModuleId = 'virtual:viteburner-entry';

export function getDefaultConfig(): UserConfig {
  return {
    mode: 'development',
    optimizeDeps: { disabled: true },
    clearScreen: false,
    build: {
      lib: {
        /**
         * Meaningless for Vite<3.2.0
         * @see {@link https://github.com/vitejs/vite/discussions/1736}
         */
        entry: virtualModuleId,
        formats: ['es'],
      },
    },
    server: { middlewareMode: true },
  };
}

export function viteburnerPlugin(inlineConfig: ViteBurnerInlineConfig): Plugin {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  let server: ViteBurnerServer;
  let wsAdapter: WsAdapter;

  return {
    name: 'viteburner',
    // Load viteburner.config.xx, merge with config, and resolve
    async config(config) {
      logger.info('config', 'resolving user config...');
      config.viteburner = await loadConfig(inlineConfig);
      return getDefaultConfig();
    },
    configResolved() {
      logger.info('config', 'config resolved');
    },
    // save server instance
    configureServer(_server) {
      server = {
        ..._server,
        pathToId(file: string) {
          const id = `/@fs/${slash(resolve(server.config.root, file))}`;
          return normalizeRequestId(id, server.config.base);
        },
        async invalidateFile(file: string) {
          const id = server.pathToId(file);
          const module = await server.moduleGraph.getModuleByUrl(id);
          if (module) {
            server.moduleGraph.invalidateModule(module);
          }
        },
        async fetchModule(file: string) {
          const id = server.pathToId(file);
          return server.transformRequest(id);
        },
        onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void) {
          server.watchManager.emitter.on(hmrPluginName, (data: HmrData) => handler(data, server));
        },
        async buildStart() {
          return server.pluginContainer.buildStart({});
        },
      } as ViteBurnerServer;
    },
    // main entry
    buildStart() {
      // create watch
      logger.info('watch', 'creating a watcher...');
      const { root, viteburner } = server.config;
      const { watch, ignoreInitial, port, timeout } = viteburner;
      server.watchManager = new WatchManager(watch, {
        cwd: root,
        persistent: true,
        ignoreInitial,
      });

      // create ws server
      logger.info('ws', 'creating ws server...');
      const wsManager = new WsManager({ port, timeout });
      wsAdapter = new WsAdapter(wsManager, server);

      // handle hmr
      server.onHmrMessage((data) => wsAdapter.handleHmrMessage(data));
      server.watchManager.init();

      // create key handler
      handleKeyInput(wsAdapter);
    },
    // virtual entry
    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        return `export {}`;
      }
    },
    // exit
    buildEnd() {
      server.watchManager.close();
      wsAdapter.manager.close();
    },
  };
}
