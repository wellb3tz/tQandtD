import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'app/src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'dist-app'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'node_modules',
        'dist',
        'dist-app',
        'coverage',
        'scripts',
        'tests',
        '**/*.test.ts',
        'app/main.ts',
        'app/worker-loader.ts',
        'app/src/core/**',
        'app/src/editor/**',
        'app/src/ui/**',
        'app/src/utils/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src'),
    },
  },
});
