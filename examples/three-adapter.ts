import {
  WorldSession,
  createDefaultWorldConfig,
} from 'tqandtd-project';
import { ThreeWorldRendererAdapter } from 'tqandtd-project/adapters/three';

/**
 * Adapter construction is intentionally separate from the interactive app.
 * Pass your own Three.js scene integration through the adapter callbacks.
 */
const adapter = new ThreeWorldRendererAdapter({
  target: {
    addChunk: (chunkX, chunkY, chunk) => {
      console.log('render chunk', { chunkX, chunkY, size: chunk.size });
    },
    updateChunk: (chunkX, chunkY, chunk) => {
      console.log('update chunk', { chunkX, chunkY, size: chunk.size });
    },
    removeChunk: (chunkX, chunkY) => {
      console.log('remove chunk', { chunkX, chunkY });
    },
    setCameraPosition: (position) => {
      console.log('camera position', position);
    },
  },
});

const session = new WorldSession({
  config: createDefaultWorldConfig({ seed: 9001 }),
  renderer: adapter,
});

async function main(): Promise<void> {
  await session.loadChunksAround(0, 0, 1);
  session.dispose();
}

void main();
