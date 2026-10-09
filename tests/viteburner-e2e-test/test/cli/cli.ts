import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Strip ANSI escape sequences so CLI output can be matched as plain text.
 *
 * Covers CSI (colors, cursor moves, line erases) including the private-mode form `prompts` emits to
 * hide and show the cursor (`\x1b[?25l` / `\x1b[?25h`), and the two-byte DECSC/DECRC cursor saves
 * (`\x1b7` / `\x1b8`) that carry no `[`. Missing either leaves raw escape bytes in the captured log.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[A-Za-z]|\u001b[78]/g, '');
}

export interface ViteburnerCliOptions {
  /** Package root of the published CLI; it is started from `bin/viteburner.js` (requires a fresh build). */
  packageRoot: string;
  /** Project directory the CLI serves (a copy of this package's fixture project in E2E runs). */
  cwd: string;
  /** WebSocket port the game should connect to. */
  port: number;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Controls a real viteburner CLI process (dist mode: `node bin/viteburner.js`).
 *
 * The whole point is to exercise the same artifact that is published to npm, so the caller must
 * build the `viteburner` package first (the repo's `rush build`/`rushx build` does that).
 */
export class ViteburnerCli {
  readonly port: number;
  private readonly packageRoot: string;
  private readonly cwd: string;
  private child?: ChildProcess;
  private buffer = '';
  private exited = false;
  private exitCode: number | null = null;
  private exitSignal: NodeJS.Signals | null = null;
  private exitInfo = '';

  constructor(options: ViteburnerCliOptions) {
    this.packageRoot = options.packageRoot;
    this.cwd = options.cwd;
    this.port = options.port;
  }

  get log() {
    return this.buffer;
  }

  logTail(lines = 40) {
    return this.buffer.split('\n').slice(-lines).join('\n');
  }

  async start() {
    const bin = path.join(this.packageRoot, 'bin', 'viteburner.js');
    if (!fs.existsSync(path.join(this.packageRoot, 'dist', 'entry.js'))) {
      throw new Error(
        'viteburner dist/entry.js is missing. Run `rush build` (or `rushx build` in that package) first.',
      );
    }
    this.child = spawn(process.execPath, [bin, '--cwd', this.cwd, '--port', String(this.port)], {
      cwd: this.packageRoot,
      // stdin is a pipe so the suite can deliver keystrokes: the CLI's key reader (`startKeypress` in
      // its `key/reader.ts`) reads `process.stdin` directly. It is not a TTY, so the CLI logs a warning
      // and skips raw mode, but plain keys and control bytes still arrive as `keypress` events —
      // which is what the reader hands to the key map.
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    // Writing after the child is gone raises EPIPE; the exit is reported through `exit` below anyway.
    this.child.stdin?.on('error', () => {});
    this.child.stdout?.on('data', (chunk: Buffer) => this.append(chunk));
    this.child.stderr?.on('data', (chunk: Buffer) => this.append(chunk));
    this.child.on('exit', (code, signal) => {
      this.exited = true;
      this.exitCode = code;
      this.exitSignal = signal;
      this.exitInfo = signal ? `signal ${signal}` : `code ${code}`;
    });
  }

  /**
   * Wait until the captured (ANSI-stripped) output matches `pattern`, searching from character
   * `from` onward. Take the buffer length (`cli.log.length`) just before the action that should
   * produce the output: the buffer is cumulative, so the startup banner would otherwise satisfy a
   * later match for something it already printed (a status block, say).
   */
  async waitForLog(pattern: RegExp, timeoutMs = 60_000, from = 0): Promise<RegExpMatchArray> {
    const started = Date.now();
    for (;;) {
      const match = this.buffer.slice(from).match(pattern);
      if (match) {
        return match;
      }
      if (this.exited) {
        throw new Error(
          `viteburner CLI exited (${this.exitInfo}) while waiting for ${pattern}.\nLog tail:\n${this.logTail()}`,
        );
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for ${pattern}.\nLog tail:\n${this.logTail()}`);
      }
      await delay(100);
    }
  }

  /**
   * Write a keystroke to the CLI's stdin, the way a terminal would.
   *
   * The CLI's handler reads raw `keypress` events, so a single character with no trailing newline is
   * exactly one key. Escape sequences are accepted too (an arrow key is `'\x1B[A'`).
   */
  sendKey(key: string) {
    if (!this.child?.stdin || this.exited) {
      throw new Error('viteburner CLI is not running; cannot send a key');
    }
    this.child.stdin.write(key);
  }

  /** Wait until the process has exited and report how; throws on timeout. */
  async waitForExit(timeoutMs = 10_000): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    const started = Date.now();
    while (!this.exited) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for the CLI to exit.\nLog tail:\n${this.logTail()}`);
      }
      await delay(50);
    }
    return { code: this.exitCode, signal: this.exitSignal };
  }

  async stop() {
    const child = this.child;
    if (!child || child.pid === undefined || this.exited) {
      return;
    }
    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on(
          'close',
          () => resolve(),
        );
      });
    } else {
      child.kill('SIGTERM');
    }
    const started = Date.now();
    while (!this.exited && Date.now() - started < 5000) {
      await delay(50);
    }
    if (!this.exited) {
      child.kill('SIGKILL');
    }
  }

  private append(chunk: Buffer) {
    this.buffer += stripAnsi(chunk.toString('utf8'));
  }
}
