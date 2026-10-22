import readline from 'node:readline';
import { PassThrough } from 'node:stream';
import { logger } from '@viteburner/vite-plugin';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliApi } from '../src/api';
import { startCliKeys } from '../src/key';
import { suspendKeypress } from '../src/key/reader';

/**
 * The keyboard's split: emergency exit chords versus ordinary shortcuts.
 *
 * Ctrl+C and Ctrl+D are read by the reader itself and force the process down before the key map runs.
 * `q` and escape are ordinary map entries, so they go through `api.quit` — and that api is a no-op
 * while no session exists. The point worth pinning is that a shortcut must not turn into an
 * emergency exit: pressing escape during startup must not kill the CLI that has nothing to stop yet.
 *
 * Both spellings of each chord are covered by the reader's single branch (the control byte, and the
 * named key readline builds for the same chord); driving the bytes here is what a pipe delivers,
 * which is also how the e2e suite talks to the CLI.
 *
 * `process.exit` is stubbed: the real one would take the test runner with it.
 */

function fakeApi(): CliApi {
  return {
    getSession: () => undefined,
    displayStatus: vi.fn(),
    quit: vi.fn(),
    fullUpload: vi.fn(async () => {}),
    fullDownload: vi.fn(async () => {}),
    displayRamUsage: vi.fn(async () => {}),
  };
}

describe('the CLI keyboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Stub the terminal's writes and the process exit, so a key can be pressed in a test. */
  function press() {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const api = fakeApi();
    const input = new PassThrough();
    const keypress = startCliKeys(api, input);
    return { api, exit, input, keypress };
  }

  it('runs the key map for a plain key', async () => {
    const { api, exit, input } = press();

    input.write('d');

    await vi.waitFor(() => expect(api.fullDownload).toHaveBeenCalledTimes(1));
    expect(exit, 'a plain d is the download key, not a force exit').not.toHaveBeenCalled();
  });

  for (const [name, byte] of [
    ['ctrl+c', '\x03'],
    ['ctrl+d', '\x04'],
  ] as const) {
    it(`force-exits on ${name}`, async () => {
      const { exit, input } = press();

      input.write(byte);

      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    });
  }

  for (const [name, byte] of [
    ['q', 'q'],
    ['escape', '\x1B'],
  ] as const) {
    it(`treats ${name} as the quit shortcut`, async () => {
      const { api, exit, input } = press();

      input.write(byte);

      await vi.waitFor(() => expect(api.quit).toHaveBeenCalledTimes(1));
      expect(exit, `${name} is a shortcut, not an emergency exit`).not.toHaveBeenCalled();
    });
  }

  /**
   * Hand the stream to a prompt: `suspendKeypress` closes the reader's readline interface, and the
   * prompt installs its own. That second interface is also what re-enables keypress events on the
   * stream, which is why the emergency listener still hears them here.
   */
  function promptTerminal(input: PassThrough) {
    const terminal = readline.createInterface({ input });
    readline.emitKeypressEvents(input, terminal);
    return terminal;
  }

  it('force-exits on ctrl+c while a prompt has the terminal', async () => {
    // `suspendKeypress` is what an interactive command does before handing stdin to `prompts`. The
    // emergency chords must keep working there, or ctrl+c would only cancel the prompt.
    const { exit, input, keypress } = press();
    suspendKeypress(keypress);
    const terminal = promptTerminal(input);

    try {
      input.write('\x03');
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    } finally {
      terminal.close();
    }
  });

  it('does not dispatch shortcuts while a prompt has the terminal', async () => {
    // The listener stays attached for the emergency chords; every other key belongs to the prompt.
    const { api, input, keypress } = press();
    suspendKeypress(keypress);
    const terminal = promptTerminal(input);

    try {
      input.write('q');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(api.quit).not.toHaveBeenCalled();
    } finally {
      terminal.close();
    }
  });
});
