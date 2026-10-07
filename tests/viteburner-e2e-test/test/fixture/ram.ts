import path from 'node:path';
import { PACKAGE_ROOT } from '../paths';

/**
 * The committed golden copy of the `r` key's RAM report, captured against the pinned build.
 *
 * It only makes sense offline: the numbers are the game's own `calculateRam` answers, so they track
 * the game release rather than anything viteburner does, and the online leg would fail on every
 * upstream version bump. The offline leg serves one fixed build, so there it is a stable reference
 * for what the report looked like — the E2E's answer to "the pipeline changed" rather than "the game
 * changed". Line endings are pinned to LF in `.gitattributes`, like the dump baselines.
 */
export const RAM_BASELINE_PATH = path.join(PACKAGE_ROOT, 'test', 'fixture', 'ram', 'offline.txt');

/** One CLI log line carrying a `ram`-tagged message, with the timestamp and prefix still in front. */
const RAM_LINE = /\[viteburner\] (ram .*)$/;

/**
 * Reduce a slice of the CLI's captured log to just the RAM report, one `<message>` per line.
 *
 * The slice also contains the `prompts` picker redraws; they carry no `[viteburner]` log prefix, so
 * matching on the tag drops them and leaves exactly what the CLI reported. The timestamp goes with
 * the prefix, and CRLF is folded to LF so a checkout's line endings cannot fail the comparison (the
 * baseline is stored LF, and `toMatchFileSnapshot` compares the strings as they are).
 */
export function normalizeRamReport(log: string): string {
  return log
    .split(/\r?\n/)
    .map((line) => line.match(RAM_LINE)?.[1])
    .filter((line): line is string => line !== undefined)
    .join('\n');
}
