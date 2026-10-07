import fs from 'fs';
import { resolve } from 'path';
import fg from 'fast-glob';
import pc from 'picocolors';
import prompt from 'prompts';
import { logger } from '@/console';
import type { ViteBurnerPluginCommands } from '@/plugins/api';
import type { ResolvedData, SyncService } from '@/services/sync';
import type { ViteService } from '@/services/vite';
import type { WatchService } from '@/services/watch';
import type { WsService } from '@/services/ws';
import { isScriptFile } from '@/utils';

export interface CoreServiceDeps {
  ws: WsService;
  sync: SyncService;
  watch: WatchService;
  vite: ViteService;
  /** Leave the daemon: dispose the session's services, then exit. */
  shutdown(): void;
}

/**
 * The game logic the player asks for — the commands behind the plugin's api.
 *
 * Nothing here knows about keys or this CLI's terminal: which key asks for which command is decided
 * where the keypress arrives. Each command reaches the service that owns the work directly.
 */
export class CoreService implements ViteBurnerPluginCommands {
  private readonly padding = 18;

  constructor(private readonly deps: CoreServiceDeps) {}

  quit() {
    logger.info('bye');
    this.deps.shutdown();
  }

  private printStatus(tag: string, msg: string) {
    logger.info('status', pc.reset(tag.padStart(this.padding)), msg);
  }

  displayStatus() {
    logger.info('status');
    logger.info('status', ' '.repeat(this.padding - 4) + pc.reset(pc.bold(pc.inverse(pc.green(' STATUS ')))));
    this.printStatus('connection:', this.deps.ws.connected ? pc.green('connected') : pc.yellow('disconnected'));
    this.printStatus('port:', pc.magenta(this.deps.vite.config.port));
    const pending = this.deps.sync.pending;
    const pendingStr = `${pending} file${pending === 1 ? '' : 's'}`;
    const pendingStrStyled = pending ? pc.yellow(pendingStr) : pc.dim(pendingStr);
    this.printStatus('pending:', pendingStrStyled);
    logger.info('status', pc.dim('')); // avoid (x2)
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

  async showRamUsageGlob() {
    const { pattern } = await prompt({
      type: 'text',
      name: 'pattern',
      message: 'Enter a glob pattern',
      initial: 'src/**/*.{ts,js}',
    });
    if (!pattern) {
      return false;
    }
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    await this.deps.sync.getRamUsage(pattern);
    return true;
  }

  async showRamUsageLocal() {
    const pattern = '**/*.{js,ts,script}';
    const files = await fg(pattern, { cwd: this.deps.vite.root });
    files.sort();
    // filter out non-script files, dts, and deadends
    const fileMap = new Map<string, ResolvedData>();
    for (const file of files) {
      if (file.endsWith('.d.ts') || file === this.deps.vite.config.dts) {
        continue;
      }
      const resolvedData = this.deps.sync.getRamUsageLocalData(file);
      if (resolvedData.length === 0) {
        continue;
      }
      fileMap.set(file, resolvedData);
    }
    const { file } = await prompt({
      type: 'autocomplete',
      name: 'file',
      message: 'Enter a filename',
      choices: [...fileMap.keys()].map((title) => ({ title })),
    });
    if (!file) {
      return false;
    }
    if (!fs.existsSync(resolve(this.deps.vite.root, file))) {
      logger.error('ram', `file ${file} does not exist`);
      return false;
    }
    // check if file in filemap
    if (fileMap.has(file)) {
      await this.deps.sync.getRamUsageLocalRaw(file, fileMap.get(file) as ResolvedData);
    } else {
      await this.deps.sync.getRamUsageLocal(file);
    }
    return true;
  }

  async showRamUsageRemote() {
    const { server } = await prompt({
      type: 'text',
      name: 'server',
      message: 'Enter a server name',
      initial: 'home',
    });
    if (!server) {
      return false;
    }
    const filenames = await this.deps.sync.getFileNames(server);
    if (!filenames) {
      return false;
    }
    const { filename } = await prompt({
      type: 'autocomplete',
      name: 'filename',
      message: 'Enter a filename',
      choices: filenames.filter(isScriptFile).map((title) => ({ title })),
    });
    if (!filename) {
      return false;
    }
    await this.deps.sync.getRamUsageRemote(server, filename);
    return true;
  }

  private async showRamUsageRaw(): Promise<boolean> {
    const { filter } = await prompt({
      type: 'select',
      name: 'filter',
      message: 'Which script do you want to check?',
      initial: 0,
      choices: [
        { title: 'All local scripts', value: 'all' },
        { title: 'Filter local scripts by glob pattern', value: 'glob' },
        { title: 'Find a local script', value: 'local' },
        { title: 'Find a remote script', value: 'remote' },
      ],
    });
    if (!filter) {
      return false; // cancelled
    }

    if (filter === 'all') {
      return this.showRamUsageAll();
    } else if (filter === 'glob') {
      return this.showRamUsageGlob();
    } else if (filter === 'local') {
      return this.showRamUsageLocal();
    } else if (filter === 'remote') {
      return this.showRamUsageRemote();
    }

    return false;
  }

  async showRamUsage() {
    const result = await this.showRamUsageRaw();
    logger.info('ram', result ? 'done' : 'cancelled');
  }
}
