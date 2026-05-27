import {
  ChunkManager,
  createDefaultWorldConfig,
  getBiomeWeightsForTile,
} from 'tqandtd-project';

async function main(): Promise<void> {
  const config = createDefaultWorldConfig({
    seed: 42,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.012,
      heightMultiplier: 1.2,
    },
  });

  const world = new ChunkManager(config);
  const chunk = await world.getChunk(0, 0);
  const centerTile = 16 * chunk.size + 16;

  console.log('height vertices', chunk.heightmap.length);
  console.log('resources', chunk.resources.length);
  console.log('structures', chunk.structures.length);
  console.log('center biome weights', [...getBiomeWeightsForTile(chunk, centerTile)]);

  world.dispose();
}

void main();
