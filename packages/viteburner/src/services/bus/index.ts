import { logger } from '@/console';
import type { HmrData, ResolvedViteBurnerConfig } from '@/types';

/**
 * Everything that reaches the daemon from outside it.
 *
 * Only the four external sources publish here: the file watcher, the game's socket, vite's server
 * lifecycle, and the player's keyboard. Everything else is a direct call between the services that
 * make up a session, so this map stays the whole of what can arrive from outside.
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
  /** One key reached the CLI's stdin reader. */
  'input:key': { key: string };
}

export type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * The ingress the services subscribe to.
 *
 * Dispatch is sequential and fault-isolated: one handler that throws is logged and the rest still
 * run, so a subscriber cannot take the daemon down by rejecting.
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

  async emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    // Snapshot so a handler that subscribes or unsubscribes mid-dispatch cannot change this run.
    for (const handler of Array.from(set)) {
      try {
        await (handler as EventHandler<AppEvents[K]>)(payload);
      } catch (e) {
        logger.error('event', `${String(event)} handler failed: ${String(e)}`);
      }
    }
  }
}
