import { builtinModules } from 'node:module';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const externalModules = [
  // exclude all dependencies
  'ws',
  'zod',
  // node builtins
  ...builtinModules,
  // node builtins with prefix
  ...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      fileName: '[name]',
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      external: (src) => {
        const name = src.split('/')[0];
        return externalModules.includes(name);
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  ssr: {
    noExternal: true,
  },
  plugins: [
    dts({
      include: 'src/**/*.ts',
      entryRoot: resolve(__dirname, 'src'),
      // The rolled-up types land at dist/index.d.ts, next to the JS: the plugin derives that path from
      // build.outDir, so a nested types directory is not an option — its entry stub would reference
      // itself, which api-extractor fails on.
      rollupTypes: true,
    }),
  ],
});
