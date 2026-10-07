import path from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest';
import { ViteBurner, startViteBurner, stopViteBurner } from './cli/vite';
import { dumpBaselinePath, endsWithInlineSourcemap, normalizeDump } from './fixture/dump';
import { FIXTURE_FILES, GAME_DIRECTORIES, uploadLogPattern } from './fixture/manifest';
import { E2eProject, createProject, removeProject } from './fixture/project';
import { VERIFY_MARKER, VERIFY_SCRIPT, VERIFY_SOURCE, VERIFY_UPLOAD } from './fixture/verify-script';
import { ensureGame } from './local/ensure-game';
import { StaticServer, startStaticServer } from './local/static-server';
import { live } from './mode';
import { launchGameBrowser } from './web/browser';
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
} from './web/game';

/**
 * One flow, two legs.
 *
 * The suite is a single file with a single six-step test body. The mode only chooses the game the
 * steps run against: the offline leg (default) serves the pinned build from `test/.cache/` over
 * loopback, and the online leg (`--mode live`) loads the real site. Everything else — the fixture
 * project, the real built CLI, the browser, the assertions — is shared, so a behaviour is either
 * proven for both legs or it fails for the leg that drifted.
 *
 * The four phases of the run:
 *
 *   1. fixture     — copy the read-only fixture project to `test/.tmp/`, and (offline) make sure the
 *                    pinned build is downloaded and serving.
 *   2. before-test — start the CLI and the browser, load the game, connect it over the Remote API,
 *                    and wait for the initial sync of every fixture file.
 *   3. test        — the six steps below. They are read-only against the state phase 2 established;
 *                    only the last one mutates (adds a source, then removes it).
 *   4. after-test  — close the browser and the CLI, and drop the project copy.
 *
 * `threads: false` in `vitest.config.ts` is what lets phase 2 live across the six steps in one
 * process: one browser, one CLI, one game, one websocket.
 */

/** The live leg's game: the official site, which drifts with upstream releases (hence opt-in). */
const ONLINE_GAME_URL = 'https://bitburner-official.github.io/';

describe(`viteburner E2E (${live ? 'online' : 'offline'})`, () => {
  let project: E2eProject;
  let server: StaticServer | undefined;
  let vite: ViteBurner;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  /** The leg's timeouts: the public site is slower to load and connect than the local build. */
  const timeouts = live ? { gotoGame: 120_000, connect: 60_000 } : { gotoGame: 90_000, connect: 45_000 };

  /** The CLI's own output is the evidence when a step fails; print its tail instead of attaching a file. */
  function watchCliLog() {
    // `onTestFailed` may only be registered from inside a test in vitest 0.34.6.
    onTestFailed(() => {
      console.error(`[e2e] viteburner CLI log tail:\n${vite?.cli.logTail(200) ?? '<fixture not started>'}`);
    });
  }

  beforeAll(async () => {
    // Phase 1 — fixture: an isolated copy of the project the CLI will watch (never the read-only
    // original), and the offline leg's pinned build on a loopback origin.
    project = createProject();
    let gameUrl: string;
    if (live) {
      gameUrl = ONLINE_GAME_URL;
    } else {
      server = await startStaticServer(await ensureGame());
      gameUrl = server.url;
    }

    // Phase 2 — before-test: the real built CLI against the project copy, and a real browser on the leg's game.
    vite = await startViteBurner(project);
    browser = await launchGameBrowser();
    context = await browser.newContext();
    await grantLocalNetworkAccess(context, gameUrl);
    page = await context.newPage();

    // Load the game and reach the terminal.
    await gotoGame(page, gameUrl, timeouts.gotoGame);
    await dismissTutorial(page);

    // Connect the game to the CLI via Remote API, then wait for the initial sync to finish: every
    // fixture file must have been pushed before any step reads the game's state.
    await connectRemoteApi(page, vite.wsPort, timeouts.connect);
    await vite.cli.waitForLog(/conn connected/, timeouts.connect);
    for (const file of FIXTURE_FILES) {
      await vite.cli.waitForLog(uploadLogPattern(file), 90_000);
    }
    await gotoTerminal(page);
  });

  afterAll(async () => {
    // Phase 4 — after-test: tear everything down and drop the project copy.
    await context?.close();
    await browser?.close();
    await stopViteBurner(vite);
    await server?.close();
    if (project) {
      removeProject(project);
    }
  });

  it('step 1: uploads every fixture file to the game', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      // The CLI logged a completed upload for this source (already awaited in beforeAll; this is the
      // per-file statement of it, so the failure names the file).
      expect(vite.cli.log, `CLI upload log for ${file.source}`).toMatch(uploadLogPattern(file));
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

  it('step 2: lets the game read every uploaded file back with its transformed content', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      const content = await catFile(page, file.upload);
      for (const expected of file.contains) {
        expect(content, `cat ${file.upload} should contain ${JSON.stringify(expected)}`).toContain(expected);
      }
      // `sourcemap: 'inline'` in the fixture config, so the trailing map is what separates a
      // transformed upload from a verbatim one. The modal renders the file as stored behind its own
      // `<name>\n\n` header, so the file's last line is still the last line here — and asking where
      // the comment lands cannot be answered by a stray `sourceMappingURL` in the file's own text.
      expect(endsWithInlineSourcemap(content), `inline sourcemap at the end of ${file.upload}`).toBe(file.transformed);
    }
  });

  it('step 3: clones the transformed scripts into the fixture dist/ via dumpFiles', async () => {
    for (const file of FIXTURE_FILES) {
      expect(project.exists(file.dump), `dump file ${file.dump}`).toBe(true);
      const dumped = project.readFile(file.dump);
      for (const expected of file.contains) {
        expect(dumped, `${file.dump} should contain ${JSON.stringify(expected)}`).toContain(expected);
      }

      // The dump is the transformed source, so the baseline is the whole compiled file, not a set of
      // substrings: any change in what the pipeline emits fails here as a diff naming the line.
      // `normalizeDump` drops the inline sourcemap and line endings — see `fixture/dump.ts` — so the
      // map is paid for by asserting where it lands, which a substring search could not tell apart
      // from a verbatim file that merely mentions `sourceMappingURL`.
      expect(endsWithInlineSourcemap(dumped), `inline sourcemap at the end of ${file.dump}`).toBe(file.transformed);
      await expect(normalizeDump(dumped)).toMatchFileSnapshot(dumpBaselinePath(file.dump));
    }
  });

  it('step 4: runs every executable fixture script and checks its output', async () => {
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

  it('step 5: reports the files this game refuses to run, without faking success', async () => {
    watchCliLog();

    for (const file of FIXTURE_FILES) {
      if (file.run.kind !== 'refused') {
        continue;
      }
      const terminal = await runScript(page, file.upload, 4_000);
      expect(terminal, `run ${file.upload} should be refused by this game`).toContain(file.run.message);
    }
  });

  it('step 6: syncs a newly added source file live, then removes it on unlink', async () => {
    watchCliLog();

    // A changed source file is transformed and synced live.
    project.writeSource(VERIFY_SOURCE, VERIFY_SCRIPT);
    await vite.cli.waitForLog(/hmr add src\/e2e-verify\.ts .*\(done\)/, 90_000);

    const listing = await listDirectory(page, '.');
    expect(listing).toContain(VERIFY_UPLOAD);

    // The game can read the synced content back.
    const content = await catFile(page, VERIFY_UPLOAD);
    expect(content).toContain(VERIFY_MARKER);

    // The game can execute it.
    const terminal = await runScript(page, VERIFY_UPLOAD);
    await expectLocatorText(page.locator('#terminal'), 'Running script with', { timeout: 30_000 });
    expect(terminal, 'run e2e-verify.js should print the marker').toContain(VERIFY_MARKER);
    expect(terminal, 'run e2e-verify.js should not have errored').not.toContain('RUNTIME ERROR');

    // Removing the source deletes the uploaded script from the game.
    project.removeSource(VERIFY_SOURCE);
    await vite.cli.waitForLog(/hmr unlink src\/e2e-verify\.ts -> @home:\/e2e-verify\.js \(done\)/, 90_000);
    const after = await listDirectory(page, '.');
    expect(after).not.toContain(VERIFY_UPLOAD);
  });
});
