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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onKeypress(handler: (str: string, key: KeyInfo) => void) {
  function callback(str: string, key: KeyInfo) {
    off();
    handler(str, key);
    on();
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
