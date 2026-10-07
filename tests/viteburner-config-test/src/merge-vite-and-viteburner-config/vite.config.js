// Half of the merge suite: the fields a vite config can carry. `build.sourcemap` is here too, to pin
// that it reaches the resolved config as the sourcemap default. The other half is in
// `viteburner.config.js`; together they must resolve to one config (see `test/suites.ts`).
export default {
  build: { sourcemap: 'inline' },
  viteburner: {
    watch: [{ pattern: 'src/**/*.js', transform: true }],
    usePolling: true,
    port: 14141,
  },
};
