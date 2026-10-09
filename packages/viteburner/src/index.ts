// The CLI package's whole surface: the WebSocket protocol types, the daemon plugin it is built on
// (`vite-plugin-viteburner`, re-exported so `viteburner` still answers every plugin import it used
// to), and the CLI's own entry points. Its commands and keys are not here: the CLI is not a plugin,
// and those are its implementation, reached only through the bin.
export * from 'bb-ws-server';
export * from 'vite-plugin-viteburner';
export * from './cli';
