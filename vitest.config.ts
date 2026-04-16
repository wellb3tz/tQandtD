import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/node_modules/**', '**/dist/**']
    }
  },
  resolve: {
    alias: {
      'three': path.resolve(__dirname, './demo/src/viewer/__mocks__/three.ts'),
      'three/examples/jsm/controls/OrbitControls.js': path.resolve(__dirname, './demo/src/viewer/__mocks__/OrbitControls.ts')
    }
  }
});
