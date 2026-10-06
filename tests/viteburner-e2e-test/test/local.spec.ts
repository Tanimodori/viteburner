import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, it, onTestFailed } from 'vitest';
import { launchGameBrowser } from './helpers/browser';
import { ViteBurnerLocalFixture, startViteBurner, stopViteBurner, VERIFY_MARKER, VERIFY_SCRIPT } from './helpers/flow';
import {
  connectRemoteApi,
  dismissTutorial,
  expectLocatorText,
  gotoGame,
  gotoTerminal,
  grantLocalNetworkAccess,
  runTerminalCommand,
} from './helpers/game';
import { live } from './testUtils/mode';

/**
 * The deterministic local leg (default mode).
 *
 * A real Bitburner build is served from `test/.cache/` over loopback, the game connects to the real
 * built CLI over the Remote API, and this file checks the sync pipeline from the game's side in one
 * linear flow: the initial upload appears in `ls`, a changed source is transformed and synced live,
 * the game reads the synced content back, and it executes it. The CLI's own log is the cross-check
 * that the bytes on the wire are its doing.
 *
 * It is a single `it` rather than one per stage because every step depends on the state the previous
 * one left in the running game; a mid-flow failure should stop there instead of surfacing as a
 * cascade of unrelated failures. The phases are marked with comments. `beforeAll` starts the server,
 * the CLI and the browser once, which is also why `threads: false` is set in `vitest.config.ts`.
 *
 * `describe.skipIf(live)`: this leg judges the pinned build with a pinned outcome, and the live mode
 * neither prepares that build nor claims that outcome — it is the live file's turn instead.
 */
describe.skipIf(live)('viteburner local E2E', () => {
  let fixture: ViteBurnerLocalFixture;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    fixture = await startViteBurner();
    browser = await launchGameBrowser();
    context = await browser.newContext();
    await grantLocalNetworkAccess(context, fixture.server.url);
    page = await context.newPage();
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
    await stopViteBurner(fixture);
  });

  // The CLI's own output is the evidence when a step fails; print its tail instead of attaching a file.
  // `onTestFailed` may only be registered from inside a test in vitest 0.34.6, hence the call below.
  it('syncs and runs scripts in the game', async () => {
    onTestFailed(() => {
      console.error(`[e2e] viteburner CLI log tail:\n${fixture?.cli.logTail(200) ?? '<fixture not started>'}`);
    });

    // Load the game and reach the terminal.
    await gotoGame(page, fixture.server.url);
    await dismissTutorial(page);

    // Connect the game to the viteburner CLI via Remote API, then wait for the initial sync.
    await connectRemoteApi(page, fixture.wsPort);
    await fixture.cli.waitForLog(/conn connected/);
    await fixture.cli.waitForLog(/hmr add src\/template\.ts .*\(done\)/, 90_000);

    // The uploaded script is listed in the game terminal.
    await gotoTerminal(page);
    await runTerminalCommand(page, 'ls');
    await expectLocatorText(page.locator('#terminal'), 'template.js', { timeout: 30_000 });

    // A changed source file is transformed and synced live.
    fixture.project.writeSource('e2e-verify.ts', VERIFY_SCRIPT);
    await fixture.cli.waitForLog(/hmr add src\/e2e-verify\.ts .*\(done\)/, 90_000);
    await runTerminalCommand(page, 'ls');
    await expectLocatorText(page.locator('#terminal'), 'e2e-verify.js', { timeout: 30_000 });

    // The game can read the synced script content back.
    await runTerminalCommand(page, 'cat e2e-verify.js');
    const modal = page.locator('.MuiModal-root');
    await modal.waitFor({ state: 'visible', timeout: 15_000 });
    await expectLocatorText(modal, VERIFY_MARKER, { timeout: 15_000 });
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden', timeout: 15_000 });

    // The game can execute the synced script, and the transformed code runs without a runtime error.
    await runTerminalCommand(page, 'run e2e-verify.js');
    const terminal = page.locator('#terminal');
    await expectLocatorText(terminal, 'Running script with', { timeout: 30_000 });
    await expectLocatorText(terminal, VERIFY_MARKER, { timeout: 30_000 });
    await expectLocatorText(terminal, 'RUNTIME ERROR', { timeout: 2_000, negate: true });
    await expectLocatorText(terminal, 'Script runtime error', { timeout: 2_000, negate: true });
  });
});
