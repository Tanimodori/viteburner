import pc from 'picocolors';
import { HmrData } from './plugins';
import { logger, onKeypress } from './console';
import { ViteBurnerConfig } from './config';
import { createServer } from './server';
import { WsManager, WsAdapter } from './ws';

export async function watch(config: ViteBurnerConfig) {
  // create ws server
  const port = config.port ?? 12525;
  logger.info('ws', 'creating WebSocket server...');
  const wsManager = new WsManager({ port, timeout: config.timeout });
  logger.info('ws', `WebSocket server listening on`, `localhost:${pc.magenta(String(port))}`);

  // create vite server
  logger.info('vite', 'creating dev server...');
  const server = await createServer(config);
  logger.info('vite', 'watching for file changes...');

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

  const padding = 15;
  const printStatus = (tag: string, msg: string) => {
    logger.info('status', pc.reset(tag.padStart(padding)), msg);
  };
  const displayStatus = () => {
    logger.info('status');
    logger.info('status', ' '.repeat(padding - 4) + pc.bold(pc.inverse(pc.green(' STATUS '))));
    printStatus('connection:', wsManager.connected ? pc.green('connected') : pc.yellow('disconnected'));
    printStatus('port:', pc.magenta(String(port)));
    const pending = wsAdapter.buffers.size;
    const pendingStr = `${pending} file${pending === 1 ? '' : 's'}`;
    const pendingStrStyled = pending ? pc.yellow(pendingStr) : pc.dim(pendingStr);
    printStatus('pending:', pendingStrStyled);
    logger.info('status');
    logger.info(
      'status',
      pc.dim('press ') + pc.reset('h') + pc.dim(' to show help, press ') + pc.reset('q') + pc.dim(' to exit'),
    );
  };

  displayStatus();

  // h to show help
  // u to update all
  // d to download all
  onKeypress((str, key) => {
    // q, ctrl-c to quit
    if (key.name === 'q' || (key.name === 'c' && key.ctrl)) {
      logger.info('bye');
      process.exit();
      // s to show status
    } else if (key.name === 's') {
      displayStatus();
    }
  });
}
