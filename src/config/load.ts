import { loadConfig as loadConfigRaw } from 'unconfig';
import { UserConfig } from 'vite';
import { resolveConfig } from './resolve';

/**
 * Destinations for the transformed files.
 */
export type RenameOutputObject = {
  /**
   * The destination path with no starting slash.
   * If not provided, the starting `src/` will be removed and `.ts` will be replaced with `.js`.
   */
  filename?: string;
  /**
   * The destination server.
   * @default 'home'
   */
  server?: string;
};
export type RenameOutput = string | RenameOutputObject | Array<string | RenameOutputObject> | null | undefined;

export interface WatchItem {
  /**
   * Glob pattern to match.
   * See {@link https://github.com/micromatch/micromatch micromatch} for more details.
   */
  pattern: string;
  /**
   * Set to `true` to use `vite`'s plugins to transform the file.
   */
  transform?: boolean;
  /**
   * Set to a string to specify the server of output file.
   * Set to a {@link RenameOutputObject} to specify the output filename and server.
   * Set to a function to specify dynamically, the `file` param has no starting slash.
   * Set to or returns an array to specify multiple outputs.
   */
  location?: RenameOutput | ((file: string) => RenameOutput);
}

/**
 * User config defined in `viteburner.config`.
 */
export interface ViteBurnerConfig {
  /**
   * watch options
   */
  watch?: WatchItem[];
  /**
   * If set to `inline`, sourcemap will be embedded into transformed js files.
   * If not set, use `build.sourcemap` from `vite` config.
   */
  sourcemap?: boolean | 'inline' | 'hidden';
  /**
   * The port that WebSocket server listens to.
   * @default 12525
   */
  port?: number;
  /**
   * The timeout for WebSocket server in ms.
   * @default 10000
   */
  timeout?: number;
  /**
   * The path to the file that contains bitburner type definitions.
   * Set to `true` to use the default filename.
   * Set to `false` to disable syncing type definitions from bitburner server.
   * @default 'NetScriptDefinition.d.ts'
   */
  dts?: string | boolean;
  /**
   * Set to `true` to disable initial sync action on startup.
   * @default false
   */
  ignoreInitial?: boolean;
  /**
   * Manual download configs.
   */
  download?: {
    /**
     * servers to download from.
     * @default "home"
     */
    server?: string | string[];
    /**
     * Rewrite the path of the downloaded file.
     * The `file` param contains no starting slash.
     * Return `null` or `undefined` to skip downloading the file.
     * @default (file) => 'src/' + file;
     */
    location?: (file: string, server: string) => string | null | undefined;
    /**
     * If set to `true`, check if the destination contains a `.ts` file with the same basename.
     * If so, skip downloading the file.
     *
     * For example. If the destination contains a file named `template.ts`,
     * the file `template.js` will not be downloaded.
     *
     * @default true
     */
    ignoreTs?: boolean;
    /**
     * If set to `true`, skip downloading files that have a tailing inline sourcemap.
     * @default true
     */
    ignoreSourcemap?: boolean;
  };
  /**
   * Dump destination of `*.js` files transformed by `vite`.
   * Set to `null` or `undefined` to disable dumping.
   * Set to a string to dump to a specific directory.
   * Set to a function that dynamically decides the destination filepath.
   * If the function returns `null` or `undefined`, the file will not be dumped.
   * @default undefined
   */
  dumpFiles?: string | null | undefined | ((file: string, server: string) => string | null | undefined);
  /** current working dir */
  cwd?: string;
}

export type ViteBurnerInlineConfig = Pick<ViteBurnerConfig, 'port' | 'cwd'>;

/**
 * User config defined in `vite.config`.
 */
export interface ViteBurnerUserConfig extends UserConfig {
  /** viteburner related configs */
  viteburner?: ViteBurnerConfig;
}

/** TypeScript helper to define your config */
export function defineConfig(config: ViteBurnerUserConfig): ViteBurnerUserConfig {
  return config;
}

export type Promisable<T> = T | Promise<T>;
export type Functionable<T> = T | (() => T);
export type ViteBurnerUserConfigInput = Functionable<Promisable<ViteBurnerUserConfig>>;

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
    cwd: inlineConfig.cwd,
    merge: true,
  });
  return resolveConfig({
    ...config,
    ...inlineConfig,
  });
}
