import { resolve } from 'node:path';
import { createServer } from 'vite';
import { viteNodeHmrPlugin } from 'vite-node/hmr';
import { ViteNodeServer } from 'vite-node/server';
import { slash, normalizeRequestId } from 'vite-node/utils';

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
    plugins: [viteNodeHmrPlugin()],
  });

  await server.pluginContainer.buildStart({});

  const node = new ViteNodeServer(server);

  let result;
  result = await node.fetchModule(path2Id('src/template.ts', server.config.base));
  console.log(result);
  result = await node.fetchModule(path2Id('src/multi-entry.ts', server.config.base));
  console.log(result);

  console.log(server.emitter);

  server.emitter?.on('message', (payload) => {
    console.log(payload);
  });
}

watch();
