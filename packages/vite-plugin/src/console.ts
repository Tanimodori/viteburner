import pc from 'picocolors';

export const prefix = '[viteburner]';

import { createLogger as createLoggerRaw } from 'vite';

export function formatNormal(first = '', second = '', third = '') {
  const parts = [];
  if (first) parts.push(pc.green(first));
  if (second) parts.push(pc.dim(second));
  if (third) parts.push(third);
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
