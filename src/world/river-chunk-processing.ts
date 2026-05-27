import {
  DEFAULT_RIVER_CONFIG,
  createSmoothedRiverPoints,
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverValleyDepth,
  getRiverValleyWidth,
  resampleRiverPointsSpline,
  type RiverData,
  type RiverPoint,
  type WorldRiverData,
} from '../gen/rivers';

const SEA_LEVEL = 0.3;
const RIVER_MOUTH_TAPER_HEIGHT = 0.1;
const RIVER_MOUTH_MAX_BELOW_SEA_DEPTH = 0.025;
const RIVER_TERMINAL_CARVE_EXTENSION = 1;
const RIVER_MIN_CHANNEL_CARVE_RADIUS = 0.5;
const RIVER_MIN_CHANNEL_FLOOR_RADIUS = 0.65;
const RIVER_VALLEY_PROFILE_PADDING = 0.5;

export type RiverClimateSample = { temperature: number; moisture: number } | null | undefined;
export type RiverClimateSampler = (point: RiverPoint) => RiverClimateSample;

export function determineRiverState(
  river: WorldRiverData,
  sampleClimate?: RiverClimateSampler
): 'flowing' | 'frozen' | 'dry' {
  if (!sampleClimate) return 'flowing';

  const points = river.mainPath;
  const sampleCount = Math.min(points.length, 12);
  const step = Math.max(1, Math.floor(points.length / sampleCount));
  let totalTemperature = 0;
  let totalMoisture = 0;
  let sampled = 0;

  for (let index = 0; index < points.length && sampled < sampleCount; index += step) {
    const climate = sampleClimate(points[index]);
    if (climate) {
      totalTemperature += climate.temperature;
      totalMoisture += climate.moisture;
      sampled++;
    }
  }

  if (sampled === 0) return 'flowing';

  const averageTemperature = totalTemperature / sampled;
  const averageMoisture = totalMoisture / sampled;
  if (averageTemperature < -0.4) return 'frozen';
  if (averageTemperature > 0.4 && averageMoisture < -0.2) return 'dry';
  return 'flowing';
}

export function convertWorldRiversToChunkRivers(
  worldRivers: WorldRiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  splineResolution = DEFAULT_RIVER_CONFIG.splineResolution,
  stateMap?: Map<string, 'flowing' | 'frozen' | 'dry'>,
): RiverData[] {
  const chunkWorldX = chunkX * chunkSize;
  const chunkWorldY = chunkY * chunkSize;
  const result: RiverData[] = [];

  const convertPath = (
    riverId: string,
    pathId: string,
    isTributary: boolean,
    points: RiverPoint[]
  ): void => {
    const densified = splineResolution > 0 ? resampleRiverPointsSpline(points, splineResolution) : points;
    const smoothed = createSmoothedRiverPoints(densified);
    const selectedRuns: RiverPoint[][] = [];
    let currentRun: RiverPoint[] | null = null;

    const flushCurrentRun = (): void => {
      if (currentRun && currentRun.length >= 2) {
        selectedRuns.push(currentRun);
      }
      currentRun = null;
    };

    for (let i = 0; i < smoothed.length - 1; i++) {
      const a = smoothed[i];
      const b = smoothed[i + 1];
      const valleyRadius = Math.max(getRiverValleyWidth(a), getRiverValleyWidth(b)) * 0.5;
      const segmentMinX = Math.min(a.x, b.x) - valleyRadius;
      const segmentMaxX = Math.max(a.x, b.x) + valleyRadius;
      const segmentMinY = Math.min(a.y, b.y) - valleyRadius;
      const segmentMaxY = Math.max(a.y, b.y) + valleyRadius;
      const intersectsChunk =
        segmentMaxX >= chunkWorldX &&
        segmentMinX <= chunkWorldX + chunkSize &&
        segmentMaxY >= chunkWorldY &&
        segmentMinY <= chunkWorldY + chunkSize;

      if (intersectsChunk) {
        if (!currentRun) {
          currentRun = [a, b];
        } else {
          currentRun.push(b);
        }
      } else {
        flushCurrentRun();
      }
    }

    flushCurrentRun();

    const localRuns = selectedRuns
      .map(run => run.map(point => ({
        ...point,
        x: point.x - chunkWorldX,
        y: point.y - chunkWorldY,
      })))
      .filter(run => run.length >= 2);

    localRuns.forEach((local, index) => {
      const xs = local.map(point => point.x);
      const ys = local.map(point => point.y);
      result.push({
        riverId,
        pathId: localRuns.length === 1 ? pathId : `${pathId}:span${index}`,
        isTributary,
        points: local,
        state: stateMap?.get(riverId),
        bounds: {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        },
      });
    });
  };

  for (const river of worldRivers) {
    convertPath(river.id, `${river.id}:main`, false, extendRiverPathToMouth(river.mainPath, river.mouth));
    for (const tributary of river.tributaries) {
      convertPath(river.id, tributary.id, true, tributary.points);
    }
  }

  return result;
}

export function carveTerrainForRivers(
  rivers: RiverData[],
  heightmap: Float32Array,
  chunkSize: number,
  carveBankWidth = DEFAULT_RIVER_CONFIG.carveBankWidth
): void {
  const vertexSize = chunkSize + 1;

  for (const river of rivers) {
    const points = river.points;
    const maxValleyRadius = points.reduce(
      (max, point) => Math.max(max, getRiverValleyWidth(point) * 0.5),
      carveBankWidth
    );
    const minPointX = Math.min(...points.map(point => point.x));
    const maxPointX = Math.max(...points.map(point => point.x));
    const minPointY = Math.min(...points.map(point => point.y));
    const maxPointY = Math.max(...points.map(point => point.y));
    const minX = Math.max(0, Math.floor(minPointX - maxValleyRadius));
    const maxX = Math.min(chunkSize, Math.ceil(maxPointX + maxValleyRadius));
    const minY = Math.max(0, Math.floor(minPointY - maxValleyRadius));
    const maxY = Math.min(chunkSize, Math.ceil(maxPointY + maxValleyRadius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const sample = closestRiverSample(x, y, points, RIVER_TERMINAL_CARVE_EXTENSION);
        if (!sample) continue;

        const rawChannelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
        const channelRadius = rawChannelRadius > 0
          ? Math.max(rawChannelRadius, RIVER_MIN_CHANNEL_CARVE_RADIUS)
          : 0;
        const valleyRadius = Math.max(
          getRiverValleyWidth(sample) * 0.5 + (rawChannelRadius > 0 ? RIVER_VALLEY_PROFILE_PADDING : 0),
          channelRadius,
        );
        if (sample.distance > valleyRadius) continue;

        const index = y * vertexSize + x;
        if (heightmap[index] < SEA_LEVEL) continue;

        let target: number;
        const mouthT = Math.min(Math.max((sample.surfaceLevel - SEA_LEVEL) / RIVER_MOUTH_TAPER_HEIGHT, 0), 1);
        const mouthDepthScale = mouthT * mouthT * (3 - 2 * mouthT);

        if (channelRadius > 0) {
          const channelTarget = Math.max(0, sample.surfaceLevel - getRiverChannelDepth(sample) * mouthDepthScale);
          const bankDepth = Math.min(getRiverChannelDepth(sample) * 0.6, getRiverValleyDepth(sample) * 1.2);
          const bankTarget = Math.max(0, sample.surfaceLevel - bankDepth * mouthDepthScale);
          target = calculateRiverChannelProfileHeight(
            heightmap[index],
            sample.distance,
            channelRadius,
            valleyRadius,
            channelTarget,
            bankTarget,
          );
        } else if (channelRadius === 0 && sample.distance === 0) {
          target = Math.max(0, sample.surfaceLevel - getRiverChannelDepth(sample) * mouthDepthScale);
        } else {
          const valleyT = 1 - Math.min(sample.distance / valleyRadius, 1);
          const valleyFalloff = valleyT * valleyT * (3 - 2 * valleyT);
          const valleyTarget = Math.max(0, sample.surfaceLevel - getRiverValleyDepth(sample) * mouthDepthScale);
          target = heightmap[index] * (1 - valleyFalloff) + valleyTarget * valleyFalloff;
        }

        if (heightmap[index] < SEA_LEVEL + RIVER_MOUTH_TAPER_HEIGHT) {
          const coastalT = Math.min(Math.max((heightmap[index] - SEA_LEVEL) / RIVER_MOUTH_TAPER_HEIGHT, 0), 1);
          const coastalDepthScale = coastalT * coastalT * (3 - 2 * coastalT);
          const coastalFloor = SEA_LEVEL - RIVER_MOUTH_MAX_BELOW_SEA_DEPTH * coastalDepthScale;
          target = Math.max(target, coastalFloor);
        }

        heightmap[index] = Math.min(heightmap[index], target);
      }
    }
  }
}

function extendRiverPathToMouth(
  points: RiverPoint[],
  mouth: { x: number; y: number }
): RiverPoint[] {
  if (points.length === 0) return points;

  const last = points[points.length - 1];
  const toMouthX = mouth.x - last.x;
  const toMouthY = mouth.y - last.y;
  const toMouthLength = Math.hypot(toMouthX, toMouthY);

  if (toMouthLength < 0.001) {
    return points;
  }

  return [
    ...points,
    {
      ...last,
      x: mouth.x,
      y: mouth.y,
      height: Math.min(last.height, SEA_LEVEL),
      surfaceLevel: SEA_LEVEL,
      flowX: toMouthX,
      flowY: toMouthY,
    },
  ];
}

function closestRiverSample(
  x: number,
  y: number,
  points: RiverPoint[],
  terminalExtension = 0
): (RiverPoint & { distance: number }) | null {
  if (points.length < 2) return null;

  let best: (RiverPoint & { distance: number }) | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy || 1;
    const length = Math.sqrt(lenSq);
    const maxT = i === points.length - 2 ? 1 + terminalExtension / length : 1;
    const t = Math.max(0, Math.min(maxT, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
    const attributeT = Math.min(t, 1);
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    const distance = Math.hypot(x - px, y - py);
    const sample = {
      ...a,
      x: px,
      y: py,
      height: a.height + (b.height - a.height) * attributeT,
      surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * attributeT,
      depth: a.depth + (b.depth - a.depth) * attributeT,
      width: a.width + (b.width - a.width) * attributeT,
      flow: interpolateOptional(a.flow, b.flow, attributeT),
      channelWidth: interpolateOptional(a.channelWidth, b.channelWidth, attributeT),
      valleyWidth: interpolateOptional(a.valleyWidth, b.valleyWidth, attributeT),
      channelDepth: interpolateOptional(a.channelDepth, b.channelDepth, attributeT),
      valleyDepth: interpolateOptional(a.valleyDepth, b.valleyDepth, attributeT),
      flowX: a.flowX + (b.flowX - a.flowX) * attributeT,
      flowY: a.flowY + (b.flowY - a.flowY) * attributeT,
      distance,
    };

    if (!best || sample.distance < best.distance) {
      best = sample;
    }
  }

  return best;
}

function calculateRiverChannelProfileHeight(
  originalHeight: number,
  distance: number,
  channelRadius: number,
  valleyRadius: number,
  channelTarget: number,
  bankTarget: number,
): number {
  if (valleyRadius <= 0) return originalHeight;

  if (channelRadius >= valleyRadius - 1e-6) {
    const t = smoothStep(Math.min(Math.max(distance / valleyRadius, 0), 1));
    return channelTarget * (1 - t) + originalHeight * t;
  }

  const floorRadius = Math.min(
    Math.max(channelRadius * 0.35, RIVER_MIN_CHANNEL_FLOOR_RADIUS),
    channelRadius * 0.7,
  );
  if (distance <= floorRadius) {
    return channelTarget;
  }

  if (distance <= channelRadius) {
    const channelWallT = smoothStep(
      Math.min(Math.max((distance - floorRadius) / (channelRadius - floorRadius), 0), 1),
    );
    return channelTarget * (1 - channelWallT) + bankTarget * channelWallT;
  }

  const outerT = Math.min(Math.max((distance - channelRadius) / (valleyRadius - channelRadius), 0), 1);
  return bankTarget * (1 - outerT) + originalHeight * outerT;
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function interpolateOptional(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return undefined;
  const start = Number.isFinite(a) ? (a as number) : (b as number);
  const end = Number.isFinite(b) ? (b as number) : start;
  return start + (end - start) * t;
}
