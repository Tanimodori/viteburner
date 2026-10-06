import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import type { E2eProject } from '../fixture/project';
import { ViteburnerCli } from './cli';

/**
 * The published CLI under test, resolved through the explicit workspace dependency.
 *
 * `package.json#exports` does not expose `./package.json`, so the root is derived from the resolved
 * entry point: `<pkg>/dist/index.js` → `<pkg>`. Following the pnpm symlink lands on the real folder,
 * which is where `bin/` and the built `dist/` live.
 */
const require = createRequire(import.meta.url);
export const VITEBURNER_PACKAGE_ROOT = path.resolve(path.dirname(require.resolve('viteburner')), '..');

/** Ask the OS for a port nothing is listening on, so parallel runs cannot collide on the ws port. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

export interface ViteBurner {
  cli: ViteburnerCli;
  /** WebSocket port the game is told to connect to. */
  wsPort: number;
}

/**
 * Start the real viteburner CLI against the fixture project, and wait until vite is watching files.
 *
 * `waitForLog(/watching for file changes/)` is what makes the CLI usable: once it is up, uploads are
 * observable in `cli.log`, which is the evidence every sync assertion reads. Call from the before-test
 * phase; use `stopViteBurner` in the after-test phase.
 */
export async function startViteBurner(project: E2eProject): Promise<ViteBurner> {
  const wsPort = await getFreePort();
  const cli = new ViteburnerCli({ packageRoot: VITEBURNER_PACKAGE_ROOT, cwd: project.root, port: wsPort });
  await cli.start();
  await cli.waitForLog(/watching for file changes/, 90_000);
  return { cli, wsPort };
}

export async function stopViteBurner(vite: ViteBurner | undefined) {
  await vite?.cli.stop();
}
