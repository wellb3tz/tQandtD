import type { BiomeConfig, BiomeSystem } from '../biome';
import { BiomeType, type ChunkData, createSparseBiomeWeights, getBiomeWeightsForTile } from '../chunk';
import type { EnhancedBiomeSystem } from '../enhanced-biome';

const SEA_LEVEL = 0.3;

export interface ChunkBiomeData {
  biomeMap: Uint8Array;
  sparseBiomeTypes: Uint8Array;
  sparseBiomeWeights: Float32Array;
  sparseBiomeOffsets: Uint16Array;
  temperatureMap: Float32Array;
  metrics: { classificationTime: number; blendingTime: number };
}

export interface ChunkBiomeGenerationOptions {
  chunkSize: number;
  worldSeed: number;
  biomeConfig: BiomeConfig;
  biomeSystem: BiomeSystem;
  enhancedBiomeSystem: EnhancedBiomeSystem | null;
  getTerrainHeightAt: (worldX: number, worldY: number, seed: number) => number;
  enablePerformanceMetrics: boolean;
}

export function generateChunkBiomeData(
  chunkX: number,
  chunkY: number,
  heightmap: Float32Array,
  options: ChunkBiomeGenerationOptions
): ChunkBiomeData {
  const size = options.chunkSize;
  const biomeMap = new Uint8Array(size * size);
  const temperatureMap = new Float32Array(size * size);
  const tileWeights: Map<number, number>[] = [];
  const worldX = chunkX * size;
  const worldY = chunkY * size;
  const vertexCount = size + 1;

  const getHeight = (sampleX: number, sampleY: number): number => {
    const targetChunkX = Math.floor(sampleX / size);
    const targetChunkY = Math.floor(sampleY / size);

    if (targetChunkX === chunkX && targetChunkY === chunkY) {
      const localX = sampleX - worldX;
      const localY = sampleY - worldY;
      if (localX >= 0 && localX <= size && localY >= 0 && localY <= size) {
        return sampleHeightmap(heightmap, vertexCount, size, localX, localY);
      }
    }

    return options.getTerrainHeightAt(sampleX, sampleY, options.worldSeed);
  };

  const blendRadius = options.biomeConfig.blendRadius;
  const stepInv = 1 / blendRadius;
  const padding = Math.ceil(blendRadius) + 1;
  const gridMinX = worldX - padding;
  const gridMinY = worldY - padding;
  const gridMaxX = worldX + size + padding;
  const gridMaxY = worldY + size + padding;
  const gridWidth = Math.ceil((gridMaxX - gridMinX) * stepInv) + 1;
  const gridHeight = Math.ceil((gridMaxY - gridMinY) * stepInv) + 1;
  const sampledHeights = new Float32Array(gridWidth * gridHeight);
  const sampledBiomes = new Uint8Array(gridWidth * gridHeight);
  const sampledHeight = new Uint8Array(gridWidth * gridHeight);
  const sampledBiome = new Uint8Array(gridWidth * gridHeight);

  const gridIndex = (sampleX: number, sampleY: number): number => {
    const indexX = Math.round((sampleX - gridMinX) * stepInv);
    const indexY = Math.round((sampleY - gridMinY) * stepInv);
    return indexY * gridWidth + indexX;
  };

  const getHeightFast = (sampleX: number, sampleY: number): number => {
    const index = gridIndex(sampleX, sampleY);
    if (sampledHeight[index]) return sampledHeights[index];
    const height = getHeight(sampleX, sampleY);
    sampledHeights[index] = height;
    sampledHeight[index] = 1;
    return height;
  };

  const temperatureCache = new Map<string, number>();
  const moistureCache = new Map<string, number>();

  const getBiomeFast = (sampleX: number, sampleY: number, height: number): number => {
    const index = gridIndex(sampleX, sampleY);
    if (sampledBiome[index]) return sampledBiomes[index];
    const biome = options.biomeSystem.getBiome(sampleX, sampleY, height, temperatureCache, moistureCache);
    sampledBiomes[index] = biome;
    sampledBiome[index] = 1;
    return biome;
  };

  const biomeCache = new Map<string, number>();
  let classificationTime = 0;
  let blendingTime = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const height = heightmap[y * vertexCount + x];
      const tileWorldX = worldX + x;
      const tileWorldY = worldY + y;

      if (options.enhancedBiomeSystem) {
        const startedAt = options.enablePerformanceMetrics ? performance.now() : 0;
        const enhancedData = options.enhancedBiomeSystem.getEnhancedBiome(tileWorldX, tileWorldY, getHeightFast);
        if (options.enablePerformanceMetrics) blendingTime += performance.now() - startedAt;

        biomeMap[index] = enhancedData.biome;
        tileWeights.push(enhancedData.weights);
        const climate = options.enhancedBiomeSystem.sampleClimate(tileWorldX, tileWorldY, height, getHeightFast);
        temperatureMap[index] = climate ? climate.temperature : 0;
      } else {
        const startedAt = options.enablePerformanceMetrics ? performance.now() : 0;
        const biome = getBiomeFast(tileWorldX, tileWorldY, height);
        if (options.enablePerformanceMetrics) classificationTime += performance.now() - startedAt;

        biomeMap[index] = biome;
        biomeCache.set(`${tileWorldX},${tileWorldY}`, biome);

        const blendingStartedAt = options.enablePerformanceMetrics ? performance.now() : 0;
        const weights = options.biomeSystem.getBiomeWeightsWithRadius(
          tileWorldX,
          tileWorldY,
          getHeightFast,
          blendRadius,
          biomeCache,
          getBiomeFast,
        );
        if (options.enablePerformanceMetrics) blendingTime += performance.now() - blendingStartedAt;

        tileWeights.push(weights);
        temperatureMap[index] = temperatureCache.get(`${tileWorldX},${tileWorldY}`)
          ?? options.biomeSystem.getTemperature(tileWorldX, tileWorldY);
      }
    }
  }

  const types: number[] = [];
  const weights: number[] = [];
  const offsets: number[] = [];
  for (let index = 0; index < size * size; index++) {
    offsets.push(types.length);
    for (const [biomeType, weight] of tileWeights[index].entries()) {
      if (weight > 0.001) {
        types.push(biomeType);
        weights.push(weight);
      }
    }
  }

  return {
    biomeMap,
    sparseBiomeTypes: new Uint8Array(types),
    sparseBiomeWeights: new Float32Array(weights),
    sparseBiomeOffsets: new Uint16Array(offsets),
    temperatureMap,
    metrics: { classificationTime, blendingTime },
  };
}

function sampleHeightmap(
  heightmap: Float32Array,
  vertexCount: number,
  size: number,
  localX: number,
  localY: number,
): number {
  const x0 = Math.max(0, Math.min(size, Math.floor(localX)));
  const y0 = Math.max(0, Math.min(size, Math.floor(localY)));
  const x1 = Math.min(size, x0 + 1);
  const y1 = Math.min(size, y0 + 1);
  const tx = localX - x0;
  const ty = localY - y0;

  const h00 = heightmap[y0 * vertexCount + x0];
  const h10 = heightmap[y0 * vertexCount + x1];
  const h01 = heightmap[y1 * vertexCount + x0];
  const h11 = heightmap[y1 * vertexCount + x1];
  const top = h00 * (1 - tx) + h10 * tx;
  const bottom = h01 * (1 - tx) + h11 * tx;
  return top * (1 - ty) + bottom * ty;
}

export function fixBiomesAfterHeightChange(chunk: ChunkData): void {
  const size = chunk.size;
  const vertexCount = size + 1;
  const tileCount = size * size;
  const tileWeights: Map<BiomeType, number>[] = [];
  let changed = false;

  for (let index = 0; index < tileCount; index++) {
    tileWeights.push(getBiomeWeightsForTile(chunk, index));
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tileIndex = y * size + x;
      const averageHeight = (
        chunk.heightmap[y * vertexCount + x] +
        chunk.heightmap[y * vertexCount + (x + 1)] +
        chunk.heightmap[(y + 1) * vertexCount + x] +
        chunk.heightmap[(y + 1) * vertexCount + (x + 1)]
      ) / 4;

      if (averageHeight < SEA_LEVEL && chunk.biomeMap[tileIndex] !== BiomeType.OCEAN) {
        chunk.biomeMap[tileIndex] = BiomeType.OCEAN;
        tileWeights[tileIndex] = new Map([[BiomeType.OCEAN, 1]]);
        if (chunk.temperatureMap) {
          chunk.temperatureMap[tileIndex] = 0;
        }
        changed = true;
      }
    }
  }

  if (changed) {
    const sparse = createSparseBiomeWeights(tileWeights, tileCount);
    chunk.sparseBiomeTypes = sparse.types;
    chunk.sparseBiomeWeights = sparse.weights;
    chunk.sparseBiomeOffsets = sparse.offsets;
  }
}

export function createOceanFallbackChunk(chunkX: number, chunkY: number, size: number): ChunkData {
  const tileCount = size * size;
  const vertexCount = size + 1;
  const tileWeights = Array.from({ length: tileCount }, () => new Map([[BiomeType.OCEAN, 1]]));
  const sparse = createSparseBiomeWeights(tileWeights, tileCount);

  return {
    x: chunkX,
    y: chunkY,
    size,
    heightmap: new Float32Array(vertexCount * vertexCount).fill(SEA_LEVEL),
    biomeMap: new Uint8Array(tileCount).fill(BiomeType.OCEAN),
    sparseBiomeTypes: sparse.types,
    sparseBiomeWeights: sparse.weights,
    sparseBiomeOffsets: sparse.offsets,
    lakes: [],
    rivers: [],
    resources: [],
    structures: [],
  };
}
