import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cliPlugin } from '../src/plugins/cli';
import { viteburnerPlugin } from '../src/plugins/viteburner';
import { findViteBurnerPlugin } from '../src/plugins/viteburner/api';
import type { ViteBurnerUserConfig } from '../src/types';
import { slash } from '../src/utils/path';

/**
 * The CLI's key plugin inside a real `createServer`, checked without a terminal or a built CLI.
 *
 * The question this answers is whether attaching the key reader from a vite plugin hook survives the
 * ordinary startup flow — including the config-change restart that replaces the dev server while
 * reusing the plugin instance. The reader is given a `PassThrough` (the `cliPlugin` seam) instead of
 * `process.stdin`, so one key written to it is exactly one `keypress` event and the test runner's own
 * stdin is never touched.
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

  it('answers a key through the viteburner plugin, and keeps answering after a restart', async () => {
    const port = await freePort();
    const dir = makeProject();
    const inline = { cwd: dir, port };
    const input = new PassThrough();
    // Typed as the user config so the `viteburner` key is allowed where vite's own InlineConfig would
    // reject the extra property.
    const config: ViteBurnerUserConfig = {
      root: dir,
      logLevel: 'silent',
      viteburner: inline,
      plugins: [viteburnerPlugin(inline), cliPlugin({ input })],
    };
    server = await createServer(config);

    const plugin = findViteBurnerPlugin(server.config);
    expect(plugin, 'the plugin is part of the resolved config').toBeDefined();
    // `s` renders the status block from this read, so the spy is the CLI's question to the daemon.
    const status = vi.spyOn(plugin!.api, 'getStatus');

    // The reader is attached during `createServer`, so one key written right after it resolves is
    // already answered — the same window a plain vite startup would give it.
    input.write('s');
    await vi.waitFor(() => expect(status).toHaveBeenCalledTimes(1));

    // A config-change restart reuses this plugin instance and re-runs `configResolved` and
    // `configureServer`. The reader must not be attached a second time: the next key dispatches once,
    // not twice, and it still reaches the replacement session's api.
    await server.restart();
    input.write('s');
    await vi.waitFor(() => expect(status).toHaveBeenCalledTimes(2));
  });

  it('leaves a config without the viteburner plugin alone instead of breaking startup', async () => {
    const dir = makeProject();
    const input = new PassThrough();

    // What a user's own vite config would look like if it carried the CLI plugin by mistake: startup
    // must still succeed, and the keys must have nothing to answer rather than take the server down.
    server = await createServer({ root: dir, logLevel: 'silent', plugins: [cliPlugin({ input })] });
    expect(findViteBurnerPlugin(server.config), 'no viteburner plugin in this config').toBeUndefined();

    input.write('s');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(slash(server.config.root), 'the server is still up').toBe(slash(dir));
  });
});
