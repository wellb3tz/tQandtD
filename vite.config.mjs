import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: 'app',
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  resolve: {
    alias: {
      'procedural-world-engine': resolve(__dirname, './src/index.ts'),
      '@engine': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './app/src/core'),
      '@viewer': resolve(__dirname, './app/src/viewer'),
      '@ui': resolve(__dirname, './app/src/ui'),
      '@utils': resolve(__dirname, './app/src/utils')
    }
  },
  build: {
    outDir: '../dist-app',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.log']
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'engine-core': [
            resolve(__dirname, './src/core/noise.ts'),
            resolve(__dirname, './src/core/rng.ts'),
            resolve(__dirname, './src/core/hash.ts')
          ],
          'engine-world': [
            resolve(__dirname, './src/world/chunk.ts'),
            resolve(__dirname, './src/world/chunk-manager.ts'),
            resolve(__dirname, './src/world/biome.ts'),
            resolve(__dirname, './src/world/enhanced-biome.ts')
          ],
          'engine-generation': [
            resolve(__dirname, './src/gen/terrain.ts'),
            resolve(__dirname, './src/gen/resources.ts'),
            resolve(__dirname, './src/gen/structures.ts')
          ],
          'engine-advanced': [
            resolve(__dirname, './src/world/worker-pool.ts'),
            resolve(__dirname, './src/world/serialization.ts')
          ]
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    chunkSizeWarningLimit: 600
  },
  optimizeDeps: {
    include: ['three', 'pako']
  },
  worker: {
    format: 'es'
  }
});
