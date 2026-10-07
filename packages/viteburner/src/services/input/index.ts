import readline from 'readline';
import { logger } from '@/console';
import { EventBus } from '@/services/bus';

export interface KeyInfo {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/**
 * The only reader of `process.stdin`, and the source of the `input:key` event.
 *
 * It is process-scoped, not session-scoped: stdin belongs to the CLI, and a dev server restart does
 * not replace it. `start` attaches the reader explicitly — a reader that is never started leaves
 * every key unanswered — and `suspend`/`resume` let a command that needs the terminal for itself (an
 * interactive prompt reading stdin) hand it over and take it back.
 */
export class InputService {
  private active = false;
  private running = false;
  private rl?: readline.Interface;

  constructor(private readonly bus: EventBus) {}

  start() {
    if (this.active) {
      return;
    }
    this.active = true;
    // Key press handler may not work on non-tty stdin like Git Bash on Windows.
    if (!process.stdin.isTTY) {
      logger.warn('current stdin is not a TTY. Keypress events may not work.');
    }
    this.resume();
  }

  stop() {
    this.active = false;
    this.suspend();
  }

  suspend() {
    this.rl?.close();
    this.rl = undefined;
    process.stdin.off('keypress', this.onKey);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  resume() {
    if (!this.active) {
      return;
    }
    this.suspend();
    this.rl = readline.createInterface({ input: process.stdin });
    readline.emitKeypressEvents(process.stdin, this.rl);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on('keypress', this.onKey);
  }

  private readonly onKey = async (str: string, key: KeyInfo) => {
    // esc, ctrl+d or ctrl+c to force exit
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c')) {
      logger.info('sigterm');
      process.exit(1);
    }
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.bus.emit('input:key', { key: key.name });
    } finally {
      this.running = false;
    }
  };
}
