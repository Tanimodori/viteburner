import type { ViteDevServer } from 'vite';
import { logger } from '@/console';
import { EventBus } from '@/services/bus';
import { SyncService } from '@/services/sync';
import { ViteService } from '@/services/vite';
import { WatchService } from '@/services/watch';
import { WsService } from '@/services/ws';
import type { ResolvedViteBurnerConfig } from '@/types';

/**
 * The services of one dev server, and the composition root that wires them.
 *
 * A session is not a singleton: vite builds a fresh server on a config change (and closes the old one
 * after the new one exists), so each server gets its own session with its own watcher, socket, and
 * subscriptions. `dispose` undoes exactly `start`, which is what keeps a replacement server's
 * services alive when the previous server is closed.
 *
 * The bus is shared across sessions, so vites and their services can be observed process-wide; the
 * subscriptions made here are not, and are torn down with the session that made them.
 */
export class Session {
  readonly vite: ViteService;
  readonly watch: WatchService;
  readonly ws: WsService;
  readonly sync: SyncService;

  private readonly disposers: (() => void)[] = [];
  private disposed = false;

  constructor(
    devServer: ViteDevServer,
    config: ResolvedViteBurnerConfig,
    private readonly bus: EventBus,
  ) {
    this.vite = new ViteService(devServer, config);
    this.watch = new WatchService(
      config.watch,
      {
        cwd: this.vite.root,
        persistent: true,
        ignoreInitial: config.ignoreInitial,
        usePolling: !!config.usePolling,
        ...config.pollingOptions,
      },
      bus,
    );
    this.ws = new WsService({ port: config.port, timeout: config.timeout, logger }, bus);
    this.sync = new SyncService({ ws: this.ws, watch: this.watch, vite: this.vite });
  }

  start() {
    // Subscribe before the producers start, so the first chokidar `add` and the first client
    // connection both land on a live handler.
    this.disposers.push(this.bus.on('fs:changed', (data) => this.sync.handleHmrMessage(data)));
    this.disposers.push(this.bus.on('ws:connected', () => this.sync.onConnected()));
    this.watch.start();
    this.ws.start();
    void this.bus.emit('vite:started', { config: this.vite.config });
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const dispose of this.disposers.splice(0).reverse()) {
      dispose();
    }
    this.ws.stop();
    this.watch.stop();
    void this.bus.emit('vite:closed', undefined);
  }
}
