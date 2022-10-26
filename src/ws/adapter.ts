import {
  getSourceMapString,
  logger,
  writeFile,
  isScriptFile,
  fixStartingSlash,
  forceStartingSlash,
  removeStartingSlash,
} from '..';
import { WsManager } from './manager';
import fs from 'fs';
import pc from 'picocolors';
import path, { resolve } from 'path';
import { slash } from 'vite-node/utils';
import fg from 'fast-glob';
import { fixImportPath } from './import';
import { ViteBurnerServer, HmrData } from '@/types';

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

export interface FileContent {
  filename: string;
  content: string;
}

export interface ResolvedDataItem {
  filename: string;
  server: string;
}

export type ResolvedData = ResolvedDataItem[];

export const defaultDownloadLocation = (file: string) => {
  return 'src/' + file;
};

export const defaultDts = 'NetscriptDefinitions.d.ts';
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
  }
  async getDts() {
    const filename = this.server.config.viteburner.dts;
    if (!filename) {
      return;
    }
    try {
      const data = await this.manager.getDefinitionFile();
      const root = this.server.config.root;
      const fullpath = path.resolve(root, filename);
      await writeFile(fullpath, data);
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
      // invalidate vite cache
      if (item.transform) {
        this.server.invalidateFile(item.file);
      }
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
  async dumpFile(data: HmrData, content: string, server: string) {
    const relative = this.server.config.viteburner.dumpFiles?.(data.file, server);
    if (!relative) {
      return;
    }
    const fullpath = path.resolve(this.server.config.root, relative);
    await writeFile(fullpath, content);
    logger.info('dump', formatUpload(data.file, slash(relative), server).styled);
  }
  async fetchModule(data: HmrData) {
    let content = '';
    if (data.transform) {
      const module = await this.server.fetchModule(data.file);
      if (!module) {
        throw new Error('module not found: ' + data.file);
      }
      content = module.code;
      if (this.server.config.viteburner.sourcemap === 'inline' && module.map) {
        content += getSourceMapString(module.map);
      }
    } else {
      const buffer = await fs.promises.readFile(path.resolve(this.server.config.root, data.file));
      content = buffer.toString();
    }
    return content;
  }
  fixImport(content: string, data: HmrData, serverName: string) {
    if (data.transform) {
      return fixImportPath({
        content,
        filename: data.file,
        server: serverName,
        manager: this.server.watchManager,
      });
    } else {
      return content;
    }
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
    const payloads = this.server.watchManager.getUploadFilenames(data.file);
    // no payload, skip
    if (!payloads.length) {
      logger.info(`hmr ${data.event}`, data.file, pc.dim('(ignored)'));
      return;
    }
    // for each payload execute upload/delete tasks
    for (const { filename, server: serverName } of payloads) {
      const fileChangeStrs = formatUpload(data.file, filename, serverName);
      try {
        if (isAdd) {
          // fix import path
          if (data.transform) {
            content = this.fixImport(content, data, serverName);
          }
          // dump file
          this.dumpFile(data, content, serverName);
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
    logger.info('vite', pc.reset('stop watching for file changes while downloading'));
    this.server.watchManager.setEnabled(false);

    // get servers
    const servers = this.server.config.viteburner.download.server;

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
      const { location: locationFn, ignoreTs, ignoreSourcemap } = this.server.config.viteburner.download;
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
          const isIgnoreTs = () => {
            return (
              ignoreTs &&
              resolvedLocation.endsWith('.js') &&
              fs.existsSync(resolvedLocation.substring(0, resolvedLocation.length - 3) + '.ts')
            );
          };
          // ignoreSourcemap
          const isIgnoreSourceMap = () => {
            return ignoreSourcemap && file.content.match(/\/\/# sourceMappingURL=\S+\s*$/g);
          };
          if (isIgnoreTs() || isIgnoreSourceMap()) {
            logger.info(`download`, fileChangeStrs.styled, pc.dim('(ignored)'));
            continue;
          }
          // copy
          await writeFile(resolvedLocation, file.content);
          logger.info(`download`, fileChangeStrs.styled, pc.green('(done)'));
        } catch (e) {
          logger.error(`download`, fileChangeStrs.raw, `(${e})`);
        }
      }
    }

    logger.info('vite', pc.reset('download completed, watching for file changes...'));
    this.server.watchManager.setEnabled(true);
  }
  async getRamUsage(pattern?: string) {
    // get patterns
    const patterns = pattern ?? this.server.watchManager.patterns;
    if (!patterns) {
      logger.warn('ram', 'no pattern found');
      return;
    }

    // get files
    const files = await fg(patterns, { cwd: this.server.config.root });
    if (files.length === 0) {
      logger.warn('ram', 'no file found');
      return;
    }
    files.sort();

    // get ram usage
    for (const file of files) {
      await this.getRamUsageLocal(file);
    }
  }
  getRamUsageLocalData(file: string) {
    return this.server.watchManager.getUploadFilenames(file);
  }
  async getRamUsageLocalRaw(file: string, resolvedData: ResolvedData) {
    // loop through all resolved data
    let isScript = false;
    let ramUsage = -1;
    if (resolvedData.length === 0) {
      logger.info('ram', `${file} (ignored)`);
      return true;
    }
    for (const { filename, server } of resolvedData) {
      const formatUploadStrs = formatUpload(file, filename, server);
      // if not a scipt file after filename resolve, skip
      if (!isScriptFile(filename)) {
        continue;
      }
      // if it is mapped as a script file, mark it
      isScript = true;
      try {
        ramUsage = await this.manager.calculateRam({ filename, server });
        logger.info('ram', pc.reset(`${file}: ${ramUsage} GB`));
        break; // resolved
      } catch (e) {
        logger.warn(`ram`, formatUploadStrs.raw, `(${e})`);
      }
    }
    // if isScript is true and no ramUsage fetched
    // throws an error
    if (isScript) {
      if (ramUsage === -1) {
        logger.warn(`ram`, file, `(no target found)`);
        return false;
      }
    } else {
      // not a script, print an ignore message
      logger.info('ram', file, pc.dim('(ignored)'));
    }
    return true;
  }
  async getRamUsageLocal(file: string) {
    const resolvedData = this.getRamUsageLocalData(file);
    return this.getRamUsageLocalRaw(file, resolvedData);
  }
  async getRamUsageRemote(server: string, filename: string) {
    const resolvedFilename = fixStartingSlash(filename);
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    try {
      const ramUsage = await this.manager.calculateRam({ filename: resolvedFilename, server });
      logger.info('ram', pc.reset(`@${server}/${filename}: ${ramUsage} GB`));
    } catch (e) {
      logger.error(`ram`, `@${server}/${filename}: ${e}`);
    }
  }
  async getFileNames(server: string) {
    try {
      const filenames = await this.manager.getFileNames({ server });
      return filenames.map(removeStartingSlash);
    } catch (e) {
      logger.error(`list`, `cannot fetch filenames from server ${server}: ${e}`);
      return null;
    }
  }
}
