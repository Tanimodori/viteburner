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

test.describe.configure({ mode: 'serial' });

test.describe('viteburner local E2E', () => {
  let fixture: ViteBurnerFixture;

  test.beforeAll(async () => {
    fixture = await startViteBurner();
  });

  test.afterAll(async () => {
    await stopViteBurner(fixture);
  });

  test('syncs and runs scripts in the game', async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    await grantLocalNetworkAccess(context, fixture.server.url);
    const page = await context.newPage();

    try {
      await test.step('load the game and reach the terminal', async () => {
        await gotoGame(page, fixture.server.url);
        await dismissTutorial(page);
      });

      await test.step('connect the game to the viteburner CLI via Remote API', async () => {
        await connectRemoteApi(page, fixture.wsPort);
        await fixture.cli.waitForLog(/conn connected/);
        // Initial sync uploads the playground sources; wait for at least one completed upload.
        await fixture.cli.waitForLog(/hmr add src\/template\.ts .*\(done\)/, 90_000);
      });

      await test.step('the uploaded script is listed in the game terminal', async () => {
        await gotoTerminal(page);
        await runTerminalCommand(page, 'ls');
        await expect(page.locator('#terminal')).toContainText('template.js', { timeout: 30_000 });
      });

      await test.step('a changed source file is transformed and synced live', async () => {
        fixture.project.writeSource('e2e-verify.ts', VERIFY_SCRIPT);
        await fixture.cli.waitForLog(/hmr add src\/e2e-verify\.ts .*\(done\)/, 90_000);
        await runTerminalCommand(page, 'ls');
        await expect(page.locator('#terminal')).toContainText('e2e-verify.js', { timeout: 30_000 });
      });

      await test.step('the game can read the synced script content', async () => {
        await runTerminalCommand(page, 'cat e2e-verify.js');
        const modal = page.locator('.MuiModal-root');
        await modal.waitFor({ state: 'visible', timeout: 15_000 });
        await expect(modal).toContainText(VERIFY_MARKER, { timeout: 15_000 });
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'hidden', timeout: 15_000 });
      });

      await test.step('the game can execute the synced script', async () => {
        await runTerminalCommand(page, 'run e2e-verify.js');
        const terminal = page.locator('#terminal');
        await expect(terminal).toContainText('Running script with', { timeout: 30_000 });
        await expect(terminal).toContainText(VERIFY_MARKER, { timeout: 30_000 });
        await expect(terminal).not.toContainText('RUNTIME ERROR');
        await expect(terminal).not.toContainText('Script runtime error');
      });
    } finally {
      await testInfo.attach('viteburner-cli-log', {
        body: fixture.cli.logTail(200),
        contentType: 'text/plain',
      });
      await context.close();
    }
  });
});
