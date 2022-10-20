import { HmrData, ViteBurnerServer } from '..';
import WsManager from './manager';
import fs from 'fs';

export default class WsAdapter {
  buffers: Map<string, HmrData> = new Map();
  manager: WsManager;
  constructor(manager: WsManager) {
    this.manager = manager;
  }
  handleHmrMessage(data: HmrData, server: ViteBurnerServer) {
    this.buffers.set(data.file, data);
    if (!this.manager.connected) {
      return;
    }
    // transmit buffered data
    if (this.buffers.size) {
      this.buffers.forEach((data) => this.transmitData(data, server));
    }
  }
  async transmitData(data: HmrData, server: ViteBurnerServer) {
    if (data.event === 'add' || data.event === 'change') {
      let content = '';
      if (data.transform) {
        const module = await server.fetchModule(data.file);
        if (!module) {
          server.config.logger.error('[viteburner] module not found: ' + data.file);
          return;
        }
        // TODO sourcemap
        content = module.code;
      } else {
        const buffer = await fs.promises.readFile(data.file);
        content = buffer.toString();
      }
      try {
        await this.manager.pushFile({
          filename: data.file,
          content,
          server: 'home',
        });
        // check timestamp
        const currentData = this.buffers.get(data.file);
        if (currentData && data.timestamp === currentData.timestamp) {
          this.buffers.delete(data.file);
        }
      } catch (e) {
        server.config.logger.error(`[viteburner] error pushing file: ${data.file} ${e}`);
      }
    }
  }
}
