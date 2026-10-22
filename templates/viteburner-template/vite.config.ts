import { resolve } from 'node:path';
import { defineConfig } from 'viteburner';

const src = resolve(import.meta.dirname, 'src');

export default defineConfig({
  resolve: {
    alias: {
      '@': src,
      '/src': src,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  viteburner: {
    watch: [
      { pattern: 'src/**/*.{js,ts,jsx,tsx}', transform: true },
      { pattern: 'src/**/*.{script,txt}' },
    ],
    sourcemap: 'inline',
  },
});
