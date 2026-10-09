import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createServer, type ViteDevServer } from 'vite';
import { viteburnerPlugin, type ViteBurnerUserConfig } from 'vite-plugin-viteburner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliApi } from '../src/cli/api';
import { startCliKeys } from '../src/cli/keys';

/**
 * The CLI's api against a real `createServer`, checked without a terminal or a built CLI.
 *
 * The CLI is not a plugin: it creates the daemon plugin, keeps the instance, and reaches the session
 * through it — `createCliApi(() => daemon.api.getSession())`, exactly what `cli.ts` does. The question
 * this answers is whether that held instance follows the config-change restart that replaces the dev
 * server, since the api's liveness rests on it. The key reader is the CLI's own (`startCliKeys`, wired
 * as `cli.ts` wires it) over a `PassThrough`, so one key written to it is exactly one `keypress` event
 * and the test runner's own stdin is never touched.
 *
 * The daemon plugin comes from `vite-plugin-viteburner` by name — the same dependency the built CLI
 * resolves at runtime — so this package must be built before this spec runs (`rush build` orders it
 * first). That boundary is deliberate: it is the plugin's published surface the CLI is written
 * against, not a private path into its sources.
 */

const CONFIG = JSON.stringify({ watch: [{ pattern: 'src/**/*.ts', transform: false }] }, null, 2);

/** A port nothing is listening on, so the daemon under test can bind it. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

describe('the CLI against a real dev server', () => {
  let server: ViteDevServer | undefined;
  let root: string | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  /** A minimal project the plugin can serve: one watched source and a viteburner config. */
  function makeProject(): string {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'viteburner-cli-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(root, 'viteburner.config.json'), CONFIG);
    return root;
  }

  it('answers a key through the held daemon plugin, and keeps answering after a restart', async () => {
    const port = await freePort();
    const dir = makeProject();
    const inline = { cwd: dir, port };
    // The CLI's composition, minus its cac entry: hold the daemon plugin it created, build the api
    // over it, and read keys with its own reader.
    const daemon = viteburnerPlugin(inline);
    const api = createCliApi(() => daemon.api.getSession());
    const input = new PassThrough();
    startCliKeys(api, input);

    // Typed as the user config so the `viteburner` key is allowed where vite's own InlineConfig would
    // reject the extra property.
    const config: ViteBurnerUserConfig = {
      root: dir,
      logLevel: 'silent',
      viteburner: inline,
      plugins: [daemon],
    };
    server = await createServer(config);

    // `s` renders the status block from this read, so the spy is the CLI's question to the daemon.
    const first = api.getSession();
    expect(first, 'the first server started a session').toBeDefined();
    const firstStatus = vi.spyOn(first!, 'getStatus');

    // The reader was attached before the server existed, so one key written right after it resolves is
    // already answered — the same window a plain vite startup would give it.
    input.write('s');
    await vi.waitFor(() => expect(firstStatus).toHaveBeenCalledTimes(1));

    // A config-change restart replaces the session while vite reuses the plugin instance the CLI
    // holds. The api must reach the replacement: the next key dispatches once, not twice, and lands on
    // the new session rather than the closed one.
    await server.restart();
    const second = api.getSession();
    expect(second, 'the replacement server started a session').toBeDefined();
    expect(second, 'the restart replaced the session').not.toBe(first);
    const secondStatus = vi.spyOn(second!, 'getStatus');
    input.write('s');
    await vi.waitFor(() => expect(secondStatus).toHaveBeenCalledTimes(1));
  });

  it('answers nothing while no session is up', () => {
    // What the api is between the two servers of a restart, or before the first one: every command is
    // a no-op rather than a throw, the way an unanswerable key was.
    const api = createCliApi(() => undefined);

    expect(api.getSession(), 'no session to hand out').toBeUndefined();
    // A no-op, not a throw: `quit` must not reach `process.exit` without a session to dispose. The
    // help is not here to check — it lives on the keyboard side (`keys.ts`), which needs no session.
    expect(() => api.displayStatus()).not.toThrow();
    expect(() => api.quit()).not.toThrow();
  });
});
