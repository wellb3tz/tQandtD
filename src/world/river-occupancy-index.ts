import { getRiverValleyWidth, type RiverConfig, type RiverPoint } from '../gen/rivers';
import {
  closestBetweenSegments,
  distanceToSegment,
  interpolateRiverPoint,
} from './river-geometry';

const MIN_OCCUPANCY_CELL_SIZE = 4;

export interface OccupiedRiverSegment {
  riverId: string;
  segmentIndex: number;
  a: RiverPoint;
  b: RiverPoint;
  radius: number;
}

export interface RiverConfluenceHit {
  segment: OccupiedRiverSegment;
  candidateT: number;
  distance: number;
  existingPoint: RiverPoint;
}

export class RiverOccupancyIndex {
  private readonly occupiedSegments: OccupiedRiverSegment[] = [];
  private readonly occupiedSegmentGrid = new Map<string, OccupiedRiverSegment[]>();
  private readonly occupancyCellSize: number;
  private maxOccupiedRadius: number;

  constructor(private readonly carveBankWidth: number) {
    this.occupancyCellSize = Math.max(MIN_OCCUPANCY_CELL_SIZE, carveBankWidth * 2);
    this.maxOccupiedRadius = carveBankWidth;
  }

  isEmpty(): boolean {
    return this.occupiedSegments.length === 0;
  }

  clear(): void {
    this.occupiedSegments.length = 0;
    this.occupiedSegmentGrid.clear();
    this.maxOccupiedRadius = this.carveBankWidth;
  }

  indexRiverPath(riverId: string, points: RiverPoint[], config: RiverConfig): void {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segment: OccupiedRiverSegment = {
        riverId,
        segmentIndex: i,
        a,
        b,
        radius: Math.max(
          config.carveBankWidth * 1.15,
          getRiverValleyWidth(a) * 0.5,
          getRiverValleyWidth(b) * 0.5,
        ),
      };
      this.occupiedSegments.push(segment);
      this.maxOccupiedRadius = Math.max(this.maxOccupiedRadius, segment.radius);
      this.indexOccupiedSegment(segment);
    }
  }

  findOccupiedPoint(x: number, y: number): OccupiedRiverSegment | null {
    for (const segment of this.queryOccupiedSegmentsForPoint(x, y)) {
      const distance = distanceToSegment(x, y, segment.a, segment.b);
      if (distance <= segment.radius) return segment;
    }

    return null;
  }

  findConfluenceHit(a: RiverPoint, b: RiverPoint): RiverConfluenceHit | null {
    let best: RiverConfluenceHit | null = null;

    for (const segment of this.queryOccupiedSegmentsForSegment(a, b)) {
      const closest = closestBetweenSegments(a, b, segment.a, segment.b);
      if (closest.distance > segment.radius) continue;

      const existingPoint = interpolateRiverPoint(segment.a, segment.b, closest.existingT);
      const hit: RiverConfluenceHit = {
        segment,
        candidateT: closest.candidateT,
        distance: closest.distance,
        existingPoint,
      };

      if (!best || hit.distance < best.distance) {
        best = hit;
      }
    }

    return best;
  }

  private indexOccupiedSegment(segment: OccupiedRiverSegment): void {
    for (const cellKey of this.getGridKeysForBounds(
      Math.min(segment.a.x, segment.b.x) - segment.radius,
      Math.max(segment.a.x, segment.b.x) + segment.radius,
      Math.min(segment.a.y, segment.b.y) - segment.radius,
      Math.max(segment.a.y, segment.b.y) + segment.radius,
    )) {
      const bucket = this.occupiedSegmentGrid.get(cellKey);
      if (bucket) {
        bucket.push(segment);
      } else {
        this.occupiedSegmentGrid.set(cellKey, [segment]);
      }
    }
  }

  private queryOccupiedSegmentsForPoint(x: number, y: number): OccupiedRiverSegment[] {
    const bucket = this.occupiedSegmentGrid.get(this.getGridKeyForPoint(x, y));
    return bucket ?? [];
  }

  private queryOccupiedSegmentsForSegment(a: RiverPoint, b: RiverPoint): OccupiedRiverSegment[] {
    const result: OccupiedRiverSegment[] = [];
    const seen = new Set<OccupiedRiverSegment>();

    for (const cellKey of this.getGridKeysForBounds(
      Math.min(a.x, b.x) - this.maxOccupiedRadius,
      Math.max(a.x, b.x) + this.maxOccupiedRadius,
      Math.min(a.y, b.y) - this.maxOccupiedRadius,
      Math.max(a.y, b.y) + this.maxOccupiedRadius,
    )) {
      const bucket = this.occupiedSegmentGrid.get(cellKey);
      if (!bucket) continue;

      for (const segment of bucket) {
        if (seen.has(segment)) continue;
        seen.add(segment);
        result.push(segment);
      }
    }

    return result;
  }

  private getGridKeysForBounds(minX: number, maxX: number, minY: number, maxY: number): string[] {
    const keys: string[] = [];
    const minCellX = Math.floor(minX / this.occupancyCellSize);
    const maxCellX = Math.floor(maxX / this.occupancyCellSize);
    const minCellY = Math.floor(minY / this.occupancyCellSize);
    const maxCellY = Math.floor(maxY / this.occupancyCellSize);

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        keys.push(`${cellX},${cellY}`);
      }
    }

    return keys;
  }

  private getGridKeyForPoint(x: number, y: number): string {
    return `${Math.floor(x / this.occupancyCellSize)},${Math.floor(y / this.occupancyCellSize)}`;
  }
}
