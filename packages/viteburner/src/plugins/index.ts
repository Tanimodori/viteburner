// Both plugins' public surface. `cliPlugin` is the CLI's control plane, meant to be constructed by a
// CLI and added to its dev server; `viteburnerPlugin` is the daemon itself, meant for any vite config
// that wants the file sync.
export * from './cli';
export * from './viteburner';
