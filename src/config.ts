import { loadConfig as loadConfigRaw } from 'unconfig';
import { UserConfig } from 'vite';
import { HmrOptions } from './plugins/hmr';

export interface ViteBurnerUserConfig extends HmrOptions {
  sourcemap?: boolean | 'inline' | 'hidden';
  port?: number;
  timeout?: number;
  dts?: string | boolean;
  ignoreInitial?: boolean;
  download?: {
    server?: string | string[];
    location?: (file: string, server: string) => string | null | undefined;
    ignoreTs?: boolean;
    ignoreSourcemap?: boolean;
  };
  dumpFiles?: string | null | undefined | ((file: string) => string | null | undefined);
}

export interface ViteBurnerViteConfig extends UserConfig {
  viteburner?: ViteBurnerConfig;
}
export interface ViteBurnerInlineConfig {
  cwd: string;
  port?: number;
}

export interface ViteBurnerConfig extends ViteBurnerUserConfig, ViteBurnerInlineConfig {}

declare module 'vite' {
  interface UserConfig {
    viteburner?: ViteBurnerConfig;
  }
}

export function defineConfig(config: ViteBurnerViteConfig): ViteBurnerViteConfig {
  return config;
}

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
