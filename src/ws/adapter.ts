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
      this.info('conn', '', 'connected');
      ws.on('close', () => {
        this.info('conn', '', pc.yellow('disconnected'));
      });
      await this.getDts();
      await this.handleHmrMessage();
    });
  }
  info(...msg: string[]) {
    this.server.config.logger.info(formatNormal(...msg));
  }
  error(msg: string) {
    this.server.config.logger.error(formatError(msg));
  }
  async getDts() {
    try {
      const data = await this.manager.getDefinitionFile();
      const root = this.server.config.root ?? process.cwd();
      const filename = this.server.config?.viteburner?.dts ?? 'NetscriptDefinitions.d.ts';
      const fullpath = path.resolve(root, filename);
      await fs.promises.writeFile(fullpath, data);
      this.info('dts change', filename);
    } catch (e) {
      this.error(`error getting dts file: ${e}`);
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
      this.info(`hmr ${item.event}`, item.file, pc.yellow('(pending)'));
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
  getFilename(data: HmrData) {
    const defaultRename = (file: string) => {
      if (file.startsWith('src/')) {
        file = file.substring(4);
      }
      if (file.endsWith('.ts')) {
        file = file.substring(0, file.length - 3) + '.js';
      }
      return file;
    };
    const rename = this.server.config?.viteburner?.watch?.[data.type]?.rename ?? defaultRename;
    return rename(data.file);
  }
  async transmitData(data: HmrData) {
    const formatFileChange = (from: string, to: string, serverName: string) => {
      const dest = `@${serverName}:${to}`;
      return `${pc.dim(from)} ${pc.reset('->')} ${pc.dim(dest)}`;
    };
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
        const buffer = await fs.promises.readFile(path.resolve(this.server.config.root, data.file));
        content = buffer.toString();
      }
      try {
        const filename = this.getFilename(data);
        const serverName = 'home';
        await this.manager.pushFile({
          filename,
          content,
          server: serverName,
        });
        // check timestamp
        this.deleteCache(data);
        const fileChangeStr = formatFileChange(data.file, filename, serverName);
        this.info(`hmr ${data.event}`, fileChangeStr, pc.green('(done)'));
      } catch (e) {
        this.error(`error on pusing file: ${data.file} ${e}`);
        this.error(`hmr ${data.event} ${data.file} (error)`);
      }
    } else if (data.event === 'unlink') {
      try {
        const filename = this.getFilename(data);
        const serverName = 'home';
        await this.manager.deleteFile({
          filename,
          server: serverName,
        });
        // check timestamp
        this.deleteCache(data);
        const fileChangeStr = formatFileChange(data.file, filename, serverName);
        this.info(`hmr ${data.event}`, fileChangeStr, pc.green('(done)'));
      } catch (e) {
        this.error(`error on deleting file: ${data.file} ${e}`);
        this.error(`hmr ${data.event} ${data.file} (error)`);
        return;
      }
    } else {
      throw new Error('Unknown hmr event: ' + data.event);
    }
  }
}
