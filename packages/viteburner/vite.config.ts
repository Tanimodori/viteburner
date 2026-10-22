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

/**
 * api-extractor writes `import { X } from 'vite'` even when X is only used as a type. Without
 * `"type": "module"` the d.ts is a CommonJS module, and under node16/nodenext a value import of an
 * ESM-only package is TS1479. Every import in a declaration file is type-only, so make that explicit.
 *
 * For an ESM-only package that still leaves TS1541: a type-only import from a CommonJS declaration
 * must say which resolution mode it means. `vite` is the only such package in the published surface.
 */
const esmOnlyPackages = ['vite'];

function typeOnlyDtsImports(content: string) {
  const typeOnly = content.replace(/^import\s+(?!type\b)(?=[{*A-Za-z_$])/gm, 'import type ');
  return esmOnlyPackages.reduce(
    (result, pkg) =>
      result.replace(
        new RegExp(`(^import type\\s+[^;]*?\\s+from\\s+['"]${pkg}['"])(;)`, 'gm'),
        `$1 with { "resolution-mode": "import" }$2`,
      ),
    typeOnly,
  );
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
      // build.outDir. A nested types directory is not honored — it makes the entry stub reference
      // itself, which api-extractor then fails on.
      bundleTypes: true,
      beforeWriteFile(filePath, content) {
        if (filePath.endsWith('.d.ts')) {
          return { content: typeOnlyDtsImports(content) };
        }
      },
    }),
  ],
});
