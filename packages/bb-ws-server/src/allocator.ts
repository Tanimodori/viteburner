import { WebSocket, WebSocketServer } from 'ws';

interface WsServerEntry {
  port: number;
  wss: WebSocketServer;
}

let entry: WsServerEntry | null = null;

/**
 * Returns the WebSocketServer bound to `port`, creating it on first use.
 *
 * A WsManager is rebuilt whenever its host restarts the surrounding server while the process stays
 * alive (vite does this on a config change). The manager therefore does not own the server: asking
 * for the same port again returns the running one instead of binding a second time and failing with
 * EADDRINUSE. Asking for a different port retires the previous server and its clients.
 */
export function acquireWss(port: number): WebSocketServer {
  if (entry === null || entry.port !== port) {
    if (entry) {
      entry.wss.clients.forEach((client) => client.close());
      entry.wss.close();
    }
    entry = { port, wss: new WebSocketServer({ port }) };
  }
  return entry.wss;
}

/**
 * The active client: the last client to connect that is still open.
 *
 * `WebSocketServer.clients` preserves insertion order and drops a client once it closes, so the last
 * open entry is exactly "the last one to connect that is still here". The manager sends every request
 * to this client and ignores messages from any other, which is what makes one port serve one active
 * client even when more than one has connected.
 */
export function getActiveClient(wss: WebSocketServer): WebSocket | undefined {
  let active: WebSocket | undefined;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      active = client;
    }
  }
  return active;
}

/**
 * Closes the shared server and disconnects its clients.
 *
 * WsManager deliberately does not call this: a host that restarts must be able to reuse the running
 * server (see `acquireWss`). Tests use it to release the port and let the process exit.
 */
export function closeWss(): Promise<void> {
  return new Promise((resolve) => {
    if (entry === null) {
      resolve();
      return;
    }
    const closing = entry;
    entry = null;
    closing.wss.clients.forEach((client) => client.terminate());
    closing.wss.close(() => resolve());
  });
}
