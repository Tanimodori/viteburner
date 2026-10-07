import type { Plugin, ResolvedConfig } from 'vite';
import type { ResolvedViteBurnerConfig } from '@/types';

/** The name the plugin registers under, and the key `findViteBurnerPlugin` looks it up by. */
export const viteburnerPluginName = 'viteburner';

/** The daemon's state, as data for a caller to render however it likes. */
export interface ViteBurnerStatus {
  /** Whether the game is the active client of the websocket port. */
  connected: boolean;
  /** The port the game connects to. */
  port: number;
  /** How many watched files are waiting to sync. */
  pending: number;
}

/**
 * What the plugin can be asked to do, one method per capability.
 *
 * This is the plugin's whole public surface: a caller holding only the resolved config — the CLI, a
 * test, another plugin — asks for an operation through the plugin object instead of through the dev
 * server's websocket.
 *
 * Nothing here names an input, a prompt, or a terminal: which key asks for which operation, what to
 * ask the player first, and how to render the answer are the caller's business. An operation needs a
 * running dev server, so these answer only while the plugin's session is up — from the
 * `configureServer` that starts it until that dev server is closed; outside that window each one is a
 * no-op.
 */
export interface ViteBurnerPluginApi {
  /** Tear the running session's services down, without ending the process. */
  dispose(): void;
  /** The daemon's state, or `undefined` while no session is running. */
  getStatus(): ViteBurnerStatus | undefined;
  /** Send every watched file to the game again, as if each one had just changed. */
  fullUpload(): void;
  /** Pull every watched file back from the game. */
  fullDownload(): void;
  /** Report the RAM cost of every local script. */
  showRamUsageAll(): void | Promise<unknown>;
  /** Report the RAM cost of every script matching a glob. */
  showRamUsageGlob(pattern: string): void | Promise<unknown>;
  /** Report the RAM cost of one local script. */
  showRamUsageLocal(file: string): void | Promise<unknown>;
  /** Report the RAM cost of one script on a named server. */
  showRamUsageRemote(server: string, filename: string): void | Promise<unknown>;
  /** The local scripts that have a RAM cost — the choices to offer for {@link showRamUsageLocal}. */
  getRamUsageLocalFiles(): Promise<string[]>;
  /** The filenames on a server, or `null` if the game could not be asked — the choices for {@link showRamUsageRemote}. */
  getFileNames(server: string): Promise<string[] | null>;
  /**
   * The viteburner config this dev server resolved, the same object on `resolvedConfig.viteburner`.
   *
   * A read of config the plugin already resolved, so unlike the operations it answers as soon as
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
