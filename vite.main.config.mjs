import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: './src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: '.vite/build',
    rollupOptions: {
      // Only externalize electron itself, not native modules
      external: ['electron'],
    },
  },
});
