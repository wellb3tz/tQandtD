import { getRiverValleyWidth, type RiverPoint, type WorldRiverData } from '../gen/rivers';

export interface ClosestSegmentPoints {
  candidateT: number;
  existingT: number;
  distance: number;
}

export function closestPointOnSegment(
  x: number,
  y: number,
  a: RiverPoint,
  b: RiverPoint,
): { x: number; y: number; t: number; distance: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
  const px = a.x + vx * t;
  const py = a.y + vy * t;

  return {
    x: px,
    y: py,
    t,
    distance: Math.hypot(x - px, y - py),
  };
}

export function distanceToSegment(x: number, y: number, a: RiverPoint, b: RiverPoint): number {
  return closestPointOnSegment(x, y, a, b).distance;
}

export function segmentIntersection(
  a: RiverPoint,
  b: RiverPoint,
  c: RiverPoint,
  d: RiverPoint,
): { candidateT: number; existingT: number } | null {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const denominator = rX * sY - rY * sX;
  if (Math.abs(denominator) < 1e-9) return null;

  const cmaX = c.x - a.x;
  const cmaY = c.y - a.y;
  const candidateT = (cmaX * sY - cmaY * sX) / denominator;
  const existingT = (cmaX * rY - cmaY * rX) / denominator;

  if (candidateT < 0 || candidateT > 1 || existingT < 0 || existingT > 1) return null;

  return {
    candidateT,
    existingT,
  };
}

export function closestBetweenSegments(
  candidateA: RiverPoint,
  candidateB: RiverPoint,
  existingA: RiverPoint,
  existingB: RiverPoint,
): ClosestSegmentPoints {
  const candidates: ClosestSegmentPoints[] = [];
  const candidateToExistingA = closestPointOnSegment(existingA.x, existingA.y, candidateA, candidateB);
  candidates.push({
    candidateT: candidateToExistingA.t,
    existingT: 0,
    distance: candidateToExistingA.distance,
  });

  const candidateToExistingB = closestPointOnSegment(existingB.x, existingB.y, candidateA, candidateB);
  candidates.push({
    candidateT: candidateToExistingB.t,
    existingT: 1,
    distance: candidateToExistingB.distance,
  });

  const existingToCandidateA = closestPointOnSegment(candidateA.x, candidateA.y, existingA, existingB);
  candidates.push({
    candidateT: 0,
    existingT: existingToCandidateA.t,
    distance: existingToCandidateA.distance,
  });

  const existingToCandidateB = closestPointOnSegment(candidateB.x, candidateB.y, existingA, existingB);
  candidates.push({
    candidateT: 1,
    existingT: existingToCandidateB.t,
    distance: existingToCandidateB.distance,
  });

  const intersection = segmentIntersection(candidateA, candidateB, existingA, existingB);
  if (intersection) {
    candidates.push({
      candidateT: intersection.candidateT,
      existingT: intersection.existingT,
      distance: 0,
    });
  }

  return candidates.reduce((best, current) => current.distance < best.distance ? current : best);
}

export function interpolateRiverPoint(a: RiverPoint, b: RiverPoint, t: number): RiverPoint {
  const optional = (start: number | undefined, end: number | undefined): number | undefined => {
    if (!Number.isFinite(start) && !Number.isFinite(end)) return undefined;
    const from = Number.isFinite(start) ? (start as number) : (end as number);
    const to = Number.isFinite(end) ? (end as number) : from;
    return from + (to - from) * t;
  };

  return {
    ...a,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    height: a.height + (b.height - a.height) * t,
    surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * t,
    width: a.width + (b.width - a.width) * t,
    depth: a.depth + (b.depth - a.depth) * t,
    flow: optional(a.flow, b.flow),
    channelWidth: optional(a.channelWidth, b.channelWidth),
    valleyWidth: optional(a.valleyWidth, b.valleyWidth),
    channelDepth: optional(a.channelDepth, b.channelDepth),
    valleyDepth: optional(a.valleyDepth, b.valleyDepth),
    flowX: a.flowX + (b.flowX - a.flowX) * t,
    flowY: a.flowY + (b.flowY - a.flowY) * t,
  };
}

export function normalized(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function getRiverInfluenceRadius(river: WorldRiverData, carveBankWidth: number): number {
  let radius = carveBankWidth;
  const includePoint = (point: RiverPoint): void => {
    radius = Math.max(radius, getRiverValleyWidth(point) * 0.5);
  };

  river.mainPath.forEach(includePoint);
  for (const tributary of river.tributaries) {
    tributary.points.forEach(includePoint);
  }

  return radius;
}

export function boundsForPoints(points: RiverPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
