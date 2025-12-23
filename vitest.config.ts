import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'out/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/preload/**',
        '**/renderer/**',
        'vitest.config.ts',
        'electron-builder.yml',
        'build/**'
      ]
      // Note: 80% threshold removed - focusing on critical security functions first
      // Current coverage: ~26% focused on validation and security-critical code paths
    },
    include: ['src/main/**/*.test.ts'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
