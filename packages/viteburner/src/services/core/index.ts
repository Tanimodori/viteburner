import fs from 'fs';
import { resolve } from 'path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { logger } from '@/console';
import type { ViteBurnerPluginCommands, ViteBurnerStatus } from '@/plugins/viteburner/api';
import type { SyncService } from '@/services/sync';
import type { ViteService } from '@/services/vite';
import type { WatchService } from '@/services/watch';
import type { WsService } from '@/services/ws';

export interface CoreServiceDeps {
  ws: WsService;
  sync: SyncService;
  watch: WatchService;
  vite: ViteService;
  /** Stop this session's services, without ending the process. */
  dispose(): void;
}

/**
 * The game logic the player asks for — the operations behind the plugin's api.
 *
 * Nothing here knows about keys, a terminal, or the process: it neither asks the player anything, nor
 * renders a report's shell, nor ends the process. Each operation reaches the service that owns the
 * work directly, and a caller that needs a choice makes it and passes the answer in.
 */
export class CoreService implements ViteBurnerPluginCommands {
  constructor(private readonly deps: CoreServiceDeps) {}

  dispose() {
    this.deps.dispose();
  }

  getStatus(): ViteBurnerStatus {
    return {
      connected: this.deps.ws.connected,
      port: this.deps.vite.config.port,
      pending: this.deps.sync.pending,
    };
  }

  private checkConnection() {
    if (!this.deps.ws.connected) {
      logger.error('conn', pc.red('no connection'));
      return false;
    }
    return true;
  }

  fullUpload() {
    if (!this.checkConnection()) {
      return;
    }
    logger.info('upload', pc.reset('force full-upload triggered'));
    void this.deps.watch.fullReload();
  }

  fullDownload() {
    if (!this.checkConnection()) {
      return;
    }
    logger.info('download', pc.reset('force full-download triggered'));
    void this.deps.sync.fullDownload();
  }

  async showRamUsageAll() {
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    await this.deps.sync.getRamUsage();
    return true;
  }

  async showRamUsageGlob(pattern: string) {
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    await this.deps.sync.getRamUsage(pattern);
    return true;
  }

  async showRamUsageLocal(file: string) {
    if (!fs.existsSync(resolve(this.deps.vite.root, file))) {
      logger.error('ram', `file ${file} does not exist`);
      return false;
    }
    await this.deps.sync.getRamUsageLocal(file);
    return true;
  }

  async showRamUsageRemote(server: string, filename: string) {
    await this.deps.sync.getRamUsageRemote(server, filename);
    return true;
  }

  async getRamUsageLocalFiles() {
    const pattern = '**/*.{js,ts,script}';
    const files = await fg(pattern, { cwd: this.deps.vite.root });
    files.sort();
    // The files worth offering as a choice: not a declaration, not the synced definitions, and
    // mapped to at least one upload destination.
    return files.filter((file) => {
      if (file.endsWith('.d.ts') || file === this.deps.vite.config.dts) {
        return false;
      }
      return this.deps.sync.getRamUsageLocalData(file).length > 0;
    });
  }

  getFileNames(server: string) {
    return this.deps.sync.getFileNames(server);
  }
}
