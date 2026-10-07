/**
 * Diagnostics sink for the manager.
 *
 * The manager is a library: it must not decide how its host formats output. viteburner passes its
 * own `[viteburner]`-prefixed logger; the default below keeps the package usable on its own.
 */
export interface Logger {
  info(...msg: string[]): void;
  warn(...msg: string[]): void;
  error(...msg: string[]): void;
}

export const consoleLogger: Logger = {
  info: (...msg) => console.info(...msg),
  warn: (...msg) => console.warn(...msg),
  error: (...msg) => console.error(...msg),
};
