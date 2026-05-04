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
