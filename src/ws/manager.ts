import { RawData, WebSocket, WebSocketServer } from 'ws';
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
import { z } from 'zod';
import { logger } from '..';

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
}

export class WsManager {
  options: Required<WsManagerOptions>;
  ws: WebSocket | undefined;
  wss: WebSocketServer;
  trackers: PromiseHolder[];
  nextId: number;
  constructor(options: WsManagerOptions) {
    this.options = {
      timeout: 10000,
      ...options,
    };
    this.trackers = [];
    this.nextId = 0;
    this.ws = undefined;
    this.wss = new WebSocketServer({ port: this.options.port });
    this.wss.on('connection', (ws) => {
      this.ws = ws;
      ws.on('message', (response) => this.handleMessage(response));
    });
    this.wss.on('error', (e) => {
      const err = String(e);
      if (err.indexOf('EADDRINUSE') !== -1) {
        logger.error('ws', `fatal: port ${this.options.port} is already in use`);
        process.exit(1);
      } else {
        logger.error('ws', `${err}`);
      }
    });
  }
  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  onConnected(cb: (ws: WebSocket) => void) {
    this.wss.on('connection', (ws) => {
      // ensure ws is saved before any sendMessage calls
      this.ws = ws;
      cb(ws);
    });
  }
  onDisconneted(cb: () => void) {
    this.wss.on('close', cb);
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

    // preflight check
    if (!this.ws || !this.connected) {
      throw new Error('No connection');
    }
    const id = ++this.nextId;

    // send message
    this.ws.send(
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
}
