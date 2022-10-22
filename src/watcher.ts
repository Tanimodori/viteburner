import pc from 'picocolors';
import { HmrData } from './plugins';
import { logger, onKeypress } from './console';
import { ViteBurnerConfig } from './config';
import { createServer } from './server';
import { WsManager, WsAdapter } from './ws';

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

  const fullUpload = () => {
    logger.info('upload', pc.reset('force full-upload triggered'));
    wsAdapter.server.viteburnerEmitter.emit('full-upload');
  };

  const fullDownload = () => {
    logger.info('download', pc.reset('force full-download triggered'));
    wsAdapter.server.viteburnerEmitter.emit('full-download');
  };

  const showRamUsage = () => {
    logger.info('ram', pc.reset('fetching ram usage of scripts...'));
    // TODO: allowing patterns
    wsAdapter.getRamUsage();
  };

  onKeypress((str, key) => {
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
      fullUpload();
    } else if (key.name === 'd') {
      // d to download all
      fullDownload();
    } else if (key.name === 'r') {
      // f to show ram usage
      showRamUsage();
    }
  });
}
