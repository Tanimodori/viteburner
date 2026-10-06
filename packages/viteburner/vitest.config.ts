import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for this package, under `test/`.
 *
 * The end-to-end suite lives in `tests/viteburner-e2e-test`, which drives the built CLI from the
 * outside; keeping this include narrow means a change to either one cannot pull the other's specs
 * into the wrong runner.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
