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

export interface RiverData {
  riverId: string;
  pathId: string;
  isTributary: boolean;
  points: RiverPoint[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
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
  baseDepth: 0.055,
  carveBankWidth: 3.5,
};

const DEFAULT_FLOW = 0.35;
const SOURCE_TAPER = 0.35;

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
  return point.surfaceLevel - getRiverChannelDepth(point) * 0.35;
}

export function createRiverCorridorPoints(points: RiverPoint[]): RiverPoint[] {
  return points.map((point, index) => {
    const progress = points.length <= 1 ? 1 : index / (points.length - 1);
    const sourceRamp = clamp(SOURCE_TAPER + progress * 1.5, SOURCE_TAPER, 1);
    const flow = finiteOr(point.flow, clamp(0.2 + progress * 0.8, 0.2, 1));
    const channelWidth = finiteOr(point.channelWidth, point.width * sourceRamp * (0.75 + flow * 0.35));
    const valleyWidth = finiteOr(point.valleyWidth, Math.max(channelWidth * 4, point.width * (3.2 + flow * 2.4)));
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
