import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viteburnerPlugin } from '../src/plugins/viteburner';
import { findViteBurnerPlugin } from '../src/plugins/viteburner';
import type { ViteBurnerUserConfig } from '../src/types';

/**
 * What a config-change restart does to the daemon, checked without a browser or the built CLI.
 *
 * `server.restart()` is exactly what vite does when the config file changes: it builds the
 * replacement server — running the plugin's `configureServer` for it — and only then closes the one
 * being replaced. That order is the whole difficulty, and this is the guard for it: when the plugin
 * kept one set of services in a closure, the old server's teardown closed the *replacement's*
 * watcher and socket and cleared its commands, so every assertion after the restart failed.
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

/**
 * A stand-in for the game: it answers the calls the sync path makes and records what it was asked.
 *
 * `getDefinitionFile` is the signal for adoption — the session asks for it when the game becomes the
 * active client, so a socket that was never adopted never appears in `calls`.
 */
function fakeGame(port: number) {
  const calls: string[] = [];
  const pushes: string[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.addEventListener('message', (event) => {
    const request = JSON.parse(String(event.data)) as { id: number; method: string; params?: { filename: string } };
    calls.push(request.method);
    if (request.method === 'pushFile' && request.params) {
      pushes.push(request.params.filename);
    }
    const result =
      request.method === 'getDefinitionFile'
        ? '// definitions'
        : request.method === 'calculateRam'
          ? 0
          : /FileNames|AllFiles/.test(request.method)
            ? []
            : 'OK';
    ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result, error: null }));
  });
  return { ws, calls, pushes };
}

describe('a config-change restart', () => {
  let server: ViteDevServer | undefined;
  let root: string | undefined;
  let game: ReturnType<typeof fakeGame> | undefined;

  afterEach(async () => {
    game?.ws.close();
    await server?.close();
    server = undefined;
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  it('keeps watching, syncing, and answering after the dev server is replaced', async () => {
    const port = await freePort();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'viteburner-restart-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(root, 'viteburner.config.json'), CONFIG);

    const inline = { cwd: root, port };
    // Typed as the user config so the `viteburner` key is allowed where vite's own InlineConfig would
    // reject the extra property.
    const config: ViteBurnerUserConfig = {
      root,
      logLevel: 'silent',
      viteburner: inline,
      plugins: [viteburnerPlugin(inline)],
    };
    server = await createServer(config);

    // The game connects, is adopted (which is why it is asked for the definitions), and is handed
    // the watched file.
    const first = fakeGame(port);
    game = first;
    await vi.waitFor(() => expect(first.calls).toContain('getDefinitionFile'), { timeout: 20_000 });
    await vi.waitFor(() => expect(first.pushes).toContain('a.js'), { timeout: 20_000 });

    await server.restart();

    // `getSession` hands back the replacement session. `fullUpload` is the command the old teardown
    // cleared, so after a restart it answered nothing at all and no push followed.
    const plugin = findViteBurnerPlugin(server.config);
    expect(plugin, 'the plugin is part of the restarted config').toBeDefined();
    first.pushes.length = 0;
    plugin?.api.getSession()?.sync.fullUpload();
    await vi.waitFor(() => expect(first.pushes).toContain('a.js'), { timeout: 20_000 });

    // A game that connects after the restart is adopted by the replacement too — the same
    // `getDefinitionFile` signal, from the session that outlived the restart — and a command still
    // reaches it.
    first.ws.close();
    const second = fakeGame(port);
    game = second;
    await vi.waitFor(() => expect(second.calls).toContain('getDefinitionFile'), { timeout: 20_000 });
    second.pushes.length = 0;
    plugin?.api.getSession()?.sync.fullUpload();
    await vi.waitFor(() => expect(second.pushes).toContain('a.js'), { timeout: 20_000 });
  });
});
