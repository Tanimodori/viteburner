import { describe, expect, it, vi } from 'vitest';
import { logger } from '@/console';
import type { HmrData } from '@/types';
import { EventBus } from '@/utils/bus';

/**
 * The bus contract the session's services depend on: dispatch is synchronous, and a subscriber that
 * fails is contained.
 *
 * `emit` no longer awaits, so a handler that rejects cannot be caught by the dispatch loop itself —
 * the bus settles the returned promise instead. Both halves are pinned here: the synchronous throw,
 * and the rejection that must not reach the process as an unhandled rejection.
 */

const HMR: HmrData = { file: 'a.ts', pattern: 'src/**/*.ts', event: 'change', initial: false, timestamp: 1 };

/** Silence the expected error log, and hand back the spy so a test can assert it fired. */
function spyError() {
  return vi.spyOn(logger, 'error').mockImplementation(() => {});
}

describe('EventBus', () => {
  it('dispatches synchronously, in subscription order', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on('fs:changed', () => {
      order.push('first');
    });
    bus.on('fs:changed', () => {
      order.push('second');
    });

    bus.emit('fs:changed', HMR);

    // Nothing is awaited: the handlers have already run by the time emit returns.
    expect(order).toEqual(['first', 'second']);
  });

  it('stops delivering to a subscriber once it unsubscribes', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('fs:changed', handler);

    bus.emit('fs:changed', HMR);
    off();
    bus.emit('fs:changed', HMR);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for an event with no subscribers', () => {
    expect(() => new EventBus().emit('ws:connected', undefined)).not.toThrow();
  });

  it('keeps the remaining handlers running when one throws, and logs it', () => {
    const error = spyError();
    const bus = new EventBus();
    const after = vi.fn();
    bus.on('fs:changed', () => {
      throw new Error('boom');
    });
    bus.on('fs:changed', after);

    bus.emit('fs:changed', HMR);

    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('event', expect.stringContaining('boom'));
    error.mockRestore();
  });

  it('contains a rejecting async handler instead of leaking an unhandled rejection', async () => {
    const error = spyError();
    const bus = new EventBus();
    const after = vi.fn();
    bus.on('fs:changed', async () => {
      throw new Error('async boom');
    });
    bus.on('fs:changed', after);

    bus.emit('fs:changed', HMR);
    // Let the rejected promise settle; an unhandled rejection would fail this test here.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('event', expect.stringContaining('async boom'));
    error.mockRestore();
  });
});
