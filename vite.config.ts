import { defineConfig } from 'vite';
import { resolve } from 'path';
import builtins from 'builtin-modules/static';
import dts from 'vite-plugin-dts';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: '',
      fileName: '[name]',
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      external: [
        // exclede all node builtins and dependencies
        'cac',
        'chokidar',
        'micromatch',
        'pathe',
        'picocolors',
        'unconfig',
        'vite',
        'ws',
        'zod',
        ...builtins,
      ],
      input: {
        entry: resolve(__dirname, 'src/entry.ts'),
        index: resolve(__dirname, 'src/index.ts'),
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  plugins: [
    dts({
      include: 'src/**/*.ts',
      entryRoot: resolve(__dirname, 'src'),
      outputDir: resolve(__dirname, 'dist/typings'),
    }),
  ],
});
