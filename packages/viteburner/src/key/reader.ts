import readline from 'readline';
import { logger } from '@viteburner/vite-plugin';

export interface KeyInfo {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/** What one keypress is handed to: the CLI's key map. */
export type KeyHandler = (key: string) => void | Promise<void>;

/**
 * The terminal the reader reads from. It is structural rather than `process.stdin` so a test can hand
 * it a stream of its own; the two members beyond a readable stream are the TTY-only ones, which are
 * absent (and then skipped) on a pipe.
 */
export interface KeyInput extends NodeJS.ReadableStream {
  isTTY?: boolean;
  setRawMode?(mode: boolean): void;
}

/**
 * The reader's state, held by whoever created it rather than by a module or a class.
 *
 * There is no reader object and no service: the functions below are the whole reader, and this state
 * is all they share, so the CLI that creates one (`cli.ts`, through `key/index.ts`) is the only thing
 * that knows the terminal is being read.
 */
export interface Keypress {
  readonly input: KeyInput;
  active: boolean;
  running: boolean;
  rl?: readline.Interface;
  /** The listener attached to the stream, kept so `stopKeypress` detaches exactly this one. */
  listener?: (str: string, key: KeyInfo) => void | Promise<void>;
}

/** A reader over `input` (`process.stdin` by default), not yet attached to it. */
export function createKeypress(input: KeyInput = process.stdin): Keypress {
  return { input, active: false, running: false };
}

/**
 * Attach the reader: from here on every key is handed to `onKey` by name.
 *
 * Calling it on an already-started reader is a no-op, which is what makes it safe to call from a hook
 * that runs once per dev server — a config-change restart reuses the reader along with the plugin
 * instance, and must not end up with two listeners on the same stream.
 */
export function startKeypress(state: Keypress, onKey: KeyHandler) {
  if (state.active) {
    return;
  }
  state.active = true;
  state.listener = async (str: string, key: KeyInfo) => {
    // ctrl+c and ctrl+d are the emergency exit: they end the process before anything else runs, with
    // or without a session. The control bytes are what a TTY in raw mode and a pipe both deliver; the
    // `key` check covers the same chords when readline names them instead. q and escape are not here
    // — they are ordinary shortcuts in the key map, so they stay harmless while no session exists.
    if (str === '\x03' || str === '\x04' || (key && key.ctrl && (key.name === 'c' || key.name === 'd'))) {
      logger.info('sigterm');
      process.exit(1);
    }
    // While suspended, an interactive prompt owns the keyboard. The listener stays attached only so
    // the emergency chords above still work; every other key belongs to the prompt.
    if (!state.rl || state.running) {
      return;
    }
    state.running = true;
    try {
      await onKey(key.name);
    } finally {
      state.running = false;
    }
  };
  // Key press handler may not work on non-tty stdin like Git Bash on Windows.
  if (!state.input.isTTY) {
    logger.warn('current stdin is not a TTY. Keypress events may not work.');
  }
  // Attached for the reader's whole life: `suspendKeypress` only takes the readline interface away,
  // so the listener keeps hearing the emergency chords while a prompt owns the terminal.
  state.input.on('keypress', state.listener);
  resumeKeypress(state);
}

export function stopKeypress(state: Keypress) {
  state.active = false;
  suspendKeypress(state);
  if (state.listener) {
    state.input.off('keypress', state.listener);
    state.listener = undefined;
  }
}

/**
 * Let go of the terminal, so a command that needs it for itself (an interactive prompt) can have it.
 * The keypress listener stays attached, but `state.rl` being undefined makes it ignore everything
 * except ctrl+c/ctrl+d — those must still terminate the process while a prompt is open.
 */
export function suspendKeypress(state: Keypress) {
  state.rl?.close();
  state.rl = undefined;
  if (state.input.isTTY) {
    state.input.setRawMode?.(false);
  }
}

/** Take the terminal back after {@link suspendKeypress}. */
export function resumeKeypress(state: Keypress) {
  if (!state.active || !state.listener) {
    return;
  }
  state.rl?.close();
  state.rl = readline.createInterface({ input: state.input });
  readline.emitKeypressEvents(state.input, state.rl);
  if (state.input.isTTY) {
    state.input.setRawMode?.(true);
  }
}
