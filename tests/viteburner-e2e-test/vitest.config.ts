import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Two legs, one config.
 *
 * `vitest run` (mode `test`) drives the deterministic local leg against the pinned game build;
 * `vitest run --mode live` drives the opt-in smoke test against the official site. The mode is what
 * separates them, exactly as `import.meta.env.MODE` sees it inside the specs, so the global setup
 * below can be attached only to the leg that needs a local build.
 */
export default defineConfig(({ mode }) => {
  const live = mode === 'live';
  return {
    test: {
      include: ['test/**/*.spec.ts'],
      /*
       * One browser, one CLI process, one game: the flow drives a single websocket and asserts on
       * terminal output, so files must not fan out into worker threads. `threads: false` also keeps
       * the fixture's `beforeAll`/`afterAll` in the same process as the assertions.
       */
      threads: false,
      testTimeout: 120_000,
      hookTimeout: 180_000,
      /*
       * The local leg serves the pinned Bitburner build, which the setup downloads and verifies once.
       * The live leg reaches the official site and has no local build to prepare.
       */
      globalSetup: live ? [] : [path.join(here, 'test', 'global-setup.ts')],
    },
  };
});
