import { formatNormal, getSourceMapString, HmrData, ViteBurnerServer } from '..';
import WsManager from './manager';
import fs from 'fs';
import pc from 'picocolors';

export default class WsAdapter {
  buffers: Map<string, HmrData> = new Map();
  manager: WsManager;
  constructor(manager: WsManager) {
    this.manager = manager;
  }
  async handleHmrMessage(data: HmrData | HmrData[], server: ViteBurnerServer) {
    const connected = this.manager.connected;
    if (!Array.isArray(data)) {
      data = [data];
    }
    for (const item of data) {
      this.buffers.set(item.file, item);
      server.config.logger.info(formatNormal(`hmr ${item.event}`, item.file, pc.yellow('(pending)')));
    }
    if (!connected) {
      return;
    }
    // transmit buffered data
    if (this.buffers.size) {
      for (const item of this.buffers.values()) {
        await this.transmitData(item, server);
      }
    }
  }
  deleteCache(data: HmrData) {
    const currentData = this.buffers.get(data.file);
    if (currentData && data.timestamp === currentData.timestamp) {
      this.buffers.delete(data.file);
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
        content = module.code;
        if (server.config?.viteburner?.sourcemap === 'inline' && module.map) {
          content += getSourceMapString(module.map);
        }
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
        this.deleteCache(data);
      } catch (e) {
        server.config.logger.error(`[viteburner] error pushing file: ${data.file} ${e}`);
      }
    } else if (data.event === 'unlink') {
      try {
        await this.manager.deleteFile({
          filename: data.file,
          server: 'home',
        });
        // check timestamp
        this.deleteCache(data);
      } catch (e) {
        server.config.logger.error(`[viteburner] error pushing file: ${data.file} ${e}`);
      }
    } else {
      throw new Error('Unknown hmr event: ' + data.event);
    }
    server.config.logger.info(formatNormal(`hmr ${data.event}`, data.file, pc.green('(done)')));
  }
}
