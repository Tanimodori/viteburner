import { resolve } from 'path';
import { createServer as createViteServerRaw } from 'vite';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { hmrPlugin, entryPlugin, virtualModuleId, hmrPluginName, HmrData } from './plugins';
import { ResolvedConfig, ResolvedViteBurnerConfig, ViteBurnerServer } from './types';

export async function createViteServer(config: ResolvedViteBurnerConfig) {
  const root = config.cwd;
  return createViteServerRaw({
    ...(root && { root }),
    mode: 'development',
    optimizeDeps: { disabled: true },
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
    },
    server: { middlewareMode: true },
    viteburner: config,
    plugins: [entryPlugin(), hmrPlugin()],
  });
}

export async function createServer(config: ResolvedViteBurnerConfig) {
  const viteServer = await createViteServer(config);
  const server: ViteBurnerServer = {
    ...viteServer,
    config: { ...viteServer.config, viteburner: config } as ResolvedConfig,
    pathToId(file: string) {
      const id = `/@fs/${slash(resolve(viteServer.config.root, file))}`;
      return normalizeRequestId(id, server.config.base);
    },
    async fetchModule(file: string) {
      const id = server.pathToId(file);
      return server.transformRequest(id);
    },
    onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void) {
      server.watchManager.emitter.on(hmrPluginName, (data: HmrData) => handler(data, server));
    },
    async buildStart() {
      return server.pluginContainer.buildStart({});
    },
  };
  return server;
}
