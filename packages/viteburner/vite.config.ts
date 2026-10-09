import { builtinModules } from 'node:module';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const externalModules = [
  // exclude all dependencies
  '@viteburner/vite-plugin',
  'cac',
  'picocolors',
  'prompts',
  'vite',
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
  build: {
    ssr: true,
    lib: {
      entry: {
        entry: resolve(__dirname, 'src/entry.ts'),
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
      // The rolled-up types land at dist/index.d.ts, next to the JS: the plugin derives that path from
      // build.outDir. The older `outputDir` (a nested types directory) is not honored — it makes the
      // entry stub reference itself, which api-extractor then fails on.
      rollupTypes: true,
    }),
  ],
});
