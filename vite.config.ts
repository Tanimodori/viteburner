import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'node:module';
import dts from 'vite-plugin-dts';

const externalModules = [
  // exclude all dependencies
  'acorn',
  'cac',
  'chokidar',
  'fast-glob',
  'magic-string',
  'micromatch',
  'pathe',
  'picocolors',
  'prompts',
  'unconfig',
  'vite',
  'ws',
  'zod',
  // node builtins
  ...builtinModules,
  // node builtins with prefix
  ...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: {
        entry: resolve(__dirname, 'src/entry.ts'),
        index: resolve(__dirname, 'src/index.ts'),
      },
      fileName: '[name]',
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      external: externalModules,
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
      // Disabled due to https://github.com/qmhc/vite-plugin-dts/issues/144
      // rollupTypes: true,
    }),
  ],
});
