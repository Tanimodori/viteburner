import type { ViteBurnerConfig } from 'viteburner';

// The same full config as the `vite.config.*` suites, but written in its own `viteburner.config.ts`
// file. Function-free on purpose, so every resolved field can be compared with plain data.
const config: ViteBurnerConfig = {
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
};

export default config;
