// The CLI package's whole surface: the daemon plugin and the transport surface it carries
// (`@viteburner/vite-plugin`, re-exported so `viteburner` still answers every import the pre-split
// package did), and the CLI's own entry points. Its commands and keys are not here: the CLI is not a
// plugin, and those are its implementation, reached only through the bin.
export * from '@viteburner/vite-plugin';
export * from './cli';
