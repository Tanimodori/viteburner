import { resolve } from 'pathe';
import { UserConfig } from 'vite';
import { logger } from '@/console';
import {
  HmrData,
  ResolvedConfig,
  ResolvedViteBurnerConfig,
  ViteBurnerInlineConfig,
  ViteBurnerServer,
  ViteBurnerUserConfig,
} from '@/types';
import { WsManager, WsAdapter } from '@/ws';
import { loadConfig, normalizeRequestId, slash } from '..';
import { ViteBurnerPlugin, ViteBurnerPluginApi, ViteBurnerPluginCommands, viteburnerPluginName } from './api';
import { createApi } from './commands';
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

export function viteburnerPlugin(inlineConfig: ViteBurnerInlineConfig): ViteBurnerPlugin {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  let server: ViteBurnerServer;
  let wsAdapter: WsAdapter;
  let commands: ViteBurnerPluginCommands | undefined;
  // The config the plugin resolved, captured at `configResolved` so `getPluginConfig` can answer
  // without a running server — the commands below all need one, this read does not.
  let pluginConfig: ResolvedViteBurnerConfig | undefined;
  // The api is one stable object handed out once: a command needs the dev server, so the commands
  // behind it exist only between `buildStart` and `buildEnd`, and a caller that kept the api keeps a
  // handle that no-ops rather than reaching into a closed server.
  const api: ViteBurnerPluginApi = {
    getPluginConfig: () => pluginConfig,
    quit: () => commands?.quit(),
    displayStatus: () => commands?.displayStatus(),
    fullUpload: () => commands?.fullUpload(),
    fullDownload: () => commands?.fullDownload(),
    showRamUsage: () => commands?.showRamUsage(),
    showRamUsageAll: () => commands?.showRamUsageAll(),
    showRamUsageGlob: () => commands?.showRamUsageGlob(),
    showRamUsageLocal: () => commands?.showRamUsageLocal(),
    showRamUsageRemote: () => commands?.showRamUsageRemote(),
  };

  return {
    name: viteburnerPluginName,
    api,
    apply: 'serve',
    // Load viteburner.config.xx, merge with config, and resolve
    async config(config: ViteBurnerUserConfig) {
      logger.info('config', 'resolving user config...');
      config.viteburner = await loadConfig(inlineConfig);
      return getDefaultConfig();
    },
    configResolved(config) {
      pluginConfig = (config as unknown as ResolvedConfig).viteburner;
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
      const { watch, ignoreInitial, port, timeout, usePolling, pollingOptions } = viteburner;
      server.watchManager = new WatchManager(watch, {
        cwd: root,
        persistent: true,
        ignoreInitial,
        usePolling: !!usePolling,
        ...pollingOptions,
      });

      // create ws server
      logger.info('ws', 'creating ws server...');
      const wsManager = new WsManager({ port, timeout, logger });
      wsAdapter = new WsAdapter(wsManager, server);

      // handle hmr
      server.onHmrMessage((data) => wsAdapter.handleHmrMessage(data));
      server.watchManager.init();

      // create the commands the api runs
      commands = createApi(wsAdapter);
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
      commands = undefined;
    },
  };
}
