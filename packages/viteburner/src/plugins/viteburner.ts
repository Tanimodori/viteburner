import type { UserConfig } from 'vite';
import { loadConfig } from '@/config';
import { logger } from '@/console';
import { EventBus } from '@/services/bus';
import { Session } from '@/services/session';
import type { ResolvedConfig, ResolvedViteBurnerConfig, ViteBurnerInlineConfig, ViteBurnerUserConfig } from '@/types';
import { viteburnerPluginName } from './api';
import type { ViteBurnerPlugin, ViteBurnerPluginApi } from './api';

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

/**
 * The vite plugin: the adapter between vite's hook lifecycle and one session of services.
 *
 * It is created once for the CLI, but the server it is attached to is not: on a config change vite
 * builds the replacement server first and closes the old one afterwards. So the plugin holds no
 * per-server state of its own beyond the session `configureServer` creates, and ties that session's
 * teardown to the dev server that owns it rather than to "the current session".
 *
 * `bus` is the process-wide event bus the CLI keeps; a caller that runs the plugin without a CLI gets
 * a private one, so the plugin still works on its own.
 */
export function viteburnerPlugin(
  inlineConfig: ViteBurnerInlineConfig,
  bus: EventBus = new EventBus(),
): ViteBurnerPlugin {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  // The config the plugin resolved, captured at `configResolved` so `getPluginConfig` can answer
  // without a running server — the commands below all need one, this read does not.
  let pluginConfig: ResolvedViteBurnerConfig | undefined;
  // The services of the dev server currently running. The api is one stable object handed out once,
  // so it routes through this rather than being rebuilt: a caller that kept the api keeps a handle
  // that no-ops while no server is up, instead of reaching into a closed one.
  let session: Session | undefined;

  const api: ViteBurnerPluginApi = {
    getPluginConfig: () => pluginConfig,
    quit: () => session?.core.quit(),
    displayStatus: () => session?.core.displayStatus(),
    fullUpload: () => session?.core.fullUpload(),
    fullDownload: () => session?.core.fullDownload(),
    showRamUsage: () => session?.core.showRamUsage(),
    showRamUsageAll: () => session?.core.showRamUsageAll(),
    showRamUsageGlob: () => session?.core.showRamUsageGlob(),
    showRamUsageLocal: () => session?.core.showRamUsageLocal(),
    showRamUsageRemote: () => session?.core.showRamUsageRemote(),
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
    // Start this server's services. vite calls this per server, and only in serve mode.
    configureServer(devServer) {
      if (!pluginConfig) {
        throw new Error('the viteburner config was not resolved before the dev server was created');
      }
      const created = new Session(devServer, pluginConfig, bus);
      created.start();
      session = created;

      // Teardown belongs to the server that is closing, not to whatever `session` points at: at this
      // point a config-change restart has already run the replacement server's `configureServer`
      // above, so clearing the shared variable would drop the replacement instead of this server.
      const close = devServer.close.bind(devServer);
      devServer.close = async () => {
        try {
          return await close();
        } finally {
          created.dispose();
          if (session === created) {
            session = undefined;
          }
        }
      };
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
