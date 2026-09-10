import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        short: resolve(__dirname, 'short/index.html'),
        mapa: resolve(__dirname, 'mapa/index.html'),
        pogoda: resolve(__dirname, 'pogoda/index.html'),
        bazy: resolve(__dirname, 'bazy/index.html'),
        galeria: resolve(__dirname, 'galeria/index.html'),
        praktyczne: resolve(__dirname, 'praktyczne/index.html'),
        packing: resolve(__dirname, 'packing/index.html'),
        pamiatki: resolve(__dirname, 'pamiatki/index.html'),
      },
    },
  },
});
