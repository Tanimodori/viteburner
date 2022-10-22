import pc from 'picocolors';
import prompt from 'prompts';
import fg from 'fast-glob';
import fs from 'fs';
import { HmrData } from './plugins';
import { KeyHandlerContext, logger, onKeypress } from './console';
import { ViteBurnerConfig } from './config';
import { createServer } from './server';
import { WsManager, WsAdapter } from './ws';
import { isScriptFile } from './utils';
import { resolve } from 'path';

export async function watch(config: ViteBurnerConfig) {
  // create ws server
  const port = config.port ?? 12525;
  logger.info('ws', 'creating ws server...');
  const wsManager = new WsManager({ port, timeout: config.timeout });

  // create vite server
  logger.info('vite', 'creating dev server...');
  const server = await createServer(config);
  logger.info('vite', pc.reset('watching for file changes...'));

  const wsAdapter = new WsAdapter(wsManager, server);

  // store initial HMR datas
  let buildStarted = false;
  const initialDatas: HmrData[] = [];
  server.onHmrMessage(async (data) => {
    if (!buildStarted) {
      initialDatas.push(data);
    } else {
      await wsAdapter.handleHmrMessage(data);
    }
  });

  // init plugins
  await server.buildStart();
  buildStarted = true;

  // process initial HMR datas
  await wsAdapter.handleHmrMessage(initialDatas);

  handleKeyInput(wsAdapter);
}

export async function handleKeyInput(wsAdapter: WsAdapter) {
  const port = wsAdapter.server.config?.viteburner?.port ?? 12525;
  const padding = 18;
  const printStatus = (tag: string, msg: string) => {
    logger.info('status', pc.reset(tag.padStart(padding)), msg);
  };
  const displayStatus = () => {
    logger.info('status');
    logger.info('status', ' '.repeat(padding - 4) + pc.reset(pc.bold(pc.inverse(pc.green(' STATUS ')))));
    printStatus('connection:', wsAdapter.manager.connected ? pc.green('connected') : pc.yellow('disconnected'));
    printStatus('port:', pc.magenta(String(port)));
    const pending = wsAdapter.buffers.size;
    const pendingStr = `${pending} file${pending === 1 ? '' : 's'}`;
    const pendingStrStyled = pending ? pc.yellow(pendingStr) : pc.dim(pendingStr);
    printStatus('pending:', pendingStrStyled);
    logger.info('status', pc.dim('')); // avoid (x2)
  };

  const displayKeyHelpHint = () => {
    logger.info(
      'status',
      pc.dim('press ') +
        pc.reset(pc.bold('h')) +
        pc.dim(' to show help, press ') +
        pc.reset(pc.bold('q')) +
        pc.dim(' to exit'),
    );
  };

  displayStatus();
  displayKeyHelpHint();

  const displayHelp = () => {
    logger.info('status');
    const commands = [
      ['u', 'upload all files'],
      ['d', 'download all files'],
      ['s', 'show status'],
      ['r', 'show RAM usage of scripts'],
      ['q', 'quit'],
    ];
    logger.info('status', pc.reset(pc.bold('Watch Usage')));
    for (const [key, desc] of commands) {
      logger.info('status', `press ${pc.reset(pc.bold(key))}${pc.dim(' to ')}${desc}`);
    }
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
    wsAdapter.server.viteburnerEmitter.emit('full-upload');
  };

  const fullDownload = () => {
    logger.info('download', pc.reset('force full-download triggered'));
    wsAdapter.server.viteburnerEmitter.emit('full-download');
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
    const { file } = await prompt({
      type: 'autocomplete',
      name: 'file',
      message: 'Enter a filename',
      choices: files
        .filter((file) => {
          return !file.endsWith('.d.ts') && file !== wsAdapter.resolveDts();
        })
        .map((title) => ({ title })),
    });
    if (!file) {
      return false;
    }
    if (!fs.existsSync(resolve(wsAdapter.server.config.root, file))) {
      logger.error('ram', `file ${file} does not exist`);
      return false;
    }
    await wsAdapter.getRamUsageLocal(file, pattern);
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
        { title: 'Filter local script by glob pattern', value: 'glob' },
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

  const showRamUsage = async (ctx: KeyHandlerContext) => {
    ctx.off();
    const result = await showRamUsageRaw();
    if (result) {
      logger.info('ram', 'done');
    } else {
      logger.info('ram', 'cancelled');
    }
    ctx.on();
  };

  onKeypress(async (ctx) => {
    const { key } = ctx;
    if (key.name === 'q') {
      // q to quit
      logger.info('bye');
      process.exit();
    } else if (key.name === 's') {
      // s to show status
      displayStatus();
    } else if (key.name === 'h') {
      // h to show help
      displayHelp();
    } else if (key.name === 'u') {
      // u to update all
      checkConnection() && fullUpload();
    } else if (key.name === 'd') {
      // d to download all
      checkConnection() && fullDownload();
    } else if (key.name === 'r') {
      // f to show ram usage
      checkConnection() && (await showRamUsage(ctx));
    }
  });
}
