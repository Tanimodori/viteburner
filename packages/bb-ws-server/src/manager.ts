import { RawData, WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { acquireWss, getActiveClient, releaseWss } from './allocator';
import { consoleLogger, Logger } from './logger';
import {
  wsResponseSchema,
  PushFileParams,
  pushFileResponseSchema,
  getFileResponseSchema,
  GetFileParams,
  DeleteFileParams,
  deleteFileResponseSchema,
  GetFileNamesParams,
  getFileNamesResponseSchema,
  GetAllFilesParams,
  getAllFilesResponseSchema,
  CalculateRamParams,
  calculateRamResponseSchema,
  getDefinitionFileResponseSchema,
} from './messages';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PromiseHolder<T = any> {
  resolve: (value?: T) => void;
  reject: (reason?: unknown) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MessageSchema<P = undefined, R extends z.ZodTypeAny = z.ZodTypeAny> {
  method: string;
  params?: P;
  validator?: R;
}

export interface WsManagerOptions {
  port: number;
  timeout?: number;
  logger?: Logger;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any[]) => any;
type Promisable<T> = T | Promise<T>;

/** Called when a client becomes the active one. May return a cleanup for that client's handlers. */
export type ConnectedHandler = (ws: WebSocket) => Promisable<Fn | void>;

/**
 * Server side of the Bitburner Remote API: it listens for the game (which connects as a client) and
 * exposes every protocol method as a request/response call.
 *
 * The protocol is one-directional — this side always initiates and the game only answers — so the
 * whole API is the set of methods below; there is no server-push channel to model.
 *
 * One port serves one active client: the last client to connect. Requests go only to it, and
 * responses are accepted only from it. A client that was superseded stays connected but goes quiet —
 * closing it here would look like an unexpected disconnect to the game and, when the player enabled
 * `RemoteFileApiReconnectionDelay`, start a reconnect loop between the competing clients.
 *
 * The server itself is shared per port and held for as long as any manager uses it, so a host that
 * restarts (rebuilding its manager while the old one is still up) reuses the running one instead of
 * binding again. `close` gives up this manager's hold, and the last hold closes the port.
 */
export class WsManager {
  options: Required<WsManagerOptions>;
  wss: WebSocketServer;
  trackers: PromiseHolder[];
  nextId: number;
  private handlers: ConnectedHandler[];
  private clientCleanups: Map<ConnectedHandler, Fn>;
  private clientListeners: Map<WebSocket, { message: Fn; close: Fn }>;
  private serverUnregisters: Fn[];
  /** The client the connected handlers were last run for, used to detect a change of active client. */
  private announced: WebSocket | undefined;
  /** `close` gives up this manager's hold on the port, so it must do so exactly once. */
  private closed = false;

  constructor(options: WsManagerOptions) {
    this.options = {
      timeout: 10000,
      logger: consoleLogger,
      ...options,
    };
    this.trackers = [];
    this.nextId = 0;
    this.handlers = [];
    this.clientCleanups = new Map();
    this.clientListeners = new Map();
    this.serverUnregisters = [];
    this.wss = acquireWss(this.options.port);
    this._registerServerHandlers();
  }

  /** The active client, or `undefined` when none is connected. */
  get client() {
    return getActiveClient(this.wss);
  }
  get connected() {
    return this.client?.readyState === WebSocket.OPEN;
  }
  private _registerServerHandlers() {
    const onConnection = (ws: WebSocket) => this._adoptClient(ws);
    const onError = (e: unknown) => this._handleServerError(e);
    this.wss.on('connection', onConnection);
    this.wss.on('error', onError);
    this.serverUnregisters.push(() => {
      this.wss.off('connection', onConnection);
      this.wss.off('error', onError);
    });
  }
  private _handleServerError(e: unknown) {
    const err = String(e);
    if (err.indexOf('EADDRINUSE') !== -1) {
      this.options.logger.error('ws', `fatal: port ${this.options.port} is already in use`);
      process.exit(1);
    } else {
      this.options.logger.error('ws', `${err}`);
    }
  }
  private _adoptClient(ws: WebSocket) {
    const onMessage = (data: RawData) => {
      // Only the active client can answer a request: a superseded one has none outstanding.
      if (this.client === ws) {
        this.handleMessage(data);
      }
    };
    const onClose = () => {
      this._removeClientListeners(ws);
      this._refreshActive();
    };
    ws.on('message', onMessage);
    ws.on('close', onClose);
    this.clientListeners.set(ws, { message: onMessage, close: onClose });
    this._refreshActive();
  }
  private _removeClientListeners(ws: WebSocket) {
    const listeners = this.clientListeners.get(ws);
    if (!listeners) {
      return;
    }
    ws.off('message', listeners.message);
    ws.off('close', listeners.close);
    this.clientListeners.delete(ws);
  }
  private _refreshActive() {
    const active = this.client;
    if (active === this.announced) {
      return;
    }
    this._teardownClientCleanups();
    this.announced = active;
    if (active) {
      void this._announce(active);
    }
  }
  private async _announce(ws: WebSocket) {
    for (const handler of this.handlers) {
      await this._announceTo(handler, ws);
    }
  }
  private async _announceTo(handler: ConnectedHandler, ws: WebSocket) {
    const cleanup = await handler(ws);
    if (cleanup) {
      this.clientCleanups.set(handler, cleanup);
    }
  }
  private _teardownClientCleanups() {
    for (const cleanup of this.clientCleanups.values()) {
      cleanup();
    }
    this.clientCleanups.clear();
  }
  onConnected(handler: ConnectedHandler) {
    this.handlers.push(handler);
    // The server is shared per port, so a client may already be connected when this manager adopts
    // it (after the host restarted its own server). Announce it as if it had just connected.
    const active = this.client;
    if (!active) {
      return;
    }
    if (active === this.announced) {
      void this._announceTo(handler, active);
    } else {
      this.announced = active;
      void this._announce(active);
    }
  }
  handleMessage(response: RawData) {
    const parsed = wsResponseSchema.parse(JSON.parse(response.toString()));
    const { id, result, error } = parsed;
    if (!this.trackers[id]) {
      return;
    }
    // get those functions before deleting the tracker
    const { resolve, reject } = this.trackers[id];
    if (error) {
      reject(error);
    }
    resolve(result);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendMessage<P = undefined, R extends z.ZodTypeAny = z.ZodTypeAny>(options: MessageSchema<P, R>) {
    const params = options.params;
    const ws = this.client;

    // preflight check
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('No connection');
    }
    const id = ++this.nextId;

    // send message
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: options.method,
        ...(params && { params }),
      }),
    );

    // constructing the result
    const result = new Promise<z.infer<R>>((resolve, reject) => {
      const onResolve = (data: unknown) => {
        try {
          resolve(options.validator?.parse(data) ?? data);
        } catch (e) {
          reject(e);
        } finally {
          delete this.trackers[id];
        }
      };
      const onReject = (reason: unknown) => {
        delete this.trackers[id];
        reject(reason);
      };
      this.trackers[id] = {
        resolve: onResolve,
        reject: onReject,
      };
    });

    // timeout
    if (this.options.timeout) {
      setTimeout(() => {
        if (this.trackers[id]) {
          this.trackers[id].reject(new Error(`Timeout after ${this.options.timeout}ms`));
        }
      }, this.options.timeout);
    }

    return result;
  }
  async pushFile(params: PushFileParams) {
    return this.sendMessage({
      method: 'pushFile',
      params,
      validator: pushFileResponseSchema,
    });
  }
  async getFile(params: GetFileParams) {
    return this.sendMessage({
      method: 'getFile',
      params,
      validator: getFileResponseSchema,
    });
  }
  async deleteFile(params: DeleteFileParams) {
    return this.sendMessage({
      method: 'deleteFile',
      params,
      validator: deleteFileResponseSchema,
    });
  }
  async getFileNames(params: GetFileNamesParams) {
    return this.sendMessage({
      method: 'getFileNames',
      params,
      validator: getFileNamesResponseSchema,
    });
  }
  async getAllFiles(params: GetAllFilesParams) {
    return this.sendMessage({
      method: 'getAllFiles',
      params,
      validator: getAllFilesResponseSchema,
    });
  }
  async calculateRam(params: CalculateRamParams) {
    return this.sendMessage({
      method: 'calculateRam',
      params,
      validator: calculateRamResponseSchema,
    });
  }
  async getDefinitionFile() {
    return this.sendMessage({
      method: 'getDefinitionFile',
      validator: getDefinitionFileResponseSchema,
    });
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    // remove all handlers
    this.serverUnregisters.forEach((unregister) => unregister());
    this.serverUnregisters = [];
    this._teardownClientCleanups();
    for (const ws of this.clientListeners.keys()) {
      this._removeClientListeners(ws);
    }
    this.handlers = [];
    this.announced = undefined;
    // Give up this manager's hold: the last one releases the port.
    releaseWss(this.options.port);
  }
}
