import { resolve } from 'path';
import { createServer as createViteServerRaw, TransformResult, ViteDevServer } from 'vite';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { hmrPlugin, entryPlugin, virtualModuleId, hmrPluginName, HmrData } from './plugins';
import { ViteBurnerConfig } from './config';

export async function createViteServer(config: ViteBurnerConfig) {
  const root = config.cwd;
  return createViteServerRaw({
    ...(root && { root }),
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
    server: {
      middlewareMode: true,
    },
    viteburner: config,
    plugins: [entryPlugin(), hmrPlugin()],
  });
}

export interface ViteBurnerServer extends ViteDevServer {
  pathToId(file: string): string;
  fetchModule(file: string): Promise<TransformResult | null>;
  onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void): void;
  buildStart(): Promise<void>;
}

export async function createServer(config: ViteBurnerConfig) {
  const viteServer = await createViteServer(config);
  const server: ViteBurnerServer = {
    ...viteServer,
    pathToId(file: string) {
      const id = `/@fs/${slash(resolve(viteServer.config.root, file))}`;
      return normalizeRequestId(id, server.config.base);
    },
    async fetchModule(file: string) {
      const id = server.pathToId(file);
      return server.transformRequest(id);
    },
    onHmrMessage(handler: (data: HmrData, server: ViteBurnerServer) => void) {
      server.viteburnerEmitter.on(hmrPluginName, (data: HmrData) => handler(data, server));
    },
    async buildStart() {
      return server.pluginContainer.buildStart({});
    },
  };
  return server;
}
