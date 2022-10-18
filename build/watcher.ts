import { resolve } from 'node:path';
import { createServer } from 'vite';
import { ViteNodeServer } from 'vite-node/server';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { hmrPlugin, entryPlugin, virtualModuleId, hmrPluginName, HmrData } from './plugins';

export function path2Id(file: string, base: string) {
  const id = `/@fs/${slash(resolve(file))}`;
  return normalizeRequestId(id, base);
}

export async function watch() {
  const server = await createServer({
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
    plugins: [
      entryPlugin(),
      hmrPlugin({
        watch: {
          js: { pattern: 'src/**/*.{js,ts}', transform: true },
          script: { pattern: 'src/**/*.script', transform: false },
          txt: { pattern: 'src/**/*.txt', transform: false },
        },
      }),
    ],
  });

  server.emitter.on(hmrPluginName, (data: HmrData) => {
    console.log(data);
  });

  await server.pluginContainer.buildStart({});

  const node = new ViteNodeServer(server);

  let result;
  result = await node.fetchModule(path2Id('src/template.ts', server.config.base));
  result = await node.fetchModule(path2Id('src/multi-entry.ts', server.config.base));
}

watch();
