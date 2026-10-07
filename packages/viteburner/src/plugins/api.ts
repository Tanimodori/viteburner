import type { Plugin, ResolvedConfig } from 'vite';

/** The name the plugin registers under, and the key `findViteBurnerPlugin` looks it up by. */
export const viteburnerPluginName = 'viteburner';

/**
 * What the plugin can be asked to do, one method per capability.
 *
 * This is the plugin's whole public surface: a caller holding only the resolved config — the CLI, a
 * test, another plugin — asks for a command through the plugin object instead of through the dev
 * server's websocket. Nothing here names an input: which key, click, or request asks for which
 * command is the caller's business.
 *
 * A command needs a running dev server, so the api answers only between the plugin's `buildStart`
 * and `buildEnd`; outside that window every method is a no-op.
 */
export interface ViteBurnerPluginApi {
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

export interface ViteBurnerPlugin extends Plugin {
  name: typeof viteburnerPluginName;
  api: ViteBurnerPluginApi;
}

/** The viteburner plugin among a resolved config's plugins, for callers that hold only the config. */
export function findViteBurnerPlugin(config: ResolvedConfig): ViteBurnerPlugin | undefined {
  return config.plugins.find((plugin) => plugin.name === viteburnerPluginName) as ViteBurnerPlugin | undefined;
}
