import { defineConfig } from 'vitest/config';

/**
 * Unit tests for this package, under `test/`.
 *
 * The CLI's key plugin is exercised in `test/cli-plugin.spec.ts` against a real dev server built from
 * the `vite-plugin-viteburner` dependency. The daemon's own tests live in that package, the config
 * suite in `tests/viteburner-config-test`, and the end-to-end suite in `tests/viteburner-e2e-test`;
 * keeping this include narrow means none of them can pull another's specs into the wrong runner.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
