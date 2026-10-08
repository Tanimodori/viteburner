import { logger } from '@/console';
import type { HmrData, ResolvedViteBurnerConfig } from '@/types';

/**
 * Everything that reaches a session from outside it.
 *
 * Only the three external sources publish here: the file watcher, the game's socket, and vite's
 * server lifecycle. Everything else is a direct call between the services that make up a session, so
 * this map stays the whole of what can arrive from outside.
 *
 * The player's keyboard is not among them: the keys are the CLI's control plane, read and answered by
 * the CLI's own plugin (`plugins/cli`) against the api this plugin publishes. The bus is the daemon's
 * ingress only, which is what keeps it free of anything the CLI owns.
 */
export interface AppEvents {
  /** A dev server was created and its services are running. */
  'vite:started': { config: ResolvedViteBurnerConfig };
  /** A dev server was closed and its services are disposed. */
  'vite:closed': undefined;
  /** The game became the active client of the websocket port. */
  'ws:connected': undefined;
  /** The active game client went away or was superseded. */
  'ws:disconnected': undefined;
  /** A watched file was added, changed, or removed. */
  'fs:changed': HmrData;
}

export type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * The ingress a session's services publish their external events on, created and held by that
 * session.
 *
 * Dispatch is synchronous and fault-isolated: handlers are called in subscription order, and one
 * that throws — or returns a promise that rejects — is logged while the rest still run, so a
 * subscriber cannot take the daemon down by rejecting.
 */
export class EventBus {
  // Handlers are stored under their bare event key with the payload erased to `never`: only `on`
  // writes here and it has the concrete type, so the casts below cannot be observed from outside.
  private readonly handlers = new Map<keyof AppEvents, Set<EventHandler<never>>>();

  /** Subscribe; the returned function unsubscribes. */
  on<K extends keyof AppEvents>(event: K, handler: EventHandler<AppEvents[K]>): () => void {
    const existing = this.handlers.get(event);
    const set = existing ?? new Set<EventHandler<never>>();
    if (!existing) {
      this.handlers.set(event, set);
    }
    const erased = handler as EventHandler<never>;
    set.add(erased);
    return () => {
      set.delete(erased);
    };
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    const fail = (e: unknown) => {
      logger.error('event', `${String(event)} handler failed: ${String(e)}`);
    };
    // Snapshot so a handler that subscribes or unsubscribes mid-dispatch cannot change this run.
    for (const handler of Array.from(set)) {
      try {
        // Handlers may be async; `Promise.resolve` settles the returned promise with the same catch,
        // so a rejection is reported here instead of surfacing as an unhandled rejection.
        void Promise.resolve((handler as EventHandler<AppEvents[K]>)(payload)).catch(fail);
      } catch (e) {
        fail(e);
      }
    }
  }
}
