import { Plugin, UserConfig, ViteDevServer } from 'vite';
import defu from 'defu';
import { loadConfig } from 'unconfig';
import { ViteBurnerConfig, ViteBurnerInlineConfig } from '@/types';
import { resolveConfig } from '@/config/resolve';

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
  let server: ViteDevServer;

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
      server = _server;
    },
    // main entry
    buildStart() {
      // TODO
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
