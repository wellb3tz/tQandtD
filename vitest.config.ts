import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'demo/src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'dist-demo'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'dist-demo', '**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src'),
    },
  },
});
