import {
  ChunkManager,
  buildChunkBoundaryLineData,
  buildOceanGeometryData,
  buildTerrainGridGeometryData,
  createDefaultWorldConfig,
  identifyOceanSurfaceTiles,
  planFoliagePlacements,
} from 'tqandtd-project';

async function main(): Promise<void> {
  const world = new ChunkManager(createDefaultWorldConfig({ seed: 777 }));
  const chunk = await world.getChunk(0, 0);

  const terrain = buildTerrainGridGeometryData(chunk, 0, 0, { heightScale: 50 });
  const oceanTiles = identifyOceanSurfaceTiles(chunk, 0.3);
  const ocean = buildOceanGeometryData(oceanTiles, chunk, 0.3, { heightScale: 50 });
  const foliage = planFoliagePlacements(0, 0, chunk, 0.3);
  const boundaries = buildChunkBoundaryLineData(0, 0, chunk, { heightScale: 50 });

  console.log('terrain vertices', terrain.vertexCount);
  console.log('ocean vertices', ocean ? ocean.positions.length / 3 : 0);
  console.log('tree placements', foliage?.treePlacements.length ?? 0);
  console.log('boundary vertices', boundaries.positions.length / 3);

  world.dispose();
}

void main();
