import type { LakeData } from '../../../gen/lakes';
import type { WorldLakeData } from '../../lake-manager';

const LAKE_CARVE_DEPTH = 0.04;

export type WaterBodyState = 'filled' | 'frozen' | 'dry';
export type LakeClimateSample = { temperature: number; moisture: number } | null | undefined;
export type LakeClimateSampler = (worldX: number, worldY: number) => LakeClimateSample;

export function convertWorldLakesToChunkLakes(
  worldLakes: WorldLakeData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  determineState: (lake: WorldLakeData) => WaterBodyState = () => 'filled'
): LakeData[] {
  const chunkWorldX = chunkX * chunkSize;
  const chunkWorldY = chunkY * chunkSize;
  const result: LakeData[] = [];

  for (const worldLake of worldLakes) {
    const chunkTiles = new Set<number>();
    const surfaceTiles = new Set<number>();

    for (const tileKey of worldLake.tiles) {
      const [worldX, worldY] = tileKey.split(',').map(Number);

      if (
        worldX >= chunkWorldX &&
        worldX < chunkWorldX + chunkSize &&
        worldY >= chunkWorldY &&
        worldY < chunkWorldY + chunkSize
      ) {
        const localX = worldX - chunkWorldX;
        const localY = worldY - chunkWorldY;
        chunkTiles.add(localY * chunkSize + localX);
      }

      for (let surfaceWorldY = worldY - 1; surfaceWorldY <= worldY + 1; surfaceWorldY++) {
        if (surfaceWorldY < chunkWorldY || surfaceWorldY >= chunkWorldY + chunkSize) continue;

        for (let surfaceWorldX = worldX - 1; surfaceWorldX <= worldX + 1; surfaceWorldX++) {
          if (surfaceWorldX < chunkWorldX || surfaceWorldX >= chunkWorldX + chunkSize) continue;

          const localX = surfaceWorldX - chunkWorldX;
          const localY = surfaceWorldY - chunkWorldY;
          surfaceTiles.add(localY * chunkSize + localX);
        }
      }
    }

    if (chunkTiles.size > 0 || surfaceTiles.size > 0) {
      result.push({
        waterLevel: worldLake.waterLevel,
        tiles: chunkTiles,
        surfaceTiles,
        maxDepth: worldLake.maxDepth,
        minTerrainHeight: worldLake.minTerrainHeight,
        state: determineState(worldLake),
      });
    }
  }

  return result;
}

export function carveTerrainForWorldLakes(
  worldLakes: WorldLakeData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  heightmap: Float32Array
): void {
  const chunkWorldX = chunkX * chunkSize;
  const chunkWorldY = chunkY * chunkSize;
  const vertexSize = chunkSize + 1;

  for (const worldLake of worldLakes) {
    const targetHeight = Math.max(0, worldLake.waterLevel - LAKE_CARVE_DEPTH);

    for (let localY = 0; localY <= chunkSize; localY++) {
      const worldVertexY = chunkWorldY + localY;

      for (let localX = 0; localX <= chunkSize; localX++) {
        const worldVertexX = chunkWorldX + localX;
        const touchesLake =
          worldLake.tiles.has(`${worldVertexX},${worldVertexY}`) ||
          worldLake.tiles.has(`${worldVertexX - 1},${worldVertexY}`) ||
          worldLake.tiles.has(`${worldVertexX},${worldVertexY - 1}`) ||
          worldLake.tiles.has(`${worldVertexX - 1},${worldVertexY - 1}`);

        if (!touchesLake) continue;

        const vertexIndex = localY * vertexSize + localX;
        heightmap[vertexIndex] = Math.min(heightmap[vertexIndex], targetHeight);
      }
    }
  }
}

export function determineLakeState(
  lake: WorldLakeData,
  sampleClimate?: LakeClimateSampler
): WaterBodyState {
  if (!sampleClimate) return 'filled';

  const sampleCount = Math.min(lake.tiles.size, 9);
  const tileArray = Array.from(lake.tiles);
  let totalTemp = 0;
  let totalMoisture = 0;
  let sampled = 0;

  const step = Math.max(1, Math.floor(tileArray.length / sampleCount));
  for (let i = 0; i < tileArray.length && sampled < sampleCount; i += step) {
    const [worldX, worldY] = tileArray[i].split(',').map(Number);
    const climate = sampleClimate(worldX, worldY);
    if (climate) {
      totalTemp += climate.temperature;
      totalMoisture += climate.moisture;
      sampled++;
    }
  }

  if (sampled === 0) return 'filled';

  const avgTemp = totalTemp / sampled;
  const avgMoisture = totalMoisture / sampled;

  if (avgTemp < -0.4) return 'frozen';
  if (avgTemp > 0.4 && avgMoisture < -0.2) return 'dry';
  return 'filled';
}
