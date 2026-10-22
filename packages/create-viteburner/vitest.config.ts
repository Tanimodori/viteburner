import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the template exporter and the scaffolder.
 *
 * The end-to-end check — the installed CLI, a real child project, a copied `NetscriptDefinitions`
 * fixture and `tsc` — lives in `tests/viteburner-create-test`, so this include stays narrow.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
