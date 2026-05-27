import {
  WorldSession,
  createDefaultWorldConfig,
} from 'tqandtd-project';

async function main(): Promise<void> {
  const session = new WorldSession({
    config: createDefaultWorldConfig({ seed: 123 }),
    scene: {
      syncLoadedChunks: true,
    },
  });

  session.on('chunk_loaded', ({ coordinate }) => {
    console.log('loaded chunk', coordinate);
  });

  await session.loadChunksAround(0, 0, 1);
  console.log('loaded count', session.getLoadedChunkCount());
  console.log('world stats', session.getWorldStats());

  session.regenerate({ seed: 456 });
  await session.loadChunksAround(0, 0, 1);
  console.log('new seed loaded count', session.getLoadedChunkCount());

  session.dispose();
}

void main();
