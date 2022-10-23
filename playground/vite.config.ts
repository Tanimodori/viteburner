import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
});
