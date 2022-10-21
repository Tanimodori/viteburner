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

const defaultRename = (file: string) => {
  if (file.startsWith('src/')) {
    file = file.substring(4);
  }
  if (file.endsWith('.ts')) {
    file = file.substring(0, file.length - 3) + '.js';
  }
  return file;
};

const resolveHmrData = (data: HmrData) => {
  let result = data.rename ?? defaultRename;
  if (typeof result === 'function') {
    result = result(data.file);
  }
  if (!Array.isArray(result)) {
    result = [result];
  }
  return result.map((r) => {
    if (typeof r === 'string') {
      return { filename: forceStartingSlashNonRoot(r), server: 'home' };
    } else {
      return r;
    }
  });
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
    let filename = this.server.config?.viteburner?.dts;
    if (filename === false) {
      return;
    }
    if (filename === undefined || filename === true) {
      filename = 'NetscriptDefinitions.d.ts';
    }
    try {
      const data = await this.manager.getDefinitionFile();
      const root = this.server.config.root ?? process.cwd();
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
  async fetchModule(data: HmrData) {
    let content = '';
    if (data.transform) {
      const module = await this.server.fetchModule(data.file);
      if (!module) {
        throw new Error('module not found: ' + data.file);
      }
      content = module.code;
      if (this.server.config?.viteburner?.sourcemap === 'inline' && module.map) {
        content += getSourceMapString(module.map);
      }
    } else {
      const buffer = await fs.promises.readFile(path.resolve(this.server.config.root, data.file));
      content = buffer.toString();
    }
    return content;
  }
  async transmitData(data: HmrData) {
    // if true, we need to transmit the file
    const isAdd = data.event !== 'unlink';

    // try to get the file content
    let content = '';
    if (isAdd) {
      try {
        content = await this.fetchModule(data);
      } catch (e: unknown) {
        logger.error(String(e));
        return;
      }
    }

    // resolve actual filename and servers
    const payloads = resolveHmrData(data);
    for (const { filename, server: serverName } of payloads) {
      const fileChangeStrs = formatFileChange(data.file, filename, serverName);
      try {
        if (isAdd) {
          await this.manager.pushFile({
            filename,
            content,
            server: serverName,
          });
        } else {
          await this.manager.deleteFile({
            filename,
            server: serverName,
          });
        }
        // check timestamp
        this.deleteCache(data);
        logger.info(`hmr ${data.event}`, fileChangeStrs.styled, pc.green('(done)'));
      } catch (e) {
        logger.error(`error ${data.event}: ${fileChangeStrs.raw} ${e}`);
        logger.error(`hmr ${data.event} ${data.file} (error)`);
        continue;
      }
    }
  }
}
