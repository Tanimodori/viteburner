import { defineConfig } from 'vite';
import fg from 'fast-glob';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const entries = fg.sync('src/**/*.{js,ts}');

export default defineConfig({
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
