import pc from 'picocolors';

export function formatRaw(msg: string) {
  return `${pc.cyan('[viteburner]')} ${msg}`;
}

export function formatNormal(first = '', second = '', third = '') {
  const parts = [];
  first && parts.push(pc.green(first));
  second && parts.push(pc.dim(second));
  third && parts.push(third);
  return formatRaw(parts.join(' '));
}

export function formatWarn(msg: string) {
  return pc.yellow(`[viteburner] ${msg}`);
}

export function formatError(msg: string) {
  return pc.red(`[viteburner] ${msg}`);
}

export interface LoggerLike {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function createLogger() {
  const logger = {
    base: console as LoggerLike,
    info: (...msg: string[]) => logger.base.info(formatNormal(...msg)),
    warn: (...msg: string[]) => logger.base.warn(formatWarn(msg.join(' '))),
    error: (...msg: string[]) => logger.base.error(formatError(msg.join(' '))),
  };
  return logger;
}

export const logger = createLogger();
