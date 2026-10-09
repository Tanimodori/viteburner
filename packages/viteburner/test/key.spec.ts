import { PassThrough } from 'node:stream';
import { logger } from '@viteburner/vite-plugin';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliApi } from '../src/api';
import { startCliKeys } from '../src/key';

/**
 * The keyboard's two halves: a plain key goes to the key map, and the force-exit chords never do.
 *
 * The exit chords are worth pinning because `ctrl+d` sits one modifier away from `d`, which is
 * "download all files" — so a reader that guessed at the wrong half of the chord would either swallow
 * a download or exit on it. Both spellings of the chord are covered by the reader's single branch
 * (the control byte, and the named key readline builds for the same chord); driving the bytes here is
 * what a pipe delivers, which is also how the e2e suite talks to the CLI.
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
    startCliKeys(api, input);
    return { api, exit, input };
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
});
