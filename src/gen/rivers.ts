import { BiomeType } from '../world/chunk';

export interface RiverPoint {
  x: number;
  y: number;
  height: number;
  surfaceLevel: number;
  width: number;
  depth: number;
  flow?: number;
  channelWidth?: number;
  valleyWidth?: number;
  channelDepth?: number;
  valleyDepth?: number;
  flowX: number;
  flowY: number;
}

export interface RiverPath {
  id: string;
  points: RiverPoint[];
  connectsToRiverId: string;
  connectsAtIndex: number;
}

export interface WorldRiverData {
  id: string;
  /**
   * Consumer-visible river corridor. If the river terminates in ocean/sea,
   * the terminal ocean point is excluded and this path ends at the adjacent shoreline.
   */
  mainPath: RiverPoint[];
  tributaries: RiverPath[];
  source: { x: number; y: number };
  /** Terminal ocean/sea point when the river reaches the coast. */
  mouth: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export type RiverState = 'flowing' | 'frozen' | 'dry';

export interface RiverData {
  riverId: string;
  pathId: string;
  isTributary: boolean;
  points: RiverPoint[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Climate-driven river state; undefined when climate system is disabled. */
  state?: RiverState;
}

export interface RiverConfig {
  enabled: boolean;
  sourceNoiseScale: number;
  sourceThreshold: number;
  minSourceElevation: number;
  maxSourceElevation: number;
  allowedSourceBiomes: BiomeType[];
  maxLength: number;
  maxUphillBudget: number;
  minRiverLength: number;
  maxRiversPerRegion: number;
  maxTributaries: number;
  baseWidth: number;
  baseDepth: number;
  carveBankWidth: number;
  /**
   * Spline resampling step size (world units). 0 disables spline smoothing.
   * Values like 0.25–0.5 create smooth Catmull-Rom curves between raw
   * river points, eliminating the stair-step look when carving terrain.
   */
  splineResolution: number;
}

export const DEFAULT_RIVER_CONFIG: RiverConfig = {
  enabled: true,
  sourceNoiseScale: 0.006,
  sourceThreshold: 0.5,
  minSourceElevation: 0.45,
  maxSourceElevation: 0.85,
  allowedSourceBiomes: [
    BiomeType.MOUNTAIN,
    BiomeType.TAIGA,
    BiomeType.TUNDRA,
    BiomeType.FOREST,
    BiomeType.PLAINS,
  ],
  maxLength: 512,
  maxUphillBudget: 0.08,
  minRiverLength: 24,
  maxRiversPerRegion: 3,
  maxTributaries: 2,
  baseWidth: 1.6,
  // Normalized terrain units. With the default 1200 m height scale this is
  // about 1.2 m before downstream channel shaping, keeping rivers human-scale.
  // Temporarily increased 50x for debugging to verify river carving is visible.
  baseDepth: 0.01,
  carveBankWidth: 3.5,
  splineResolution: 0,
};

const DEFAULT_FLOW = 0.35;
const SOURCE_TAPER = 0.08;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const finiteOr = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) ? (value as number) : fallback;

export function getRiverFlow(point: RiverPoint, fallback = DEFAULT_FLOW): number {
  return finiteOr(point.flow, fallback);
}

export function getRiverChannelWidth(point: RiverPoint): number {
  return finiteOr(point.channelWidth, point.width);
}

export function getRiverValleyWidth(point: RiverPoint): number {
  return finiteOr(point.valleyWidth, Math.max(point.width, getRiverChannelWidth(point) * 2.5));
}

export function getRiverChannelDepth(point: RiverPoint): number {
  return finiteOr(point.channelDepth, point.depth);
}

export function getRiverValleyDepth(point: RiverPoint): number {
  return finiteOr(point.valleyDepth, getRiverChannelDepth(point) * 0.6);
}

export function getRiverWaterLevel(point: RiverPoint): number {
  return point.surfaceLevel - getRiverChannelDepth(point) * 0.72;
}

export function createRiverCorridorPoints(points: RiverPoint[]): RiverPoint[] {
  return points.map((point, index) => {
    const progress = points.length <= 1 ? 1 : index / (points.length - 1);
    const sourceRamp = clamp(SOURCE_TAPER + progress * 1.5, SOURCE_TAPER, 1);
    const flow = finiteOr(point.flow, clamp(0.2 + progress * 0.8, 0.2, 1));
    const channelWidth = finiteOr(point.channelWidth, point.width * sourceRamp * (0.75 + flow * 0.35));
    const valleyWidth = finiteOr(point.valleyWidth, Math.max(channelWidth * 4, point.width * sourceRamp * (3.2 + flow * 2.4)));
    const channelDepth = finiteOr(point.channelDepth, point.depth * sourceRamp * (2 + flow * 1.2));
    const valleyDepth = finiteOr(point.valleyDepth, channelDepth * (0.45 + flow * 0.15));
    const previous = points[index - 1];
    const next = points[index + 1];

    return {
      ...point,
      flow,
      channelWidth,
      valleyWidth,
      channelDepth,
      valleyDepth,
      flowX: next ? next.x - point.x : previous ? point.x - previous.x : point.flowX,
      flowY: next ? next.y - point.y : previous ? point.y - previous.y : point.flowY,
    };
  });
}

export function createSmoothedRiverPoints(points: RiverPoint[]): RiverPoint[] {
  const smoothed = points.map((point, index) => {
    if (points.length <= 2 || index === 0 || index === points.length - 1) {
      return { ...point };
    }

    const previous = points[index - 1];
    const next = points[index + 1];
    return {
      ...point,
      x: previous.x * 0.25 + point.x * 0.5 + next.x * 0.25,
      y: previous.y * 0.25 + point.y * 0.5 + next.y * 0.25,
      height: previous.height * 0.25 + point.height * 0.5 + next.height * 0.25,
      surfaceLevel: previous.surfaceLevel * 0.25 + point.surfaceLevel * 0.5 + next.surfaceLevel * 0.25,
      width: previous.width * 0.25 + point.width * 0.5 + next.width * 0.25,
      depth: previous.depth * 0.25 + point.depth * 0.5 + next.depth * 0.25,
    };
  });

  return createRiverCorridorPoints(smoothed);
}

/**
 * Resample river points along a Catmull-Rom spline to eliminate
 * the stair-step look caused by straight line segments.
 * @param points Original river points (must contain at least 2 points)
 * @param subdivisionsPerUnit Number of subdivisions per world-unit of segment length.
 *        Values like 1–2 create smooth curves; 0 disables resampling.
 * @returns Densely sampled points with re-derived corridor attributes
 */
export function resampleRiverPointsSpline(points: RiverPoint[], subdivisionsPerUnit: number): RiverPoint[] {
  if (subdivisionsPerUnit <= 0 || points.length < 2) return points;

  const result: RiverPoint[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const numSteps = Math.max(1, Math.ceil(segmentLength * subdivisionsPerUnit));

    for (let s = 0; s < numSteps; s++) {
      const t = s / numSteps;
      result.push(interpolateRiverPointCatmullRom(t, p0, p1, p2, p3));
    }
  }

  // Always include the last original point
  result.push({ ...points[points.length - 1] });

  return createRiverCorridorPoints(result);
}

function interpolateRiverPointCatmullRom(
  t: number,
  p0: RiverPoint,
  p1: RiverPoint,
  p2: RiverPoint,
  p3: RiverPoint,
): RiverPoint {
  const cr = (t: number, v0: number, v1: number, v2: number, v3: number): number =>
    0.5 * (
      (2 * v1) +
      (-v0 + v2) * t +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t +
      (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t
    );

  const lerpOptional = (a: number | undefined, b: number | undefined, t: number): number | undefined => {
    if (!Number.isFinite(a) && !Number.isFinite(b)) return undefined;
    const start = Number.isFinite(a) ? (a as number) : (b as number);
    const end = Number.isFinite(b) ? (b as number) : start;
    return start + (end - start) * t;
  };

  return {
    x: cr(t, p0.x, p1.x, p2.x, p3.x),
    y: cr(t, p0.y, p1.y, p2.y, p3.y),
    height: cr(t, p0.height, p1.height, p2.height, p3.height),
    surfaceLevel: cr(t, p0.surfaceLevel, p1.surfaceLevel, p2.surfaceLevel, p3.surfaceLevel),
    width: cr(t, p0.width, p1.width, p2.width, p3.width),
    depth: cr(t, p0.depth, p1.depth, p2.depth, p3.depth),
    flow: lerpOptional(p1.flow, p2.flow, t),
    channelWidth: lerpOptional(p1.channelWidth, p2.channelWidth, t),
    valleyWidth: lerpOptional(p1.valleyWidth, p2.valleyWidth, t),
    channelDepth: lerpOptional(p1.channelDepth, p2.channelDepth, t),
    valleyDepth: lerpOptional(p1.valleyDepth, p2.valleyDepth, t),
    flowX: 0,
    flowY: 0,
  };
}
