import { NoiseEngine, type NoiseConfig } from '../core/noise';
import {
  createRiverCorridorPoints,
  getRiverValleyWidth,
  type RiverConfig,
  type RiverPoint,
  type WorldRiverData,
} from '../gen/rivers';
import { BiomeType } from './chunk';

const SEA_LEVEL = 0.3;
const MAX_SAFE_MOUTH_HEIGHT = SEA_LEVEL + 0.14;
const MAX_SAFE_MOUTH_DROP = 0.18;
const COAST_APPROACH_WINDOW = 8;
const MAX_SAFE_COAST_APPROACH_DROP = 0.28;

/**
 * Manages deterministic world-space river systems and exposes chunk
 * intersections on demand.
 */
export class RiverManager {
  private readonly noise: NoiseEngine;
  private readonly sourceNoiseConfig: NoiseConfig;
  private readonly allowedSourceBiomes: Set<number>;
  private readonly rivers: Map<string, WorldRiverData>;
  private readonly generatedRegions: Set<string>;

  constructor(
    private readonly worldSeed: number,
    private readonly config: RiverConfig,
    private readonly getHeightAt: (worldX: number, worldY: number) => number,
    private readonly getBiomeAt: (worldX: number, worldY: number) => BiomeType,
  ) {
    this.noise = new NoiseEngine(worldSeed + 67891);
    this.allowedSourceBiomes = new Set(config.allowedSourceBiomes);
    this.sourceNoiseConfig = {
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: config.sourceNoiseScale,
    };
    this.rivers = new Map();
    this.generatedRegions = new Set();
  }

  getRiversForChunk(chunkX: number, chunkY: number, chunkSize: number): WorldRiverData[] {
    if (!this.config.enabled) return [];

    for (let regionY = chunkY - 1; regionY <= chunkY + 1; regionY++) {
      for (let regionX = chunkX - 1; regionX <= chunkX + 1; regionX++) {
        const regionKey = this.getChunkKey(regionX, regionY);
        if (this.generatedRegions.has(regionKey)) continue;

        this.generateRiversForRegion(regionX, regionY, chunkSize);
        this.generatedRegions.add(regionKey);
      }
    }

    const chunkWorldX = chunkX * chunkSize;
    const chunkWorldY = chunkY * chunkSize;
    const chunkMaxX = chunkWorldX + chunkSize;
    const chunkMaxY = chunkWorldY + chunkSize;

    return Array.from(this.rivers.values()).filter(river => {
      const padding = this.getRiverInfluenceRadius(river);
      return (
        river.bounds.maxX >= chunkWorldX - padding &&
        river.bounds.minX <= chunkMaxX + padding &&
        river.bounds.maxY >= chunkWorldY - padding &&
        river.bounds.minY <= chunkMaxY + padding
      );
    });
  }

  clear(): void {
    this.rivers.clear();
    this.generatedRegions.clear();
  }

  notifyChunkEvicted(_chunkX: number, _chunkY: number): void {
    // River cache is intentionally stable for the initial implementation.
  }

  private generateRiversForRegion(chunkX: number, chunkY: number, chunkSize: number): void {
    const candidates = this.collectSourceCandidates(chunkX, chunkY, chunkSize);
    const limited = candidates.slice(0, this.config.maxRiversPerRegion);
    const regionRivers: WorldRiverData[] = [];

    for (const source of limited) {
      const river = this.traceMainRiver(source.x, source.y);
      if (river) {
        regionRivers.push(river);
      }
    }

    const acceptedInRegion: WorldRiverData[] = [];
    for (const candidate of regionRivers.sort((a, b) => this.compareRiverPriority(a, b))) {
      if (acceptedInRegion.some(existing => this.areRiversTooClose(candidate, existing))) continue;
      acceptedInRegion.push(candidate);
      this.rivers.set(candidate.id, candidate);
    }
  }

  private collectSourceCandidates(
    chunkX: number,
    chunkY: number,
    chunkSize: number
  ): Array<{ x: number; y: number }> {
    const result: Array<{ x: number; y: number }> = [];
    const worldXStart = chunkX * chunkSize;
    const worldYStart = chunkY * chunkSize;

    for (let localY = 0; localY < chunkSize; localY += 4) {
      for (let localX = 0; localX < chunkSize; localX += 4) {
        const worldX = worldXStart + localX;
        const worldY = worldYStart + localY;
        const height = this.getHeightAt(worldX, worldY);
        if (height < this.config.minSourceElevation || height > this.config.maxSourceElevation) continue;

        const biome = this.getBiomeAt(worldX, worldY);
        if (!this.allowedSourceBiomes.has(biome)) continue;

        const raw = this.noise.fbm(worldX + 0.5, worldY + 0.5, this.sourceNoiseConfig);
        const sourceValue = (raw + 1) * 0.5;
        if (sourceValue >= this.config.sourceThreshold) {
          result.push({ x: worldX, y: worldY });
        }
      }
    }

    return result;
  }

  private traceMainRiver(sourceX: number, sourceY: number): WorldRiverData | null {
    const points: RiverPoint[] = [];
    const visited = new Set<string>();
    let currentX = sourceX;
    let currentY = sourceY;
    let uphillSpent = 0;

    for (let step = 0; step < this.config.maxLength; step++) {
      const height = this.getHeightAt(currentX, currentY);
      const biome = this.getBiomeAt(currentX, currentY);
      points.push(this.createPoint(currentX, currentY, height, points[points.length - 1]));

      if ((height <= SEA_LEVEL || biome === BiomeType.OCEAN) && points.length >= this.config.minRiverLength) {
        if (points.filter(point => !this.isOceanPoint(point)).length < this.config.minRiverLength) return null;
        if (!this.hasSafeOceanMouth(points)) return null;
        return this.createRiver(points);
      }

      const key = `${currentX},${currentY}`;
      if (visited.has(key)) return null;
      visited.add(key);

      const next = this.chooseNextStep(currentX, currentY, height, step);
      if (!next) return null;

      if (next.height > height) {
        uphillSpent += next.height - height;
        if (uphillSpent > this.config.maxUphillBudget) return null;
      }

      currentX = next.x;
      currentY = next.y;
    }

    return null;
  }

  private chooseNextStep(
    x: number,
    y: number,
    currentHeight: number,
    step: number
  ): { x: number; y: number; height: number } | null {
    const directions = [
      [1, 0],
      [1, -1],
      [1, 1],
      [0, -1],
      [0, 1],
      [-1, 0],
      [-1, -1],
      [-1, 1],
    ] as const;

    let best: { x: number; y: number; height: number; score: number } | null = null;

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const height = this.getHeightAt(nx, ny);
      const biome = this.getBiomeAt(nx, ny);
      const downhill = currentHeight - height;
      const oceanBonus = height <= SEA_LEVEL || biome === BiomeType.OCEAN ? 10 : 0;
      const eastwardBias = dx * 0.05;
      const meander = this.noise.noise2D(nx * 0.17 + step, ny * 0.17) * 0.02;
      const score = downhill * 4 + oceanBonus + eastwardBias + meander;

      if (!best || score > best.score) {
        best = { x: nx, y: ny, height, score };
      }
    }

    return best;
  }

  private compareRiverPriority(a: WorldRiverData, b: WorldRiverData): number {
    return this.getRiverPriorityKey(a).localeCompare(this.getRiverPriorityKey(b));
  }

  private getRiverPriorityKey(river: WorldRiverData): string {
    const pathKey = river.mainPath.map(point => `${point.x},${point.y}`).join('|');
    return [
      river.source.x,
      river.source.y,
      river.mouth.x,
      river.mouth.y,
      river.id,
      pathKey,
    ].join('|');
  }

  private areRiversTooClose(a: WorldRiverData, b: WorldRiverData): boolean {
    if (a.mainPath.length === 0 || b.mainPath.length === 0) return false;

    const minDistance = this.config.carveBankWidth * 1.5;
    const minDistanceSq = minDistance * minDistance;

    for (const point of a.mainPath) {
      for (const existing of b.mainPath) {
        const dx = point.x - existing.x;
        const dy = point.y - existing.y;
        if (dx * dx + dy * dy <= minDistanceSq) return true;
      }
    }

    return false;
  }

  private createPoint(x: number, y: number, height: number, previous?: RiverPoint): RiverPoint {
    const flowX = previous ? x - previous.x : 1;
    const flowY = previous ? y - previous.y : 0;

    return {
      x,
      y,
      height,
      surfaceLevel: Math.max(SEA_LEVEL, height + 0.01),
      width: this.config.baseWidth,
      depth: this.config.baseDepth,
      flowX,
      flowY,
    };
  }

  private hasSafeOceanMouth(points: RiverPoint[]): boolean {
    const mouth = points[points.length - 1];
    if (!this.isOceanPoint(mouth)) return true;

    let hasDryShoreline = false;
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      if (this.isOceanPoint(previous) || !this.isOceanPoint(current)) continue;

      hasDryShoreline = true;
      const mouthDrop = previous.height - current.height;
      if (previous.height > MAX_SAFE_MOUTH_HEIGHT || mouthDrop > MAX_SAFE_MOUTH_DROP) {
        return false;
      }

      const approachStart = Math.max(0, i - COAST_APPROACH_WINDOW);
      const approach = points.slice(approachStart, i).filter(point => !this.isOceanPoint(point));
      const highestApproachPoint = Math.max(...approach.map(point => point.height));
      if (highestApproachPoint - previous.height > MAX_SAFE_COAST_APPROACH_DROP) {
        return false;
      }
    }

    return hasDryShoreline;
  }

  private createRiver(points: RiverPoint[]): WorldRiverData {
    const rawSource = points[0];
    const mouth = points[points.length - 1];
    const rawMainPath = this.isOceanPoint(mouth) && points.length > 1
      ? points.slice(0, -1)
      : points;
    const mainPath = createRiverCorridorPoints(rawMainPath);
    const id = `river_${rawSource.x}_${rawSource.y}_${mouth.x}_${mouth.y}`;
    const bounds = this.boundsForPoints(mainPath.length > 0 ? mainPath : [mouth]);

    return {
      id,
      mainPath,
      tributaries: [],
      source: { x: rawSource.x, y: rawSource.y },
      mouth: { x: mouth.x, y: mouth.y },
      bounds,
    };
  }

  private getRiverInfluenceRadius(river: WorldRiverData): number {
    let radius = this.config.carveBankWidth;
    const includePoint = (point: RiverPoint): void => {
      radius = Math.max(radius, getRiverValleyWidth(point) * 0.5);
    };

    river.mainPath.forEach(includePoint);
    for (const tributary of river.tributaries) {
      tributary.points.forEach(includePoint);
    }

    return radius;
  }

  private isOceanPoint(point: RiverPoint): boolean {
    return point.height <= SEA_LEVEL || this.getBiomeAt(point.x, point.y) === BiomeType.OCEAN;
  }

  private boundsForPoints(points: RiverPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }
}
