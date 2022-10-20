import { loadConfig as loadConfigRaw } from 'unconfig';

import { UserConfig } from 'vite';
import { HmrOptions } from './plugins/hmr';

export interface ViteBurnerUserConfig extends HmrOptions {
  sourcemap?: boolean | 'inline' | 'hidden';
  port?: number;
  timeout?: number;
}

export interface ViteBurnerViteConfig extends UserConfig {
  viteburner?: ViteBurnerConfig;
}

export interface ViteBurnerInlineConfig {
  cwd: string;
  port?: number;
}

export interface ViteBurnerConfig extends ViteBurnerUserConfig, ViteBurnerInlineConfig {}

export async function loadConfig(inlineConfig: ViteBurnerInlineConfig) {
  const { config } = await loadConfigRaw<ViteBurnerUserConfig>({
    sources: [
      // load from `viteburner.config.xx`
      {
        files: 'viteburner.config',
        extensions: ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', ''],
      },
      // load inline config from `vite.config`
      {
        files: 'vite.config',
        async rewrite(config) {
          const resolvedConfig = await (typeof config === 'function' ? config() : config);
          const sourcemap = resolvedConfig?.build?.sourcemap;
          return {
            ...(sourcemap && { sourcemap }),
            ...resolvedConfig?.viteburner,
          };
        },
      },
    ],
    cwd: inlineConfig.cwd,
    merge: true,
  });
  return {
    ...config,
    ...inlineConfig,
  } as ViteBurnerConfig;
}
