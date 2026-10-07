// The same full config as `viteburner-config-ts`, in the `.js` form. The file carries the bare
// viteburner config: this is the source `load.ts` reads with no rewrite.
export default {
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
