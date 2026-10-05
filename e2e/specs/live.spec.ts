import { expect, test } from '@playwright/test';
import { VERIFY_MARKER, VERIFY_SCRIPT, startViteBurner, stopViteBurner, ViteBurnerFixture } from '../helpers/flow';
import {
  connectRemoteApi,
  dismissTutorial,
  gotoGame,
  gotoTerminal,
  grantLocalNetworkAccess,
  runTerminalCommand,
} from '../helpers/game';

/**
 * Opt-in smoke test against the live game site (https://bitburner-official.github.io/).
 * Run with `npm run test:e2e:live`. The result can drift when the game is updated, so this
 * project is not part of the default `npm run test:e2e`.
 */
test.describe('viteburner live smoke test', () => {
  let fixture: ViteBurnerFixture;

  test.beforeAll(async () => {
    fixture = await startViteBurner();
  });

  test.afterAll(async () => {
    await stopViteBurner(fixture);
  });

  test('connects the live game to the local CLI and runs a synced script', async ({ browser }) => {
    const context = await browser.newContext();
    await grantLocalNetworkAccess(context, 'https://bitburner-official.github.io');
    const page = await context.newPage();

    try {
      await gotoGame(page, 'https://bitburner-official.github.io/', 120_000);
      await dismissTutorial(page);
      await connectRemoteApi(page, fixture.wsPort, 60_000);
      await fixture.cli.waitForLog(/conn connected/, 60_000);

      fixture.project.writeSource('e2e-verify.ts', VERIFY_SCRIPT);
      await fixture.cli.waitForLog(/hmr add src\/e2e-verify\.ts .*\(done\)/, 90_000);

      await gotoTerminal(page);
      await runTerminalCommand(page, 'ls');
      await expect(page.locator('#terminal')).toContainText('e2e-verify.js', { timeout: 30_000 });

      await runTerminalCommand(page, 'run e2e-verify.js');
      await expect(page.locator('#terminal')).toContainText(VERIFY_MARKER, { timeout: 30_000 });
    } finally {
      await context.close();
    }
  });
});
