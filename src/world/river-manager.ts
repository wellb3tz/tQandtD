import { NoiseEngine, type NoiseConfig } from '../core/noise';
import {
  createRiverCorridorPoints,
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverFlow,
  getRiverValleyDepth,
  getRiverValleyWidth,
  type RiverConfig,
  type RiverPath,
  type RiverPoint,
  type WorldRiverData,
} from '../gen/rivers';
import { BiomeType } from './chunk';
import {
  boundsForPoints,
  getRiverInfluenceRadius,
  interpolateRiverPoint,
  normalized,
} from './water/rivers/river-geometry';
import { RiverOccupancyIndex, type OccupiedRiverSegment, type RiverConfluenceHit } from './water/rivers/river-occupancy-index';

const SEA_LEVEL = 0.3;
const MAX_SAFE_MOUTH_HEIGHT = SEA_LEVEL + 0.14;
const MAX_SAFE_MOUTH_DROP = 0.18;
const COAST_APPROACH_WINDOW = 8;
const MAX_SAFE_COAST_APPROACH_DROP = 0.28;
const MIN_CONFLUENCE_DRY_POINTS = 4;
const MAX_CONFLUENCE_OPPOSING_DOT = -0.35;
const MAX_CONFLUENCE_SURFACE_DROP = 0.14;
const CONFLUENCE_ROUTE_BONUS = 6;
const OCCUPIED_CORRIDOR_EARLY_PENALTY = -8;

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
  private readonly occupancyIndex: RiverOccupancyIndex;
  private isLakeTile?: (worldX: number, worldY: number) => boolean;

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
    this.occupancyIndex = new RiverOccupancyIndex(config.carveBankWidth);
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
      const padding = getRiverInfluenceRadius(river, this.config.carveBankWidth);
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
    this.occupancyIndex.clear();
  }

  notifyChunkEvicted(_chunkX: number, _chunkY: number): void {
    // River cache is intentionally stable for the initial implementation.
  }

  /**
   * Register a callback that returns true when a world tile is already
   * occupied by a lake.  Used to prevent rivers from flowing through
   * existing lakes (they terminate at the shore instead).
   */
  setLakeTileChecker(checker: (worldX: number, worldY: number) => boolean): void {
    this.isLakeTile = checker;
  }

  /**
   * Returns true if the world-space point lies inside any river corridor
   * (channel or valley).  Used by LakeManager to avoid spawning lakes on
   * top of rivers.
   */
  isPointInRiverCorridor(worldX: number, worldY: number): boolean {
    return this.findOccupiedPoint(worldX, worldY) !== null;
  }

  private findOccupiedPoint(worldX: number, worldY: number): OccupiedRiverSegment | null {
    return this.occupancyIndex.findOccupiedPoint(worldX, worldY);
  }

  private generateRiversForRegion(chunkX: number, chunkY: number, chunkSize: number): void {
    const candidates = this.collectSourceCandidates(chunkX, chunkY, chunkSize);
    const limited = candidates
      .slice(0, this.config.maxRiversPerRegion)
      .sort((a, b) => a.x - b.x || a.y - b.y);

    for (const source of limited) {
      if (this.findOccupiedPoint(source.x, source.y)) continue;

      const river = this.traceMainRiver(source.x, source.y);
      if (river) {
        this.acceptRiver(river);
      }
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

      if (points.length >= 2) {
        const previous = points[points.length - 2];
        const current = points[points.length - 1];
        const hit = this.occupancyIndex.findConfluenceHit(previous, current);
        if (hit) {
          return this.tryCreateMergedTributary(points, hit);
        }
      }

      if ((height <= SEA_LEVEL || biome === BiomeType.OCEAN) && points.length >= this.config.minRiverLength) {
        if (points.filter(point => !this.isOceanPoint(point)).length < this.config.minRiverLength) return null;
        if (!this.hasSafeOceanMouth(points)) return null;
        return this.createRiver(points);
      }

      if (this.isLakeTile?.(currentX, currentY)) {
        if (points.filter(point => !this.isOceanPoint(point)).length < this.config.minRiverLength) return null;
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
      const occupancyScore = this.getOccupiedCorridorStepScore(x, y, currentHeight, nx, ny, height, step);
      const score = downhill * 4 + oceanBonus + eastwardBias + meander + occupancyScore;

      if (!best || score > best.score) {
        best = { x: nx, y: ny, height, score };
      }
    }

    return best;
  }

  private getOccupiedCorridorStepScore(
    x: number,
    y: number,
    currentHeight: number,
    nextX: number,
    nextY: number,
    nextHeight: number,
    step: number,
  ): number {
    if (this.occupancyIndex.isEmpty()) return 0;

    const current = this.createPoint(x, y, currentHeight);
    const next = this.createPoint(nextX, nextY, nextHeight, current);
    const hit = this.occupancyIndex.findConfluenceHit(current, next);
    if (!hit) return 0;

    const requiredPoints = Math.max(MIN_CONFLUENCE_DRY_POINTS, this.config.minRiverLength);
    const pointsAfterStep = step + 2;
    if (pointsAfterStep < requiredPoints) return OCCUPIED_CORRIDOR_EARLY_PENALTY;

    const targetRiver = this.rivers.get(hit.segment.riverId);
    const canMerge =
      this.config.maxTributaries > 0 &&
      targetRiver !== undefined &&
      targetRiver.tributaries.length < this.config.maxTributaries &&
      this.canMergeAtConfluence([current, next], hit);

    if (!canMerge) return 0;

    const distancePenalty = hit.segment.radius > 1e-6 ? hit.distance / hit.segment.radius : 0;
    return CONFLUENCE_ROUTE_BONUS * (1 - Math.min(distancePenalty, 1));
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
    const bounds = boundsForPoints(mainPath.length > 0 ? mainPath : [mouth]);

    return {
      id,
      mainPath,
      tributaries: [],
      source: { x: rawSource.x, y: rawSource.y },
      mouth: { x: mouth.x, y: mouth.y },
      bounds,
    };
  }

  private acceptRiver(river: WorldRiverData): void {
    this.rivers.set(river.id, river);
    this.occupancyIndex.indexRiverPath(river.id, river.mainPath, this.config);
    for (const tributary of river.tributaries) {
      this.occupancyIndex.indexRiverPath(river.id, tributary.points, this.config);
    }
  }

  private tryCreateMergedTributary(points: RiverPoint[], hit: RiverConfluenceHit): null {
    if (points.filter(point => !this.isOceanPoint(point)).length < Math.max(MIN_CONFLUENCE_DRY_POINTS, this.config.minRiverLength)) {
      return null;
    }
    if (!this.canMergeAtConfluence(points, hit)) {
      return null;
    }

    const targetRiver = this.rivers.get(hit.segment.riverId);
    if (!targetRiver) return null;
    if (targetRiver.tributaries.length >= this.config.maxTributaries) return null;

    const rawTributary = this.createTributaryPoints(points, hit);
    if (rawTributary.length < 2) return null;

    const tributaryPoints = createRiverCorridorPoints(rawTributary);
    const source = tributaryPoints[0];
    const confluence = tributaryPoints[tributaryPoints.length - 1];
    const tributary: RiverPath = {
      id: `${targetRiver.id}:tributary:${source.x}_${source.y}_${Math.round(confluence.x * 100) / 100}_${Math.round(confluence.y * 100) / 100}`,
      points: tributaryPoints,
      connectsToRiverId: targetRiver.id,
      connectsAtIndex: hit.segment.segmentIndex,
    };

    targetRiver.tributaries.push(tributary);
    this.boostDownstreamFlow(targetRiver, hit.segment.segmentIndex, tributaryPoints);
    targetRiver.bounds = boundsForPoints([
      ...targetRiver.mainPath,
      ...targetRiver.tributaries.flatMap(path => path.points),
    ]);
    this.occupancyIndex.indexRiverPath(targetRiver.id, tributary.points, this.config);

    return null;
  }

  private createTributaryPoints(points: RiverPoint[], hit: RiverConfluenceHit): RiverPoint[] {
    const previous = points[points.length - 2];
    const current = points[points.length - 1];
    const raw = points.slice(0, -1);
    const candidateEnd = interpolateRiverPoint(previous, current, hit.candidateT);
    if (Math.hypot(candidateEnd.x - raw[raw.length - 1].x, candidateEnd.y - raw[raw.length - 1].y) > 1e-6) {
      raw.push(candidateEnd);
    }

    const prior = raw[raw.length - 1];
    const flowX = hit.existingPoint.x - prior.x;
    const flowY = hit.existingPoint.y - prior.y;
    raw.push({
      ...hit.existingPoint,
      flowX,
      flowY,
    });

    return raw;
  }

  private canMergeAtConfluence(points: RiverPoint[], hit: RiverConfluenceHit): boolean {
    if (hit.distance > hit.segment.radius) return false;

    const previous = points[points.length - 2];
    const current = points[points.length - 1];
    const candidateDir = normalized(current.x - previous.x, current.y - previous.y);
    const existingDir = normalized(hit.segment.b.x - hit.segment.a.x, hit.segment.b.y - hit.segment.a.y);
    const dot = candidateDir.x * existingDir.x + candidateDir.y * existingDir.y;
    if (dot < MAX_CONFLUENCE_OPPOSING_DOT) return false;

    const candidateSurface = current.surfaceLevel;
    if (candidateSurface + MAX_CONFLUENCE_SURFACE_DROP < hit.existingPoint.surfaceLevel) return false;

    return true;
  }

  private boostDownstreamFlow(
    river: WorldRiverData,
    segmentIndex: number,
    tributaryPoints: RiverPoint[],
  ): void {
    const contribution = Math.max(0.08, getRiverFlow(tributaryPoints[tributaryPoints.length - 1]) * 0.18);
    for (let i = Math.max(0, segmentIndex + 1); i < river.mainPath.length; i++) {
      const point = river.mainPath[i];
      const downstreamT = river.mainPath.length <= 1 ? 1 : i / (river.mainPath.length - 1);
      const boost = contribution * (0.65 + downstreamT * 0.35);
      point.flow = Math.min(1.25, getRiverFlow(point) + boost);
      point.channelWidth = getRiverChannelWidth(point) * (1 + boost * 0.18);
      point.valleyWidth = getRiverValleyWidth(point) * (1 + boost * 0.12);
      point.channelDepth = getRiverChannelDepth(point) * (1 + boost * 0.12);
      point.valleyDepth = getRiverValleyDepth(point) * (1 + boost * 0.1);
    }
  }

  private isOceanPoint(point: RiverPoint): boolean {
    return point.height <= SEA_LEVEL || this.getBiomeAt(point.x, point.y) === BiomeType.OCEAN;
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }
}
