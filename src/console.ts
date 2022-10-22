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

export type KeypressHandler = (str: string, key: KeyInfo) => void | Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onKeypress(handler: KeypressHandler) {
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
    await handler(str, key);
    running = false;
  }
  function on() {
    off();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on('keypress', callback);
  }
  function off() {
    process.stdin.off('keypress', callback);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
  on();
}
