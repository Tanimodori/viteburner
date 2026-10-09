import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for this package, under `test/`.
 *
 * The daemon's own contract — the plugin in a real dev server, the session it creates, the event bus
 * and the path helpers — is checked here. The config suite lives in `tests/viteburner-config-test`
 * and the CLI's keys in `packages/viteburner`; keeping this include narrow means neither can pull the
 * other's specs into the wrong runner.
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
