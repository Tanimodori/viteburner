import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Keep Vitest focused on unit tests under `test/`.
 *
 * Vitest's default include pattern would also pick up the Playwright specs under `e2e/`,
 * which cannot run inside Vitest.
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
