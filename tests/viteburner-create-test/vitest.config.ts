import { defineConfig } from 'vitest/config';

/**
 * The scaffold suite, driven by vitest.
 *
 * The CLI is spawned as a real child process, so the tests need a built `create-viteburner`
 * (`rush rebuild` before `rushx test`). `fileParallelism: false` keeps the shared temporary
 * directory and the one template build in a predictable order.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
