import { findViteBurnerPlugin, logger } from 'vite-plugin-viteburner';
import type { ViteBurnerPlugin } from 'vite-plugin-viteburner';
import { createCliApi } from './api';
import { cliPluginName } from './types';
import type { CliPlugin } from './types';

/**
 * The CLI's control plane, as a vite plugin: the CLI's commands, published on its api.
 *
 * The plugin adds itself next to the daemon plugin (`vite-plugin-viteburner`) and looks that plugin up
 * in the resolved config to reach its session — the api's operations answer on whichever session is
 * live. The CLI that adds this plugin is the only caller: it holds the plugin instance and calls
 * `api`, and it reads the player's keys itself, so the daemon plugin never learns what a keystroke is
 * and this plugin never sees one — see `cli.ts` and `keys.ts`.
 *
 * A config-change restart re-resolves this plugin instance and re-runs `configResolved`, so the
 * daemon plugin the api reads is re-pointed at the config that is now current; the session it answers
 * on is re-read per call, so a caller always reaches the one that is live now.
 */
export function cliPlugin(): CliPlugin {
  // The daemon plugin of the config that is currently resolved, and so the session the api answers on.
  let plugin: ViteBurnerPlugin | undefined;

  const api = createCliApi(() => plugin?.api.getSession());

  return {
    name: cliPluginName,
    api,
    apply: 'serve',
    configResolved(config) {
      plugin = findViteBurnerPlugin(config);
      if (!plugin) {
        // This plugin in a config that has no daemon plugin is not a viteburner CLI config: say so and
        // leave the server alone, rather than take down a dev server over a missing peer.
        logger.warn('cli', 'the viteburner plugin is not part of this config: the cli api will not answer');
      }
    },
  };
}

export { cliPluginName } from './types';
export type { CliPlugin, CliPluginApi } from './types';
export { displayKeyHelpHint, displayWatchAndHelp, startCliKeys } from './keys';
export type { KeyInput } from './keypress';
