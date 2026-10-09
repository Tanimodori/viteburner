// The CLI's own control plane: `cliPlugin`, which publishes the CLI's commands as an api over the
// session the daemon plugin (`vite-plugin-viteburner`) owns. The daemon plugin itself is not here —
// it lives in that package and is re-exported from this package's index.
export * from './cli';
