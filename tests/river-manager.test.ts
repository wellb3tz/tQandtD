import { describe, expect, it } from 'vitest';
import {
  createRiverCorridorPoints,
  createSmoothedRiverPoints,
  DEFAULT_RIVER_CONFIG,
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverFlow,
  getRiverValleyDepth,
  getRiverValleyWidth,
  getRiverWaterLevel,
  resampleRiverPointsSpline,
  type WorldRiverData,
} from '../src/gen/rivers';
import { RiverManager } from '../src/world/river-manager';
import { BiomeType } from '../src/world/chunk';

const alwaysPlain = () => BiomeType.PLAINS;

describe('RiverManager', () => {
  it('enriches raw corridor points without smoothing their route', () => {
    const points = createRiverCorridorPoints([
      { x: 0, y: 0, height: 0.72, surfaceLevel: 0.73, width: 1.6, depth: 0.03, flowX: 1, flowY: 0 },
      { x: 10, y: 4, height: 0.58, surfaceLevel: 0.59, width: 1.6, depth: 0.03, flowX: 1, flowY: 1 },
      { x: 2, y: 8, height: 0.42, surfaceLevel: 0.43, width: 1.6, depth: 0.03, flowX: -1, flowY: 1 },
    ]);

    expect(points[1].x).toBe(10);
    expect(points[1].y).toBe(4);
    expect(getRiverFlow(points.at(-1)!)).toBeGreaterThan(getRiverFlow(points[0]));
    expect(getRiverChannelWidth(points.at(-1)!)).toBeGreaterThan(getRiverChannelWidth(points[0]));
    expect(getRiverChannelDepth(points.at(-1)!)).toBeGreaterThan(getRiverChannelDepth(points[0]));
  });

  it('derives corridor fields with downstream growth and broader valleys', () => {
    const sourceRawDepth = 0.03;
    const points = createSmoothedRiverPoints([
      { x: 0, y: 0, height: 0.72, surfaceLevel: 0.73, width: 1.6, depth: sourceRawDepth, flowX: 1, flowY: 0 },
      { x: 1, y: 0, height: 0.66, surfaceLevel: 0.67, width: 1.8, depth: 0.035, flowX: 1, flowY: 0 },
      { x: 2, y: 1, height: 0.57, surfaceLevel: 0.58, width: 2.1, depth: 0.04, flowX: 1, flowY: 1 },
      { x: 3, y: 1, height: 0.42, surfaceLevel: 0.43, width: 2.4, depth: 0.045, flowX: 1, flowY: 0 },
    ]);

    expect(points.length).toBe(4);
    for (const point of points) {
      expect(getRiverChannelWidth(point)).toBeLessThan(getRiverValleyWidth(point));
    }
    expect(getRiverFlow(points.at(-1)!)).toBeGreaterThan(getRiverFlow(points[0]));
    expect(getRiverChannelDepth(points.at(-1)!)).toBeGreaterThanOrEqual(sourceRawDepth);
  });

  it('places river water level below banks and above the channel bed', () => {
    const points = createSmoothedRiverPoints([
      { x: 0, y: 0, height: 0.7, surfaceLevel: 0.71, width: 1.6, depth: 0.03, flowX: 1, flowY: 0 },
      { x: 1, y: 0, height: 0.64, surfaceLevel: 0.65, width: 1.8, depth: 0.035, flowX: 1, flowY: 0 },
      { x: 2, y: 0, height: 0.52, surfaceLevel: 0.53, width: 2.2, depth: 0.045, flowX: 1, flowY: 0 },
    ]);

    for (const point of points) {
      const waterLevel = getRiverWaterLevel(point);
      expect(waterLevel).toBeLessThan(point.surfaceLevel);
      expect(waterLevel).toBeGreaterThan(point.surfaceLevel - getRiverChannelDepth(point));
    }
  });

  it('keeps ocean mouth separate while main path reaches shoreline', () => {
    const seaStartsAtX = 18;
    const manager = new RiverManager(
      123,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => Math.max(0.31, 0.8 - x * 0.03),
      (x: number) => x >= seaStartsAtX ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const rivers = manager.getRiversForChunk(0, 0, 16);
    expect(rivers.length).toBeGreaterThan(0);
    const river = rivers[0];
    const mainPathEnd = river.mainPath.at(-1)!;

    expect(river.mouth.x).toBeGreaterThanOrEqual(seaStartsAtX);
    expect(mainPathEnd.x).toBeLessThan(seaStartsAtX);
    expect(mainPathEnd.height).toBeGreaterThan(0.3);
    expect(mainPathEnd).not.toMatchObject(river.mouth);
    expect(Math.hypot(mainPathEnd.x - river.mouth.x, mainPathEnd.y - river.mouth.y)).toBeLessThanOrEqual(Math.SQRT2);
  });

  it('rejects river mouths that reach ocean from a high coastal cliff', () => {
    const manager = new RiverManager(
      123,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => x >= 18 ? 0.28 : 0.72,
      (x: number) => x >= 18 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    expect(manager.getRiversForChunk(0, 0, 16)).toEqual([]);
  });

  it('rejects river mouths that run down a steep dry coastal wall before ocean', () => {
    const manager = new RiverManager(
      123,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => {
        if (x >= 19) return 0.28;
        if (x >= 15) return 0.72 - (x - 14) * 0.075;
        return 0.72;
      },
      (x: number) => x >= 19 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    expect(manager.getRiversForChunk(0, 0, 16)).toEqual([]);
  });

  it('allows river mouths that descend to a low shoreline before ocean', () => {
    const manager = new RiverManager(
      123,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => x >= 18 ? 0.28 : Math.max(0.32, 0.72 - x * 0.025),
      (x: number) => x >= 18 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const rivers = manager.getRiversForChunk(0, 0, 16);
    expect(rivers.length).toBeGreaterThan(0);
    expect(rivers[0].mainPath.at(-1)!.height).toBeLessThanOrEqual(0.44);
  });

  it('widens and deepens main corridor downstream', () => {
    const manager = new RiverManager(
      456,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => Math.max(0.2, 0.82 - x * 0.035),
      (x: number) => x >= 16 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const [river] = manager.getRiversForChunk(0, 0, 16);
    expect(river).toBeDefined();

    const first = river.mainPath[0];
    const last = river.mainPath.at(-1)!;
    expect(getRiverFlow(last)).toBeGreaterThan(getRiverFlow(first));
    expect(getRiverChannelWidth(last)).toBeGreaterThan(getRiverChannelWidth(first));
    expect(getRiverValleyWidth(last)).toBeGreaterThan(getRiverValleyWidth(first));
    expect(getRiverChannelDepth(last)).toBeGreaterThan(getRiverChannelDepth(first));
    expect(getRiverValleyDepth(last)).toBeGreaterThan(getRiverValleyDepth(first));
  });

  it('deduplicates nearby parallel routes in the same region', () => {
    const manager = new RiverManager(
      654,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 4,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => Math.max(0.2, 0.84 - x * 0.03),
      (x: number) => x >= 18 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const rivers = manager.getRiversForChunk(0, 0, 16);

    expect(rivers.length).toBeLessThanOrEqual(2);
  });

  it('turns a candidate that enters an occupied corridor into a tributary', () => {
    const manager = new RiverManager(
      246,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 0,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 4,
      },
      (x: number, y: number) => Math.max(0.32, 0.86 - x * 0.02 - y * 0.015),
      alwaysPlain,
    );
    const mainPath = createRiverCorridorPoints([
      { x: 8, y: 8, height: 0.58, surfaceLevel: 0.59, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
      { x: 20, y: 8, height: 0.42, surfaceLevel: 0.43, width: 2, depth: 0.04, flowX: 1, flowY: 0 },
    ]);
    const existing: WorldRiverData = {
      id: 'river_existing',
      mainPath,
      tributaries: [],
      source: { x: 8, y: 8 },
      mouth: { x: 20, y: 8 },
      bounds: { minX: 8, maxX: 20, minY: 8, maxY: 8 },
    };

    (manager as any).acceptRiver(existing);
    const standalone = (manager as any).traceMainRiver(0, 0);

    expect(standalone).toBeNull();
    expect(existing.tributaries).toHaveLength(1);
    expect(existing.tributaries[0].points.at(-1)!.y).toBeCloseTo(8);
    expect(existing.tributaries[0].connectsToRiverId).toBe(existing.id);
    expect(existing.tributaries[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('steers mature routes toward valid occupied corridors for natural confluences', () => {
    const manager = new RiverManager(
      248,
      {
        ...DEFAULT_RIVER_CONFIG,
        maxRiversPerRegion: 0,
        minRiverLength: 4,
        maxTributaries: 4,
      },
      () => 0.6,
      alwaysPlain,
    );
    const existing: WorldRiverData = {
      id: 'river_target',
      mainPath: createRiverCorridorPoints([
        { x: 1, y: 1, height: 0.6, surfaceLevel: 0.57, width: 2, depth: 0.03, flowX: 1, flowY: 0 },
        { x: 8, y: 1, height: 0.52, surfaceLevel: 0.5, width: 2, depth: 0.03, flowX: 1, flowY: 0 },
      ]),
      tributaries: [],
      source: { x: 1, y: 1 },
      mouth: { x: 8, y: 1 },
      bounds: { minX: 1, maxX: 8, minY: 1, maxY: 1 },
    };

    (manager as any).acceptRiver(existing);
    const next = (manager as any).chooseNextStep(0, 0, 0.6, 4);

    expect(next).toMatchObject({ x: 1, y: 1 });
  });

  it('detects sources already inside an occupied river corridor', () => {
    const manager = new RiverManager(
      247,
      { ...DEFAULT_RIVER_CONFIG, maxRiversPerRegion: 0 },
      () => 0.7,
      alwaysPlain,
    );
    const existing: WorldRiverData = {
      id: 'river_occupied',
      mainPath: createRiverCorridorPoints([
        { x: 4, y: 6, height: 0.7, surfaceLevel: 0.62, width: 2, depth: 0.03, flowX: 1, flowY: 0 },
        { x: 14, y: 6, height: 0.6, surfaceLevel: 0.52, width: 2, depth: 0.03, flowX: 1, flowY: 0 },
      ]),
      tributaries: [],
      source: { x: 4, y: 6 },
      mouth: { x: 14, y: 6 },
      bounds: { minX: 4, maxX: 14, minY: 6, maxY: 6 },
    };

    (manager as any).acceptRiver(existing);

    expect((manager as any).findOccupiedPoint(8, 6)).not.toBeNull();
    expect((manager as any).findOccupiedPoint(8, 14)).toBeNull();
  });

  it('does not invalidate rivers returned for earlier chunks after later exploration', () => {
    const config = {
      ...DEFAULT_RIVER_CONFIG,
      sourceThreshold: -1,
      maxRiversPerRegion: 1,
      minRiverLength: 4,
      maxLength: 128,
      maxTributaries: 0,
    };
    const height = (x: number) => Math.max(0.2, 0.84 - x * 0.01);
    const biome = (x: number) => x >= 64 ? BiomeType.OCEAN : BiomeType.PLAINS;
    const makeManager = () => new RiverManager(987, config, height, biome);
    const snapshotChunkRivers = (manager: RiverManager, chunkX: number) =>
      manager.getRiversForChunk(chunkX, 0, 16)
        .map(river => ({
          id: river.id,
          path: river.mainPath.map(point => [point.x, point.y]),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const snapshotAcceptedIds = (manager: RiverManager) =>
      Array.from((manager as any).rivers.keys()).sort();

    const westThenEast = makeManager();
    const westBeforeEast = snapshotChunkRivers(westThenEast, 0);
    const eastAfterInitialWest = snapshotChunkRivers(westThenEast, 3);
    const westAfterEast = snapshotChunkRivers(westThenEast, 0);

    const eastThenWest = makeManager();
    const eastBeforeWest = snapshotChunkRivers(eastThenWest, 3);
    const acceptedBeforeWest = snapshotAcceptedIds(eastThenWest);
    snapshotChunkRivers(eastThenWest, 0);
    const acceptedAfterWest = snapshotAcceptedIds(eastThenWest);

    expect(westBeforeEast.length).toBeGreaterThan(0);
    expect(eastAfterInitialWest.length).toBeGreaterThan(0);
    expect(westAfterEast).toEqual(westBeforeEast);
    expect(eastBeforeWest.length).toBeGreaterThan(0);
    expect(acceptedAfterWest).toEqual(expect.arrayContaining(acceptedBeforeWest));
    expect('riverCandidates' in (eastThenWest as any)).toBe(false);
  });

  it('is deterministic for the same seed and callbacks', () => {
    const make = () => new RiverManager(
      999,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 64,
        maxTributaries: 0,
      },
      (x: number) => Math.max(0.2, 0.8 - x * 0.03),
      alwaysPlain,
    );

    const a = make().getRiversForChunk(0, 0, 16).map(r => r.mainPath.map(p => [p.x, p.y]));
    const b = make().getRiversForChunk(0, 0, 16).map(r => r.mainPath.map(p => [p.x, p.y]));
    expect(a).toEqual(b);
  });

  it('discards routes that cannot reach ocean within maxLength', () => {
    const manager = new RiverManager(
      123,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: -1,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 12,
        maxTributaries: 0,
      },
      () => 0.7,
      () => BiomeType.PLAINS,
    );

    expect(manager.getRiversForChunk(0, 0, 16)).toEqual([]);
  });

  it('does not create synthetic tributary ribbons in corridor mode', () => {
    const manager = new RiverManager(
      321,
      {
        ...DEFAULT_RIVER_CONFIG,
        sourceThreshold: 0,
        maxRiversPerRegion: 1,
        minRiverLength: 4,
        maxLength: 96,
        maxTributaries: 2,
      },
      (x: number, y: number) => Math.max(0.2, 0.85 - x * 0.025 + Math.abs(y - 8) * 0.004),
      (x: number) => x >= 24 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const rivers = manager.getRiversForChunk(0, 0, 16);
    expect(rivers.length).toBeGreaterThan(0);
    expect(rivers[0].tributaries).toEqual([]);
  });

  it('returns cached rivers whose valley influence reaches the chunk outside bank width', () => {
    const config = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 2, maxRiversPerRegion: 0 };
    const manager = new RiverManager(
      111,
      config,
      () => 0.7,
      alwaysPlain,
    );
    const worldRiver: WorldRiverData = {
      id: 'river_wide_valley',
      mainPath: [
        {
          x: 4,
          y: 8,
          height: 0.7,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          channelWidth: 2,
          valleyWidth: 16,
          channelDepth: 0.04,
          valleyDepth: 0.08,
          flowX: 1,
          flowY: 0,
        },
        {
          x: 12,
          y: 8,
          height: 0.7,
          surfaceLevel: 0.62,
          width: 2,
          depth: 0.02,
          channelWidth: 2,
          valleyWidth: 16,
          channelDepth: 0.04,
          valleyDepth: 0.08,
          flowX: 1,
          flowY: 0,
        },
      ],
      tributaries: [],
      source: { x: 4, y: 8 },
      mouth: { x: 12, y: 8 },
      bounds: { minX: 4, maxX: 12, minY: 8, maxY: 8 },
    };

    (manager as any).rivers.set(worldRiver.id, worldRiver);

    expect(manager.getRiversForChunk(1, 0, 16).map(river => river.id)).toContain(worldRiver.id);
  });
});

describe('resampleRiverPointsSpline', () => {
  const makePoints = (): Parameters<typeof resampleRiverPointsSpline>[0] => [
    { x: 0, y: 0, height: 0.72, surfaceLevel: 0.73, width: 1.6, depth: 0.03, flowX: 1, flowY: 0 },
    { x: 2, y: 0, height: 0.66, surfaceLevel: 0.67, width: 1.8, depth: 0.035, flowX: 1, flowY: 0 },
    { x: 4, y: 2, height: 0.57, surfaceLevel: 0.58, width: 2.1, depth: 0.04, flowX: 1, flowY: 1 },
    { x: 6, y: 2, height: 0.42, surfaceLevel: 0.43, width: 2.4, depth: 0.045, flowX: 1, flowY: 0 },
  ];

  it('returns original points when density is 0', () => {
    const original = makePoints();
    const result = resampleRiverPointsSpline(original, 0);
    expect(result).toHaveLength(original.length);
    expect(result.map(p => [p.x, p.y])).toEqual(original.map(p => [p.x, p.y]));
  });

  it('returns original points when fewer than 2 points are given', () => {
    const single = [makePoints()[0]];
    const result = resampleRiverPointsSpline(single, 1);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(single[0].x);
  });

  it('increases point count with spline density', () => {
    const original = makePoints();
    const result = resampleRiverPointsSpline(original, 1);
    expect(result.length).toBeGreaterThan(original.length);
  });

  it('produces smooth curves that deviate from straight segments', () => {
    const original = makePoints();
    const result = resampleRiverPointsSpline(original, 2);

    // Find a point that should curve inward between (2,0) and (4,2)
    const midIndex = Math.floor(result.length / 2);
    const mid = result[midIndex];

    // The spline should produce a point whose y is between the straight-line
    // interpolation and the actual control polygon
    expect(mid.y).toBeGreaterThanOrEqual(0);
    expect(mid.y).toBeLessThanOrEqual(2.5);
  });

  it('preserves start and end points', () => {
    const original = makePoints();
    const result = resampleRiverPointsSpline(original, 2);
    const start = result[0];
    const end = result[result.length - 1];

    expect(start.x).toBeCloseTo(original[0].x, 3);
    expect(start.y).toBeCloseTo(original[0].y, 3);
    expect(end.x).toBeCloseTo(original[original.length - 1].x, 3);
    expect(end.y).toBeCloseTo(original[original.length - 1].y, 3);
  });

  it('derives flow direction for interpolated points', () => {
    const original = makePoints();
    const result = resampleRiverPointsSpline(original, 2);

    // At least some interior points should have non-zero flow
    const interior = result.slice(1, -1);
    const hasFlow = interior.some(p => p.flowX !== 0 || p.flowY !== 0);
    expect(hasFlow).toBe(true);
  });
});
