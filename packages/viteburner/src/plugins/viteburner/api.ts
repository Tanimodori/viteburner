import type { Plugin, ResolvedConfig } from 'vite';
import type { Session } from '@/services/session';
import type { ResolvedViteBurnerConfig } from '@/types';

/** The name the plugin registers under, and the key `findViteBurnerPlugin` looks it up by. */
export const viteburnerPluginName = 'viteburner';

/**
 * What the plugin itself can be asked for: the config it resolved, and the session of the dev server
 * that is currently up.
 *
 * These are the two things the plugin owns rather than a running server — the config is captured at
 * `configResolved`, the session is whatever `configureServer` created — so they are all the plugin
 * answers. Every operation a caller wants is done on the session it gets back: its services
 * (`session.sync`, `session.ws`, ...), its own `getStatus`, and its `dispose`.
 *
 * Nothing here names an input, a prompt, or a terminal: which key asks for which operation, what to
 * ask the player first, and how to render the answer are the caller's business.
 */
export interface ViteBurnerPluginApi {
  /**
   * The services of the dev server currently running, or `undefined` while none is.
   *
   * A session is not stable across a config-change restart — vite builds the replacement server
   * before closing the old one — so this re-reads the current one rather than caching it: a caller
   * holding the plugin always reaches the session that is live now.
   */
  getSession(): Session | undefined;
  /**
   * The viteburner config this dev server resolved, the same object on `resolvedConfig.viteburner`.
   *
   * A read of config the plugin already resolved, so unlike the session it answers as soon as
   * `configResolved` has run and needs no dev server.
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
