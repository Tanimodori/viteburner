import type { BrowserContext, Page } from '@playwright/test';

/**
 * Chromium (142+) gates requests to local/loopback addresses behind the Local Network Access
 * permission. The E2E flow connects to `ws://localhost:<port>` from the game page, so grant the
 * permission where supported; the LNA features are additionally disabled via launch flags in
 * `playwright.config.ts`.
 */
export async function grantLocalNetworkAccess(context: BrowserContext, origin: string) {
  try {
    await context.grantPermissions(['local-network-access'], { origin });
  } catch (error) {
    console.warn(`[e2e] could not grant 'local-network-access' permission: ${String(error)}`);
  }
}

/** Open the game and wait until the terminal is ready (a fresh profile starts a new game automatically). */
export async function gotoGame(page: Page, url: string, timeout = 90_000) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await page.locator('#terminal-input').waitFor({ state: 'visible', timeout });
}

/** Click a page/button by its accessible name, falling back to exact text. */
async function clickByName(page: Page, name: string) {
  const byRole = page.getByRole('button', { name, exact: true });
  if ((await byRole.count()) > 0) {
    await byRole.first().click();
    return;
  }
  await page.getByText(name, { exact: true }).first().click();
}

/** Close the interactive tutorial panel if it is present; it does not block the sync flow either way. */
export async function dismissTutorial(page: Page) {
  try {
    await page.getByRole('button', { name: 'Exit Tutorial' }).click({ timeout: 3000 });
  } catch {
    // The tutorial may already be finished or not rendered; ignoring is fine.
  }
}

/** Open `Options > Remote API`, fill in the port and click Connect; resolve when the game reports `Online`. */
export async function connectRemoteApi(page: Page, port: number, timeout = 45_000) {
  await clickByName(page, 'Options');
  await clickByName(page, 'Remote API');
  const portInput = page.locator('input[placeholder="12525"]');
  await portInput.waitFor({ state: 'visible', timeout });
  await portInput.fill(String(port));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page
    .locator('span', { hasText: /^Online$/ })
    .first()
    .waitFor({ state: 'visible', timeout });
}

/** Navigate back to the Terminal page and wait for the command input. */
export async function gotoTerminal(page: Page, timeout = 30_000) {
  await clickByName(page, 'Terminal');
  await page.locator('#terminal-input').waitFor({ state: 'visible', timeout });
}

/** Type a command into the in-game terminal and press Enter. */
export async function runTerminalCommand(page: Page, command: string) {
  const input = page.locator('#terminal-input');
  await input.click();
  await input.fill(command);
  await input.press('Enter');
}
