import fs from 'node:fs';
import path from 'node:path';
import { ViteburnerCli } from './cli';
import { getGameDir } from './ensure-game';
import { E2eProject, createProject } from './project';
import { StaticServer, getFreePort, startStaticServer } from './static-server';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');

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
  server: StaticServer;
  /** WebSocket port the game is told to connect to. */
  wsPort: number;
}

/**
 * Start the static game server, prepare an isolated copy of playground/ and start the real
 * viteburner CLI against it. Call from `test.beforeAll`; use `stopViteBurner` in `afterAll`.
 */
export async function startViteBurner(): Promise<ViteBurnerFixture> {
  const gameDir = getGameDir(REPO_ROOT);
  if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
    throw new Error(`pinned game build missing at ${gameDir}; global setup should have prepared it`);
  }
  const server = await startStaticServer(gameDir);
  const wsPort = await getFreePort();
  const projectDir = path.join(REPO_ROOT, 'e2e', '.tmp', 'project');
  const project = createProject(path.join(REPO_ROOT, 'playground'), projectDir);
  const cli = new ViteburnerCli({ repoRoot: REPO_ROOT, cwd: project.root, port: wsPort });
  await cli.start();
  await cli.waitForLog(/watching for file changes/, 90_000);
  return { cli, project, server, wsPort };
}

export async function stopViteBurner(fixture: ViteBurnerFixture | undefined) {
  if (!fixture) {
    return;
  }
  await fixture.cli.stop();
  await fixture.server.close();
  if (!process.env.E2E_KEEP) {
    fs.rmSync(fixture.project.root, { recursive: true, force: true });
  }
}
