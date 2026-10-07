import { defineConfig } from 'vitest/config';

/**
 * Unit tests for this package, under `test/`.
 *
 * The single-active-client rule is verified against a real WebSocketServer here rather than a mock,
 * because the rule is about connection ordering (`WebSocketServer.clients`) as much as it is about
 * the manager's own bookkeeping. The viteburner end-to-end suite still covers the package in situ:
 * it drives the built CLI and judges the whole sync pipeline from the game's side.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
