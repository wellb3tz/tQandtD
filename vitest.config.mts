import { coverageConfigDefaults, defineConfig } from 'vitest/config';
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
      exclude: [
        ...coverageConfigDefaults.exclude,
        'node_modules',
        'dist',
        'dist-demo',
        'coverage',
        'scripts',
        'tests',
        '**/*.test.ts',
        'demo/main.ts',
        'demo/worker-loader.ts',
        'demo/src/core/**',
        'demo/src/editor/**',
        'demo/src/ui/**',
        'demo/src/utils/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src'),
    },
  },
});
