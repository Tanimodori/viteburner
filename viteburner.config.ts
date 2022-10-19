export default {
  watch: {
    js: { pattern: 'src/**/*.{js,ts}', transform: true },
    script: { pattern: 'src/**/*.script', transform: false },
    txt: { pattern: 'src/**/*.txt', transform: false },
  },
  sourcemap: 'inline',
};
