import { slash } from 'vite-node/utils';
import { HmrData } from './plugins';
import { formatNormal } from './console';
import { ViteBurnerConfig } from './config';
import { createServer, ViteBurnerServer } from './server';
import { getSourceMapString } from './utils';

export async function handleHmrMessage(data: HmrData, server: ViteBurnerServer) {
  server.config.logger.info(formatNormal(`hmr ${data.event}`, slash(data.file)));
  const module = await server.fetchModule(data.file);
  if (module) {
    const result = module.code + getSourceMapString(module.map);
    return result;
  } else {
    return null;
  }
}

export async function watch(config: ViteBurnerConfig) {
  // create vite server
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
