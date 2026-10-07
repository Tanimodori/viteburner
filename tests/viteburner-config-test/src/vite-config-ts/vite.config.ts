import type { ViteBurnerUserConfig } from 'viteburner';

// The full config, written in `vite.config.ts`. It is deliberately function-free so the suite can
// compare every resolved field with plain data (see `test/view.ts`). `build.sourcemap` is set to a
// different value than `viteburner.sourcemap` to pin which of the two the resolution keeps.
const config: ViteBurnerUserConfig = {
  build: { sourcemap: true },
  viteburner: {
    watch: [
      { pattern: 'src/**/*.{js,ts}', transform: true },
      { pattern: 'src/**/*.script', location: 'n00dles' },
      {
        pattern: 'src/data/**/*.txt',
        location: [
          { server: 'home', filename: 'data/keep.txt' },
          { server: 'n00dles', filename: 'keep.txt' },
        ],
      },
    ],
    usePolling: { interval: 500, binaryInterval: 900 },
    sourcemap: 'inline',
    port: 13231,
    timeout: 23456,
    dts: 'types/game.d.ts',
    ignoreInitial: true,
    download: {
      server: ['home', 'n00dles'],
      ignoreTs: false,
      ignoreSourcemap: false,
    },
    dumpFiles: 'dump-dir',
  },
};

export default config;
