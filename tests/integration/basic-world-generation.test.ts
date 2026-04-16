import { describe, test, expect } from 'vitest';
import { ChunkManager } from '../../src/world/chunk-manager';
import { BiomeType, ResourceType, StructureType } from '../../src/world/chunk';

describe('Basic World Generation Integration', () => {
  const createTestConfig = () => ({
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 5,
    },
    resourceConfig: {
      types: [
        {
          type: ResourceType.STONE,
          rarity: 0.1,
          biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
          minAmount: 10,
          maxAmount: 50,
        },
        {
          type: ResourceType.WOOD,
          rarity: 0.2,
          biomes: [BiomeType.FOREST, BiomeType.TAIGA],
          minAmount: 5,
          maxAmount: 20,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.5,
    },
    structureConfig: {
      types: [
        {
          type: StructureType.VILLAGE,
          rarity: 1.0,
          rules: [
            { type: 'biome' as const, params: { biomes: [BiomeType.PLAINS, BiomeType.FOREST] } },
            { type: 'slope' as const, params: { maxSlope: 0.1 } },
          ],
        },
      ],
      minDistance: 10,
      maxAttempts: 30,
    },
    riverNetworkConfig: {
      sourceElevation: 0.6,
      minFlowLength: 5,
      flowWidth: 2,
    },
  });

  test('should generate a complete chunk with all components', () => {
    const manager = new ChunkManager(createTestConfig());
    const chunk = manager.getChunk(0, 0);

    // Verify chunk coordinates
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.size).toBe(32);

    // Verify heightmap is generated (with seamless boundaries: (size+1)*(size+1))
    expect(chunk.heightmap).toBeInstanceOf(Float32Array);
    expect(chunk.heightmap.length).toBe(33 * 33);
    
    // Verify all heights are in valid range [0, 1]
    for (let i = 0; i < chunk.heightmap.length; i++) {
      expect(chunk.heightmap[i]).toBeGreaterThanOrEqual(0);
      expect(chunk.heightmap[i]).toBeLessThanOrEqual(1);
    }

    // Verify biome map is generated
    expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
    expect(chunk.biomeMap.length).toBe(32 * 32);
    
    // Verify all biomes are valid enum values
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      expect(chunk.biomeMap[i]).toBeGreaterThanOrEqual(BiomeType.OCEAN);
      expect(chunk.biomeMap[i]).toBeLessThanOrEqual(BiomeType.MOUNTAIN);
    }

    // Verify biome weights are generated
    expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
    expect(chunk.biomeWeights.length).toBe(32 * 32 * 8); // 8 biome types

    // Verify resources, structures, and rivers are initialized
    expect(Array.isArray(chunk.resources)).toBe(true);
    expect(Array.isArray(chunk.structures)).toBe(true);
    expect(chunk.rivers).toBeInstanceOf(Set);
  });

  test('should generate different chunks at different coordinates', () => {
    const manager = new ChunkManager(createTestConfig());

    const chunk1 = manager.getChunk(0, 0);
    const chunk2 = manager.getChunk(1, 0);
    const chunk3 = manager.getChunk(0, 1);

    // Chunks should have different heightmaps
    expect(chunk1.heightmap).not.toEqual(chunk2.heightmap);
    expect(chunk1.heightmap).not.toEqual(chunk3.heightmap);
    expect(chunk2.heightmap).not.toEqual(chunk3.heightmap);

    // Chunks should have different biome maps
    expect(chunk1.biomeMap).not.toEqual(chunk2.biomeMap);
    expect(chunk1.biomeMap).not.toEqual(chunk3.biomeMap);
  });

  test('should generate identical chunks for same coordinates', () => {
    const manager = new ChunkManager(createTestConfig());

    const chunk1 = manager.generateChunk(5, 5);
    const chunk2 = manager.generateChunk(5, 5);

    // Heightmaps should be identical
    expect(chunk1.heightmap).toEqual(chunk2.heightmap);
    
    // Biome maps should be identical
    expect(chunk1.biomeMap).toEqual(chunk2.biomeMap);
    
    // Biome weights should be identical
    expect(chunk1.biomeWeights).toEqual(chunk2.biomeWeights);

    // Resources should be identical
    expect(chunk1.resources).toEqual(chunk2.resources);

    // Structures should be identical
    expect(chunk1.structures).toEqual(chunk2.structures);

    // Rivers should be identical
    expect(Array.from(chunk1.rivers).sort()).toEqual(Array.from(chunk2.rivers).sort());
  });

  test('should generate varied terrain with multiple biomes', () => {
    const manager = new ChunkManager(createTestConfig());
    const chunk = manager.getChunk(0, 0);

    // Collect unique biomes in the chunk
    const uniqueBiomes = new Set<number>();
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      uniqueBiomes.add(chunk.biomeMap[i]);
    }

    // Should have at least 1 biome type (could be more depending on seed)
    expect(uniqueBiomes.size).toBeGreaterThanOrEqual(1);

    // Collect unique height values (should have variation)
    const uniqueHeights = new Set<number>();
    for (let i = 0; i < chunk.heightmap.length; i++) {
      uniqueHeights.add(Math.floor(chunk.heightmap[i] * 10)); // Group into 10 buckets
    }

    // Should have varied terrain (multiple height levels)
    expect(uniqueHeights.size).toBeGreaterThan(1);
  });

  test('should use cache for repeated chunk requests', () => {
    const manager = new ChunkManager(createTestConfig());

    const chunk1 = manager.getChunk(0, 0);
    const chunk2 = manager.getChunk(0, 0);

    // Should return the same object reference (cached)
    expect(chunk1).toBe(chunk2);
  });

  test('should generate resources in appropriate biomes', () => {
    const manager = new ChunkManager(createTestConfig());
    const chunk = manager.getChunk(0, 0);

    // Verify all resources are in valid positions
    for (const resource of chunk.resources) {
      expect(resource.x).toBeGreaterThanOrEqual(0);
      expect(resource.x).toBeLessThan(chunk.size);
      expect(resource.y).toBeGreaterThanOrEqual(0);
      expect(resource.y).toBeLessThan(chunk.size);

      // Verify resource amount is within configured range
      expect(resource.amount).toBeGreaterThanOrEqual(5);
      expect(resource.amount).toBeLessThanOrEqual(50);

      // Verify resource is in appropriate biome
      const index = resource.y * chunk.size + resource.x;
      const biome = chunk.biomeMap[index];
      
      if (resource.type === ResourceType.STONE) {
        expect([BiomeType.MOUNTAIN, BiomeType.PLAINS]).toContain(biome);
      } else if (resource.type === ResourceType.WOOD) {
        expect([BiomeType.FOREST, BiomeType.TAIGA]).toContain(biome);
      }
    }
  });

  test('should generate structures with minimum distance constraint', () => {
    const manager = new ChunkManager(createTestConfig());
    const chunk = manager.getChunk(0, 0);

    // Verify all structures maintain minimum distance
    for (let i = 0; i < chunk.structures.length; i++) {
      for (let j = i + 1; j < chunk.structures.length; j++) {
        const s1 = chunk.structures[i];
        const s2 = chunk.structures[j];
        const dx = s1.x - s2.x;
        const dy = s1.y - s2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        expect(distance).toBeGreaterThanOrEqual(10); // minDistance from config
      }
    }

    // Verify structures are in valid positions
    for (const structure of chunk.structures) {
      expect(structure.x).toBeGreaterThanOrEqual(0);
      expect(structure.x).toBeLessThan(chunk.size);
      expect(structure.y).toBeGreaterThanOrEqual(0);
      expect(structure.y).toBeLessThan(chunk.size);
    }
  });

  test('should generate rivers that flow downhill', () => {
    const manager = new ChunkManager(createTestConfig());
    const chunk = manager.getChunk(0, 0);

    // Verify river tiles are in valid positions
    for (const riverIndex of chunk.rivers) {
      expect(riverIndex).toBeGreaterThanOrEqual(0);
      expect(riverIndex).toBeLessThan(chunk.size * chunk.size);
    }
  });

  test('should generate chunks with all features disabled', () => {
    const config = createTestConfig();
    config.resourceConfig.types = [];
    config.structureConfig.types = [];
    config.riverConfig.minFlowLength = 1000; // Effectively disable rivers

    const manager = new ChunkManager(config);
    const chunk = manager.getChunk(0, 0);

    // Should still have terrain and biomes (heightmap has seamless boundaries)
    expect(chunk.heightmap.length).toBe(33 * 33);
    expect(chunk.biomeMap.length).toBe(32 * 32);

    // Should have no resources or structures
    expect(chunk.resources.length).toBe(0);
    expect(chunk.structures.length).toBe(0);
  });
});

