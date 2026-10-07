import { resolve } from 'pathe';
import type { TransformResult, ViteDevServer } from 'vite';
import type { ResolvedViteBurnerConfig } from '@/types';
import { normalizeRequestId, slash } from '@/utils';

/**
 * The dev server as the rest of the daemon needs it: the resolved viteburner config, and the three
 * operations that have no public vite equivalent — turning a file into the id vite knows it by,
 * invalidating a module, and asking vite to transform one.
 *
 * One instance belongs to one dev server. vite builds a fresh server on a config change, so this is
 * never reused across servers — which is also why nothing here is stored on the server object.
 */
export class ViteService {
  constructor(
    private readonly devServer: ViteDevServer,
    readonly config: ResolvedViteBurnerConfig,
  ) {}

  get root() {
    return this.devServer.config.root;
  }

  /** vite's internal map of import-glob patterns to the files that matched them. */
  get importGlobMap() {
    return this.devServer._importGlobMap;
  }

  pathToId(file: string) {
    const id = `/@fs/${slash(resolve(this.root, file))}`;
    return normalizeRequestId(id, this.devServer.config.base);
  }

  async invalidateFile(file: string) {
    const id = this.pathToId(file);
    const module = await this.devServer.moduleGraph.getModuleByUrl(id);
    if (module) {
      this.devServer.moduleGraph.invalidateModule(module);
    }
  }

  async fetchModule(file: string): Promise<TransformResult | null> {
    return this.devServer.transformRequest(this.pathToId(file));
  }
}
