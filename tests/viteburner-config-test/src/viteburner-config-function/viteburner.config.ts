import type { ViteBurnerConfigExport } from 'viteburner';

// The function form of a standalone config: the plugin must call it with vite's `ConfigEnv`.
// The port branch proves that both `command` and `mode` arrive; any other env resolves to a value
// the suite does not expect.
const config: ViteBurnerConfigExport = async (env) => ({
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
  port: env.command === 'serve' && env.mode === 'development' ? 13231 : 1,
  timeout: 23456,
  dts: 'types/game.d.ts',
  ignoreInitial: true,
  download: {
    server: ['home', 'n00dles'],
    ignoreTs: false,
    ignoreSourcemap: false,
  },
  dumpFiles: 'dump-dir',
});

export default config;
