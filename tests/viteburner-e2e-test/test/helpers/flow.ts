import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ViteburnerCli } from './cli';
import { getGameDir } from './ensure-game';
import { FIXTURE_DIR } from './fixture';
import { E2eProject, createProject } from './project';
import { StaticServer, getFreePort, startStaticServer } from './static-server';

/** This package's root: `test/helpers/flow.ts` → `test/` → package root. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The published CLI under test. */
const require = createRequire(import.meta.url);

/**
 * Resolve the `viteburner` package root through the explicit workspace dependency.
 *
 * `package.json#exports` does not expose `./package.json`, so the root is derived from the resolved
 * entry point: `<pkg>/dist/index.js` → `<pkg>`. Following the pnpm symlink lands on the real folder,
 * which is where `bin/` and the built `dist/` live.
 */
export const VITEBURNER_PACKAGE_ROOT = path.resolve(path.dirname(require.resolve('viteburner')), '..');

export const VERIFY_MARKER = 'E2E_VERIFY_OK';

/** Source of the script uploaded during the test run. */
export const VERIFY_SCRIPT = [
  "import { NS } from '@ns';",
  '',
  'export async function main(ns: NS) {',
  `  ns.tprint('${VERIFY_MARKER}');`,
  '}',
  '',
].join('\n');

export interface ViteBurnerFixture {
  cli: ViteburnerCli;
  project: E2eProject;
  /** Set when the leg serves the pinned local build; absent in the live leg, which uses the public site. */
  server?: StaticServer;
  /** WebSocket port the game is told to connect to. */
  wsPort: number;
}

/** The local leg's fixture: it always serves the pinned build, so `server` is guaranteed present. */
export interface ViteBurnerLocalFixture extends ViteBurnerFixture {
  server: StaticServer;
}

export interface StartViteBurnerOptions {
  /**
   * Serve the pinned local Bitburner build over loopback (the local leg). The live leg passes `false`:
   * it loads the public site and must not depend on the pinned build being downloaded.
   */
  servePinnedGame?: boolean;
}

/**
 * Start the static game server (when `servePinnedGame`), prepare an isolated copy of the in-package
 * fixture and start the real viteburner CLI against it. Call from `beforeAll`; use `stopViteBurner`
 * in `afterAll`.
 *
 * Overloaded so a caller that serves the pinned build gets a fixture with `server` guaranteed:
 * the local leg should not have to re-assert what its own call already decided.
 */
export async function startViteBurner(options: { servePinnedGame: false }): Promise<ViteBurnerFixture>;
export async function startViteBurner(options?: { servePinnedGame?: true }): Promise<ViteBurnerLocalFixture>;
export async function startViteBurner(options: StartViteBurnerOptions = {}): Promise<ViteBurnerFixture> {
  const { servePinnedGame = true } = options;

  let server: StaticServer | undefined;
  if (servePinnedGame) {
    const gameDir = getGameDir(PACKAGE_ROOT);
    if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
      throw new Error(`pinned game build missing at ${gameDir}; global setup should have prepared it`);
    }
    server = await startStaticServer(gameDir);
  }

  const wsPort = await getFreePort();
  const projectDir = path.join(PACKAGE_ROOT, 'test', '.tmp', 'project');
  const project = createProject(FIXTURE_DIR, projectDir);
  const cli = new ViteburnerCli({ packageRoot: VITEBURNER_PACKAGE_ROOT, cwd: project.root, port: wsPort });
  await cli.start();
  await cli.waitForLog(/watching for file changes/, 90_000);
  return { cli, project, server, wsPort };
}

export async function stopViteBurner(fixture: ViteBurnerFixture | undefined) {
  if (!fixture) {
    return;
  }
  await fixture.cli.stop();
  await fixture.server?.close();
  if (!process.env.E2E_KEEP) {
    fs.rmSync(fixture.project.root, { recursive: true, force: true });
  }
}
