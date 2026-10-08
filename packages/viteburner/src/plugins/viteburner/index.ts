import type { UserConfig } from 'vite';
import { loadConfig } from '@/config';
import { logger } from '@/console';
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
 * The plugin's own api is only the two reads that are not the session's: the resolved config, and the
 * session itself. Everything a caller does is done on the session it gets from `getSession()` — see
 * `plugins/cli` for the CLI's use of it.
 *
 * The event bus the services publish their external events on belongs to the session that owns them
 * (see `Session.events`), not to this plugin: it is the daemon's ingress, not an interface the CLI or
 * any other caller reaches into. Which key asks for which operation is decided by the CLI that adds
 * this plugin — see `plugins/cli`.
 */
export function viteburnerPlugin(inlineConfig: ViteBurnerInlineConfig): ViteBurnerPlugin {
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  // The config the plugin resolved, captured at `configResolved` so `getPluginConfig` can answer
  // without a running server — the session needs one, this read does not.
  let pluginConfig: ResolvedViteBurnerConfig | undefined;
  // The services of the dev server currently running, or undefined between servers. `getSession`
  // reads this rather than caching it, so a caller that holds the plugin reaches the session that is
  // live now instead of a closed one.
  let session: Session | undefined;

  const api: ViteBurnerPluginApi = {
    getSession: () => session,
    getPluginConfig: () => pluginConfig,
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
      const created = new Session(devServer, pluginConfig);
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
