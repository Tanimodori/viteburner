import type { Plugin } from 'vite';
import { logger } from '@/console';
import { findViteBurnerPlugin } from '@/plugins/viteburner/api';
import type { ViteBurnerPlugin } from '@/plugins/viteburner/api';
import { createKeypress, startKeypress } from './keypress';
import type { KeyInput } from './keypress';
import { dispatchKey } from './keys';

/** The name this plugin registers under, so vite can tell it apart from the daemon plugin. */
export const cliPluginName = 'viteburner:cli';

export interface CliPluginOptions {
  /** The terminal the keys are read from; `process.stdin` unless a test supplies its own. */
  input?: KeyInput;
}

/**
 * The CLI's control plane, as a vite plugin: the player's keys, and nothing else.
 *
 * The CLI adds this plugin next to the viteburner one, which is what keeps the daemon plugin free of
 * any notion of a keyboard, a prompt, or a terminal. A key is answered by looking the viteburner
 * plugin up in the resolved config and running the command that key names — the key map and the
 * commands themselves are the CLI's (`keys.ts`, `commands.ts`), and the daemon plugin knows none of
 * them.
 *
 * A config-change restart reuses this plugin instance (vite re-resolves the CLI's inline config), so
 * the reader is created once and `configResolved` only re-points it at the plugin of the config that
 * is now current; the reader outlives the dev server the same way stdin does.
 *
 * Adding this plugin to a config that is not the CLI's would put the CLI's keys on that dev server's
 * terminal — including the force-exit on esc/ctrl+c — and fight vite's own key shortcuts for stdin.
 */
export function cliPlugin(options: CliPluginOptions = {}): Plugin {
  // The viteburner plugin of the config that is currently resolved, and so the api a key answers to.
  let plugin: ViteBurnerPlugin | undefined;
  const keypress = createKeypress(options.input);

  return {
    name: cliPluginName,
    apply: 'serve',
    configResolved(config) {
      plugin = findViteBurnerPlugin(config);
    },
    configureServer() {
      const found = plugin;
      if (!found) {
        // This plugin in a config that has no viteburner plugin is not a viteburner CLI config: say
        // so and leave the terminal alone, rather than take down a dev server over a missing peer.
        logger.warn('cli', 'the viteburner plugin is not part of this config: keys are not answered');
        return;
      }
      startKeypress(keypress, (key) => dispatchKey(key, found.api, keypress));
    },
  };
}

export { displayStatus } from './commands';
export { displayKeyHelpHint, displayWatchAndHelp } from './keys';
export type { KeyInput } from './keypress';
