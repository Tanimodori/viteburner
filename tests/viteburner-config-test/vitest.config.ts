import { defineConfig } from 'vitest/config';

/**
 * The config suite, driven by vitest.
 *
 * Unlike the E2E suite there is no browser, no game and no CLI process: each spec builds a real vite
 * dev server over a fixture project and reads the `viteburner` config back off it. `threads: false`
 * keeps those servers on one thread, so their output stays in order and a port or watcher started by
 * a bug cannot fan out across workers.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    threads: false,
    testTimeout: 30_000,
  },
});
