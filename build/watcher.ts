import { resolve } from 'node:path';
import { createServer, ViteDevServer } from 'vite';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { SourceMap } from 'rollup';
import { hmrPlugin, entryPlugin, virtualModuleId, hmrPluginName, HmrData } from './plugins';
import { formatNormal } from './console';

export function path2Id(file: string, base: string) {
  const id = `/@fs/${slash(resolve(file))}`;
  return normalizeRequestId(id, base);
}

export function createHmrPlugin() {
  return hmrPlugin({
    watch: {
      js: { pattern: 'src/**/*.{js,ts}', transform: true },
      script: { pattern: 'src/**/*.script', transform: false },
      txt: { pattern: 'src/**/*.txt', transform: false },
    },
  });
}

export async function createViteServer() {
  return createServer({
    mode: 'development',
    optimizeDeps: {
      disabled: true,
    },
    clearScreen: false,
    build: {
      lib: {
        /**
         * Meaningless for Vite<3.2.0
         * @see {@link https://github.com/vitejs/vite/discussions/1736}
         */
        entry: virtualModuleId,
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          exports: 'named',
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: () => `[name].js`,
        },
      },
    },
    plugins: [entryPlugin(), createHmrPlugin()],
  });
}

export function getSourceMapString(map?: SourceMap | null): string {
  if (!map) return '';
  const mapDataString = JSON.stringify(map);
  return `//# sourceMappingURL=data:application/json;base64,${Buffer.from(mapDataString).toString('base64')}`;
}

export async function fetchModule(server: ViteDevServer, file: string) {
  const id = path2Id(file, server.config.base);
  return server.transformRequest(id);
}

export async function handleHmrMessage(server: ViteDevServer, data: HmrData) {
  server.config.logger.info(formatNormal(`hmr ${data.event}`, slash(data.file)));
  const module = await fetchModule(server, data.file);
  if (module) {
    const result = module.code + getSourceMapString(module.map);
    return result;
  } else {
    return null;
  }
}

export async function watch() {
  // create vite server
  const server = await createViteServer();
  server.config.logger.info(formatNormal('watching for file changes...'));

  // store initial HMR datas
  let buildStarted = false;
  const initialDatas: HmrData[] = [];
  server.emitter.on(hmrPluginName, async (data: HmrData) => {
    if (!buildStarted) {
      initialDatas.push(data);
    } else {
      await handleHmrMessage(server, data);
    }
  });

  // init plugins
  await server.pluginContainer.buildStart({});
  buildStarted = true;

  // process initial HMR datas
  for (const data of initialDatas) {
    await handleHmrMessage(server, data);
  }
}

watch();
