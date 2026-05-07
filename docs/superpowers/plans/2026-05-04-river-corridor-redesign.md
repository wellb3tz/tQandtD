# River Corridor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace strip-rendered rivers with terrain-first river corridors: carved valleys and recessed channels with narrow water contained inside them.

**Architecture:** Add corridor-oriented river data and helper profiles in `src/gen/rivers.ts`, generate corridor fields in `src/world/river-manager.ts`, carve terrain through those corridor fields in `src/world/chunk-manager.ts`, and render only channel-contained water in `demo/src/viewer/water/RiverMeshGenerator.ts`. Synthetic tributary ribbons are disabled; close candidate routes are merged or skipped.

**Tech Stack:** TypeScript, Vitest, Three.js `BufferGeometry`, existing `ChunkManager`, existing worker serialization, existing demo water layer.

---

## File Structure

- `src/gen/rivers.ts`: River corridor types, default config fields, smoothing/taper/profile helpers, water-level helpers.
- `src/world/river-manager.ts`: deterministic source selection, downhill route tracing, candidate de-duplication/merge, corridor field generation.
- `src/world/chunk-manager.ts`: world-to-chunk corridor conversion and corridor-based terrain carving.
- `src/worker.ts`: worker serialization/deserialization for corridor fields.
- `src/index.ts`: public exports for new corridor helpers/types.
- `demo/src/viewer/water/RiverMeshGenerator.ts`: channel-contained river water mesh.
- `demo/src/viewer/water/RiverMeshGenerator.test.ts`: water geometry constraints.
- `tests/river-manager.test.ts`: deterministic corridor generation, ocean mouth, no synthetic tributaries, route rejection/merge.
- `tests/chunk-manager.test.ts`: valley/channel carving behavior.
- `tests/serialization.test.ts`: persistence of corridor fields.
- `tests/worker.test.ts`: worker transfer of corridor fields.

---

### Task 1: Add Corridor Types And Profile Helpers

**Files:**
- Modify: `src/gen/rivers.ts`
- Modify: `src/index.ts`
- Test: `tests/river-manager.test.ts`

- [ ] **Step 1: Write failing tests for corridor helper shape**

Add this import in `tests/river-manager.test.ts`:

```ts
import {
  DEFAULT_RIVER_CONFIG,
  createSmoothedRiverPoints,
  getRiverWaterLevel,
  type RiverPoint,
} from '../src/gen/rivers';
```

Replace any duplicate `DEFAULT_RIVER_CONFIG` import with the combined import above.

Add these tests inside `describe('RiverManager', () => { ... })`:

```ts
it('derives corridor fields with channel narrower than valley', () => {
  const points: RiverPoint[] = [
    { x: 0, y: 0, height: 0.7, surfaceLevel: 0.71, width: 1.4, depth: 0.12, flowX: 1, flowY: 0 },
    { x: 4, y: 0, height: 0.6, surfaceLevel: 0.61, width: 1.4, depth: 0.12, flowX: 1, flowY: 0 },
    { x: 8, y: 0, height: 0.5, surfaceLevel: 0.51, width: 1.4, depth: 0.12, flowX: 1, flowY: 0 },
  ];

  const smoothed = createSmoothedRiverPoints(points);
  expect(smoothed.length).toBeGreaterThan(points.length);
  expect(smoothed[0].channelWidth).toBeLessThan(smoothed[0].valleyWidth);
  expect(smoothed.at(-1)!.flow).toBeGreaterThan(smoothed[0].flow);
  expect(smoothed.at(-1)!.channelDepth).toBeGreaterThanOrEqual(smoothed[0].channelDepth);
});

it('keeps river water below banks and above the bed', () => {
  const point = {
    x: 4,
    y: 0,
    height: 0.6,
    surfaceLevel: 0.61,
    width: 1.4,
    depth: 0.12,
    flowX: 1,
    flowY: 0,
    flow: 0.7,
    channelWidth: 1.2,
    valleyWidth: 7,
    channelDepth: 0.18,
    valleyDepth: 0.08,
  };

  const water = getRiverWaterLevel(point);
  expect(water).toBeLessThan(point.surfaceLevel);
  expect(water).toBeGreaterThan(point.surfaceLevel - point.channelDepth);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/river-manager.test.ts
```

Expected: FAIL because `channelWidth`, `valleyWidth`, `flow`, `channelDepth`, and `valleyDepth` do not exist on `RiverPoint`.

- [ ] **Step 3: Extend river types**

In `src/gen/rivers.ts`, extend `RiverPoint`:

```ts
export interface RiverPoint {
  x: number;
  y: number;
  height: number;
  surfaceLevel: number;
  width: number;
  depth: number;
  flowX: number;
  flowY: number;
  flow?: number;
  channelWidth?: number;
  valleyWidth?: number;
  channelDepth?: number;
  valleyDepth?: number;
}
```

Add helper functions after `DEFAULT_RIVER_CONFIG`:

```ts
export function getRiverFlow(point: RiverPoint, fallback = 0.35): number {
  return clamp01(point.flow ?? fallback);
}

export function getRiverChannelWidth(point: RiverPoint): number {
  return point.channelWidth ?? Math.max(0.45, point.width * 0.7);
}

export function getRiverValleyWidth(point: RiverPoint): number {
  return point.valleyWidth ?? Math.max(getRiverChannelWidth(point) * 3.5, point.width * 4.2);
}

export function getRiverChannelDepth(point: RiverPoint): number {
  return point.channelDepth ?? Math.max(point.depth, 0.1);
}

export function getRiverValleyDepth(point: RiverPoint): number {
  return point.valleyDepth ?? Math.max(getRiverChannelDepth(point) * 0.45, 0.045);
}

export function getRiverWaterLevel(point: RiverPoint): number {
  return Math.max(0, point.surfaceLevel - getRiverChannelDepth(point) * 0.38);
}

function enrichCorridorPoint(point: RiverPoint, index: number, total: number): RiverPoint {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const flow = Math.max(0.15, Math.min(1, 0.2 + progress * 0.8));
  const taper = sourceTaper(index, total);
  const channelWidth = Math.max(0.35, point.width * (0.45 + flow * 0.65) * taper);
  const valleyWidth = Math.max(channelWidth * 4.5, point.width * (3.8 + flow * 3.2));
  const channelDepth = Math.max(point.depth, point.depth * (1.0 + flow * 0.9));
  const valleyDepth = Math.max(point.depth * 0.55, channelDepth * 0.45);

  return {
    ...point,
    flow,
    width: channelWidth,
    channelWidth,
    valleyWidth,
    channelDepth,
    valleyDepth,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
```

In `createSmoothedRiverPoints`, wrap the pushed object with `enrichCorridorPoint`:

```ts
const point = {
  x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
  y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
  height: lerp(p1.height, p2.height, t),
  surfaceLevel: lerp(p1.surfaceLevel, p2.surfaceLevel, t),
  width: lerp(p1.width, p2.width, t),
  depth: lerp(p1.depth, p2.depth, t),
  flowX: lerp(p1.flowX, p2.flowX, t),
  flowY: lerp(p1.flowY, p2.flowY, t),
};

result.push(enrichCorridorPoint(point, i, samples));
```

For `points.length <= 2`, return enriched copies:

```ts
if (points.length <= 2) {
  return points.map((point, index) => enrichCorridorPoint(point, index, points.length));
}
```

- [ ] **Step 4: Export helpers**

In `src/index.ts`, add exports from `./gen/rivers`:

```ts
getRiverChannelDepth,
getRiverChannelWidth,
getRiverFlow,
getRiverValleyDepth,
getRiverValleyWidth,
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```powershell
npm test -- tests/river-manager.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/gen/rivers.ts src/index.ts tests/river-manager.test.ts
git commit -m "feat: add river corridor profile helpers"
```

---

### Task 2: Generate Corridor Fields And Disable Synthetic Tributaries

**Files:**
- Modify: `src/world/river-manager.ts`
- Modify: `src/gen/rivers.ts`
- Test: `tests/river-manager.test.ts`

- [ ] **Step 1: Write failing tests for no synthetic tributaries and downstream growth**

Add tests in `tests/river-manager.test.ts`:

```ts
it('does not create synthetic tributary ribbons in corridor mode', () => {
  const manager = new RiverManager(
    321,
    {
      ...DEFAULT_RIVER_CONFIG,
      sourceThreshold: 0,
      maxRiversPerRegion: 1,
      minRiverLength: 4,
      maxLength: 96,
      maxTributaries: 3,
    },
    (x: number, y: number) => Math.max(0.2, 0.85 - x * 0.025 + Math.abs(y - 8) * 0.004),
    (x: number) => x >= 24 ? BiomeType.OCEAN : BiomeType.PLAINS,
  );

  const rivers = manager.getRiversForChunk(0, 0, 16);
  expect(rivers.length).toBeGreaterThan(0);
  expect(rivers[0].tributaries).toEqual([]);
});

it('widens and deepens main corridor downstream', () => {
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
    (x: number) => Math.max(0.2, 0.82 - x * 0.03),
    (x: number) => x >= 18 ? BiomeType.OCEAN : BiomeType.PLAINS,
  );

  const river = manager.getRiversForChunk(0, 0, 16)[0];
  const first = river.mainPath[0];
  const last = river.mainPath.at(-1)!;
  expect(last.flow ?? 0).toBeGreaterThan(first.flow ?? 0);
  expect(last.channelWidth ?? 0).toBeGreaterThan(first.channelWidth ?? 0);
  expect(last.channelDepth ?? 0).toBeGreaterThanOrEqual(first.channelDepth ?? 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/river-manager.test.ts
```

Expected: FAIL because `createTributaries` still creates synthetic tributaries and raw main path points do not have corridor fields.

- [ ] **Step 3: Add a public corridor enrichment helper**

In `src/gen/rivers.ts`, add:

```ts
export function createRiverCorridorPoints(points: RiverPoint[]): RiverPoint[] {
  return points.map((point, index) => enrichCorridorPoint(point, index, points.length));
}
```

Export it from `src/index.ts`.

- [ ] **Step 4: Enrich main path in river manager**

In `src/world/river-manager.ts`, change import:

```ts
import { createRiverCorridorPoints, type RiverConfig, type RiverPath, type RiverPoint, type WorldRiverData } from '../gen/rivers';
```

In `createRiver`, replace:

```ts
const source = points[0];
const mouth = mouthPoint ?? points[points.length - 1];
const id = `river_${source.x}_${source.y}_${mouth.x}_${mouth.y}`;
const tributaries = this.createTributaries(id, points);
const bounds = this.boundsForPoints([...points, ...tributaries.flatMap(tributary => tributary.points)]);
```

with:

```ts
const corridorPoints = createRiverCorridorPoints(points);
const source = corridorPoints[0];
const mouth = mouthPoint ?? corridorPoints[corridorPoints.length - 1];
const id = `river_${source.x}_${source.y}_${mouth.x}_${mouth.y}`;
const tributaries: RiverPath[] = [];
const bounds = this.boundsForPoints(corridorPoints);
```

Return `mainPath: corridorPoints`.

- [ ] **Step 5: Remove synthetic tributary use**

Leave `createTributaries` and `traceTributary` in place only if other code still references them. If TypeScript reports unused private methods are allowed, keep them for the next cleanup task. If lint/typecheck complains, delete both private methods in the same commit.

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- tests/river-manager.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/gen/rivers.ts src/index.ts src/world/river-manager.ts tests/river-manager.test.ts
git commit -m "feat: generate river corridor fields"
```

---

### Task 3: Carve Broad Valleys And Recessed Channels

**Files:**
- Modify: `src/world/chunk-manager.ts`
- Test: `tests/chunk-manager.test.ts`

- [ ] **Step 1: Write failing valley-profile tests**

Add imports in `tests/chunk-manager.test.ts`:

```ts
import { getRiverChannelDepth, getRiverValleyWidth } from '../src/gen/rivers';
```

Add this test in `describe('ChunkManager rivers', () => { ... })`:

```ts
it('carves a broad valley around a deeper central channel', () => {
  const config = makeMinimalConfig(42);
  config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
  config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true, carveBankWidth: 3.2 };
  const manager = new ChunkManager(config);
  const centerPoint = {
    x: 8,
    y: 8,
    height: 0.72,
    surfaceLevel: 0.72,
    width: 1.4,
    depth: 0.12,
    flowX: 1,
    flowY: 0,
    flow: 0.8,
    channelWidth: 1.4,
    valleyWidth: 8,
    channelDepth: 0.22,
    valleyDepth: 0.1,
  };
  const worldRiver: WorldRiverData = {
    id: 'river_valley',
    mainPath: [
      { ...centerPoint, x: 3 },
      centerPoint,
      { ...centerPoint, x: 13 },
    ],
    tributaries: [],
    source: { x: 3, y: 8 },
    mouth: { x: 13, y: 8 },
    bounds: { minX: 3, maxX: 13, minY: 8, maxY: 8 },
  };

  (manager as any).riverManager = {
    getRiversForChunk: () => [worldRiver],
    notifyChunkEvicted: () => undefined,
    clear: () => undefined,
  };

  const chunk = manager.generateChunk(0, 0);
  const vertexSize = chunk.size + 1;
  const center = chunk.heightmap[8 * vertexSize + 8];
  const innerBank = chunk.heightmap[10 * vertexSize + 8];
  const outerValley = chunk.heightmap[12 * vertexSize + 8];
  const untouched = chunk.heightmap[16 * vertexSize + 8];

  expect(center).toBeLessThan(centerPoint.surfaceLevel - getRiverChannelDepth(centerPoint) * 0.7);
  expect(innerBank).toBeGreaterThan(center);
  expect(innerBank).toBeLessThan(untouched);
  expect(outerValley).toBeLessThanOrEqual(untouched);
  expect(getRiverValleyWidth(centerPoint)).toBeGreaterThan(centerPoint.channelWidth * 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/chunk-manager.test.ts
```

Expected: FAIL because current carving uses a narrow single-depth profile.

- [ ] **Step 3: Update imports in chunk manager**

In `src/world/chunk-manager.ts`, import corridor helpers:

```ts
import {
  DEFAULT_RIVER_CONFIG,
  createSmoothedRiverPoints,
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverValleyDepth,
  getRiverValleyWidth,
  type RiverConfig,
  type RiverData,
  type RiverPoint,
  type WorldRiverData,
} from '../gen/rivers';
```

- [ ] **Step 4: Replace single-width carving profile**

In `carveTerrainForRivers`, replace the body after `const sample = this.closestRiverSample(...)` with:

```ts
const channelWidth = getRiverChannelWidth(sample);
const valleyWidth = Math.max(getRiverValleyWidth(sample), bankDefault);
if (sample.distance > valleyWidth) continue;

const channelDepth = getRiverChannelDepth(sample);
const valleyDepth = getRiverValleyDepth(sample);
const index = y * vertexSize + x;

const channelT = 1 - Math.min(sample.distance / Math.max(channelWidth * 0.5, 0.001), 1);
const channelFalloff = channelT * channelT * (3 - 2 * channelT);
const valleyT = 1 - Math.min(sample.distance / valleyWidth, 1);
const valleyFalloff = valleyT * valleyT * (3 - 2 * valleyT);

const channelTarget = Math.max(0, sample.surfaceLevel - channelDepth);
const valleyTarget = Math.max(0, sample.surfaceLevel - valleyDepth * valleyFalloff);
const target = Math.min(
  heightmap[index] * (1 - valleyFalloff) + valleyTarget * valleyFalloff,
  heightmap[index] * (1 - channelFalloff) + channelTarget * channelFalloff
);
heightmap[index] = Math.min(heightmap[index], target);
```

- [ ] **Step 5: Extend closest sample return type**

Change `closestRiverSample` return type:

```ts
): (RiverPoint & { distance: number }) | null {
```

Change `sample` construction to preserve corridor fields:

```ts
const sample = {
  ...a,
  x: px,
  y: py,
  distance,
  height: a.height + (b.height - a.height) * t,
  surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * t,
  depth: a.depth + (b.depth - a.depth) * t,
  width: a.width + (b.width - a.width) * t,
  flow: (a.flow ?? 0.35) + ((b.flow ?? 0.35) - (a.flow ?? 0.35)) * t,
  channelWidth: (a.channelWidth ?? a.width) + ((b.channelWidth ?? b.width) - (a.channelWidth ?? a.width)) * t,
  valleyWidth: (a.valleyWidth ?? a.width * 4) + ((b.valleyWidth ?? b.width * 4) - (a.valleyWidth ?? a.width * 4)) * t,
  channelDepth: (a.channelDepth ?? a.depth) + ((b.channelDepth ?? b.depth) - (a.channelDepth ?? a.depth)) * t,
  valleyDepth: (a.valleyDepth ?? a.depth * 0.5) + ((b.valleyDepth ?? b.depth * 0.5) - (a.valleyDepth ?? a.depth * 0.5)) * t,
};
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- tests/chunk-manager.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/world/chunk-manager.ts tests/chunk-manager.test.ts
git commit -m "feat: carve river corridors into terrain"
```

---

### Task 4: Render Channel-Contained Water, Not Full Strip Water

**Files:**
- Modify: `demo/src/viewer/water/RiverMeshGenerator.ts`
- Test: `demo/src/viewer/water/RiverMeshGenerator.test.ts`

- [ ] **Step 1: Write failing water geometry tests**

Add imports:

```ts
import { getRiverChannelWidth, getRiverValleyWidth } from '../../../../src/gen/rivers';
```

Add test:

```ts
it('uses channel width for water and never valley width', () => {
  const points: RiverData['points'] = [
    {
      x: 0,
      y: 1,
      height: 0.6,
      surfaceLevel: 0.61,
      width: 1.4,
      depth: 0.12,
      flowX: 1,
      flowY: 0,
      flow: 0.4,
      channelWidth: 1.1,
      valleyWidth: 8,
      channelDepth: 0.16,
      valleyDepth: 0.08,
    },
    {
      x: 4,
      y: 1,
      height: 0.5,
      surfaceLevel: 0.51,
      width: 1.8,
      depth: 0.12,
      flowX: 1,
      flowY: 0,
      flow: 0.8,
      channelWidth: 1.6,
      valleyWidth: 10,
      channelDepth: 0.2,
      valleyDepth: 0.1,
    },
  ];

  const geometry = buildRiverGeometry([river(points)], 0, 0, 16)!;
  const positions = geometry.getAttribute('position').array;
  const firstLeftZ = positions[2];
  const firstRightZ = positions[5];
  const renderedWidth = Math.abs(firstLeftZ - firstRightZ);

  expect(renderedWidth).toBeLessThan(getRiverValleyWidth(points[0]) * 0.35);
  expect(renderedWidth).toBeCloseTo(getRiverChannelWidth(points[0]), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- demo/src/viewer/water/RiverMeshGenerator.test.ts
```

Expected: FAIL if renderer still uses `point.width` without corridor channel helpers.

- [ ] **Step 3: Update renderer imports**

In `demo/src/viewer/water/RiverMeshGenerator.ts`, import:

```ts
import {
  createSmoothedRiverPoints,
  getRiverChannelWidth,
  getRiverWaterLevel,
  type RiverData,
} from '../../../../src/gen/rivers';
```

- [ ] **Step 4: Use channel width**

Replace:

```ts
const halfWidth = point.width * 0.5;
```

with:

```ts
const halfWidth = getRiverChannelWidth(point) * 0.5;
```

- [ ] **Step 5: Keep water recessed**

Keep this vertical placement:

```ts
const y = getRiverWaterLevel(point) * HEIGHT_SCALE + 0.04;
```

If the line differs, replace it with the line above.

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- demo/src/viewer/water/RiverMeshGenerator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add demo/src/viewer/water/RiverMeshGenerator.ts demo/src/viewer/water/RiverMeshGenerator.test.ts
git commit -m "feat: render water inside river channels"
```

---

### Task 5: Preserve Corridor Fields In Worker And Serialization

**Files:**
- Modify: `src/worker.ts`
- Test: `tests/serialization.test.ts`
- Test: `tests/worker.test.ts`

- [ ] **Step 1: Write failing serialization test**

In `tests/serialization.test.ts`, find the river serialization tests and add:

```ts
it('preserves river corridor fields through JSON serialization', async () => {
  const config = makeMinimalConfig(42);
  config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: true };
  const manager = new ChunkManager(config);
  const chunk = manager.generateChunk(0, 0);
  chunk.rivers = [{
    riverId: 'river_corridor',
    pathId: 'river_corridor:main',
    isTributary: false,
    points: [{
      x: 1,
      y: 1,
      height: 0.6,
      surfaceLevel: 0.61,
      width: 1.2,
      depth: 0.12,
      flowX: 1,
      flowY: 0,
      flow: 0.7,
      channelWidth: 1.4,
      valleyWidth: 8,
      channelDepth: 0.2,
      valleyDepth: 0.1,
    }],
    bounds: { minX: 1, maxX: 1, minY: 1, maxY: 1 },
  }];

  const json = manager.exportWorld({ format: SerializationFormat.JSON, compress: false, modifiedOnly: false });
  const parsed = JSON.parse(json as string);
  const riverPoint = parsed.chunks[0].data.rivers[0].points[0];
  expect(riverPoint.channelWidth).toBe(1.4);
  expect(riverPoint.valleyWidth).toBe(8);
  expect(riverPoint.channelDepth).toBe(0.2);
  expect(riverPoint.valleyDepth).toBe(0.1);
  expect(riverPoint.flow).toBe(0.7);
});
```

Use existing imports in the file for `ChunkManager`, `DEFAULT_RIVER_CONFIG`, `SerializationFormat`, and `makeMinimalConfig`. If any are missing, add them from the same paths already used by nearby tests.

- [ ] **Step 2: Write failing worker test**

In `tests/worker.test.ts`, add an assertion to the existing generated chunk test:

```ts
for (const river of result.chunk.rivers ?? []) {
  for (const point of river.points) {
    expect(point.channelWidth).toBeDefined();
    expect(point.valleyWidth).toBeDefined();
    expect(point.channelDepth).toBeDefined();
    expect(point.valleyDepth).toBeDefined();
  }
}
```

- [ ] **Step 3: Run tests to verify fail**

Run:

```powershell
npm test -- tests/serialization.test.ts tests/worker.test.ts
```

Expected: FAIL if worker serialization drops corridor fields.

- [ ] **Step 4: Update worker serialized point shape**

In `src/worker.ts`, find the serialized river point type and add:

```ts
flow?: number;
channelWidth?: number;
valleyWidth?: number;
channelDepth?: number;
valleyDepth?: number;
```

Ensure both serialization and deserialization use object spread for points:

```ts
points: river.points.map(point => ({ ...point })),
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- tests/serialization.test.ts tests/worker.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/worker.ts tests/serialization.test.ts tests/worker.test.ts
git commit -m "feat: preserve river corridor fields"
```

---

### Task 6: Reject Close Parallel Candidate Routes

**Files:**
- Modify: `src/world/river-manager.ts`
- Test: `tests/river-manager.test.ts`

- [ ] **Step 1: Write failing route de-duplication test**

Add:

```ts
it('skips close parallel river candidates in the same region', () => {
  const manager = new RiverManager(
    123,
    {
      ...DEFAULT_RIVER_CONFIG,
      sourceThreshold: -1,
      maxRiversPerRegion: 4,
      minRiverLength: 4,
      maxLength: 64,
      maxTributaries: 0,
    },
    (x: number) => Math.max(0.2, 0.82 - x * 0.03),
    (x: number) => x >= 18 ? BiomeType.OCEAN : BiomeType.PLAINS,
  );

  const rivers = manager.getRiversForChunk(0, 0, 16);
  expect(rivers.length).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/river-manager.test.ts
```

Expected: FAIL if every nearby source creates a separate parallel river.

- [ ] **Step 3: Add candidate route rejection**

In `src/world/river-manager.ts`, add:

```ts
private isTooCloseToExistingRiver(points: RiverPoint[]): boolean {
  for (const existing of this.rivers.values()) {
    for (const point of points) {
      for (const existingPoint of existing.mainPath) {
        if (Math.hypot(point.x - existingPoint.x, point.y - existingPoint.y) <= this.config.carveBankWidth * 1.5) {
          return true;
        }
      }
    }
  }

  return false;
}
```

In `traceMainRiver`, when ocean is reached and before `return this.createRiver(points, mouth);`, add:

```ts
if (this.isTooCloseToExistingRiver(points)) return null;
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm test -- tests/river-manager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/world/river-manager.ts tests/river-manager.test.ts
git commit -m "feat: reject parallel river corridors"
```

---

### Task 7: Final Verification And Demo Cleanup

**Files:**
- Modify if needed: `demo/src/viewer/water/config.ts`
- Modify if needed: `src/gen/rivers.ts`

- [ ] **Step 1: Run full unit test suite**

Run:

```powershell
npm test
```

Expected: all non-skipped tests pass.

- [ ] **Step 2: Run engine build**

Run:

```powershell
npm run build
```

Expected: TypeScript build succeeds.

- [ ] **Step 3: Run demo build**

Run:

```powershell
npm run build:demo
```

Expected: Vite demo build succeeds.

- [ ] **Step 4: Start demo server**

Run:

```powershell
Start-Process -FilePath npm.cmd -ArgumentList 'run','demo','--','--host','127.0.0.1' -WorkingDirectory 'C:\Intel\tQandtD' -WindowStyle Hidden -RedirectStandardOutput 'C:\Intel\tQandtD\vite-demo.log' -RedirectStandardError 'C:\Intel\tQandtD\vite-demo.err.log'
```

Expected: `http://127.0.0.1:3000/` returns status `200`.

- [ ] **Step 5: Manual visual checklist**

Inspect several coastal/mountain regions in the demo. Accept the slice only if all checks are true:

- Rivers are readable as valleys with water inside them.
- No bright full-width blue ribbons sit on top of terrain.
- River mouths do not continue as stripes into ocean.
- River sources taper without square caps.
- Close rivers do not form bundles of parallel artificial channels.
- Disabling water still leaves a visible dry valley/channel.

- [ ] **Step 6: Commit verification adjustments**

If Steps 1-5 required small config/material tweaks, commit them:

```powershell
git add src/gen/rivers.ts demo/src/viewer/water/config.ts
git commit -m "tune river corridor visuals"
```

If no tweaks were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: corridor data is Task 1, generation and no fake tributaries are Tasks 2 and 6, terrain-first carving is Task 3, channel-contained water is Task 4, serialization/worker preservation is Task 5, demo verification is Task 7.
- Type consistency: corridor fields are optional on `RiverPoint` so existing tests and transitional data still compile; helpers centralize default behavior.
- Migration scope: this plan replaces the strip visual path for demo output while keeping the existing route tracer as the first source of centerlines.


