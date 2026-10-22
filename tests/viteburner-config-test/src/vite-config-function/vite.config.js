// The full config in vite's function form. Vite calls this with `{ command, mode }`; the plugin must
// read `viteburner` from that same call instead of evaluating the file again without arguments.
// `port` depends on `mode`, so an argument-less second evaluation either throws (destructuring
// undefined) or resolves a different port — both fail the suite's expected config.
export default ({ mode }) => ({
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
    port: mode === 'development' ? 13231 : 1,
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
});
