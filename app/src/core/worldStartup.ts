import {
  BiomeType,
  FIRST_PERSON_EYE_HEIGHT_METERS,
  TERRAIN_HEIGHT_SCALE_METERS,
  TERRAIN_TILE_SIZE_METERS,
} from '@engine/index';
import type { WorldApp } from './WorldApp';
import { getBufferedStreamingRadius } from './AppRuntimeLoop';
import type { WorldViewer } from '../viewer/WorldViewer';

export function findSpawnPosition(app: WorldApp): { x: number; y: number; z: number } {
  const loadedChunks = app.getLoadedChunksSnapshot();
  const config = app.getConfigSnapshot();
  const chunkSizeTiles = config.chunkSize;
  const seaLevelNorm = 0.3;
  const minHeight = seaLevelNorm + 0.05;
  const maxHeight = 0.75;

  let best: { x: number; z: number; h: number } | null = null;
  let bestDistSq = Infinity;

  for (const [, chunk] of loadedChunks) {
    const size = chunk.size;
    const vertexSize = size + 1;
    for (let localY = 0; localY < size; localY++) {
      for (let localX = 0; localX < size; localX++) {
        const biome = chunk.biomeMap[localY * size + localX];
        if (biome === BiomeType.OCEAN) continue;
        const heightNorm = chunk.heightmap[localY * vertexSize + localX];
        if (heightNorm < minHeight || heightNorm > maxHeight) continue;
        const worldX = (chunk.x * size + localX) * TERRAIN_TILE_SIZE_METERS;
        const worldZ = (chunk.y * size + localY) * TERRAIN_TILE_SIZE_METERS;
        const distSq = worldX * worldX + worldZ * worldZ;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          best = { x: worldX, z: worldZ, h: heightNorm };
        }
      }
    }
  }

  if (!best) {
    return {
      x: 0,
      y: (seaLevelNorm + 0.1) * TERRAIN_HEIGHT_SCALE_METERS + FIRST_PERSON_EYE_HEIGHT_METERS,
      z: 0,
    };
  }

  return {
    x: best.x,
    y: best.h * TERRAIN_HEIGHT_SCALE_METERS + FIRST_PERSON_EYE_HEIGHT_METERS,
    z: best.z,
  };
}

export async function warmUpInitialTerrain(app: WorldApp, viewer: WorldViewer): Promise<void> {
  const cameraPos = viewer.getCameraPosition();
  const chunkSize = app.getConfigSnapshot().chunkSize * TERRAIN_TILE_SIZE_METERS;
  const cameraChunkX = Math.floor(cameraPos.x / chunkSize);
  const cameraChunkY = Math.floor(cameraPos.z / chunkSize);
  const loadRadius = getBufferedStreamingRadius(app.getViewDistance());

  await app.loadChunksAround(cameraChunkX, cameraChunkY, loadRadius);
  await viewer.flushPendingChunkBuilds();
}
