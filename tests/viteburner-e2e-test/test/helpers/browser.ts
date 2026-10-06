import { Browser, chromium } from 'playwright';

/**
 * Launch Chromium with the flags the E2E flow needs, mirroring what `playwright.config.ts` used to set.
 *
 * - Local Network Access gates loopback requests (Chromium 142+); disable it for automation.
 * - The game uses WebGL-adjacent canvas rendering; software GL is enough.
 */
export function launchGameBrowser(): Promise<Browser> {
  return chromium.launch({
    args: ['--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets', '--use-gl=swiftshader'],
  });
}
