import pc from 'picocolors';
import readline from 'readline';

export const prefix = '[viteburner]';

import { createLogger as createLoggerRaw } from 'vite';

export function formatNormal(first = '', second = '', third = '') {
  const parts = [];
  first && parts.push(pc.green(first));
  second && parts.push(pc.dim(second));
  third && parts.push(third);
  return parts.join(' ');
}

export function formatWarn(msg: string) {
  return pc.yellow(`${msg}`);
}

export function formatError(msg: string) {
  return pc.red(`${msg}`);
}

export function createLogger() {
  const logger = {
    base: createLoggerRaw('info', { prefix, allowClearScreen: false }),
    info: (...msg: string[]) => logger.base.info(formatNormal(...msg), { timestamp: true, clear: false }),
    warn: (...msg: string[]) => logger.base.warn(formatWarn(msg.join(' ')), { timestamp: true, clear: false }),
    error: (...msg: string[]) => logger.base.error(formatError(msg.join(' ')), { timestamp: true, clear: false }),
  };
  return logger;
}

export const logger = createLogger();

export interface KeyInfo {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface KeyHandlerContext {
  str: string;
  key: KeyInfo;
  on(): void;
  off(): void;
}

export type KeypressHandler = (ctx: KeyHandlerContext) => void | Promise<void>;

export interface KeypressHandlerControl {
  on(): void;
  off(): void;
  running: () => boolean;
}

// source: https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/stdin.ts
// MIT License
export function onKeypress(handler: KeypressHandler) {
  //  Key press handler may not work on non-tty stdin like Git Bash on Windows.
  if (!process.stdin.isTTY) {
    logger.warn('current stdin is not a TTY. Keypress events may not work.');
  }

  let running = false;
  async function callback(str: string, key: KeyInfo) {
    // esc, ctrl+d or ctrl+c to force exit
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c')) {
      logger.info('sigterm');
      process.exit(1);
    }
    if (running) {
      return;
    }
    running = true;
    await handler({ str, key, on, off });
    running = false;
  }
  let rl: readline.Interface | undefined;
  function on() {
    off();
    rl = readline.createInterface({ input: process.stdin });
    readline.emitKeypressEvents(process.stdin, rl);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on('keypress', callback);
  }
  function off() {
    rl?.close();
    rl = undefined;
    process.stdin.off('keypress', callback);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
  on();

  return {
    on,
    off,
    running: () => running,
  } as KeypressHandlerControl;
}

let handler: KeypressHandler | undefined;
export function setHandler(value?: KeypressHandler) {
  handler = value;
}
onKeypress((ctx) => {
  handler?.(ctx);
});
