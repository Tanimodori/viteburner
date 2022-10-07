import { defineConfig } from 'vite';
import fg from 'fast-glob';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'node:path';

const entries = fg.sync('src/**/*.{js,ts}');

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: entries[0],
      formats: ['es'],
    },
    rollupOptions: {
      input: entries,
      output: {
        exports: 'named',
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: () => `[name].js`,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [{ src: 'src/**/*.{txt,script}', dest: '.' }],
      flatten: false,
    }),
  ],
});
