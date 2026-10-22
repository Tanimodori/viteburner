import { loadConfig as loadConfigRaw } from 'unconfig';
import type { ConfigEnv, UserConfig } from 'vite';
import type { ViteBurnerConfig, ViteBurnerConfigExport, ViteBurnerInlineConfig, ViteBurnerUserConfig } from '@/types';
import { resolveConfig } from './resolve';

/** TypeScript helper to define your config */
export function defineConfig(config: ViteBurnerUserConfig): UserConfig {
  return config;
}

/**
 * Resolve the viteburner config for one vite server.
 *
 * `userConfig` is the config vite has already loaded — the argument of the plugin's `config` hook.
 * Reading the `viteburner` key and `build.sourcemap` from it, rather than loading `vite.config.*` a
 * second time with unconfig, is what keeps a function config from being called twice (and without
 * vite's `{ command, mode }` arguments). unconfig is left with the standalone `viteburner.config.*`
 * file, whose existence vite does not know about.
 *
 * A standalone file may export either the config object or a function receiving vite's `ConfigEnv`.
 * unconfig only imports the file, so the source's `rewrite` invokes that function with the same
 * `env` vite used for this server. When `loadConfig` is called outside vite, `env` defaults to a
 * serve/development run.
 *
 * Precedence, highest first: the CLI's inline options, the standalone `viteburner.config.*`, the
 * `viteburner` key in `vite.config.*`, and `build.sourcemap` as the sourcemap default. `defaults`
 * carries the lowest two into unconfig, so its deep merge keeps the same order the old two-source
 * load produced (the standalone file won, then the inline options were spread last).
 */
export async function loadConfig(
  inlineConfig: ViteBurnerInlineConfig,
  userConfig: ViteBurnerUserConfig = {},
  env: ConfigEnv = { command: 'serve', mode: 'development' },
) {
  const sourcemap = userConfig.build?.sourcemap;
  const { config: standalone } = await loadConfigRaw<ViteBurnerConfig>({
    sources: [
      {
        files: 'viteburner.config',
        extensions: ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', ''],
        async rewrite<T>(config: T) {
          // unconfig types `rewrite` generically over the imported value; narrow it to the export
          // shape a standalone config file is expected to have.
          const value = config as ViteBurnerConfigExport | null | undefined;
          const resolved = typeof value === 'function' ? await value(env) : value;
          return resolved ?? undefined;
        },
      },
    ],
    defaults: {
      ...(sourcemap && { sourcemap }),
      ...userConfig.viteburner,
    },
    cwd: inlineConfig.cwd ?? process.cwd(),
    merge: true,
  });
  return resolveConfig({
    ...standalone,
    ...inlineConfig,
  });
}
