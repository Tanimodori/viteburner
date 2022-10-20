import pc from 'picocolors';
import { HmrData } from './plugins';
import { formatNormal } from './console';
import { ViteBurnerConfig } from './config';
import { createServer, ViteBurnerServer } from './server';
import { getSourceMapString } from './utils';
import WsManager from './ws/manager';

export async function handleHmrMessage(data: HmrData, server: ViteBurnerServer) {
  server.config.logger.info(formatNormal(`hmr ${data.event}`, data.file));
  const module = await server.fetchModule(data.file);
  if (module) {
    const result = module.code + getSourceMapString(module.map);
    return result;
  } else {
    return null;
  }
}

export async function watch(config: ViteBurnerConfig) {
  // create ws server
  const port = config.port ?? 12525;
  console.log(formatNormal('creating WebSocket server...'));
  const wsManager = new WsManager({ port, timeout: config.timeout });
  console.log(formatNormal(`WebSocket server listening on localhost:${pc.magenta(String(port))}`));

  // create vite server
  console.log(formatNormal('creating dev server...'));
  const server = await createServer(config);
  server.config.logger.info(formatNormal('watching for file changes...'));

  // store initial HMR datas
  let buildStarted = false;
  const initialDatas: HmrData[] = [];
  server.onHmrMessage(async (data, server) => {
    if (!buildStarted) {
      initialDatas.push(data);
    } else {
      await handleHmrMessage(data, server);
    }
  });

  // init plugins
  await server.buildStart();
  buildStarted = true;

  // process initial HMR datas
  for (const data of initialDatas) {
    await handleHmrMessage(data, server);
  }
}
