/**
 * ChunkManager tests
 *
 * Covers caching behaviour, coordinate utilities, and biome/lake data integrity.
 * Keeps the surface small - one test per meaningful invariant.
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { worldToChunk, chunkToWorld, worldToLocal, BiomeType } from '../src/world/chunk';
import { DEFAULT_CLIMATE_CONFIG } from '../src/world/climate';
import { EnhancedBiomeSystem } from '../src/world/enhanced-biome';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { DEFAULT_RIVER_CONFIG, type WorldRiverData } from '../src/gen/rivers';
import { LakeManager } from '../src/world/lake-manager';
import { determineLakeState } from '../src/world/water/lakes/lake-chunk-processing';
import { convertWorldRiversToChunkRivers } from '../src/world/water/rivers/river-chunk-processing';
import { makeMinimalConfig } from './helpers';

// --- Coordinate utilities -----------------------------------------------------

describe('Coordinate utilities', () => {
  it('worldToChunk rounds toward negative infinity', () => {
    expect(worldToChunk(0,   0,  32)).toEqual([0,  0]);
    expect(worldToChunk(31,  31, 32)).toEqual([0,  0]);
    expect(worldToChunk(32,  0,  32)).toEqual([1,  0]);
    expect(worldToChunk(-1,  0,  32)).toEqual([-1, 0]);
    expect(worldToChunk(-32, 0,  32)).toEqual([-1, 0]);
    expect(worldToChunk(-33, 0,  32)).toEqual([-2, 0]);
  });

  it('chunkToWorld returns top-left corner', () => {
    expect(chunkToWorld(0,  0,  32)).toEqual([0,   0]);
    expect(chunkToWorld(1,  0,  32)).toEqual([32,  0]);
    expect(chunkToWorld(-1, 0,  32)).toEqual([-32, 0]);
  });

  it('worldToLocal stays in [0, chunkSize)', () => {
    const [lx, ly] = worldToLocal(75, 40, 32);
    expect(lx).toBe(75 % 32);
    expect(ly).toBe(40 % 32);
  });

  it('worldToLocal handles negative world coordinates', () => {
    const [lx, ly] = worldToLocal(-1, -1, 32);
    expect(lx).toBe(31);
    expect(ly).toBe(31);
  });
});

// --- ChunkManager cache -------------------------------------------------------

describe('ChunkManager cache', () => {
  it('returns the same object on second call (cache hit)', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const first  = await manager.getChunk(0, 0);
    const second = await manager.getChunk(0, 0);
    expect(first).toBe(second);
  });

  it('concurrent requests for the same chunk resolve to the same object', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const [a, b, c] = await Promise.all([
      manager.getChunk(5, 5),
      manager.getChunk(5, 5),
      manager.getChunk(5, 5),
    ]);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('generateChunkWithMetrics does not mutate the manager config', () => {
    const config = makeMinimalConfig(1);
    config.enablePerformanceMetrics = false;
    const manager = new ChunkManager(config);

    const result = manager.generateChunkWithMetrics(0, 0);

    expect(result.metrics.totalTime).toBeGreaterThanOrEqual(0);
    expect(manager.config.enablePerformanceMetrics).toBe(false);
  });

  it('clearCache removes all entries', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    await manager.getChunk(0, 0);
    expect(manager.getCacheSize()).toBe(1);
    manager.clearCache();
    expect(manager.getCacheSize()).toBe(0);
  });

  it('LRU eviction keeps cache within maxCacheSize', async () => {
    const config = makeMinimalConfig(1);
    config.maxCacheSize = 3;
    const manager = new ChunkManager(config);

    for (let i = 0; i < 5; i++) {
      await manager.getChunk(i, 0);
    }

    expect(manager.getCacheSize()).toBeLessThanOrEqual(3);
  });
});

// --- ChunkData integrity ------------------------------------------------------

describe('ChunkData integrity', () => {
  it('biomeMap has size^2 entries', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    expect(chunk.biomeMap.length).toBe(chunk.size * chunk.size);
  });

  it('all biome values are valid BiomeType enum members', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    const validValues = new Set(Object.values(BiomeType).filter(v => typeof v === 'number'));
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      expect(validValues.has(chunk.biomeMap[i])).toBe(true);
    }
  });

  it('resource positions are within chunk bounds', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    for (const r of chunk.resources) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(chunk.size);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThan(chunk.size);
    }
  });

  it('structure positions are within chunk bounds', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    for (const s of chunk.structures) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(chunk.size);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(chunk.size);
    }
  });

  it('lake water levels are above sea level (0.3)', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    const manager = new ChunkManager(config);

    // Check several chunks to find at least one with a lake
    let foundLake = false;
    for (let cx = 0; cx < 10 && !foundLake; cx++) {
      for (let cy = 0; cy < 10 && !foundLake; cy++) {
        const chunk = await manager.getChunk(cx, cy);
        for (const lake of chunk.lakes ?? []) {
          expect(lake.waterLevel).toBeGreaterThan(0.3);
          expect(lake.maxDepth).toBeGreaterThan(0);
          expect(lake.tiles.size).toBeGreaterThanOrEqual(2);
          foundLake = true;
        }
      }
    }
  });

  it('lake tiles do not exceed chunk bounds', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    const manager = new ChunkManager(config);

    for (let cx = 0; cx < 5; cx++) {
      for (let cy = 0; cy < 5; cy++) {
        const chunk = await manager.getChunk(cx, cy);
        const maxTileIndex = chunk.size * chunk.size - 1;
        for (const lake of chunk.lakes ?? []) {
          for (const tileIdx of lake.tiles) {
            expect(tileIdx).toBeGreaterThanOrEqual(0);
            expect(tileIdx).toBeLessThanOrEqual(maxTileIndex);
          }
        }
      }
    }
  });
});

describe('Climate-driven water state', () => {
  it('freezes cold lakes, keeps hot wet lakes filled, and dries only shallow hot dry lakes', () => {
    const lake = {
      id: 'lake_1',
      waterLevel: 0.5,
      tiles: new Set(['0,0', '1,0', '0,1']),
      maxDepth: 0.1,
      minTerrainHeight: 0.4,
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    };
    const shallowLake = {
      ...lake,
      maxDepth: 0.03,
      minTerrainHeight: 0.47,
    };

    expect(determineLakeState(lake, () => ({ temperature: 0.55, moisture: 0.45 }))).toBe('filled');
    expect(determineLakeState(lake, () => ({ temperature: -0.55, moisture: 0.2 }))).toBe('frozen');
    expect(determineLakeState(lake, () => ({ temperature: 0.55, moisture: -0.35 }))).toBe('filled');
    expect(determineLakeState(shallowLake, () => ({ temperature: 0.55, moisture: -0.35 }))).toBe('dry');
  });

  it('uses climateConfig world temperature offset when adjusting lake biomes', () => {
    const config = makeMinimalConfig(78);
    config.enhancedBiomeConfig = {
      ...config.biomeConfig,
      enableTransitions: false,
      transitionWidth: 4,
      enableElevationBands: true,
      snowLineElevation: 0.8,
      treeLineElevation: 0.75,
      climateConfig: {
        ...DEFAULT_CLIMATE_CONFIG,
        worldTemperatureOffset: 0.55,
      },
    };
    config.lakeConfig = {
      ...DEFAULT_LAKE_CONFIG,
      allowedBiomes: [BiomeType.TUNDRA, BiomeType.TAIGA, BiomeType.PLAINS],
    };

    const manager = new ChunkManager(config);
    const lakeConfig = (manager as any).lakeManager.config;

    expect(lakeConfig.allowedBiomes).not.toContain(BiomeType.TUNDRA);
    expect(lakeConfig.allowedBiomes).not.toContain(BiomeType.TAIGA);
    expect(lakeConfig.allowedBiomes).toContain(BiomeType.PLAINS);
  });

  it('uses climate classification when measuring enhanced biome transitions', () => {
    const system = new EnhancedBiomeSystem(79, {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 2,
      enableTransitions: true,
      transitionWidth: 4,
      enableElevationBands: true,
      snowLineElevation: 0.8,
      treeLineElevation: 0.75,
    });
    (system as any).climateSystem = {
      getDynamicSnowLine: () => 0.76,
      getDynamicTreeLine: () => 0.75,
      getTemperature: (x: number) => x < 0 ? -0.6 : 0.6,
      getMoisture: () => -0.6,
    };

    const data = system.getEnhancedBiome(1, 0, () => 0.5);

    expect(data.biome).toBe(BiomeType.DESERT);
    expect(data.transitionFactor).toBeGreaterThan(0);
  });
});

describe('Multi-chunk lake discovery', () => {
  it('includes lakes seeded in a neighbouring chunk before that chunk is requested', () => {
    const chunkSize = 16;
    const lakeManager = new LakeManager(
      123,
      {
        ...DEFAULT_LAKE_CONFIG,
        noiseThreshold: -1,
        minElevation: 0.3,
        maxElevation: 0.8,
        maxFillDepth: 0.08,
      },
      (worldX: number, worldY: number) => {
        const insideCrossBoundaryBasin =
          worldX >= 12 && worldX <= 21 &&
          worldY >= 4 && worldY <= 13;
        return insideCrossBoundaryBasin ? 0.35 : 0.5;
      },
      () => BiomeType.PLAINS,
    );

    const lakes = lakeManager.getLakesForChunk(0, 0, chunkSize);
    const crossingLake = lakes.find(lake =>
      lake.tiles.has('15,8') && lake.tiles.has('16,8')
    );

    expect(crossingLake).toBeDefined();
  });
});

describe('ChunkManager rivers', () => {
  it('adds river arrays to generated chunks when rivers are enabled', async () => {
    const config = makeMinimalConfig(42);
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, sourceThreshold: 0.99, maxRiversPerRegion: 0 };
    const manager = new ChunkManager(config);
    const chunk = await manager.getChunk(0, 0);

    expect(chunk.rivers).toBeInstanceOf(Array);
  });

  it('keeps local river points near chunk bounds', async () => {
    const config = makeMinimalConfig(42);
    config.riverConfig = {
      ...DEFAULT_RIVER_CONFIG,
      sourceThreshold: 0,
      maxRiversPerRegion: 1,
      minRiverLength: 4,
      maxLength: 96,
    };
    const manager = new ChunkManager(config);

    for (let cx = 0; cx < 3; cx++) {
      const chunk = await manager.getChunk(cx, 0);
      for (const river of chunk.rivers ?? []) {
        for (const point of river.points) {
          expect(point.x).toBeGreaterThanOrEqual(-config.riverConfig.carveBankWidth - 1);
          expect(point.x).toBeLessThanOrEqual(chunk.size + config.riverConfig.carveBankWidth + 1);
          expect(point.y).toBeGreaterThanOrEqual(-config.riverConfig.carveBankWidth - 1);
          expect(point.y).toBeLessThanOrEqual(chunk.size + config.riverConfig.carveBankWidth + 1);
        }
      }
    }
  });

  it('converts world rivers to chunk-local rivers and carves terrain', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 3 };
    const manager = new ChunkManager(config);
    const worldRiver: WorldRiverData = {
      id: 'river_test',
      mainPath: [
        { x: 1, y: 1, height: 0.6, surfaceLevel: 0.61, width: 2, depth: 0.05, flowX: 1, flowY: 0 },
        { x: 8, y: 1, height: 0.55, surfaceLevel: 0.56, width: 2, depth: 0.05, flowX: 1, flowY: 0 },
      ],
      tributaries: [],
      source: { x: 1, y: 1 },
      mouth: { x: 8, y: 1 },
      bounds: { minX: 1, maxX: 8, minY: 1, maxY: 1 },
    };

    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    expect(chunk.rivers).toHaveLength(1);
    expect(chunk.rivers?.[0].points.map(p => [p.x, p.y])).toEqual([[1, 1], [8, 1]]);

    const vertexSize = chunk.size + 1;
    const carvedIndex = 1 * vertexSize + 4;
    expect(chunk.heightmap[carvedIndex]).toBeLessThan(0.56);
  });

  it('converts natural tributaries as separate local river spans', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const worldRiver: WorldRiverData = {
      id: 'river_with_tributary',
      mainPath: [
        { x: 2, y: 8, height: 0.62, surfaceLevel: 0.58, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
        { x: 14, y: 8, height: 0.52, surfaceLevel: 0.5, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
      ],
      tributaries: [{
        id: 'river_with_tributary:tributary:4_4_8_8',
        connectsToRiverId: 'river_with_tributary',
        connectsAtIndex: 0,
        points: [
          { x: 4, y: 4, height: 0.68, surfaceLevel: 0.62, width: 1.2, depth: 0.03, flowX: 1, flowY: 1 },
          { x: 8, y: 8, height: 0.58, surfaceLevel: 0.56, width: 1.4, depth: 0.03, flowX: 1, flowY: 1 },
        ],
      }],
      source: { x: 2, y: 8 },
      mouth: { x: 14, y: 8 },
      bounds: { minX: 2, maxX: 14, minY: 4, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(0.72),
      getHeightAt: () => 0.72,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const main = chunk.rivers?.find(river => !river.isTributary);
    const tributary = chunk.rivers?.find(river => river.isTributary);

    expect(chunk.rivers).toHaveLength(2);
    expect(main?.pathId).toBe('river_with_tributary:main');
    expect(tributary?.pathId).toBe('river_with_tributary:tributary:4_4_8_8');
    expect(tributary?.points.at(-1)).toMatchObject({ x: 8, y: 8 });
  });

  it('carves a deep channel, raised inner banks, and a broad outer valley', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const untouchedHeight = 0.72;
    const surfaceLevel = 0.62;
    const channelDepth = 0.12;
    const worldRiver: WorldRiverData = {
      id: 'river_corridor',
      mainPath: [
        {
          x: 2,
          y: 8,
          height: untouchedHeight,
          surfaceLevel,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 4,
          valleyWidth: 10,
          channelDepth,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 14,
          y: 8,
          height: untouchedHeight,
          surfaceLevel,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 4,
          valleyWidth: 10,
          channelDepth,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 2, y: 8 },
      mouth: { x: 14, y: 8 },
      bounds: { minX: 2, maxX: 14, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(untouchedHeight),
      getHeightAt: () => untouchedHeight,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;
    const heightAt = (x: number, y: number): number => chunk.heightmap[y * vertexSize + x];

    const center = heightAt(8, 8);
    const innerBank = heightAt(8, 10);
    const outerValley = heightAt(8, 12);
    const untouched = heightAt(8, 14);

    expect(center).toBeLessThan(surfaceLevel - channelDepth * 0.7);
    expect(innerBank).toBeGreaterThan(center);
    expect(innerBank).toBeLessThan(untouched);
    expect(outerValley).toBeGreaterThan(innerBank);
    expect(outerValley).toBeLessThan(untouched);
  });

  it('keeps the carved river trench cross-section free of one-cell spikes', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const untouchedHeight = 0.72;
    const worldRiver: WorldRiverData = {
      id: 'river_smooth_trench',
      mainPath: [
        {
          x: 2,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 4,
          valleyWidth: 10,
          channelDepth: 0.12,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 14,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 4,
          valleyWidth: 10,
          channelDepth: 0.12,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 2, y: 8 },
      mouth: { x: 14, y: 8 },
      bounds: { minX: 2, maxX: 14, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(untouchedHeight),
      getHeightAt: () => untouchedHeight,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;
    const heights = [8, 9, 10, 11, 12, 13].map(y => chunk.heightmap[y * vertexSize + 8]);
    const largestStep = heights.slice(1).reduce(
      (max, height, index) => Math.max(max, Math.abs(height - heights[index])),
      0,
    );

    expect(largestStep).toBeLessThanOrEqual(0.05);
  });

  it('keeps deep river cutting in the channel instead of dragging outer banks down', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const untouchedHeight = 0.72;
    const worldRiver: WorldRiverData = {
      id: 'river_bobsled_channel',
      mainPath: [
        {
          x: 2,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 2,
          valleyWidth: 10,
          channelDepth: 0.2,
          valleyDepth: 0.02,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 14,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 2,
          valleyWidth: 10,
          channelDepth: 0.2,
          valleyDepth: 0.02,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 2, y: 8 },
      mouth: { x: 14, y: 8 },
      bounds: { minX: 2, maxX: 14, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(untouchedHeight),
      getHeightAt: () => untouchedHeight,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;
    const center = chunk.heightmap[8 * vertexSize + 8];
    const outerBank = chunk.heightmap[12 * vertexSize + 8];

    expect(center).toBeLessThan(0.45);
    expect(outerBank).toBeGreaterThan(0.67);
    expect(outerBank).toBeLessThan(untouchedHeight);
  });

  it('keeps sub-cell river channels narrow enough for the meter-scale world', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const untouchedHeight = 0.72;
    const worldRiver: WorldRiverData = {
      id: 'river_sub_cell_channel',
      mainPath: [
        {
          x: 2,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 0.6,
          depth: 0.02,
          flow: 0.4,
          channelWidth: 0.6,
          valleyWidth: 4,
          channelDepth: 0.2,
          valleyDepth: 0.02,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 14,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 0.6,
          depth: 0.02,
          flow: 0.4,
          channelWidth: 0.6,
          valleyWidth: 4,
          channelDepth: 0.2,
          valleyDepth: 0.02,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 2, y: 8 },
      mouth: { x: 14, y: 8 },
      bounds: { minX: 2, maxX: 14, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(untouchedHeight),
      getHeightAt: () => untouchedHeight,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;
    const heights = [8, 9, 10].map(y => chunk.heightmap[y * vertexSize + 8]);

    expect(heights[0]).toBeLessThan(0.45);
    expect(heights[1]).toBeGreaterThan(0.60);
    expect(heights[1] - heights[0]).toBeGreaterThan(0.18);
    expect(heights[2]).toBeGreaterThan(heights[1]);
  });

  it('does not carve river trenches into terrain already below sea level', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const seaLevel = 0.3;
    const worldRiver: WorldRiverData = {
      id: 'river_ocean_mouth',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: 0.5,
          surfaceLevel: 0.51,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 12,
          y: 8,
          height: 0.24,
          surfaceLevel: 0.3,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 12, y: 8 },
      bounds: { minX: 4, maxX: 12, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => {
        const vertexSize = config.chunkSize + 1;
        const heightmap = new Float32Array(vertexSize * vertexSize);
        for (let y = 0; y < vertexSize; y++) {
          for (let x = 0; x < vertexSize; x++) {
            heightmap[y * vertexSize + x] = x >= 10 ? 0.24 : x === 9 ? seaLevel + 0.01 : 0.5;
          }
        }
        return heightmap;
      },
      getHeightAt: (x: number) => x >= 10 ? 0.24 : x === 9 ? seaLevel + 0.01 : 0.5,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;
    const shorelineIndex = 8 * vertexSize + 9;
    const oceanIndex = 8 * vertexSize + 12;

    expect(chunk.heightmap[shorelineIndex]).toBeLessThanOrEqual(seaLevel + 0.011);
    expect(chunk.heightmap[shorelineIndex]).toBeGreaterThan(seaLevel - 0.005);
    expect(chunk.heightmap[oceanIndex]).toBeCloseTo(0.24, 5);
  });

  it('tapers river trench depth near the ocean mouth', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const seaLevel = 0.3;
    const worldRiver: WorldRiverData = {
      id: 'river_tapered_mouth',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: 0.5,
          surfaceLevel: 0.51,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 8,
          y: 8,
          height: seaLevel + 0.01,
          surfaceLevel: seaLevel + 0.01,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 12,
          y: 8,
          height: 0.24,
          surfaceLevel: seaLevel,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 12, y: 8 },
      bounds: { minX: 4, maxX: 12, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => {
        const vertexSize = config.chunkSize + 1;
        const heightmap = new Float32Array(vertexSize * vertexSize).fill(0.5);
        heightmap[8 * vertexSize + 8] = seaLevel + 0.01;
        heightmap[8 * vertexSize + 12] = 0.24;
        return heightmap;
      },
      getHeightAt: (x: number) => x >= 12 ? 0.24 : x === 8 ? seaLevel + 0.01 : 0.5,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;

    expect(chunk.heightmap[8 * vertexSize + 8]).toBeGreaterThan(seaLevel - 0.0075);
  });

  it('keeps coastal river mouth carving only slightly below ocean level', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const seaLevel = 0.3;
    const worldRiver: WorldRiverData = {
      id: 'river_mouth_level',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: 0.5,
          surfaceLevel: 0.51,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.12,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 8,
          y: 8,
          height: 0.34,
          surfaceLevel: 0.34,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.12,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 12,
          y: 8,
          height: 0.24,
          surfaceLevel: seaLevel,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.12,
          valleyDepth: 0.06,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 12, y: 8 },
      bounds: { minX: 4, maxX: 12, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => {
        const vertexSize = config.chunkSize + 1;
        const heightmap = new Float32Array(vertexSize * vertexSize).fill(0.5);
        heightmap[8 * vertexSize + 8] = 0.34;
        heightmap[8 * vertexSize + 12] = 0.24;
        return heightmap;
      },
      getHeightAt: (x: number) => x >= 12 ? 0.24 : x === 8 ? 0.34 : 0.5,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;

    expect(chunk.heightmap[8 * vertexSize + 8]).toBeGreaterThanOrEqual(seaLevel - 0.012);
    expect(chunk.heightmap[8 * vertexSize + 8]).toBeLessThan(seaLevel);
  });

  it('includes rivers in chunks that only intersect broad valley influence', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const untouchedHeight = 0.72;
    const worldRiver: WorldRiverData = {
      id: 'river_wide_valley',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 2,
          valleyWidth: 16,
          channelDepth: 0.04,
          valleyDepth: 0.08,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 12,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 2,
          valleyWidth: 16,
          channelDepth: 0.04,
          valleyDepth: 0.08,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 12, y: 8 },
      bounds: { minX: 4, maxX: 12, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(untouchedHeight),
      getHeightAt: () => untouchedHeight,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(1, 0);
    const vertexSize = chunk.size + 1;
    expect(chunk.rivers).toHaveLength(1);
    expect(chunk.heightmap[8 * vertexSize]).toBeLessThan(untouchedHeight);
  });

  it('converts already-smoothed world river points consistently across chunk boundaries', () => {
    const config = makeMinimalConfig(42);
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const worldRiver: WorldRiverData = {
      id: 'river_smooth_boundary',
      mainPath: [
        { x: 8, y: 8, height: 0.7, surfaceLevel: 0.62, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
        { x: 16, y: 12, height: 0.7, surfaceLevel: 0.62, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
        { x: 24, y: 8, height: 0.7, surfaceLevel: 0.62, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
      ],
      tributaries: [],
      source: { x: 8, y: 8 },
      mouth: { x: 24, y: 8 },
      bounds: { minX: 8, maxX: 24, minY: 8, maxY: 12 },
    };

    const left = convertWorldRiversToChunkRivers([worldRiver], 0, 0, config.chunkSize, config.riverConfig?.splineResolution);
    const right = convertWorldRiversToChunkRivers([worldRiver], 1, 0, config.chunkSize, config.riverConfig?.splineResolution);
    const leftBoundaryPoint = left[0].points.find((point: { x: number }) => point.x === 16);
    const rightBoundaryPoint = right[0].points.find((point: { x: number }) => point.x === 0);

    expect(leftBoundaryPoint?.y).toBe(10);
    expect(rightBoundaryPoint?.y).toBe(10);
  });

  it('extends main river carving to the ocean mouth point', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const worldRiver: WorldRiverData = {
      id: 'river_extended_mouth',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: 0.5,
          surfaceLevel: 0.51,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 8,
          y: 8,
          height: 0.34,
          surfaceLevel: 0.34,
          width: 2,
          depth: 0.02,
          channelWidth: 3,
          valleyWidth: 8,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 11, y: 8 },
      bounds: { minX: 4, maxX: 11, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(0.5),
      getHeightAt: (x: number) => x >= 11 ? 0.24 : x === 8 ? 0.34 : 0.5,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;

    expect(chunk.rivers?.[0].points.at(-1)).toMatchObject({ x: 11, y: 8 });
    expect(chunk.heightmap[8 * vertexSize + 10]).toBeLessThan(0.5);
  });

  it('extends only terrain carving slightly beyond the final mouth point', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const worldRiver: WorldRiverData = {
      id: 'river_carve_extension_only',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: 0.5,
          surfaceLevel: 0.51,
          width: 2,
          depth: 0.02,
          channelWidth: 2,
          valleyWidth: 2,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 8,
          y: 8,
          height: 0.34,
          surfaceLevel: 0.34,
          width: 2,
          depth: 0.02,
          channelWidth: 2,
          valleyWidth: 2,
          channelDepth: 0.08,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 9, y: 8 },
      bounds: { minX: 4, maxX: 9, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(0.5),
      getHeightAt: () => 0.5,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;

    expect(chunk.rivers?.[0].points.at(-1)).toMatchObject({ x: 9, y: 8 });
    expect(chunk.heightmap[8 * vertexSize + 10]).toBeLessThan(0.5);
  });

  it('splits disjoint selected river spans instead of reconnecting them through the chunk', () => {
    const config = makeMinimalConfig(42);
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const point = (x: number, y: number) => ({
      x,
      y,
      height: 0.7,
      surfaceLevel: 0.62,
      width: 2,
      depth: 0.02,
      channelWidth: 2,
      valleyWidth: 2,
      channelDepth: 0.04,
      valleyDepth: 0.02,
      flowX: 1,
      flowY: 0,
    });
    const worldRiver: WorldRiverData = {
      id: 'river_two_passes',
      mainPath: [
        point(-10, 8),
        point(8, 8),
        point(40, 40),
        point(60, 40),
        point(8, 12),
        point(-10, 12),
      ],
      tributaries: [],
      source: { x: -10, y: 8 },
      mouth: { x: -10, y: 12 },
      bounds: { minX: -10, maxX: 60, minY: 8, maxY: 40 },
    };

    const rivers = convertWorldRiversToChunkRivers([worldRiver], 0, 0, config.chunkSize, config.riverConfig?.splineResolution);

    expect(rivers).toHaveLength(2);
    expect(rivers.every((river: { points: unknown[] }) => river.points.length >= 2)).toBe(true);
  });

  it('does not widen an explicit zero-width channel with divide-by-zero protection', () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2 };
    const manager = new ChunkManager(config);
    const untouchedHeight = 0.72;
    const worldRiver: WorldRiverData = {
      id: 'river_zero_channel',
      mainPath: [
        {
          x: 2,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 0,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 0,
          valleyWidth: 8,
          channelDepth: 0.12,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 14,
          y: 8,
          height: untouchedHeight,
          surfaceLevel: 0.62,
          width: 0,
          depth: 0.02,
          flow: 0.8,
          channelWidth: 0,
          valleyWidth: 8,
          channelDepth: 0.12,
          valleyDepth: 0.04,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 2, y: 8 },
      mouth: { x: 14, y: 8 },
      bounds: { minX: 2, maxX: 14, minY: 8, maxY: 8 },
    };

    (manager as any).terrainGenerator = {
      generateHeightmap: () => new Float32Array((config.chunkSize + 1) * (config.chunkSize + 1)).fill(untouchedHeight),
      getHeightAt: () => untouchedHeight,
    };
    (manager as any).riverManager = {
      getRiversForChunk: () => [worldRiver],
      notifyChunkEvicted: () => undefined,
      clear: () => undefined,
    };

    const chunk = manager.generateChunk(0, 0);
    const vertexSize = chunk.size + 1;
    const center = chunk.heightmap[8 * vertexSize + 8];
    const nearCenter = chunk.heightmap[9 * vertexSize + 8];

    expect(center).toBeLessThan(0.52);
    expect(nearCenter).toBeGreaterThan(0.56);
  });
});
