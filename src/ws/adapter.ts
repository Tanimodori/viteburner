import { getSourceMapString, HmrData, logger, ViteBurnerServer } from '..';
import WsManager from './manager';
import fs from 'fs';
import pc from 'picocolors';
import path from 'path';

/** Enforce starting slash */
const forceStartingSlash = (s: string) => {
  return s.startsWith('/') ? s : '/' + s;
};

/** Enforce starting slash if file is not in root dir */
const forceStartingSlashNonRoot = (s: string) => {
  return s.indexOf('/') !== -1 && !s.startsWith('/') ? '/' + s : s;
};

const formatFileChange = (from: string, to: string, serverName: string) => {
  to = forceStartingSlash(to);
  const dest = `@${serverName}:${to}`;
  return {
    styled: `${pc.dim(from)} ${pc.reset('->')} ${pc.dim(dest)}`,
    raw: `${from} -> ${dest}`,
  };
};

export default class WsAdapter {
  buffers: Map<string, HmrData> = new Map();
  manager: WsManager;
  server: ViteBurnerServer;
  constructor(manager: WsManager, server: ViteBurnerServer) {
    this.manager = manager;
    this.server = server;
    this.manager.onConnected(async (ws) => {
      logger.info('conn', '', 'connected');
      ws.on('close', () => {
        logger.info('conn', '', pc.yellow('disconnected'));
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
      logger.info('dts change', filename);
    } catch (e) {
      logger.error(`error getting dts file: ${e}`);
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
      logger.info(`hmr ${item.event}`, item.file, pc.yellow('(pending)'));
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
    const rename = data?.rename ?? defaultRename;
    return forceStartingSlashNonRoot(rename(data.file));
  }
  async transmitData(data: HmrData) {
    if (data.event === 'add' || data.event === 'change') {
      let content = '';
      if (data.transform) {
        const module = await this.server.fetchModule(data.file);
        if (!module) {
          logger.error('module not found: ' + data.file);
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
      const filename = this.getFilename(data);
      const serverName = 'home';
      const fileChangeStrs = formatFileChange(data.file, filename, serverName);
      try {
        await this.manager.pushFile({
          filename,
          content,
          server: serverName,
        });
        // check timestamp
        this.deleteCache(data);
        logger.info(`hmr ${data.event}`, fileChangeStrs.styled, pc.green('(done)'));
      } catch (e) {
        logger.error(`error on pusing file: ${fileChangeStrs.raw} ${e}`);
        logger.error(`hmr ${data.event} ${data.file} (error)`);
      }
    } else if (data.event === 'unlink') {
      const filename = this.getFilename(data);
      const serverName = 'home';
      const fileChangeStrs = formatFileChange(data.file, filename, serverName);
      try {
        await this.manager.deleteFile({
          filename,
          server: serverName,
        });
        // check timestamp
        this.deleteCache(data);
        logger.info(`hmr ${data.event}`, fileChangeStrs.styled, pc.green('(done)'));
      } catch (e) {
        logger.error(`error on deleting file: ${fileChangeStrs.raw} ${e}`);
        logger.error(`hmr ${data.event} ${data.file} (error)`);
        return;
      }
    } else {
      throw new Error('Unknown hmr event: ' + data.event);
    }
  }
}
