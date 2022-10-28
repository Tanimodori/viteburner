import { Plugin, UserConfig } from 'vite';
import defu from 'defu';
import { loadConfig } from 'unconfig';
import { HmrData, ViteBurnerConfig, ViteBurnerInlineConfig, ViteBurnerServer } from '@/types';
import { resolveConfig } from '@/config/resolve';
import { logger } from '@/console';
import { WsManager, WsAdapter } from '@/ws';
import { resolve } from 'pathe';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { handleKeyInput, hmrPluginName } from '..';
import { WatchManager } from './watch';

export const virtualModuleId = 'virtual:viteburner-entry';

export function getDefaultConfig() {
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
  } as UserConfig;
}

export function viteburnerPlugin(inlineConfig: ViteBurnerInlineConfig): Plugin {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  let server: ViteBurnerServer;

  return {
    name: 'viteburner',
    // Load viteburner.config.xx, merge with config, and resolve
    async config(config) {
      const standalone = await loadConfig<ViteBurnerConfig>({
        sources: [
          {
            files: 'viteburner.config',
            extensions: ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', ''],
          },
        ],
      });
      const conbinedConfig = defu(inlineConfig, standalone.config, config.viteburner);
      return {
        ...getDefaultConfig(),
        ...config,
        viteburner: resolveConfig(conbinedConfig),
      };
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
      // create ws server
      logger.info('ws', 'creating ws server...');
      const wsManager = new WsManager(server.config.viteburner);
      const wsAdapter = new WsAdapter(wsManager, server);

      // create watch
      server.onHmrMessage(wsAdapter.handleHmrMessage);
      const { root, viteburner } = server.config;
      const { watch, ignoreInitial } = viteburner;
      server.watchManager = new WatchManager(watch, {
        cwd: root,
        persistent: true,
        ignoreInitial,
      });
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
  };
}
