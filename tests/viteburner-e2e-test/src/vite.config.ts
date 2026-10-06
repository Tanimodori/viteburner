import { resolve } from 'path';
import type { ViteBurnerUserConfig } from 'viteburner';

// The fixture project the E2E suite hands to the CLI. Its aliases, watch patterns and dump mapping
// are the ones the assertions in `test/fixture/manifest.ts` are written against: change either and
// the other must change with it.
const config: ViteBurnerUserConfig = {
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '/src': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  viteburner: {
    watch: [{ pattern: 'src/**/*.{js,ts}', transform: true }, { pattern: 'src/**/*.{script,txt}' }],
    sourcemap: 'inline',
    dumpFiles: (file: string) => {
      return file.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js');
    },
  },
};

export default config;
