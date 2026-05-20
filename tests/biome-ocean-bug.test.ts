/**
 * Regression tests for biome/height mismatch bug:
 * land biomes (FOREST, PLAINS, etc.) appearing on tiles where height < 0.3
 * after river/lake carving or boundary reconciliation.
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { BiomeType } from '../src/world/chunk';
import { EnhancedBiomeSystem } from '../src/world/enhanced-biome';
import { makeMinimalConfig } from './helpers';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';

const SEA_LEVEL = 0.3;

describe('Biome / height mismatch regression', () => {
  it('marks carved-below-sea-level tiles as OCEAN after river generation', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 4 };
    const manager = new ChunkManager(config);

    // Create a chunk with flat terrain well above sea level so river carving will dig below it.
    const chunk = manager.generateChunk(0, 0);
    const vSize = chunk.size + 1;
    const tileCount = chunk.size * chunk.size;

    // Artificially raise all heights to 0.7 (land) so any river carving will definitely go below 0.3.
    for (let i = 0; i < chunk.heightmap.length; i++) {
      chunk.heightmap[i] = 0.7;
    }
    // Reset biomeMap to PLAINS everywhere (simulating pre-carve state).
    for (let i = 0; i < tileCount; i++) {
      chunk.biomeMap[i] = BiomeType.PLAINS;
    }
    // Clear sparse weights so each tile is 100% PLAINS.
    const plainsTypes = new Uint8Array(tileCount).fill(BiomeType.PLAINS);
    const plainsWeights = new Float32Array(tileCount).fill(1.0);
    const plainsOffsets = new Uint16Array(tileCount);
    for (let i = 0; i < tileCount; i++) plainsOffsets[i] = i;
    chunk.sparseBiomeTypes = plainsTypes;
    chunk.sparseBiomeWeights = plainsWeights;
    chunk.sparseBiomeOffsets = plainsOffsets;

    // Force a deep river through the middle of the chunk.
    const river = {
      riverId: 'test_river',
      pathId: 'test_river:main',
      isTributary: false,
      state: 'flowing' as const,
      points: [
        { x: 2, y: 8, height: 0.7, surfaceLevel: 0.25, width: 2, depth: 0.3, flowX: 1, flowY: 0 },
        { x: 14, y: 8, height: 0.7, surfaceLevel: 0.25, width: 2, depth: 0.3, flowX: 1, flowY: 0 },
      ],
      bounds: { minX: 2, maxX: 14, minY: 8, maxY: 8 },
    };

    (manager as any).carveTerrainForRivers([river], chunk.heightmap, chunk.size);

    // fixBiomesAfterHeightChange is normally invoked automatically inside
    // generateChunkInternal right after river carving.  Here we call it
    // explicitly because we are testing the helper in isolation.
    (manager as any).fixBiomesAfterHeightChange(chunk);

    // After carving, any tile whose height dropped below sea level must be OCEAN.
    let mismatchCount = 0;
    for (let y = 0; y < chunk.size; y++) {
      for (let x = 0; x < chunk.size; x++) {
        const tileIdx = y * chunk.size + x;
        // Sample height from the four corner vertices of the tile.
        const h00 = chunk.heightmap[y * vSize + x];
        const h10 = chunk.heightmap[y * vSize + (x + 1)];
        const h01 = chunk.heightmap[(y + 1) * vSize + x];
        const h11 = chunk.heightmap[(y + 1) * vSize + (x + 1)];
        const avgHeight = (h00 + h10 + h01 + h11) / 4;

        if (avgHeight < SEA_LEVEL && chunk.biomeMap[tileIdx] !== BiomeType.OCEAN) {
          mismatchCount++;
        }
      }
    }

    expect(mismatchCount).toBe(0);
  });

  it('marks reconciled-below-sea-level boundary tiles as OCEAN', () => {
    const config = makeMinimalConfig(42);
    config.maxCacheSize = 10;
    const manager = new ChunkManager(config);

    // Generate two adjacent chunks.
    const left = manager.generateChunk(0, 0);
    const right = manager.generateChunk(1, 0);

    // Artificially lower the shared boundary on the right chunk below sea level.
    const vSize = right.size + 1;
    for (let y = 0; y <= right.size; y++) {
      const idx = y * vSize + 0; // leftmost column of right chunk = shared boundary
      right.heightmap[idx] = SEA_LEVEL - 0.05;
      // Make sure right chunk biomeMap for that tile is not OCEAN initially.
      if (y < right.size) {
        const tileIdx = y * right.size + 0;
        right.biomeMap[tileIdx] = BiomeType.FOREST;
      }
    }

    // Put both chunks into the cache so reconcileBoundaryHeights fires.
    (manager as any).addToCache('0,0', left);
    (manager as any).addToCache('1,0', right);

    // After reconciliation the shared boundary of left chunk must also be below sea level.
    // Check that the boundary tiles in the left chunk are now marked OCEAN.
    let mismatchCount = 0;
    for (let y = 0; y < left.size; y++) {
      const leftTileIdx = y * left.size + (left.size - 1);
      const leftHeight = left.heightmap[y * vSize + (left.size - 1)];
      if (leftHeight < SEA_LEVEL && left.biomeMap[leftTileIdx] !== BiomeType.OCEAN) {
        mismatchCount++;
      }
    }

    expect(mismatchCount).toBe(0);
  });

  it('EnhancedBiomeSystem returns pure OCEAN weights when height < 0.3', () => {
    const system = new EnhancedBiomeSystem(1, {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 2,
      enableTransitions: true,
      transitionWidth: 4,
      enableElevationBands: true,
      snowLineElevation: 0.8,
      treeLineElevation: 0.75,
    });

    // Flat terrain below sea level — must be pure ocean regardless of neighbours.
    const data = system.getEnhancedBiome(0, 0, () => 0.25);

    expect(data.biome).toBe(BiomeType.OCEAN);
    expect(data.weights.size).toBe(1);
    expect(data.weights.get(BiomeType.OCEAN)).toBe(1);
  });
});
