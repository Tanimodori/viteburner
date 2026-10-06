import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { launchGameBrowser } from './helpers/browser';
import { ViteBurnerFixture, startViteBurner, stopViteBurner, VERIFY_MARKER, VERIFY_SCRIPT } from './helpers/flow';
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
 * The opt-in live leg (`vitest run --mode live`).
 *
 * The same installed CLI and the same sync flow, but the game comes from
 * <https://bitburner-official.github.io/> rather than the pinned local build. It can drift when the
 * game is updated upstream, so it is not part of the default `rushx test:e2e`. `describe.skipIf`
 * keeps a plain run from reaching it, and the local leg likewise skips itself in this mode.
 */
describe.skipIf(!live)('viteburner live smoke test', () => {
  let fixture: ViteBurnerFixture;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    // No pinned build to serve: the live leg loads the public site itself.
    fixture = await startViteBurner({ servePinnedGame: false });
    browser = await launchGameBrowser();
    context = await browser.newContext();
    await grantLocalNetworkAccess(context, 'https://bitburner-official.github.io');
    page = await context.newPage();
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
    await stopViteBurner(fixture);
  });

  it('connects the live game to the local CLI and runs a synced script', async () => {
    await gotoGame(page, 'https://bitburner-official.github.io/', 120_000);
    await dismissTutorial(page);
    await connectRemoteApi(page, fixture.wsPort, 60_000);
    await fixture.cli.waitForLog(/conn connected/, 60_000);

    fixture.project.writeSource('e2e-verify.ts', VERIFY_SCRIPT);
    await fixture.cli.waitForLog(/hmr add src\/e2e-verify\.ts .*\(done\)/, 90_000);

    await gotoTerminal(page);
    await runTerminalCommand(page, 'ls');
    await expectLocatorText(page.locator('#terminal'), 'e2e-verify.js', { timeout: 30_000 });

    await runTerminalCommand(page, 'run e2e-verify.js');
    await expectLocatorText(page.locator('#terminal'), VERIFY_MARKER, { timeout: 30_000 });
  });
});
