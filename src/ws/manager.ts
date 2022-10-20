import { WebSocket, WebSocketServer } from 'ws';
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

export default class WsManager {
  ws: WebSocket | undefined;
  wss: WebSocketServer;
  trackers: PromiseHolder[];
  constructor(port: number) {
    this.trackers = [];
    this.ws = undefined;
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      this.ws = ws;
      ws.on('message', this.handleMessage);
    });
  }
  get nextId() {
    return this.trackers.length;
  }
  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  onConnected(cb: (ws: WebSocket) => void) {
    this.wss.on('connection', cb);
  }
  onDisconneted(cb: () => void) {
    this.wss.on('close', cb);
  }
  handleMessage(response: string) {
    const { id, result, error } = wsResponseSchema.parse(JSON.parse(response));
    if (!this.trackers[id]) {
      return;
    }
    if (error) {
      this.trackers[id].reject(error);
    }
    this.trackers[id].resolve(result);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendMessage<P = undefined, R extends z.ZodTypeAny = z.ZodTypeAny>(options: MessageSchema<P, R>) {
    const params = options.params;
    if (!this.ws || !this.connected) {
      throw new Error('No connection');
    }
    const id = this.nextId;
    this.ws.send({
      jsonrpc: '2.0',
      id,
      method: options.method,
      ...(params && { params }),
    });
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
