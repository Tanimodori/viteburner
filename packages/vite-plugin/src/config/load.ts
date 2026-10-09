import { loadConfig as loadConfigRaw } from 'unconfig';
import type { UserConfig } from 'vite';
import type { ViteBurnerInlineConfig, ViteBurnerUserConfig } from '@/types';
import { resolveConfig } from './resolve';

/** TypeScript helper to define your config */
export function defineConfig(config: ViteBurnerUserConfig): UserConfig {
  return config;
}

export type Promisable<T> = T | Promise<T>;
export type Functionable<T> = T | (() => T);
export type ViteBurnerUserConfigInput = Functionable<Promisable<UserConfig>>;

export async function loadConfig(inlineConfig: ViteBurnerInlineConfig) {
  const { config } = await loadConfigRaw<UserConfig>({
    sources: [
      // load from `viteburner.config.xx`
      {
        files: 'viteburner.config',
        extensions: ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', ''],
      },
      // load inline config from `vite.config`
      {
        files: 'vite.config',
        async rewrite<ViteBurnerUserConfigInput>(config: ViteBurnerUserConfigInput) {
          const resolvedConfig = await (typeof config === 'function' ? config() : config);
          const sourcemap = resolvedConfig?.build?.sourcemap;
          return {
            ...(sourcemap && { sourcemap }),
            ...resolvedConfig?.viteburner,
          };
        },
      },
    ],
    cwd: inlineConfig.cwd ?? process.cwd(),
    merge: true,
  });
  return resolveConfig({
    ...config,
    ...inlineConfig,
  });
}
