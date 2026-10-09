import { builtinModules } from 'node:module';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const externalModules = [
  // exclude all dependencies
  'acorn',
  'chokidar',
  'fast-glob',
  'magic-string',
  'micromatch',
  'pathe',
  'picocolors',
  'unconfig',
  'vite',
  // @viteburner/bb-ws-server's own runtime dependencies: its code is bundled into this package, these are not
  'ws',
  'zod',
  // node builtins
  ...builtinModules,
  // node builtins with prefix
  ...builtinModules.map((name) => `node:${name}`),
];

/** The package name an import id belongs to, keeping a scope whole. */
function packageName(id: string) {
  const parts = id.split('/');
  return id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
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
      external: (src) => externalModules.includes(packageName(src)),
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
      // The declaration tree, not the published types: `scripts`-less build step two (api-extractor,
      // see api-extractor.json) rolls these up into dist/typings with @viteburner/bb-ws-server inlined.
      outputDir: resolve(__dirname, 'dist/typings-tmp'),
      rollupTypes: false,
    }),
  ],
});
