import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: './src/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: '.vite/preload',
    rollupOptions: {
      external: ['electron'],
    },
  },
});
