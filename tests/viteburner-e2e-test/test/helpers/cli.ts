import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Strip ANSI escape sequences so CLI output can be matched as plain text. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}

export interface ViteburnerCliOptions {
  /** Package root of the published CLI; it is started from `bin/viteburner.js` (requires a fresh build). */
  packageRoot: string;
  /** Project directory the CLI serves (a copy of the `viteburner` playground in E2E runs). */
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
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child.stdout?.on('data', (chunk: Buffer) => this.append(chunk));
    this.child.stderr?.on('data', (chunk: Buffer) => this.append(chunk));
    this.child.on('exit', (code, signal) => {
      this.exited = true;
      this.exitInfo = signal ? `signal ${signal}` : `code ${code}`;
    });
  }

  /** Wait until the captured (ANSI-stripped) output matches `pattern`. */
  async waitForLog(pattern: RegExp, timeoutMs = 60_000): Promise<RegExpMatchArray> {
    const started = Date.now();
    for (;;) {
      const match = this.buffer.match(pattern);
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
