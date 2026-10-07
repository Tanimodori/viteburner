import fs from 'fs';
import path, { relative, resolve } from 'path';
import fg from 'fast-glob';
import { match } from 'micromatch';
import pc from 'picocolors';
import { logger } from '@/console';
import type { ViteService } from '@/services/vite';
import type { WatchService } from '@/services/watch';
import type { WsService } from '@/services/ws';
import type { HmrData } from '@/types';
import {
  forceStartingSlash,
  formatDownload,
  formatUpload,
  getSourceMapString,
  isScriptFile,
  removeStartingSlash,
  slash,
  writeFile,
} from '@/utils';
import { fixImportPath } from './import';

export interface FileContent {
  filename: string;
  content: string;
}

export interface ResolvedDataItem {
  filename: string;
  server: string;
}

export type ResolvedData = ResolvedDataItem[];

export interface SyncServiceDeps {
  ws: WsService;
  watch: WatchService;
  vite: ViteService;
}

/**
 * The sync pipeline: it turns a file change into the transformed files the game should hold, and
 * pulls the game's files back the other way.
 *
 * It reads the watcher's patterns, asks vite to transform, and pushes over the socket — reaching the
 * other services directly, since they are peers in the same session. The two things that arrive from
 * outside it (a file changed, the game connected) are delivered by the session that owns it: see
 * `handleHmrMessage` and `onConnected`.
 *
 * The operations the player asks for live here too — the full upload/download and the RAM reports —
 * because each one is a read of, or a push through, this same pipeline.
 */
export class SyncService {
  buffers: Map<string, HmrData> = new Map();

  constructor(private readonly deps: SyncServiceDeps) {}

  private get ws() {
    return this.deps.ws;
  }
  private get watch() {
    return this.deps.watch;
  }
  private get vite() {
    return this.deps.vite;
  }

  /** Files waiting to be sent, coalesced by path. */
  get pending() {
    return this.buffers.size;
  }

  async getDts() {
    const filename = this.vite.config.dts;
    if (!filename) {
      return;
    }
    try {
      const data = await this.ws.getDefinitionFile();
      const fullpath = path.resolve(this.vite.root, filename);
      await writeFile(fullpath, data);
      logger.info('dts change', filename);
    } catch (e) {
      logger.error(`error getting dts file: ${e}`);
    }
  }

  /** The game just became the active client: refresh its type definitions, then flush the buffer. */
  async onConnected() {
    await this.getDts();
    await this.handleHmrMessage();
  }

  async checkDependencies(data: HmrData[]) {
    for (const item of data) {
      // change won't affect import glob generated files, skippping
      if (item.event === 'change') {
        continue;
      }
      const resolvedFile = slash(resolve(this.vite.root, item.file));
      this.vite.importGlobMap?.forEach((value, key) => {
        if (value.some((pattern) => match([resolvedFile], pattern).length > 0)) {
          // push key to data
          const importer = slash(relative(this.vite.root, key));
          // recursive import, skipping
          if (data.some((item) => item.file === importer)) {
            return;
          }
          const importerData = this.watch.findItem(importer);
          if (importerData?.transform) {
            data.push({
              file: importer,
              timestamp: item.timestamp,
              initial: item.initial,
              event: 'change',
              ...importerData,
            });
          }
        }
      });
    }
    return data;
  }

  async handleHmrMessage(data?: HmrData | HmrData[]) {
    if (!data) {
      data = [];
    } else if (!Array.isArray(data)) {
      data = [data];
    }
    // check deps
    data = await this.checkDependencies(data);
    const connected = this.ws.connected;
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

  async dumpFile(data: HmrData, content: string, server: string) {
    const relativePath = this.vite.config.dumpFiles?.(data.file, server);
    if (!relativePath) {
      return;
    }
    const fullpath = path.resolve(this.vite.root, relativePath);
    await writeFile(fullpath, content);
    logger.info('dump', formatUpload(data.file, slash(relativePath), server).styled);
  }

  async fetchModule(data: HmrData) {
    let content = '';
    if (data.transform) {
      this.vite.invalidateFile(data.file);
      const module = await this.vite.fetchModule(data.file);
      if (!module) {
        throw new Error('module not found: ' + data.file);
      }
      content = module.code;
      if (this.vite.config.sourcemap === 'inline' && module.map) {
        content += getSourceMapString(module.map);
      }
    } else {
      const buffer = await fs.promises.readFile(path.resolve(this.vite.root, data.file));
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
        manager: this.watch,
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
    const payloads = this.watch.getUploadFilenames(data.file);
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
          await this.ws.pushFile({
            filename,
            content,
            server: serverName,
          });
        } else {
          await this.ws.deleteFile({
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

  private checkConnection() {
    if (!this.ws.connected) {
      logger.error('conn', pc.red('no connection'));
      return false;
    }
    return true;
  }

  /** Re-send every watched file, as if each one had just changed. */
  fullUpload() {
    if (!this.checkConnection()) {
      return;
    }
    logger.info('upload', pc.reset('force full-upload triggered'));
    void this.watch.fullReload();
  }

  async fullDownload() {
    if (!this.checkConnection()) {
      return;
    }
    logger.info('download', pc.reset('force full-download triggered'));

    // stop watching
    logger.info('vite', pc.reset('stop watching for file changes while downloading'));
    this.watch.setEnabled(false);

    // get servers
    const servers = this.vite.config.download.server;

    // get files
    const filesMap = new Map<string, FileContent[]>();
    for (const server of servers) {
      try {
        filesMap.set(server, await this.ws.getAllFiles({ server }));
      } catch (e) {
        logger.error(`error: connot get filelist from server ${server}: ${e}`);
        continue;
      }
    }

    for (const [server, files] of filesMap) {
      const { location: locationFn, ignoreTs, ignoreSourcemap } = this.vite.config.download;
      for (const file of files) {
        file.filename = removeStartingSlash(file.filename);
        const location = locationFn(file.filename, server);
        if (!location) {
          logger.info(`download`, `@${server}:/${file.filename}`, pc.dim('(ignored)'));
          continue;
        }
        const resolvedLocation = resolve(this.vite.root, location);
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
    this.watch.setEnabled(true);
  }

  async getRamUsage(pattern?: string) {
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));

    // get patterns
    const patterns = pattern ?? this.watch.patterns;
    if (!patterns) {
      logger.warn('ram', 'no pattern found');
      return;
    }

    // get files
    const files = await fg(patterns, { cwd: this.vite.root });
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

  /** The local scripts that have a RAM cost — the choices to offer for a per-file report. */
  async getRamUsageLocalFiles() {
    const pattern = '**/*.{js,ts,script}';
    const files = await fg(pattern, { cwd: this.vite.root });
    files.sort();
    // The files worth offering as a choice: not a declaration, not the synced definitions, and
    // mapped to at least one upload destination.
    return files.filter((file) => {
      if (file.endsWith('.d.ts') || file === this.vite.config.dts) {
        return false;
      }
      return this.getRamUsageLocalData(file).length > 0;
    });
  }

  getRamUsageLocalData(file: string) {
    return this.watch.getUploadFilenames(file);
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
        ramUsage = await this.ws.calculateRam({ filename, server });
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
    if (!fs.existsSync(resolve(this.vite.root, file))) {
      logger.error('ram', `file ${file} does not exist`);
      return false;
    }
    const resolvedData = this.getRamUsageLocalData(file);
    return this.getRamUsageLocalRaw(file, resolvedData);
  }

  async getRamUsageRemote(server: string, filename: string) {
    const resolvedFilename = forceStartingSlash(filename);
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    try {
      const ramUsage = await this.ws.calculateRam({ filename: resolvedFilename, server });
      logger.info('ram', pc.reset(`@${server}/${filename}: ${ramUsage} GB`));
    } catch (e) {
      logger.error(`ram`, `@${server}/${filename}: ${e}`);
    }
  }

  async getFileNames(server: string) {
    try {
      const filenames = await this.ws.getFileNames({ server });
      return filenames.map(removeStartingSlash);
    } catch (e) {
      logger.error(`list`, `cannot fetch filenames from server ${server}: ${e}`);
      return null;
    }
  }
}
