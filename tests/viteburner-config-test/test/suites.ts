import type { ResolvedView } from './view';

/**
 * One fixture project and the config it must resolve to.
 *
 * `dir` is a directory under `src/`; `files` names the config file(s) it ships and is only used to
 * name the case in the report. `expected` is the resolved config minus `cwd`, which the spec checks
 * against the project's own directory.
 */
export interface ConfigSuite {
  dir: string;
  files: string[];
  expected: ResolvedView;
}

/**
 * The full config, as it must resolve no matter which way it was written.
 *
 * The values are the ones in `src/*-config-*` fixtures. `location` is the sample file's mapping, so
 * these are the outputs of `viewResolved` on the resolved config (see `test/view.ts`).
 */
function fullConfig(): ResolvedView {
  return {
    watch: [
      { pattern: 'src/**/*.{js,ts}', transform: true, location: [{ filename: 'sample.js', server: 'home' }] },
      { pattern: 'src/**/*.script', transform: false, location: [{ filename: 'sample.js', server: 'n00dles' }] },
      {
        pattern: 'src/data/**/*.txt',
        transform: false,
        location: [
          { filename: '/data/keep.txt', server: 'home' },
          { filename: 'keep.txt', server: 'n00dles' },
        ],
      },
    ],
    usePolling: true,
    pollingOptions: { interval: 500, binaryInterval: 900 },
    sourcemap: 'inline',
    port: 13231,
    timeout: 23456,
    dts: 'types/game.d.ts',
    ignoreInitial: true,
    download: {
      server: ['home', 'n00dles'],
      location: 'src/sample.ts',
      ignoreTs: false,
      ignoreSourcemap: false,
    },
    dumpFiles: 'dump-dir/src/sample.ts',
  };
}

/**
 * Every way of loading a complete config that the suite covers.
 *
 * Each fixture writes the same full config in a different file, so a difference between any two
 * expectations means the way of loading changed the result — not the config that was written.
 */
export const COMPLETE_SUITES: ConfigSuite[] = [
  { dir: 'vite-config-ts', files: ['vite.config.ts'], expected: fullConfig() },
  { dir: 'vite-config-js', files: ['vite.config.js'], expected: fullConfig() },
  { dir: 'viteburner-config-ts', files: ['viteburner.config.ts'], expected: fullConfig() },
  { dir: 'viteburner-config-js', files: ['viteburner.config.js'], expected: fullConfig() },
  { dir: 'viteburner-config-json', files: ['viteburner.config.json'], expected: fullConfig() },
];

/**
 * Configs split across two files, which must come back merged.
 *
 * Only fields that appear in one file are used, because the order in which a `vite.config` and a
 * `viteburner.config` override each other is not defined. The expectation therefore proves the two
 * sources stack — watch, usePolling and port from the vite config, timeout, dts, ignoreInitial and
 * download from the viteburner config, plus the vite config's `build.sourcemap` as the default — and
 * says nothing about who wins a collision.
 */
export const MERGE_SUITES: ConfigSuite[] = [
  {
    dir: 'merge-vite-and-viteburner-config',
    files: ['vite.config.js', 'viteburner.config.js'],
    expected: {
      watch: [{ pattern: 'src/**/*.js', transform: true, location: [{ filename: 'sample.js', server: 'home' }] }],
      usePolling: true,
      pollingOptions: {},
      sourcemap: 'inline',
      port: 14141,
      timeout: 34567,
      dts: 'types/defs.d.ts',
      ignoreInitial: true,
      download: {
        server: ['n00dles'],
        location: 'src/sample.ts',
        ignoreTs: false,
        ignoreSourcemap: false,
      },
      dumpFiles: undefined,
    },
  },
];
