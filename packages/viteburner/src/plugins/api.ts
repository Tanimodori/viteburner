import type { Plugin, ResolvedConfig } from 'vite';
import type { ResolvedViteBurnerConfig } from '@/types';

/** The name the plugin registers under, and the key `findViteBurnerPlugin` looks it up by. */
export const viteburnerPluginName = 'viteburner';

/**
 * The commands the plugin runs against a live dev server.
 *
 * Nothing here names an input: which key, click, or request asks for which command is the caller's
 * business. A command needs a running dev server, so these answer only between the plugin's
 * `buildStart` and `buildEnd`; outside that window each one is a no-op.
 */
export interface ViteBurnerPluginCommands {
  /** Stop the daemon. */
  quit(): void;
  /** Print the game connection state and how many files are waiting to sync. */
  displayStatus(): void;
  /** Send every watched file to the game again, as if each one had just changed. */
  fullUpload(): void;
  /** Pull every watched file back from the game. */
  fullDownload(): void;
  /** Ask which RAM scope to report, then report the chosen scope. */
  showRamUsage(): void | Promise<unknown>;
  /** Report the RAM cost of every local script. */
  showRamUsageAll(): void | Promise<unknown>;
  /** Report the RAM cost of every script matching a typed glob. */
  showRamUsageGlob(): void | Promise<unknown>;
  /** Pick one local script and report its RAM cost. */
  showRamUsageLocal(): void | Promise<unknown>;
  /** Pick one script on a named server and report its RAM cost. */
  showRamUsageRemote(): void | Promise<unknown>;
}

/**
 * What the plugin can be asked to do, one method per capability.
 *
 * This is the plugin's whole public surface: a caller holding only the resolved config — the CLI, a
 * test, another plugin — asks for a command through the plugin object instead of through the dev
 * server's websocket.
 */
export interface ViteBurnerPluginApi extends ViteBurnerPluginCommands {
  /**
   * The viteburner config this dev server resolved, the same object on `resolvedConfig.viteburner`.
   *
   * A read of config the plugin already resolved, so unlike the commands it answers as soon as
   * `configResolved` has run and needs no watcher.
   */
  getPluginConfig(): ResolvedViteBurnerConfig | undefined;
}

export interface ViteBurnerPlugin extends Plugin {
  name: typeof viteburnerPluginName;
  api: ViteBurnerPluginApi;
}

/** The viteburner plugin among a resolved config's plugins, for callers that hold only the config. */
export function findViteBurnerPlugin(config: ResolvedConfig): ViteBurnerPlugin | undefined {
  return config.plugins.find((plugin) => plugin.name === viteburnerPluginName) as ViteBurnerPlugin | undefined;
}
