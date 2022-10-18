import { resolve } from 'node:path';
import { createServer } from 'vite';
import { viteNodeHmrPlugin } from 'vite-node/hmr';
import { ViteNodeServer } from 'vite-node/server';
import { slash, normalizeRequestId } from 'vite-node/utils';
import entryPlugin, { virtualModuleId } from './plugins/entry';
import hmrPlugin from './plugins/hmr';

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
    plugins: [entryPlugin(), hmrPlugin()],
  });

  await server.pluginContainer.buildStart({});

  const node = new ViteNodeServer(server);

  let result;
  result = await node.fetchModule(path2Id('src/template.ts', server.config.base));
  console.log(result);
  result = await node.fetchModule(path2Id('src/multi-entry.ts', server.config.base));
  console.log(result);
}

watch();
