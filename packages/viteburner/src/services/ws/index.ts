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
 */
export class WsService {
  readonly manager: WsManager;

  constructor(
    options: WsManagerOptions,
    private readonly bus: EventBus,
  ) {
    this.manager = new WsManager(options);
  }

  get connected() {
    return this.manager.connected;
  }

  start() {
    this.manager.onConnected((ws) => {
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
  }

  stop() {
    this.manager.close();
  }

  pushFile(params: PushFileParams) {
    return this.manager.pushFile(params);
  }

  deleteFile(params: DeleteFileParams) {
    return this.manager.deleteFile(params);
  }

  getAllFiles(params: GetAllFilesParams) {
    return this.manager.getAllFiles(params);
  }

  getFileNames(params: GetFileNamesParams) {
    return this.manager.getFileNames(params);
  }

  calculateRam(params: CalculateRamParams) {
    return this.manager.calculateRam(params);
  }

  getDefinitionFile() {
    return this.manager.getDefinitionFile();
  }
}
