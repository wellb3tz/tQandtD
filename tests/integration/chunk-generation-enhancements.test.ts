import { describe, it, expect } from 'vitest';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';
import { BiomeType } from '../../src/world/chunk';

// Helper function to create a valid resource config
const createResourceConfig = () => ({
  types: [
    {
      type: 0, // ResourceType.IRON
      rarity: 0.5,
      biomes: [0, 1, 2, 3, 4, 5, 6, 7], // All biomes
      minAmount: 1,
      maxAmount: 5,
    },
  ],
  clusterScale: 20,
  densityThreshold: 0.6,
});

// Helper function to create a valid structure config
const createStructureConfig = () => ({
  types: [
    {
      type: 0, // StructureType.VILLAGE
      rarity: 0.5,
      rules: [
        {
          type: 'biome' as const,
          params: { biomes: [0, 1, 2, 3, 4, 5, 6, 7] }, // All biomes
        },
      ],
    },
  ],
  minDistance: 10,
  maxAttempts: 30,
});

describe('Chunk Generation with Enhancements', () => {
  it('should generate chunks with 3D noise when enabled', () => {
    const config: WorldConfig = {
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
        elevationInfluence: 0.3,
      },
      resourceConfig: createResourceConfig(),
      structureConfig: createStructureConfig(),
      riverConfig: {
        sourceThreshold: 0.7,
        minLength: 5,
      },
      // Enable 3D noise
      noise3DConfig: {
        enable3D: true,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 0.01,
        zScale: 1.0,
      },
    };

    const chunkManager = new ChunkManager(config);
    const chunk = chunkManager.getChunk(0, 0);

    // Verify chunk was generated
    expect(chunk).toBeDefined();
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.size).toBe(32);
    expect(chunk.heightmap).toBeInstanceOf(Float32Array);
    expect(chunk.heightmap.length).toBe(33 * 33);
    expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
    expect(chunk.biomeMap.length).toBe(32 * 32);
  });

  it('should generate chunks with EnhancedBiomeSystem when enabled', () => {
    const config: WorldConfig = {
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
        elevationInfluence: 0.3,
      },
      resourceConfig: createResourceConfig(),
      structureConfig: createStructureConfig(),
      riverConfig: {
        sourceThreshold: 0.7,
        minLength: 5,
      },
      // Enable enhanced biomes
      enhancedBiomeConfig: {
        temperatureScale: 0.005,
        moistureScale: 0.005,
        elevationInfluence: 0.3,
        enableTransitions: true,
        transitionWidth: 10,
        enableMicroBiomes: true,
        microBiomeFrequency: 0.1,
        microBiomeMaxSize: 20,
        enableElevationBands: true,
        snowLineElevation: 0.8,
        treeLineElevation: 0.75,
      },
    };

    const chunkManager = new ChunkManager(config);
    const chunk = chunkManager.getChunk(0, 0);

    // Verify chunk was generated
    expect(chunk).toBeDefined();
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.size).toBe(32);
    expect(chunk.heightmap).toBeInstanceOf(Float32Array);
    expect(chunk.heightmap.length).toBe(33 * 33);
    expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
    expect(chunk.biomeMap.length).toBe(32 * 32);
    
    // Verify biome weights are present (enhanced biomes provide weights)
    expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
    expect(chunk.biomeWeights.length).toBe(32 * 32 * 8); // 8 biome types
  });

  it('should generate chunks with both 3D noise and EnhancedBiomeSystem', () => {
    const config: WorldConfig = {
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
        elevationInfluence: 0.3,
      },
      resourceConfig: createResourceConfig(),
      structureConfig: createStructureConfig(),
      riverConfig: {
        sourceThreshold: 0.7,
        minLength: 5,
      },
      // Enable both 3D noise and enhanced biomes
      noise3DConfig: {
        enable3D: true,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 0.01,
        zScale: 1.0,
      },
      enhancedBiomeConfig: {
        temperatureScale: 0.005,
        moistureScale: 0.005,
        elevationInfluence: 0.3,
        enableTransitions: true,
        transitionWidth: 10,
        enableMicroBiomes: true,
        microBiomeFrequency: 0.1,
        microBiomeMaxSize: 20,
        enableElevationBands: true,
        snowLineElevation: 0.8,
        treeLineElevation: 0.75,
      },
    };

    const chunkManager = new ChunkManager(config);
    const chunk = chunkManager.getChunk(0, 0);

    // Verify chunk was generated with all enhancements
    expect(chunk).toBeDefined();
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.size).toBe(32);
    expect(chunk.heightmap).toBeInstanceOf(Float32Array);
    expect(chunk.heightmap.length).toBe(33 * 33);
    expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
    expect(chunk.biomeMap.length).toBe(32 * 32);
    expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
    expect(chunk.biomeWeights.length).toBe(32 * 32 * 8);
    
    // Verify heightmap has valid values
    for (let i = 0; i < chunk.heightmap.length; i++) {
      expect(chunk.heightmap[i]).toBeGreaterThanOrEqual(0);
      expect(chunk.heightmap[i]).toBeLessThanOrEqual(1);
    }
    
    // Verify biome map has valid biome types
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      expect(chunk.biomeMap[i]).toBeGreaterThanOrEqual(0);
      expect(chunk.biomeMap[i]).toBeLessThanOrEqual(7); // BiomeType enum has 8 values (0-7)
    }
  });

  it('should fall back to 2D noise when 3D noise is not enabled', () => {
    const config: WorldConfig = {
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
        elevationInfluence: 0.3,
      },
      resourceConfig: createResourceConfig(),
      structureConfig: createStructureConfig(),
      riverConfig: {
        sourceThreshold: 0.7,
        minLength: 5,
      },
      // No 3D noise config - should use 2D noise
    };

    const chunkManager = new ChunkManager(config);
    const chunk = chunkManager.getChunk(0, 0);

    // Verify chunk was generated with 2D noise (backward compatible)
    expect(chunk).toBeDefined();
    expect(chunk.heightmap).toBeInstanceOf(Float32Array);
    expect(chunk.heightmap.length).toBe(33 * 33);
  });

  it('should fall back to BiomeSystem when EnhancedBiomeSystem is not enabled', () => {
    const config: WorldConfig = {
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
        elevationInfluence: 0.3,
      },
      resourceConfig: createResourceConfig(),
      structureConfig: createStructureConfig(),
      riverConfig: {
        sourceThreshold: 0.7,
        minLength: 5,
      },
      // No enhanced biome config - should use base BiomeSystem
    };

    const chunkManager = new ChunkManager(config);
    const chunk = chunkManager.getChunk(0, 0);

    // Verify chunk was generated with base BiomeSystem (backward compatible)
    expect(chunk).toBeDefined();
    expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
    expect(chunk.biomeMap.length).toBe(32 * 32);
    expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
    expect(chunk.biomeWeights.length).toBe(32 * 32 * 8);
  });
});
