import { logger } from '@viteburner/vite-plugin';
import pc from 'picocolors';
import type { CliApi } from '../api';

/**
 * The keys this CLI answers: the map, and the help and hint that describe it.
 *
 * This is the keyboard's single source of truth for which keys exist — `displayHelp` renders the map
 * rather than repeating it, so a key cannot exist in one and be missing from the other. How a key is
 * answered (reading it, and letting go of the terminal for the ones that prompt) is `key/index.ts`.
 */

export interface KeyAction {
  /** What the key does, as `displayHelp` lists it. */
  description: string;
  run(api: CliApi): void | Promise<unknown>;
  /**
   * The action keeps the terminal for itself — it opens a prompt that reads stdin — so the key reader
   * has to let go of it first.
   */
  interactive?: boolean;
}

/**
 * The keys this CLI answers, and what each one does. The declaration order is the order the help lists
 * them in. Most entries run an api operation; `h` runs the help itself, which needs no session and so
 * is not on the api. The daemon knows none of this.
 */
export const keyActions: Record<string, KeyAction> = {
  u: { description: 'upload all files', run: (api) => api.fullUpload() },
  d: { description: 'download all files', run: (api) => api.fullDownload() },
  s: { description: 'show status', run: (api) => api.displayStatus() },
  r: { description: 'show RAM usage of scripts', run: (api) => api.displayRamUsage(), interactive: true },
  h: { description: 'show help', run: displayHelp },
  q: { description: 'quit', run: (api) => api.quit() },
};

/** The keys this CLI answers, rendered from the map above. */
export function displayHelp() {
  logger.info('help');
  logger.info('help', pc.reset(pc.bold('Watch Usage')));
  for (const [key, action] of Object.entries(keyActions)) {
    logger.info('help', `press ${pc.reset(pc.bold(key))}${pc.dim(' to ')}${action.description}`);
  }
  logger.info('help', pc.dim('')); // avoid (x2)
}

/** The one-line hint under the "watching" banner, naming the two keys worth pointing at. */
export function displayKeyHelpHint() {
  logger.info(
    'help',
    pc.dim('press ') +
      pc.reset(pc.bold('h')) +
      pc.dim(' to show help, press ') +
      pc.reset(pc.bold('q')) +
      pc.dim(' to exit'),
  );
}

/** The banner that ends a turn: the watcher is running, and these are the keys. */
export function displayWatchAndHelp() {
  logger.info('vite', pc.reset('watching for file changes...'));
  displayKeyHelpHint();
}
