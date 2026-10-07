import type {
  CalculateRamParams,
  DeleteFileParams,
  GetAllFilesParams,
  GetFileNamesParams,
  PushFileParams,
  WsManagerOptions,
} from 'bb-ws-server';
import { WsManager } from 'bb-ws-server';
import pc from 'picocolors';
import { logger } from '@/console';
import { EventBus } from '@/services/bus';

/**
 * The transport: the game connects here, and this is the side that speaks the Remote API to it.
 *
 * It publishes the two connection transitions on the bus and answers the protocol calls, and knows
 * nothing about files, transforms, or the config — a request in, a response out.
 *
 * `start` opens the port and `stop` closes it, so this service owns the port for exactly its own
 * lifetime rather than leaving it bound behind it.
 */
export class WsService {
  private manager?: WsManager;

  constructor(
    private readonly options: WsManagerOptions,
    private readonly bus: EventBus,
  ) {}

  get connected() {
    return this.manager?.connected ?? false;
  }

  start() {
    if (this.manager) {
      return;
    }
    const manager = new WsManager(this.options);
    manager.onConnected((ws) => {
      logger.info('conn', '', 'connected');
      void this.bus.emit('ws:connected', undefined);
      const onClose = () => {
        logger.info('conn', '', pc.yellow('disconnected'));
        void this.bus.emit('ws:disconnected', undefined);
      };
      ws.on('close', onClose);
      return () => {
        ws.off('close', onClose);
      };
    });
    this.manager = manager;
  }

  stop() {
    this.manager?.close();
    this.manager = undefined;
  }

  private get started(): WsManager {
    if (!this.manager) {
      throw new Error('the websocket service is not started');
    }
    return this.manager;
  }

  pushFile(params: PushFileParams) {
    return this.started.pushFile(params);
  }

  deleteFile(params: DeleteFileParams) {
    return this.started.deleteFile(params);
  }

  getAllFiles(params: GetAllFilesParams) {
    return this.started.getAllFiles(params);
  }

  getFileNames(params: GetFileNamesParams) {
    return this.started.getFileNames(params);
  }

  calculateRam(params: CalculateRamParams) {
    return this.started.calculateRam(params);
  }

  getDefinitionFile() {
    return this.started.getDefinitionFile();
  }
}
