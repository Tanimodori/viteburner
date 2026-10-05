import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = __dirname;

/**
 * E2E configuration.
 *
 * - `local` (default): serves the pinned Bitburner web build from `e2e/.cache/` over
 *   http://127.0.0.1. Deterministic and offline-friendly.
 * - `live`: smoke test against https://bitburner-official.github.io/ (opt-in via
 *   `npm run test:e2e:live`); result may drift with upstream releases.
 *
 * Requires `npm run build` first (the CLI under test is `bin/viteburner.js` -> dist), which
 * `npm run test:e2e` performs automatically.
 */
export default defineConfig({
  testDir: path.join(repoRoot, 'e2e', 'specs'),
  globalSetup: path.join(repoRoot, 'e2e', 'global-setup.ts'),
  outputDir: path.join(repoRoot, 'e2e', '.tmp', 'test-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: [
        // Local Network Access gates loopback requests (Chromium 142+); disable it for automation.
        '--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets',
        // The game uses WebGL-adjacent canvas rendering; software GL is enough.
        '--use-gl=swiftshader',
      ],
    },
  },
  projects: [
    {
      name: 'local',
      testMatch: /local\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'live',
      testMatch: /live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
