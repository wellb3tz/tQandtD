import { SeededRNG } from '../core/rng';
import { poissonDiskSampling } from '../utils/poisson';
import { BiomeType, ChunkData, Structure, StructureType } from '../world/chunk';

export type PlacementRuleType = 'biome' | 'slope' | 'nearWater' | 'elevation';

export interface PlacementRule {
  type: PlacementRuleType;
  params: any;
}

export interface StructureTypeConfig {
  type: StructureType;
  rarity: number;
  rules: PlacementRule[];
}

export interface StructureConfig {
  types: StructureTypeConfig[];
  minDistance: number;
  maxAttempts: number;
}

export class StructurePlacer {
  private config: StructureConfig;

  constructor(config: StructureConfig) {
    this.config = config;
  }

  generateStructures(chunkData: ChunkData, chunkSeed: number): Structure[] {
    const structures: Structure[] = [];
    const { size } = chunkData;

    const candidates = poissonDiskSampling({
      width: size,
      height: size,
      minDistance: this.config.minDistance,
      maxAttempts: this.config.maxAttempts,
      seed: chunkSeed,
    });

    const rng = new SeededRNG(chunkSeed);

    for (const candidate of candidates) {
      const localX = Math.floor(candidate.x);
      const localY = Math.floor(candidate.y);

      if (localX < 0 || localX >= size || localY < 0 || localY >= size) {
        continue;
      }

      // Check minimum distance constraint with already placed structures
      // (flooring can cause points to be closer than minDistance)
      let tooClose = false;
      for (const existing of structures) {
        const dx = localX - existing.x;
        const dy = localY - existing.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.config.minDistance) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) {
        continue;
      }

      const index = localY * size + localX;

      const validTypes = this.config.types.filter((typeConfig) =>
        this.evaluateRules(typeConfig.rules, chunkData, localX, localY, index)
      );

      if (validTypes.length === 0) {
        continue;
      }

      const selectedType = this.selectWeightedRandom(validTypes, rng);

      structures.push({
        x: localX,
        y: localY,
        type: selectedType.type,
      });
    }

    return structures;
  }

  private evaluateRules(
    rules: PlacementRule[],
    chunkData: ChunkData,
    x: number,
    y: number,
    index: number
  ): boolean {
    for (const rule of rules) {
      if (!this.evaluateRule(rule, chunkData, x, y, index)) {
        return false;
      }
    }
    return true;
  }

  private evaluateRule(
    rule: PlacementRule,
    chunkData: ChunkData,
    x: number,
    y: number,
    index: number
  ): boolean {
    const { heightmap, biomeMap, rivers, size } = chunkData;

    switch (rule.type) {
      case 'biome': {
        const allowedBiomes = rule.params.biomes as BiomeType[];
        const biome = biomeMap[index] as BiomeType;
        return allowedBiomes.includes(biome);
      }

      case 'slope': {
        const maxSlope = rule.params.maxSlope as number;
        const slope = this.calculateSlope(heightmap, x, y, size);
        return slope <= maxSlope;
      }

      case 'nearWater': {
        const maxDistance = rule.params.maxDistance as number;
        const distance = this.distanceToWater(rivers, x, y, size);
        return distance <= maxDistance;
      }

      case 'elevation': {
        const minHeight = rule.params.minHeight as number;
        const maxHeight = rule.params.maxHeight as number;
        const height = heightmap[index];
        return height >= minHeight && height <= maxHeight;
      }

      default:
        return true;
    }
  }

  private calculateSlope(
    heightmap: Float32Array,
    x: number,
    y: number,
    size: number
  ): number {
    const index = y * size + x;
    const centerHeight = heightmap[index];
    let maxDiff = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

        const neighborIndex = ny * size + nx;
        const diff = Math.abs(heightmap[neighborIndex] - centerHeight);
        maxDiff = Math.max(maxDiff, diff);
      }
    }

    return maxDiff;
  }

  private distanceToWater(
    rivers: Set<number>,
    x: number,
    y: number,
    size: number
  ): number {
    let minDistance = Infinity;

    for (const riverIndex of rivers) {
      const riverX = riverIndex % size;
      const riverY = Math.floor(riverIndex / size);
      const dx = x - riverX;
      const dy = y - riverY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  private selectWeightedRandom(
    types: StructureTypeConfig[],
    rng: SeededRNG
  ): StructureTypeConfig {
    const totalWeight = types.reduce((sum, t) => sum + t.rarity, 0);
    let random = rng.nextFloat() * totalWeight;

    for (const type of types) {
      random -= type.rarity;
      if (random <= 0) {
        return type;
      }
    }

    return types[types.length - 1];
  }
}