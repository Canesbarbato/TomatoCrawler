import { defineConfig } from 'vite';

export default defineConfig({
  base: '/TomatoCrawler/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
  },
});
