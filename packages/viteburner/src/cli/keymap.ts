import pc from 'picocolors';
import { logger } from 'vite-plugin-viteburner';
import type { CliApi } from './api';
import { createKeypress, resumeKeypress, startKeypress, suspendKeypress } from './keypress';
import type { KeyInput, Keypress } from './keypress';

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

export function displayWatchAndHelp() {
  logger.info('vite', pc.reset('watching for file changes...'));
  displayKeyHelpHint();
}

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
 * The keys this CLI answers, and what each one does — the single source of truth for the keyboard.
 *
 * The declaration order is the order the help lists them in: `displayHelp` renders this map rather
 * than repeating it, so a key cannot exist in one and be missing from the other. Most entries run an
 * api operation; `h` runs the help itself, which needs no session and so is not on the api. The daemon
 * knows none of this.
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

/**
 * Start the CLI's key reader over `input` (`process.stdin` by default), answering every key through
 * `api`.
 *
 * The CLI's own wiring: the api publishes the operations, the CLI decides that a terminal is being
 * read and which key runs which operation. Starting it before the dev server exists is fine — a key
 * pressed during startup reaches an api with no session and is ignored. The returned reader can be
 * handed to `stopKeypress`.
 */
export function startCliKeys(api: CliApi, input?: KeyInput): Keypress {
  const keypress = createKeypress(input);
  startKeypress(keypress, (key) => dispatchKey(key, api, keypress));
  return keypress;
}

/** Answer one keypress: run the key's operation, then print the hint that ends the turn. */
export async function dispatchKey(key: string, api: CliApi, keypress: Keypress) {
  const action = keyActions[key];
  if (!action) {
    return;
  }
  if (action.interactive) {
    suspendKeypress(keypress);
  }
  try {
    await action.run(api);
  } finally {
    if (action.interactive) {
      resumeKeypress(keypress);
    }
  }
  displayWatchAndHelp();
}
