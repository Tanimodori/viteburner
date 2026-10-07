import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { closeWss } from '../src/allocator';
import { WsManager } from '../src/manager';

/**
 * The single-active-client rule is checked against a real server and real sockets: it is a statement
 * about connection order (`WebSocketServer.clients`) as much as about the manager's bookkeeping, and
 * a mocked socket would assert neither.
 *
 * The manager holds the server-side socket for a connection, which is a different object from the
 * client-side socket a test dials in with, so the active client is asserted through what it receives
 * (a request only the active client may answer) rather than by object identity.
 */

let nextPort = 20000;

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

/** Answer every request like the game does, echoing the request id. */
function autoRespond(ws: WebSocket, result: unknown = 'OK') {
  ws.on('message', (data) => {
    const request = JSON.parse(data.toString()) as { id: number };
    ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result, error: null }));
  });
}

function collect(ws: WebSocket) {
  const messages: unknown[] = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  return messages;
}

/** Wait until the server has accepted `count` connections. */
async function waitForClients(manager: WsManager, count: number) {
  await vi.waitFor(() => expect(manager.wss.clients.size).toBe(count));
}

afterEach(async () => {
  await closeWss();
});

describe('WsManager active client', () => {
  it('answers a request from the last client that connected, and from no other', async () => {
    const port = nextPort++;
    const manager = new WsManager({ port });
    const first = await connect(port);
    await waitForClients(manager, 1);

    // With a single client, a request goes to it.
    const firstMessages = collect(first);
    autoRespond(first);
    await expect(manager.pushFile({ filename: 'a.js', content: '', server: 'home' })).resolves.toBe('OK');
    expect(firstMessages).toHaveLength(1);

    const second = await connect(port);
    await waitForClients(manager, 2);
    firstMessages.length = 0;
    const secondMessages = collect(second);
    autoRespond(second);

    await expect(manager.pushFile({ filename: 'b.js', content: '', server: 'home' })).resolves.toBe('OK');
    expect(secondMessages).toHaveLength(1);
    expect(firstMessages, 'the superseded client must not receive requests').toHaveLength(0);

    manager.close();
  });

  it('falls back to an earlier client when the active one closes', async () => {
    const port = nextPort++;
    const manager = new WsManager({ port });
    const first = await connect(port);
    await waitForClients(manager, 1);
    const second = await connect(port);
    await waitForClients(manager, 2);

    second.close();
    await waitForClients(manager, 1);

    autoRespond(first);
    await expect(manager.pushFile({ filename: 'a.js', content: '', server: 'home' })).resolves.toBe('OK');

    manager.close();
  });

  it('runs the connected handler for each active client and cleans up the superseded one', async () => {
    const port = nextPort++;
    const manager = new WsManager({ port });
    const seen: unknown[] = [];
    const cleaned: unknown[] = [];
    manager.onConnected((ws) => {
      seen.push(ws);
      return () => cleaned.push(ws);
    });

    await connect(port);
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    await connect(port);
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(cleaned, 'the first client should be cleaned up when it is superseded').toHaveLength(1);

    manager.close();
    expect(cleaned, 'closing the manager should clean up the active client').toHaveLength(2);
  });

  it('announces an already-connected client to a manager created afterwards', async () => {
    const port = nextPort++;
    const previous = new WsManager({ port });
    await connect(port);
    await waitForClients(previous, 1);

    // A second manager over the same port is the situation after the host restarts its server: the
    // client is already there and must be adopted, not waited for.
    const manager = new WsManager({ port });
    const seen: unknown[] = [];
    manager.onConnected((ws) => {
      seen.push(ws);
    });

    await vi.waitFor(() => expect(seen).toHaveLength(1));

    previous.close();
    manager.close();
  });

  it('shares one server per port and keeps it open while either manager holds it', async () => {
    const port = nextPort++;
    const previous = new WsManager({ port });
    const current = new WsManager({ port });
    // A manager built while another is up reuses the running server instead of binding again.
    expect(current.wss).toBe(previous.wss);

    const ws = await connect(port);
    await waitForClients(current, 1);

    // The restart overlap: the old manager goes away while its replacement is already serving, and
    // the port has to outlive the old one.
    previous.close();

    autoRespond(ws);
    await expect(current.pushFile({ filename: 'a.js', content: '', server: 'home' })).resolves.toBe('OK');

    current.close();
    ws.close();
  });

  it('releases the port when the last manager closes', async () => {
    const port = nextPort++;
    const manager = new WsManager({ port });
    const ws = await connect(port);
    await waitForClients(manager, 1);

    const server = manager.wss;
    manager.close();
    ws.close();

    // Nothing is listening any more, so the port is free to be bound again.
    await vi.waitFor(() => expect(server.address()).toBeNull(), { timeout: 5000 });
  });

  it('rejects a request while no client is connected', async () => {
    const manager = new WsManager({ port: nextPort++ });
    await expect(manager.pushFile({ filename: 'a.js', content: '', server: 'home' })).rejects.toThrow('No connection');
    manager.close();
  });
});
