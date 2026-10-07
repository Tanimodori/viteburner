import { WebSocket, WebSocketServer } from 'ws';

interface WsServerEntry {
  wss: WebSocketServer;
  /** How many managers are using this server. */
  refs: number;
}

/** The one server per port, and how many managers are holding it. */
const entries = new Map<number, WsServerEntry>();

/**
 * Returns the WebSocketServer bound to `port`, creating it on first use and counting one user.
 *
 * A WsManager is rebuilt whenever its host restarts the surrounding server while the process stays
 * alive (vite does this on a config change), and for a moment the old and new managers both exist.
 * They therefore share one server per port rather than each binding its own — asking for a port
 * already in use here returns the running server instead of failing with EADDRINUSE.
 *
 * The count is what keeps it alive: the server is closed by the last `releaseWss` for the port, so
 * it never outlives the managers that use it.
 */
export function acquireWss(port: number): WebSocketServer {
  let entry = entries.get(port);
  if (!entry) {
    entry = { wss: new WebSocketServer({ port }), refs: 0 };
    entries.set(port, entry);
  }
  entry.refs++;
  return entry.wss;
}

/**
 * Gives up one user of `port`'s server, closing it when none are left.
 *
 * Closing on the last release makes the port's lifetime exactly the union of its users: a manager
 * that goes away — a host shutting down, or one side of a restart — does not leave a bound port
 * behind for whatever runs next.
 */
export function releaseWss(port: number): void {
  const entry = entries.get(port);
  if (!entry) {
    return;
  }
  entry.refs--;
  if (entry.refs > 0) {
    return;
  }
  entries.delete(port);
  entry.wss.clients.forEach((client) => client.close());
  entry.wss.close();
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
 * Closes every server and disconnects its clients, whatever its user count.
 *
 * This is the escape hatch for a host that wants the ports gone regardless of who is still holding
 * them — a test does this between cases so a manager left open cannot fail the next one.
 */
export function closeWss(): Promise<void> {
  const closing = [...entries.values()];
  entries.clear();
  return Promise.all(
    closing.map(
      (entry) =>
        new Promise<void>((resolve) => {
          entry.wss.clients.forEach((client) => client.terminate());
          entry.wss.close(() => resolve());
        }),
    ),
  ).then(() => undefined);
}
