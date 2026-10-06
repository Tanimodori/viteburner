import path from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest';
import { launchGameBrowser } from './helpers/browser';
import { FIXTURE_FILES, GAME_DIRECTORIES, uploadLogPattern } from './helpers/fixture';
import { ViteBurnerLocalFixture, startViteBurner, stopViteBurner, VERIFY_MARKER, VERIFY_SCRIPT } from './helpers/flow';
import {
  catFile,
  connectRemoteApi,
  dismissTutorial,
  expectLocatorText,
  gotoGame,
  gotoTerminal,
  grantLocalNetworkAccess,
  listDirectory,
  runScript,
} from './helpers/game';
import { live } from './testUtils/mode';

/**
 * The deterministic local leg (default mode).
 *
 * A real Bitburner build is served from `test/.cache/` over loopback, the game connects to the real
 * built CLI over the Remote API, and this file judges the sync pipeline from the game's side: every
 * file in the fixture project reaches the game intact, the game can read each one back, and the ones
 * this build can execute actually run and print what their source says.
 *
 * `beforeAll` establishes the whole observable state once — server, CLI, browser, and the initial
 * sync of the fixture — and each `it` below only reads it. That is what lets the upload, read-back
 * and execution checks live in separate tests without ordering hazards, which is also why
 * `threads: false` is set in `vitest.config.ts`. Only the last test mutates state (adding a new
 * source, then removing it); it runs after the read-only ones and restores nothing, since the fixture
 * copy in `test/.tmp/` is discarded by `stopViteBurner`.
 *
 * The CLI's own log is cross-checked alongside the game: a file that appears in `ls` is the game's
 * view, and the `hmr add … (done)` line is the CLI's account of having sent it.
 *
 * `describe.skipIf(live)`: this leg judges the pinned build with a pinned outcome, and live mode
 * neither prepares that build nor claims that outcome — it is the live file's turn instead.
 */
describe.skipIf(live)('viteburner local E2E', () => {
  let fixture: ViteBurnerLocalFixture;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  /** The CLI's own output is the evidence when a step fails; print its tail instead of attaching a file. */
  function watchCliLog() {
    // `onTestFailed` may only be registered from inside a test in vitest 0.34.6.
    onTestFailed(() => {
      console.error(`[e2e] viteburner CLI log tail:\n${fixture?.cli.logTail(200) ?? '<fixture not started>'}`);
    });
  }

  beforeAll(async () => {
    fixture = await startViteBurner();
    browser = await launchGameBrowser();
    context = await browser.newContext();
    await grantLocalNetworkAccess(context, fixture.server.url);
    page = await context.newPage();

    // Load the game and reach the terminal.
    await gotoGame(page, fixture.server.url);
    await dismissTutorial(page);

    // Connect the game to the CLI via Remote API, then wait for the initial sync to finish:
    // every fixture file must have been pushed before any test reads the game's state.
    await connectRemoteApi(page, fixture.wsPort);
    await fixture.cli.waitForLog(/conn connected/);
    for (const file of FIXTURE_FILES) {
      await fixture.cli.waitForLog(uploadLogPattern(file), 90_000);
    }
    await gotoTerminal(page);
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
    await stopViteBurner(fixture);
  });

  it('uploads every fixture file to the game', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      // The CLI logged a completed upload for this source (already awaited in beforeAll; this is the
      // per-file statement of it, so the failure names the file).
      expect(fixture.cli.log, `CLI upload log for ${file.source}`).toMatch(uploadLogPattern(file));
    }

    // The game's own directory listing shows each upload under its sink directory.
    expect(GAME_DIRECTORIES.length).toBeGreaterThan(1);
    for (const dir of GAME_DIRECTORIES) {
      const listing = await listDirectory(page, dir);
      const childDirs = GAME_DIRECTORIES.filter((d) => d !== '.' && path.posix.dirname(d) === dir).map(
        (d) => `${path.posix.basename(d)}/`,
      );
      const files = FIXTURE_FILES.filter((file) => path.posix.dirname(file.upload) === dir).map((file) =>
        path.posix.basename(file.upload),
      );
      // The root also lists files the game ships with (handbook, NUKE.exe), so only membership is asserted.
      for (const entry of [...childDirs, ...files]) {
        expect(listing, `ls ${dir} should list ${entry}`).toContain(entry);
      }
    }
  });

  it('lets the game read every uploaded file back with its transformed content', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      const content = await catFile(page, file.upload);
      for (const expected of file.contains) {
        expect(content, `cat ${file.upload} should contain ${JSON.stringify(expected)}`).toContain(expected);
      }
      // `sourcemap: 'inline'` in the fixture config: transformed files carry an inline map, and the
      // files copied verbatim must not have gained one.
      if (file.transformed) {
        expect(content, `cat ${file.upload} should carry an inline sourcemap`).toContain(
          '//# sourceMappingURL=data:application/json;base64,',
        );
      } else {
        expect(content, `cat ${file.upload} should be copied verbatim`).not.toContain('sourceMappingURL');
      }
    }
  });

  it('clones the transformed scripts into the fixture dist/ via dumpFiles', async () => {
    for (const file of FIXTURE_FILES) {
      expect(fixture.project.exists(file.dump), `dump file ${file.dump}`).toBe(true);
      const dumped = fixture.project.readFile(file.dump);
      for (const expected of file.contains) {
        expect(dumped, `${file.dump} should contain ${JSON.stringify(expected)}`).toContain(expected);
      }
    }
  });

  it('runs every executable fixture script and checks its output', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      if (file.run.kind !== 'prints') {
        continue;
      }
      const terminal = await runScript(page, file.upload);
      expect(terminal, `run ${file.upload} should report the launch`).toContain('Running script with');
      for (const line of file.run.lines) {
        expect(terminal, `run ${file.upload} should print ${JSON.stringify(line)}`).toContain(line);
      }
      // A transformed script that ran to completion must not have thrown.
      expect(terminal, `run ${file.upload} should not have errored`).not.toContain('RUNTIME ERROR');
      expect(terminal, `run ${file.upload} should not have errored`).not.toContain('Script runtime error');
    }
  });

  it('reports the files this game build refuses to run, without faking success', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      if (file.run.kind !== 'refused') {
        continue;
      }
      const terminal = await runScript(page, file.upload, 4_000);
      expect(terminal, `run ${file.upload} should be refused by this build`).toContain(file.run.message);
    }
  });

  it('syncs a newly added source file live, then removes it on unlink', async () => {
    watchCliLog();

    // A changed source file is transformed and synced live.
    fixture.project.writeSource('e2e-verify.ts', VERIFY_SCRIPT);
    await fixture.cli.waitForLog(/hmr add src\/e2e-verify\.ts .*\(done\)/, 90_000);

    const listing = await listDirectory(page, '.');
    expect(listing).toContain('e2e-verify.js');

    // The game can read the synced content back.
    const content = await catFile(page, 'e2e-verify.js');
    expect(content).toContain(VERIFY_MARKER);

    // The game can execute it.
    const terminal = await runScript(page, 'e2e-verify.js');
    await expectLocatorText(page.locator('#terminal'), 'Running script with', { timeout: 30_000 });
    expect(terminal, 'run e2e-verify.js should print the marker').toContain(VERIFY_MARKER);
    expect(terminal, 'run e2e-verify.js should not have errored').not.toContain('RUNTIME ERROR');

    // Removing the source deletes the uploaded script from the game.
    fixture.project.removeSource('e2e-verify.ts');
    await fixture.cli.waitForLog(/hmr unlink src\/e2e-verify\.ts -> @home:\/e2e-verify\.js \(done\)/, 90_000);
    const after = await listDirectory(page, '.');
    expect(after).not.toContain('e2e-verify.js');
  });
});
