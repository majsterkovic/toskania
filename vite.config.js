import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/toskania/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        short: resolve(__dirname, 'short/index.html'),
      },
    },
  },
});
