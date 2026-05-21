import { describe, expect, it } from 'vitest';
import { BiomeType, TERRAIN_TILE_SIZE_METERS, type ChunkData } from '@engine/index';
import { DEFAULT_WATER_CONFIG } from './config';
import { buildOceanGeometry, identifyOceanTiles } from './OceanMeshGenerator';

function createChunk(size = 2, fillHeight = 0.5): ChunkData {
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize).fill(fillHeight);
  const biomeMap = new Uint8Array(size * size).fill(BiomeType.PLAINS);
  const biomeWeights = new Float32Array(size * size * 13);

  return {
    x: 0,
    y: 0,
    size,
    heightmap,
    biomeMap,
    biomeWeights,
    resources: [],
    structures: [],
  };
}

function setHeight(chunk: ChunkData, vx: number, vy: number, height: number): void {
  const vertexSize = chunk.size + 1;
  chunk.heightmap[vy * vertexSize + vx] = height;
}

describe('OceanMeshGenerator contour mesh', () => {
  it('includes shoreline cells when only part of a tile is below sea level', () => {
    const chunk = createChunk();
    setHeight(chunk, 0, 0, 0.1);

    const oceanTiles = identifyOceanTiles(chunk, DEFAULT_WATER_CONFIG.seaLevel);

    expect(oceanTiles.some(tile => tile.index === 0)).toBe(true);
  });

  it('clips ocean geometry to the sea-level contour', () => {
    const chunk = createChunk();
    setHeight(chunk, 0, 0, 0.1);

    const oceanTiles = identifyOceanTiles(chunk, DEFAULT_WATER_CONFIG.seaLevel);
    const geometry = buildOceanGeometry(oceanTiles, chunk, DEFAULT_WATER_CONFIG);
    expect(geometry).not.toBeNull();

    geometry!.computeBoundingBox();
    const box = geometry!.boundingBox!;
    const position = geometry!.getAttribute('position');
    const waterDepth = geometry!.getAttribute('waterDepth');
    const depths = Array.from({ length: waterDepth.count }, (_, i) => waterDepth.getX(i));

    expect(position.count).toBe(3);
    expect(waterDepth.count).toBe(position.count);
    expect(depths.some(depth => depth > 0)).toBe(true);
    expect(depths).toContain(0);
    expect(box.min.x).toBe(0);
    expect(box.min.z).toBe(0);
    expect(box.max.x).toBeGreaterThan(0);
    expect(box.max.x).toBeLessThan(1 * TERRAIN_TILE_SIZE_METERS);
    expect(box.max.z).toBeGreaterThan(0);
    expect(box.max.z).toBeLessThan(1 * TERRAIN_TILE_SIZE_METERS);
  });
});
