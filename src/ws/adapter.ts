import { getSourceMapString, HmrData, logger, ViteBurnerServer } from '..';
import { WsManager } from './manager';
import fs from 'fs';
import pc from 'picocolors';
import path, { resolve } from 'path';

/** Enforce starting slash */
export const forceStartingSlash = (s: string) => {
  return s.startsWith('/') ? s : '/' + s;
};

/** Enforce starting slash if file is not in root dir */
export const fixStartingSlash = (s: string) => {
  const index = s.lastIndexOf('/');
  if (index === 0) {
    // if file is in root dir with starting slash, remove it
    return s.substring(1);
  } else if (index !== -1) {
    // if file is not in root dir, add starting slash
    return forceStartingSlash(s);
  } else {
    // if file is in root dir without starting slash, keep it as-is
    return s;
  }
};

/** Remove starting slash on download */
export const removeStartingSlash = (s: string) => {
  return s.startsWith('/') ? s.substring(1) : s;
};

export const formatUpload = (from: string, to: string, serverName: string) => {
  to = forceStartingSlash(to);
  const dest = `@${serverName}:${to}`;
  return {
    styled: `${pc.dim(from)} ${pc.reset('->')} ${pc.dim(dest)}`,
    raw: `${from} -> ${dest}`,
  };
};

export const formatDownload = (from: string, to: string, serverName: string) => {
  to = removeStartingSlash(to);
  const src = `@${serverName}:/${from}`;
  return {
    styled: `${pc.dim(src)} ${pc.reset('->')} ${pc.dim(to)}`,
    raw: `${src} -> ${to}`,
  };
};

export const defaultUploadLocation = (file: string) => {
  if (file.startsWith('src/')) {
    file = file.substring(4);
  }
  if (file.endsWith('.ts')) {
    file = file.substring(0, file.length - 3) + '.js';
  }
  return file;
};

export const resolveHmrData = (data: HmrData) => {
  const defaultFilename = defaultUploadLocation(data.file);
  let result = data.location ?? 'home';
  if (typeof result === 'function') {
    result = result(data.file);
  }
  if (!Array.isArray(result)) {
    result = [result];
  }
  return result.map((r) => {
    const itemResult = {
      filename: defaultFilename,
      server: 'home',
      ...(typeof r === 'string' ? { server: r } : r),
    };
    itemResult.filename = fixStartingSlash(itemResult.filename);
    return itemResult;
  });
};

export interface FileContent {
  filename: string;
  content: string;
}

export const defaultDownloadLocation = (file: string) => {
  return 'src/' + file;
};

export class WsAdapter {
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
    this.server.viteburnerEmitter.on('full-download', () => {
      this.fullDownload();
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
        await this.uploadFile(item);
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
  async uploadFile(data: HmrData) {
    // check timestamp and clear cache to prevent repeated entries
    this.deleteCache(data);

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
      const fileChangeStrs = formatUpload(data.file, filename, serverName);
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
        logger.info(`hmr ${data.event}`, fileChangeStrs.styled, pc.green('(done)'));
      } catch (e) {
        logger.error(`error ${data.event}: ${fileChangeStrs.raw} ${e}`);
        logger.error(`hmr ${data.event} ${data.file} (error)`);
        continue;
      }
    }
  }
  async fullDownload() {
    // stop watching
    logger.info('vite', pc.reset('stop watching for file changes while download'));
    this.server.viteburnerEmitter.emit('enable-watch', false);

    // get servers
    let servers = this.server.config.viteburner?.download?.server ?? 'home';
    if (!Array.isArray(servers)) {
      servers = [servers];
    }

    // get files
    const filesMap = new Map<string, FileContent[]>();
    for (const server of servers) {
      try {
        filesMap.set(server, await this.manager.getAllFiles({ server }));
      } catch (e) {
        logger.error(`error: connot get filelist from server ${server}: ${e}`);
        continue;
      }
    }

    for (const [server, files] of filesMap) {
      const locationFn = this.server.config.viteburner?.download?.location ?? defaultDownloadLocation;
      const ignoreTs = this.server.config.viteburner?.download?.ignoreTs ?? true;
      for (const file of files) {
        file.filename = removeStartingSlash(file.filename);
        const location = locationFn(file.filename, server);
        if (!location) {
          logger.info(`download`, `@${server}:/${file.filename}`, pc.dim('(ignored)'));
          continue;
        }
        const resolvedLocation = resolve(this.server.config.root, location);
        const fileChangeStrs = formatDownload(file.filename, location, server);
        try {
          // ignoreTs
          if (
            ignoreTs &&
            resolvedLocation.endsWith('.js') &&
            fs.existsSync(resolvedLocation.substring(0, resolvedLocation.length - 3) + '.ts')
          ) {
            logger.info(`download`, fileChangeStrs.raw, pc.dim('(ignored)'));
            continue;
          }
          // copy
          await fs.promises.writeFile(resolvedLocation, file.content, {
            flag: 'w',
            encoding: 'utf8',
          });
          logger.info(`download`, fileChangeStrs.styled, pc.green('(done)'));
        } catch (e) {
          logger.error(`download`, fileChangeStrs.raw, '(error)');
        }
      }
    }

    logger.info('vite', pc.reset('download completed, watching for file changes...'));
    this.server.viteburnerEmitter.emit('enable-watch', true);
  }
}
