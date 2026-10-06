import path from 'node:path';
import { FIXTURE_PROJECT_DIR } from './project';

/**
 * The fixture manifest: what the sync pipeline is expected to produce for each source file in the
 * fixture project (`./project.ts`). It is the suite's single source of truth for the upload set.
 */
export const FIXTURE_DIR = FIXTURE_PROJECT_DIR;

/**
 * What the game does when asked to run an uploaded file.
 *
 * `prints` — the game runs it and these exact lines appear in the terminal.
 * `refused` — the upload is valid, but this pinned game build declines to run it; the message is
 *   what the game answers, so the test pins that interaction rather than pretending it runs.
 */
export type FixtureRun =
  | { kind: 'prints'; lines: string[] }
  | { kind: 'refused'; message: string }
  /** Module with no `main()`; it is uploaded for the scripts that import it, but is not runnable. */
  | { kind: 'library' }
  /** Plain data file copied verbatim; not runnable. */
  | { kind: 'data' };

export interface FixtureFile {
  /** Path relative to the fixture project root. */
  source: string;
  /**
   * Destination on the game's `home` server, as a path relative to its root (no leading slash).
   * The CLI strips `src/` and rewrites `.ts` to `.js` for transformed files, and keeps everything
   * else as-is.
   */
  upload: string;
  /** Destination of the CLI's `dumpFiles` copy, relative to the fixture project root. */
  dump: string;
  /** `true` for files the CLI passes through vite; those gain an inline sourcemap. */
  transformed: boolean;
  /** Substrings the uploaded/dumped content must contain. */
  contains: string[];
  /** What the game does when the file is run. */
  run: FixtureRun;
}

/** How the game's `cat` dialog renders the uploaded `foo.txt`. */
export const FOO_TXT_CONTENT = 'Test';

/**
 * Every source file in the fixture and what the sync pipeline is expected to produce for it.
 *
 * The list is exhaustive on purpose: "all files upload" is only meaningful if a new file added to
 * the fixture without a matching entry fails the suite. `fixture.spec.ts` checks this list against
 * the files actually on disk.
 */
export const FIXTURE_FILES: FixtureFile[] = [
  {
    source: 'src/template.ts',
    upload: 'template.js',
    dump: 'dist/template.js',
    transformed: true,
    contains: ['export async function main(ns)', 'ns.tprint("Hello World!")'],
    run: { kind: 'prints', lines: ['template.js: Hello World!'] },
  },
  {
    source: 'src/deep/multi-entry.ts',
    upload: 'deep/multi-entry.js',
    dump: 'dist/deep/multi-entry.js',
    transformed: true,
    contains: ['export async function main(ns)', 'ns.tprint("Hello World!")'],
    run: { kind: 'prints', lines: ['deep/multi-entry.js: Hello World!'] },
  },
  {
    source: 'src/enum/index.ts',
    upload: 'enum/index.js',
    dump: 'dist/enum/index.js',
    transformed: true,
    // `type`-only imports from `@ns` are erased; the enum member survives as a string literal.
    contains: ['const myCrimeType = "Shoplift"', 'ns.tprint(myCrimeType)'],
    run: { kind: 'prints', lines: ['enum/index.js: Shoplift'] },
  },
  {
    source: 'src/import/main.ts',
    upload: 'import/main.js',
    dump: 'dist/import/main.js',
    transformed: true,
    // Relative, `@/` and `/src/` imports all resolve to the same `/import/*.js` upload path.
    contains: [
      'import { relative } from "/import/relative.js"',
      'import { absolute } from "/import/absolute.js"',
      'import { absoluteSrc } from "/import/absolute.js"',
    ],
    run: {
      kind: 'prints',
      lines: [
        'import/main.js: Hello, relative!',
        'import/main.js: Hello, absolute!',
        'import/main.js: Hello, absoluteSrc!',
      ],
    },
  },
  {
    source: 'src/import/absolute.ts',
    upload: 'import/absolute.js',
    dump: 'dist/import/absolute.js',
    transformed: true,
    contains: ['export function absolute(ns)', 'export function absoluteSrc(ns)'],
    run: { kind: 'library' },
  },
  {
    source: 'src/import/relative.ts',
    upload: 'import/relative.js',
    dump: 'dist/import/relative.js',
    transformed: true,
    contains: ['export function relative(ns)'],
    run: { kind: 'library' },
  },
  {
    source: 'src/importGlob/index.ts',
    upload: 'importGlob/index.js',
    dump: 'dist/importGlob/index.js',
    transformed: true,
    // `import.meta.glob` is expanded at transform time into static imports of the uploaded modules.
    contains: ['from "/importGlob/modules/bar.js"', 'from "/importGlob/modules/foo.js"'],
    run: { kind: 'prints', lines: ['importGlob/index.js: Hello, bar!', 'importGlob/index.js: Hello, foo!'] },
  },
  {
    source: 'src/importGlob/modules/bar.ts',
    upload: 'importGlob/modules/bar.js',
    dump: 'dist/importGlob/modules/bar.js',
    transformed: true,
    contains: ['export default function bar(ns)'],
    run: { kind: 'library' },
  },
  {
    source: 'src/importGlob/modules/foo.ts',
    upload: 'importGlob/modules/foo.js',
    dump: 'dist/importGlob/modules/foo.js',
    transformed: true,
    contains: ['export default function foo(ns)'],
    run: { kind: 'library' },
  },
  {
    source: 'src/importExternal/main.ts',
    upload: 'importExternal/main.js',
    dump: 'dist/importExternal/main.js',
    transformed: true,
    // An external URL import is deliberately left as-is (viteburner issue #12): the game's own
    // module loader is what rejects it, not the transform.
    contains: ['import lodash from "https://unpkg.com/lodash@4.17.21/lodash.min.js"'],
    run: {
      kind: 'refused',
      message: 'Invalid module path: "https://unpkg.com/lodash@4.17.21/lodash.min.js"',
    },
  },
  {
    source: 'src/ns1.script',
    upload: 'ns1.script',
    dump: 'dist/ns1.script',
    transformed: false,
    contains: ['while(true) {', 'print("hi");', 'sleep(5000);'],
    // The v3.0.1 build dropped Netscript 1.0 execution, so the file uploads verbatim but the game
    // refuses to run it. Same for any other `.script`.
    run: { kind: 'refused', message: 'Running .script files is unsupported' },
  },
  {
    source: 'src/foo.txt',
    upload: 'foo.txt',
    dump: 'dist/foo.txt',
    transformed: false,
    contains: [FOO_TXT_CONTENT],
    run: { kind: 'data' },
  },
];

/** The `pushFile`-style destination the CLI logs and the game sees for a fixture upload path. */
export function gamePath(upload: string) {
  return `/${upload}`;
}

/** Fixture files whose upload lands directly in `dir` (the server root is `.`). */
export function filesInDirectory(dir: string): FixtureFile[] {
  return FIXTURE_FILES.filter((file) => path.posix.dirname(file.upload) === dir);
}

/**
 * Every directory that holds uploaded files, plus the intermediate directories leading to it
 * (`importGlob`, `importGlob/modules`), in a stable order. The game has no recursive `ls`, so the
 * listing check walks the tree by hand.
 */
export const GAME_DIRECTORIES = (() => {
  const dirs = new Set<string>(['.']);
  for (const file of FIXTURE_FILES) {
    const parts = file.upload.split('/');
    parts.pop();
    for (let i = 1; i <= parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  return [...dirs].sort((a, b) => a.localeCompare(b));
})();

/** Escape a literal for embedding in a RegExp. */
export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The CLI log line that proves one file finished uploading to the game. */
export function uploadLogPattern(file: FixtureFile) {
  return new RegExp(`${escapeRegExp(`hmr add ${file.source} -> @home:${gamePath(file.upload)}`)} \\(done\\)`);
}
