import { defineConfig } from 'vitest/config';

/**
 * The config suite, driven by vitest.
 *
 * Unlike the E2E suite there is no browser, no game and no CLI process: each spec builds a real vite
 * dev server over a fixture project and reads the `viteburner` config back off it. `fileParallelism:
 * false` keeps those servers from running at the same time, so their output stays in order and a port
 * or watcher started by a bug cannot fan out across workers.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
