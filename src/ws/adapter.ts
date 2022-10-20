import { formatError, formatNormal, getSourceMapString, HmrData, ViteBurnerServer } from '..';
import WsManager from './manager';
import fs from 'fs';
import pc from 'picocolors';
import path from 'path';

export default class WsAdapter {
  buffers: Map<string, HmrData> = new Map();
  manager: WsManager;
  server: ViteBurnerServer;
  constructor(manager: WsManager, server: ViteBurnerServer) {
    this.manager = manager;
    this.server = server;
    this.manager.onConnected(async (ws) => {
      this.server.config.logger.info(formatNormal('conn', '', 'connected'));
      ws.on('close', () => {
        this.server.config.logger.info(formatNormal('conn', '', pc.yellow('disconnected')));
      });
      await this.getDts();
      await this.handleHmrMessage();
    });
  }
  async getDts() {
    try {
      const data = await this.manager.getDefinitionFile();
      const root = this.server.config.root ?? process.cwd();
      const filename = this.server.config?.viteburner?.dts ?? 'NetscriptDefinitions.d.ts';
      const fullpath = path.resolve(root, filename);
      await fs.promises.writeFile(fullpath, data);
      this.server.config.logger.info(formatNormal('dts change', filename));
    } catch (e) {
      this.server.config.logger.error(formatError(`error getting dts file: ${e}`));
    }
  }
  async handleHmrMessage(data?: HmrData | HmrData[]) {
    if (!data) {
      data = [];
    } else if (!Array.isArray(data)) {
      data = [data];
    }
    const connected = this.manager.connected;
    for (const item of data) {
      this.buffers.set(item.file, item);
      this.server.config.logger.info(formatNormal(`hmr ${item.event}`, item.file, pc.yellow('(pending)')));
    }
    if (!connected) {
      return;
    }
    // transmit buffered data
    if (this.buffers.size) {
      for (const item of this.buffers.values()) {
        await this.transmitData(item);
      }
    }
  }
  deleteCache(data: HmrData) {
    const currentData = this.buffers.get(data.file);
    if (currentData && data.timestamp === currentData.timestamp) {
      this.buffers.delete(data.file);
    }
  }
  async transmitData(data: HmrData) {
    if (data.event === 'add' || data.event === 'change') {
      let content = '';
      if (data.transform) {
        const module = await this.server.fetchModule(data.file);
        if (!module) {
          this.server.config.logger.error('module not found: ' + data.file);
          return;
        }
        content = module.code;
        if (this.server.config?.viteburner?.sourcemap === 'inline' && module.map) {
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
        this.server.config.logger.error(formatError(`error pushing file: ${data.file} ${e}`));
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
        this.server.config.logger.error(formatError(`error pushing file: ${data.file} ${e}`));
      }
    } else {
      throw new Error('Unknown hmr event: ' + data.event);
    }
    this.server.config.logger.info(formatNormal(`hmr ${data.event}`, data.file, pc.green('(done)')));
  }
}
