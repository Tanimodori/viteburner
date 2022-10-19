import { defineConfig } from 'vite';
import { resolve } from 'path';
import builtins from 'builtin-modules/static';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/cli.ts'),
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      external: ['chokidar', 'micromatch', 'pathe', 'picocolors', 'unconfig', 'vite', ...builtins],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
