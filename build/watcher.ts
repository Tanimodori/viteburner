import { resolve } from 'node:path';
import { createServer } from 'vite';
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
  });

  await server.pluginContainer.buildStart({});

  const node = new ViteNodeServer(server);

  const result = await node.fetchModule(path2Id('src/template.ts', server.config.base));
  console.log(result);
}

watch();
