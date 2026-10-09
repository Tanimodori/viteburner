import type { CliApi } from '../api';
import { displayWatchAndHelp, keyActions } from './mapping';
import { createKeypress, resumeKeypress, startKeypress, suspendKeypress } from './reader';
import type { KeyInput, Keypress } from './reader';

/**
 * The keyboard's wiring: read a key, run what the map says it does, and end the turn.
 *
 * The map (`mapping.ts`) says which key does what; the reader (`reader.ts`) delivers the keys; this
 * joins them to the api. The CLI calls `startCliKeys` once — the plugin the CLI holds never sees a
 * keystroke.
 */

export { displayKeyHelpHint, displayWatchAndHelp } from './mapping';
export type { KeyInput } from './reader';

/**
 * Start the key reader over `input` (`process.stdin` by default), answering every key through `api`.
 *
 * Starting it before the dev server exists is fine — a key pressed during startup reaches an api with
 * no session and is ignored. The returned reader can be handed to `stopKeypress`.
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
