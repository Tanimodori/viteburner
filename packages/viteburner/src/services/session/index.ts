import type { ViteDevServer } from 'vite';
import { logger } from '@/console';
import { SyncService } from '@/services/sync';
import { ViteService } from '@/services/vite';
import { WatchService } from '@/services/watch';
import { WsService } from '@/services/ws';
import type { ResolvedViteBurnerConfig, ViteBurnerStatus } from '@/types';
import { EventBus } from '@/utils/bus';

/**
 * The services of one dev server, and the composition root that wires them.
 *
 * A session is not a singleton: vite builds a fresh server on a config change (and closes the old one
 * after the new one exists), so each server gets its own session with its own watcher, socket, and
 * subscriptions. `dispose` undoes exactly `start`, which is what keeps a replacement server's
 * services alive when the previous server is closed.
 *
 * The event bus is the session's own, created here and published as `events` for whoever wants to
 * observe this session's external events; the subscriptions made in `start` are torn down with the
 * session that made them.
 *
 * A session is also what a caller holds to ask the daemon anything: the services above for the
 * operations, and `getStatus` for a read of the whole thing.
 */
export class Session {
  readonly vite: ViteService;
  readonly watch: WatchService;
  readonly ws: WsService;
  readonly sync: SyncService;
  readonly events = new EventBus();

  private readonly disposers: (() => void)[] = [];
  private disposed = false;

  constructor(devServer: ViteDevServer, config: ResolvedViteBurnerConfig) {
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
      this.events,
    );
    this.ws = new WsService({ port: config.port, timeout: config.timeout, logger }, this.events);
    this.sync = new SyncService({ ws: this.ws, watch: this.watch, vite: this.vite });
  }

  start() {
    // Subscribe before the producers start, so the first chokidar `add` and the first client
    // connection both land on a live handler.
    this.disposers.push(this.events.on('fs:changed', (data) => this.sync.handleHmrMessage(data)));
    this.disposers.push(this.events.on('ws:connected', () => this.sync.onConnected()));
    this.watch.start();
    this.ws.start();
    this.events.emit('vite:started', { config: this.vite.config });
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
    this.events.emit('vite:closed', undefined);
  }

  /** The daemon's state, as data for a caller to render however it likes. */
  getStatus(): ViteBurnerStatus {
    return {
      connected: this.ws.connected,
      port: this.vite.config.port,
      pending: this.sync.pending,
    };
  }
}
