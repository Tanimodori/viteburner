import pc from 'picocolors';
import { logger } from 'vite-plugin-viteburner';
import { createKeypress, resumeKeypress, startKeypress, suspendKeypress } from './keypress';
import type { KeyInput, Keypress } from './keypress';
import type { CliPluginApi } from './types';

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
  run(api: CliPluginApi): void | Promise<unknown>;
  /**
   * The action keeps the terminal for itself — it opens a prompt that reads stdin — so the key reader
   * has to let go of it first.
   */
  interactive?: boolean;
}

/** The keys this CLI answers, and the api operation each one runs. The plugin knows none of them. */
export const keyActions: Record<string, KeyAction> = {
  q: { run: (api) => api.quit() },
  s: { run: (api) => api.displayStatus() },
  h: { run: (api) => api.displayHelp() },
  u: { run: (api) => api.fullUpload() },
  d: { run: (api) => api.fullDownload() },
  r: { run: (api) => api.displayRamUsage(), interactive: true },
};

/**
 * Start the CLI's key reader over `input` (`process.stdin` by default), answering every key through
 * `api`.
 *
 * This is the CLI's own wiring, not the plugin's: the plugin publishes the operations, the CLI
 * decides that a terminal is being read and which key runs which operation. Starting it before the
 * dev server exists is fine — a key pressed during startup reaches an api with no session and is
 * ignored. The returned reader can be handed to `stopKeypress`.
 */
export function startCliKeys(api: CliPluginApi, input?: KeyInput): Keypress {
  const keypress = createKeypress(input);
  startKeypress(keypress, (key) => dispatchKey(key, api, keypress));
  return keypress;
}

/** Answer one keypress: run the key's operation, then print the hint that ends the turn. */
export async function dispatchKey(key: string, api: CliPluginApi, keypress: Keypress) {
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
