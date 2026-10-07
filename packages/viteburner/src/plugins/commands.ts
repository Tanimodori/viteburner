import fs from 'fs';
import { resolve } from 'path';
import fg from 'fast-glob';
import pc from 'picocolors';
import prompt from 'prompts';
import { logger } from '@/console';
import { isScriptFile } from '@/utils';
import { ResolvedData, WsAdapter } from '@/ws';
import { ViteBurnerPluginCommands } from './api';

/**
 * The commands the plugin runs, over the dev server it was started for.
 *
 * Nothing here knows about keys or about this package's CLI: `ViteBurnerPluginCommands` is the whole
 * surface, and which input asks for which command is the caller's business.
 */
export function createApi(wsAdapter: WsAdapter): ViteBurnerPluginCommands {
  const padding = 18;
  const printStatus = (tag: string, msg: string) => {
    logger.info('status', pc.reset(tag.padStart(padding)), msg);
  };
  const displayStatus = () => {
    logger.info('status');
    logger.info('status', ' '.repeat(padding - 4) + pc.reset(pc.bold(pc.inverse(pc.green(' STATUS ')))));
    printStatus('connection:', wsAdapter.manager.connected ? pc.green('connected') : pc.yellow('disconnected'));
    printStatus('port:', pc.magenta(wsAdapter.server.config.viteburner.port));
    const pending = wsAdapter.buffers.size;
    const pendingStr = `${pending} file${pending === 1 ? '' : 's'}`;
    const pendingStrStyled = pending ? pc.yellow(pendingStr) : pc.dim(pendingStr);
    printStatus('pending:', pendingStrStyled);
    logger.info('status', pc.dim('')); // avoid (x2)
  };

  const checkConnection = () => {
    if (!wsAdapter.manager.connected) {
      logger.error('conn', pc.red('no connection'));
      return false;
    }
    return true;
  };

  const fullUpload = () => {
    logger.info('upload', pc.reset('force full-upload triggered'));
    wsAdapter.server.watchManager.fullReload();
  };

  const fullDownload = () => {
    logger.info('download', pc.reset('force full-download triggered'));
    wsAdapter.fullDownload();
  };

  const showRamUsageAll = async () => {
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    await wsAdapter.getRamUsage();
    return true;
  };

  const showRamUsageGlob = async () => {
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
    await wsAdapter.getRamUsage(pattern);
    return true;
  };

  const showRamUsageLocal = async () => {
    const pattern = '**/*.{js,ts,script}';
    const files = await fg(pattern, { cwd: wsAdapter.server.config.root });
    files.sort();
    // filter out non-script files, dts, and deadends
    const fileMap = new Map<string, ResolvedData>();
    for (const file of files) {
      if (file.endsWith('.d.ts') || file === wsAdapter.server.config.viteburner.dts) {
        continue;
      }
      const resolvedData = wsAdapter.getRamUsageLocalData(file);
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
    if (!fs.existsSync(resolve(wsAdapter.server.config.root, file))) {
      logger.error('ram', `file ${file} does not exist`);
      return false;
    }
    // check if file in filemap
    if (fileMap.has(file)) {
      await wsAdapter.getRamUsageLocalRaw(file, fileMap.get(file) as ResolvedData);
    } else {
      await wsAdapter.getRamUsageLocal(file);
    }
    return true;
  };

  const showRamUsageRemote = async () => {
    const { server } = await prompt({
      type: 'text',
      name: 'server',
      message: 'Enter a server name',
      initial: 'home',
    });
    if (!server) {
      return false;
    }
    const filenames = await wsAdapter.getFileNames(server);
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
    await wsAdapter.getRamUsageRemote(server, filename);
    return true;
  };

  const showRamUsageRaw = async (): Promise<boolean> => {
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
      return showRamUsageAll();
    } else if (filter === 'glob') {
      return showRamUsageGlob();
    } else if (filter === 'local') {
      return showRamUsageLocal();
    } else if (filter === 'remote') {
      return showRamUsageRemote();
    }

    return false;
  };

  const showRamUsage = async () => {
    const result = await showRamUsageRaw();
    logger.info('ram', result ? 'done' : 'cancelled');
  };

  return {
    quit: () => {
      logger.info('bye');
      process.exit();
    },
    displayStatus,
    fullUpload: () => {
      if (checkConnection()) fullUpload();
    },
    fullDownload: () => {
      if (checkConnection()) fullDownload();
    },
    showRamUsage: () => {
      if (checkConnection()) return showRamUsage();
    },
    showRamUsageAll,
    showRamUsageGlob,
    showRamUsageLocal,
    showRamUsageRemote,
  };
}
