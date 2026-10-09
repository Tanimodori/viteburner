import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createServer, type ViteDevServer } from 'vite';
import { slash, viteburnerPlugin, type ViteBurnerUserConfig } from 'vite-plugin-viteburner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cliPlugin } from '../src/plugins/cli';
import { startCliKeys } from '../src/plugins/cli/keys';

/**
 * The CLI plugin's api inside a real `createServer`, checked without a terminal or a built CLI.
 *
 * The question this answers is whether the api reaches the daemon session that is live now — including
 * after the config-change restart that replaces the dev server while reusing the plugin instance. The
 * key reader is the CLI's own (`startCliKeys`, wired exactly as `cli.ts` does it) and is given a
 * `PassThrough` instead of `process.stdin`, so one key written to it is exactly one `keypress` event
 * and the test runner's own stdin is never touched; the plugin itself knows nothing about it.
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

describe('the CLI plugin in a real dev server', () => {
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

  it('answers a key through the api, and keeps answering after a restart', async () => {
    const port = await freePort();
    const dir = makeProject();
    const inline = { cwd: dir, port };
    // The CLI's own reader, over a stream a test controls; handed the plugin's api.
    const plugin = cliPlugin();
    const input = new PassThrough();
    startCliKeys(plugin.api, input);

    // Typed as the user config so the `viteburner` key is allowed where vite's own InlineConfig would
    // reject the extra property.
    const config: ViteBurnerUserConfig = {
      root: dir,
      logLevel: 'silent',
      viteburner: inline,
      plugins: [viteburnerPlugin(inline), plugin],
    };
    server = await createServer(config);

    // `s` renders the status block from this read, so the spy is the CLI's question to the daemon.
    const first = plugin.api.getSession();
    expect(first, 'the first server started a session').toBeDefined();
    const firstStatus = vi.spyOn(first!, 'getStatus');

    // The reader was attached before the server existed, so one key written right after it resolves
    // is already answered — the same window a plain vite startup would give it.
    input.write('s');
    await vi.waitFor(() => expect(firstStatus).toHaveBeenCalledTimes(1));

    // A config-change restart re-resolves this plugin instance and replaces the session. The api must
    // reach the replacement: the next key dispatches once, not twice, and lands on the new session.
    await server.restart();
    const second = plugin.api.getSession();
    expect(second, 'the replacement server started a session').toBeDefined();
    expect(second, 'the restart replaced the session').not.toBe(first);
    const secondStatus = vi.spyOn(second!, 'getStatus');
    input.write('s');
    await vi.waitFor(() => expect(secondStatus).toHaveBeenCalledTimes(1));
  });

  it('answers nothing, and leaves the server up, in a config without the daemon plugin', async () => {
    const dir = makeProject();

    // What a user's own vite config would look like if it carried the CLI plugin by mistake: startup
    // must still succeed, and the api must have nothing to answer rather than take the server down.
    const plugin = cliPlugin();
    server = await createServer({ root: dir, logLevel: 'silent', plugins: [plugin] });

    expect(plugin.api.getSession(), 'no daemon plugin means no session').toBeUndefined();
    plugin.api.displayStatus(); // must be a no-op, not a throw
    expect(slash(server.config.root), 'the server is still up').toBe(slash(dir));
  });
});
