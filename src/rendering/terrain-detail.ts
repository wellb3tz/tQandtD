import type { ChunkData } from '../world/chunk';
import {
  getRiverChannelWidth,
  type RiverPoint,
} from '../gen/rivers';

export const RIVER_TRENCH_DARKEN_STRENGTH = 0.35;

export function calculateRiverTrenchInfluence(data: ChunkData, x: number, y: number): number {
  const rivers = data.rivers ?? [];
  if (rivers.length === 0) return 0;

  let strongest = 0;
  for (const river of rivers) {
    // Dry rivers leave a carved depression but no water effects
    if (river.state === 'dry') continue;
    const points = river.points;
    if (points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const sample = closestRiverRenderSample(x, y, points[i], points[i + 1]);
      const channelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
      if (channelRadius <= 0 || sample.distance > channelRadius) continue;

      const centerWeight = 1 - sample.distance / channelRadius;
      strongest = Math.max(strongest, centerWeight * centerWeight);
    }
  }

  return strongest;
}

export function calculateFrozenRiverInfluence(data: ChunkData, x: number, y: number): number {
  const rivers = data.rivers ?? [];
  if (rivers.length === 0) return 0;

  let strongest = 0;
  for (const river of rivers) {
    if (river.state !== 'frozen') continue;
    const points = river.points;
    if (points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const sample = closestRiverRenderSample(x, y, points[i], points[i + 1]);
      const channelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
      if (channelRadius <= 0 || sample.distance > channelRadius) continue;

      const centerWeight = 1 - sample.distance / channelRadius;
      strongest = Math.max(strongest, centerWeight * centerWeight);
    }
  }

  return strongest;
}

export function getRiverTrenchDarkening(
  data: ChunkData,
  x: number,
  y: number,
  strength = RIVER_TRENCH_DARKEN_STRENGTH,
): number {
  return 1 - calculateRiverTrenchInfluence(data, x, y) * strength;
}

function closestRiverRenderSample(
  x: number,
  y: number,
  a: RiverPoint,
  b: RiverPoint
): RiverPoint & { distance: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
  const px = a.x + vx * t;
  const py = a.y + vy * t;
  const optional = (start: number | undefined, end: number | undefined): number | undefined => {
    if (!Number.isFinite(start) && !Number.isFinite(end)) return undefined;
    const from = Number.isFinite(start) ? (start as number) : (end as number);
    const to = Number.isFinite(end) ? (end as number) : from;
    return from + (to - from) * t;
  };

  return {
    ...a,
    x: px,
    y: py,
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
    distance: Math.hypot(x - px, y - py),
  };
}
