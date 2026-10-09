// The CLI's own control plane: `cliPlugin`, which reads the player's keys and runs the CLI's commands
// against the session the daemon plugin (`vite-plugin-viteburner`) publishes. The daemon plugin
// itself is not here — it lives in that package and is re-exported from this package's index.
export * from './cli';
