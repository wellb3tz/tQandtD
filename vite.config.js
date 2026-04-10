import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: 'demo',
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      'procedural-world-engine': resolve(__dirname, './src/index.ts')
    }
  }
});
