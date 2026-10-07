import path from 'node:path';
import { PACKAGE_ROOT } from '../paths';

/**
 * The committed golden copy of what `dumpFiles` produces.
 *
 * It lives at `test/fixture/dist/<upload>` — this directory plus the CLI's own dump path, since the
 * manifest's `dump` field is already `dist/<upload>` — so a baseline sits beside the assertions that
 * read it and can be diffed against a real dump by eye. Keeping it out of the fixture project means
 * `src/` stays what `project.ts` says it is: read-only fixture source, never written by a run, and
 * never a place a baseline could be mistaken for generated output.
 *
 * Three repo-wide rules matter here, and two of them need an override:
 * - the root `.gitignore`'s `dist/` rule would drop these files, so it is negated for this directory;
 * - `.gitattributes`'s `* text=auto eol=crlf` would hand a fresh checkout CRLF baselines that cannot
 *   match LF transform output, so this directory is pinned to LF;
 * - `.oxlintrc.json` and `.oxfmtrc.json` already ignore every `dist` directory, so neither tool will
 *   rewrite them.
 */
export function dumpBaselinePath(dump: string) {
  return path.join(PACKAGE_ROOT, 'test', 'fixture', dump);
}

/** The inline sourcemap comment, anywhere in the text. */
const INLINE_SOURCEMAP = /\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+/;

/** The same comment as the file's last line — how the CLI appends it. */
const TRAILING_INLINE_SOURCEMAP = /\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+\s*$/;

/**
 * Whether a dump ends with the inline sourcemap comment the CLI appends after the module code
 * (`adapter.ts` does `content += getSourceMapString(module.map)`, with no separator and no trailing
 * newline, so the map is always the last line).
 *
 * Anchoring on the end is the whole point of asking this rather than searching for the substring:
 * a search can only say whether the text mentions a sourcemap, so it reports a verbatim file that
 * happens to contain the words `sourceMappingURL` as if it had been transformed, and accepts a
 * transformed file whose map is not where the CLI puts it.
 */
export function endsWithInlineSourcemap(content: string) {
  return TRAILING_INLINE_SOURCEMAP.test(content);
}

/**
 * Reduce a dump to the part worth pinning to a baseline, so the diff can only report a real change
 * in what the transform pipeline emits. Two things are excluded, both for the same reason — they
 * describe the machine and checkout that produced the dump rather than the pipeline's output:
 *
 * - the inline sourcemap: it embeds the producing machine's absolute paths and its own encoded
 *   bytes. Where it belongs is still pinned, by `endsWithInlineSourcemap` next to this call.
 * - line endings: a verbatim copy (`.script`, `.txt`) inherits whatever the sandbox's git checkout
 *   gave the source, so a CRLF checkout would otherwise produce a baseline that fails on a LF one.
 *   The repo normalizes text to LF anyway (`text=auto`), so EOL carries no signal here.
 */
export function normalizeDump(content: string) {
  return content.replace(INLINE_SOURCEMAP, '//# sourceMappingURL=<inline sourcemap>').replace(/\r\n/g, '\n');
}
