import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Two legs, one spec file.
 *
 * `vitest run` (mode `test`) drives the offline leg against the pinned game build; `vitest run --mode
 * live` drives the online leg against the official site. Both collect `test/e2e.spec.ts` and run the
 * same six steps — the mode only decides which game they run against (see `test/mode.ts` and
 * `test/e2e.spec.ts`). The global setup below is attached only to the offline leg, because only it
 * needs the pinned build downloaded and verified.
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
       * The offline leg serves the pinned Bitburner build, which the setup downloads and verifies once.
       * The online leg reaches the official site and has no local build to prepare.
       */
      globalSetup: live ? [] : [path.join(here, 'test', 'local', 'global-setup.ts')],
    },
  };
});
