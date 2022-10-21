import pc from 'picocolors';

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
  return pc.yellow(`[viteburner] ${msg}`);
}

export function formatError(msg: string) {
  return pc.red(`[viteburner] ${msg}`);
}

export function createLogger() {
  const logger = {
    base: createLoggerRaw('info', { prefix }),
    info: (...msg: string[]) => logger.base.info(formatNormal(...msg), { timestamp: true }),
    warn: (...msg: string[]) => logger.base.warn(formatWarn(msg.join(' ')), { timestamp: true }),
    error: (...msg: string[]) => logger.base.error(formatError(msg.join(' ')), { timestamp: true }),
  };
  return logger;
}

export const logger = createLogger();
