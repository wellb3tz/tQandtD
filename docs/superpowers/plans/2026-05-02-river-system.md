# River System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic terrain-aware rivers with simple tributaries that carve channels, cross chunk boundaries, render as water, serialize, and terminate in the ocean.

**Architecture:** Add `RiverManager` beside `LakeManager`, storing rivers in world-space and exposing chunk-local `RiverData[]` through `ChunkManager`. Integrate rivers after lakes and before resources/structures, then add a river water mesh path in the demo water layer.

**Tech Stack:** TypeScript, Vitest, Three.js, Vite demo, existing procedural engine modules.

---

## File Structure

- Create `src/gen/rivers.ts`: public river types, `RiverConfig`, `DEFAULT_RIVER_CONFIG`.
- Create `src/world/river-manager.ts`: world-space source selection, route tracing, tributaries, cache, chunk intersection.
- Modify `src/world/chunk.ts`: add `RiverData` import and `rivers?: RiverData[]`.
- Modify `src/world/chunk-manager.ts`: initialize `RiverManager`, generate chunk-local rivers, carve river channels, clear river cache.
- Modify `src/world/serialization.ts`: add serialized river shapes to JSON/binary chunk persistence.
- Modify `src/world/worker-pool.ts` and `src/worker.ts`: preserve river data across worker boundaries.
- Modify `src/utils/validation.ts`: validate `riverConfig`.
- Modify `src/utils/errors.ts`: add `RiverGenerationError`.
- Modify `src/utils/logger.ts`: add `LogCategory.RIVER`.
- Modify `src/index.ts`: export river types and manager.
- Create `tests/river-manager.test.ts`: focused manager tests with synthetic height/biome callbacks.
- Modify `tests/chunk-manager.test.ts`, `tests/determinism.test.ts`, `tests/serialization.test.ts`, `tests/validation.test.ts`, `tests/worker.test.ts`.
- Create `demo/src/viewer/water/RiverMeshGenerator.ts` and `demo/src/viewer/water/RiverMeshGenerator.test.ts`.
- Modify `demo/src/viewer/water/types.ts`, `config.ts`, `WaterLayerManager.ts`, `index.ts`.
- Modify `demo/src/ui/ControlPanel.ts` and `demo/src/core/DemoApp.ts` only for minimal config exposure.

---

### Task 1: River Types And Config

**Files:**
- Create: `src/gen/rivers.ts`
- Modify: `src/world/chunk.ts`
- Modify: `src/world/chunk-manager.ts`
- Modify: `src/utils/validation.ts`
- Modify: `src/index.ts`
- Test: `tests/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add this block to `tests/validation.test.ts` after the lake configuration tests:

```ts
  describe('River configuration', () => {
    it('rejects invalid source elevation range', () => {
      const config = makeMinimalConfig(12345);
      config.riverConfig = {
        enabled: true,
        sourceNoiseScale: 0.006,
        sourceThreshold: 0.72,
        minSourceElevation: 0.8,
        maxSourceElevation: 0.5,
        allowedSourceBiomes: [BiomeType.MOUNTAIN],
        maxLength: 512,
        maxUphillBudget: 0.08,
        minRiverLength: 32,
        maxRiversPerRegion: 2,
        maxTributaries: 2,
        baseWidth: 1.6,
        baseDepth: 0.035,
        carveBankWidth: 2.5,
      };

      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('minSourceElevation');
    });

    it('accepts valid river config', () => {
      const config = makeMinimalConfig(12345);
      config.riverConfig = {
        enabled: true,
        sourceNoiseScale: 0.006,
        sourceThreshold: 0.72,
        minSourceElevation: 0.45,
        maxSourceElevation: 0.85,
        allowedSourceBiomes: [BiomeType.MOUNTAIN, BiomeType.FOREST],
        maxLength: 512,
        maxUphillBudget: 0.08,
        minRiverLength: 32,
        maxRiversPerRegion: 2,
        maxTributaries: 2,
        baseWidth: 1.6,
        baseDepth: 0.035,
        carveBankWidth: 2.5,
      };

      expect(() => validateWorldConfig(config)).not.toThrow();
    });
  });
```

- [ ] **Step 2: Run validation test and verify failure**

Run: `npm test -- tests/validation.test.ts`

Expected: FAIL with TypeScript errors or validation assertions because `riverConfig` and river validation do not exist.

- [ ] **Step 3: Add river public types**

Create `src/gen/rivers.ts`:

```ts
import { BiomeType } from '../world/chunk';

export interface RiverPoint {
  x: number;
  y: number;
  height: number;
  surfaceLevel: number;
  width: number;
  depth: number;
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
  mainPath: RiverPoint[];
  tributaries: RiverPath[];
  source: { x: number; y: number };
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
  sourceThreshold: 0.72,
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
  minRiverLength: 32,
  maxRiversPerRegion: 2,
  maxTributaries: 2,
  baseWidth: 1.6,
  baseDepth: 0.035,
  carveBankWidth: 2.5,
};
```

- [ ] **Step 4: Add `rivers` to config and chunk types**

Modify imports and interfaces:

```ts
// src/world/chunk.ts
import type { RiverData } from '../gen/rivers';

export interface ChunkData {
  // existing fields
  lakes?: LakeData[];
  rivers?: RiverData[];
  resources: Resource[];
  structures: Structure[];
}
```

```ts
// src/world/chunk-manager.ts
import { RiverConfig, DEFAULT_RIVER_CONFIG } from '../gen/rivers';

export interface WorldConfig {
  // existing fields
  riverConfig?: RiverConfig;
}
```

In `generateChunkInternal`, initialize chunks with an empty river list:

```ts
const chunk: ChunkData = {
  x: chunkX,
  y: chunkY,
  size: this.config.chunkSize,
  heightmap,
  biomeMap,
  sparseBiomeTypes,
  sparseBiomeWeights,
  sparseBiomeOffsets,
  microBiomeMap,
  lakes: [],
  rivers: [],
  resources: [],
  structures: [],
};
```

- [ ] **Step 5: Validate river config**

In `src/utils/validation.ts`, import `RiverConfig` if needed and add this helper near lake validation:

```ts
function validateRiverConfig(config: RiverConfig): void {
  validatePositive('riverConfig.sourceNoiseScale', config.sourceNoiseScale);
  validateRange('riverConfig.sourceThreshold', config.sourceThreshold, 0, 1);
  validateRange('riverConfig.minSourceElevation', config.minSourceElevation, 0, 1);
  validateRange('riverConfig.maxSourceElevation', config.maxSourceElevation, 0, 1);

  if (config.minSourceElevation >= config.maxSourceElevation) {
    throw new ValidationError(
      'riverConfig.minSourceElevation',
      config.minSourceElevation,
      'must be less than maxSourceElevation'
    );
  }

  validatePositive('riverConfig.maxLength', config.maxLength);
  validatePositive('riverConfig.minRiverLength', config.minRiverLength);
  validatePositive('riverConfig.baseWidth', config.baseWidth);
  validatePositive('riverConfig.baseDepth', config.baseDepth);
  validatePositive('riverConfig.carveBankWidth', config.carveBankWidth);
  validateNonNegative('riverConfig.maxUphillBudget', config.maxUphillBudget);

  if (config.minRiverLength >= config.maxLength) {
    throw new ValidationError(
      'riverConfig.minRiverLength',
      config.minRiverLength,
      'must be less than maxLength'
    );
  }

  if (!Array.isArray(config.allowedSourceBiomes) || config.allowedSourceBiomes.length === 0) {
    throw new ValidationError('riverConfig.allowedSourceBiomes', config.allowedSourceBiomes, 'must not be empty');
  }

  if (!Number.isInteger(config.maxRiversPerRegion) || config.maxRiversPerRegion < 0) {
    throw new ValidationError('riverConfig.maxRiversPerRegion', config.maxRiversPerRegion, 'must be a non-negative integer');
  }

  if (!Number.isInteger(config.maxTributaries) || config.maxTributaries < 0 || config.maxTributaries > 4) {
    throw new ValidationError('riverConfig.maxTributaries', config.maxTributaries, 'must be an integer between 0 and 4');
  }
}
```

Call it from `validateWorldConfig`:

```ts
if (config.riverConfig) {
  validateRiverConfig(config.riverConfig);
}
```

- [ ] **Step 6: Export river API**

In `src/index.ts`, export the new module:

```ts
export * from './gen/rivers';
export { RiverManager } from './world/river-manager';
```

If this export fails before Task 2, move only the `RiverManager` export into Task 2 and keep `export * from './gen/rivers';` in Task 1.

- [ ] **Step 7: Run tests**

Run: `npm test -- tests/validation.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/gen/rivers.ts src/world/chunk.ts src/world/chunk-manager.ts src/utils/validation.ts src/index.ts tests/validation.test.ts
git commit -m "feat: add river config types"
```

---

### Task 2: RiverManager Main Route Generation

**Files:**
- Create: `src/world/river-manager.ts`
- Test: `tests/river-manager.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write focused manager tests**

Create `tests/river-manager.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
import { RiverManager } from '../src/world/river-manager';
import { BiomeType } from '../src/world/chunk';

const alwaysPlain = () => BiomeType.PLAINS;

describe('RiverManager', () => {
  it('generates a main river that reaches ocean on a synthetic slope', () => {
    const manager = new RiverManager(
      123,
      { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 64, maxTributaries: 0 },
      (x: number) => Math.max(0.2, 0.8 - x * 0.03),
      (x: number) => x >= 18 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const rivers = manager.getRiversForChunk(0, 0, 16);
    expect(rivers.length).toBeGreaterThan(0);
    expect(rivers[0].mainPath.at(-1)?.height).toBeLessThanOrEqual(0.3);
  });

  it('is deterministic for the same seed and callbacks', () => {
    const make = () => new RiverManager(
      999,
      { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 64, maxTributaries: 0 },
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
      { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 12, maxTributaries: 0 },
      () => 0.7,
      () => BiomeType.PLAINS,
    );

    expect(manager.getRiversForChunk(0, 0, 16)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/river-manager.test.ts`

Expected: FAIL because `RiverManager` does not exist.

- [ ] **Step 3: Implement manager skeleton and route tracing**

Create `src/world/river-manager.ts` with these public methods and helpers:

```ts
import { NoiseEngine, type NoiseConfig } from '../core/noise';
import { BiomeType } from './chunk';
import type { RiverConfig, RiverPoint, WorldRiverData } from '../gen/rivers';

const SEA_LEVEL = 0.3;

export class RiverManager {
  private readonly noise: NoiseEngine;
  private readonly sourceNoiseConfig: NoiseConfig;
  private readonly allowedSourceBiomes: Set<number>;
  private readonly rivers = new Map<string, WorldRiverData>();
  private readonly generatedRegions = new Set<string>();

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
  }

  getRiversForChunk(chunkX: number, chunkY: number, chunkSize: number): WorldRiverData[] {
    if (!this.config.enabled) return [];

    for (let ry = chunkY - 1; ry <= chunkY + 1; ry++) {
      for (let rx = chunkX - 1; rx <= chunkX + 1; rx++) {
        const key = this.getChunkKey(rx, ry);
        if (this.generatedRegions.has(key)) continue;
        this.generateRiversForRegion(rx, ry, chunkSize);
        this.generatedRegions.add(key);
      }
    }

    const minX = chunkX * chunkSize;
    const minY = chunkY * chunkSize;
    const maxX = minX + chunkSize;
    const maxY = minY + chunkSize;

    return [...this.rivers.values()].filter(r =>
      r.bounds.maxX >= minX - this.config.carveBankWidth &&
      r.bounds.minX <= maxX + this.config.carveBankWidth &&
      r.bounds.maxY >= minY - this.config.carveBankWidth &&
      r.bounds.minY <= maxY + this.config.carveBankWidth
    );
  }

  clear(): void {
    this.rivers.clear();
    this.generatedRegions.clear();
  }

  notifyChunkEvicted(_chunkX: number, _chunkY: number): void {
    // Keep river cache stable for now; add LRU eviction after core behavior is proven.
  }

  private generateRiversForRegion(chunkX: number, chunkY: number, chunkSize: number): void {
    const candidates = this.collectSourceCandidates(chunkX, chunkY, chunkSize);
    for (const source of candidates.slice(0, this.config.maxRiversPerRegion)) {
      const river = this.traceMainRiver(source.x, source.y);
      if (river) {
        this.rivers.set(river.id, river);
      }
    }
  }

  private collectSourceCandidates(chunkX: number, chunkY: number, chunkSize: number): Array<{ x: number; y: number }> {
    const result: Array<{ x: number; y: number }> = [];
    const startX = chunkX * chunkSize;
    const startY = chunkY * chunkSize;

    for (let y = 0; y < chunkSize; y += 4) {
      for (let x = 0; x < chunkSize; x += 4) {
        const wx = startX + x;
        const wy = startY + y;
        const height = this.getHeightAt(wx, wy);
        const biome = this.getBiomeAt(wx, wy);
        if (height < this.config.minSourceElevation || height > this.config.maxSourceElevation) continue;
        if (!this.allowedSourceBiomes.has(biome)) continue;

        const raw = this.noise.fbm(wx + 0.5, wy + 0.5, this.sourceNoiseConfig);
        const value = (raw + 1) * 0.5;
        if (value >= this.config.sourceThreshold) {
          result.push({ x: wx, y: wy });
        }
      }
    }

    return result;
  }

  private traceMainRiver(sourceX: number, sourceY: number): WorldRiverData | null {
    const points: RiverPoint[] = [];
    const visited = new Set<string>();
    let x = sourceX;
    let y = sourceY;
    let uphillSpent = 0;

    for (let step = 0; step < this.config.maxLength; step++) {
      const height = this.getHeightAt(x, y);
      const biome = this.getBiomeAt(x, y);
      points.push(this.createPoint(x, y, height, points.at(-1)));

      if ((height <= SEA_LEVEL || biome === BiomeType.OCEAN) && points.length >= this.config.minRiverLength) {
        return this.createRiver(points);
      }

      const key = `${x},${y}`;
      if (visited.has(key)) return null;
      visited.add(key);

      const next = this.chooseNextStep(x, y, height, points.length);
      if (!next) return null;
      if (next.height > height) {
        uphillSpent += next.height - height;
        if (uphillSpent > this.config.maxUphillBudget) return null;
      }
      x = next.x;
      y = next.y;
    }

    return null;
  }

  private chooseNextStep(x: number, y: number, currentHeight: number, step: number): { x: number; y: number; height: number } | null {
    let best: { x: number; y: number; height: number; score: number } | null = null;
    for (const [dx, dy] of [[1, 0], [1, -1], [1, 1], [0, -1], [0, 1], [-1, 0], [-1, -1], [-1, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const height = this.getHeightAt(nx, ny);
      const biome = this.getBiomeAt(nx, ny);
      const downhill = currentHeight - height;
      const oceanBonus = height <= SEA_LEVEL || biome === BiomeType.OCEAN ? 10 : 0;
      const eastwardBias = dx * 0.05;
      const meander = this.noise.noise2D(nx * 0.17 + step, ny * 0.17) * 0.02;
      const score = downhill * 4 + oceanBonus + eastwardBias + meander;
      if (!best || score > best.score) best = { x: nx, y: ny, height, score };
    }
    return best;
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

  private createRiver(points: RiverPoint[]): WorldRiverData {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const source = points[0];
    const mouth = points[points.length - 1];
    return {
      id: `river_${source.x}_${source.y}_${mouth.x}_${mouth.y}`,
      mainPath: points,
      tributaries: [],
      source: { x: source.x, y: source.y },
      mouth: { x: mouth.x, y: mouth.y },
      bounds: {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      },
    };
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }
}
```

Adjust `NoiseEngine` method names if the local API differs.

- [ ] **Step 4: Export manager**

In `src/index.ts`, ensure this line is active:

```ts
export { RiverManager } from './world/river-manager';
```

- [ ] **Step 5: Run manager tests**

Run: `npm test -- tests/river-manager.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/world/river-manager.ts src/index.ts tests/river-manager.test.ts
git commit -m "feat: add river manager routing"
```

---

### Task 3: ChunkManager Integration And River Carving

**Files:**
- Modify: `src/world/chunk-manager.ts`
- Modify: `src/utils/errors.ts`
- Modify: `src/utils/logger.ts`
- Test: `tests/chunk-manager.test.ts`

- [ ] **Step 1: Write chunk integration tests**

Add to `tests/chunk-manager.test.ts`:

```ts
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
```

Add tests:

```ts
describe('ChunkManager rivers', () => {
  it('adds river arrays to generated chunks when rivers are enabled', async () => {
    const config = makeMinimalConfig(42);
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, sourceThreshold: 0.99, maxRiversPerRegion: 0 };
    const manager = new ChunkManager(config);
    const chunk = await manager.getChunk(0, 0);

    expect(chunk.rivers).toBeInstanceOf(Array);
  });

  it('keeps local river points near chunk bounds', async () => {
    const config = makeMinimalConfig(42);
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 96 };
    const manager = new ChunkManager(config);

    for (let cx = 0; cx < 3; cx++) {
      const chunk = await manager.getChunk(cx, 0);
      for (const river of chunk.rivers ?? []) {
        for (const point of river.points) {
          expect(point.x).toBeGreaterThanOrEqual(-config.riverConfig.carveBankWidth - 1);
          expect(point.x).toBeLessThanOrEqual(chunk.size + config.riverConfig.carveBankWidth + 1);
          expect(point.y).toBeGreaterThanOrEqual(-config.riverConfig.carveBankWidth - 1);
          expect(point.y).toBeLessThanOrEqual(chunk.size + config.riverConfig.carveBankWidth + 1);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run chunk tests and verify failure**

Run: `npm test -- tests/chunk-manager.test.ts`

Expected: FAIL because `ChunkManager` does not initialize `RiverManager` or local river data.

- [ ] **Step 3: Initialize RiverManager**

In `src/world/chunk-manager.ts`, import manager and data:

```ts
import { RiverManager } from './river-manager';
import { RiverConfig, DEFAULT_RIVER_CONFIG, RiverData, WorldRiverData, RiverPoint } from '../gen/rivers';
```

Add class member:

```ts
private riverManager: RiverManager | null;
```

In constructor after `LakeManager` initialization:

```ts
const riverConfig = config.riverConfig ?? DEFAULT_RIVER_CONFIG;
this.riverManager = riverConfig.enabled ? new RiverManager(
  config.seed,
  riverConfig,
  (worldX: number, worldY: number) => this.terrainGenerator.getHeightAt(worldX, worldY, config.seed),
  (worldX: number, worldY: number) => {
    const height = this.terrainGenerator.getHeightAt(worldX, worldY, config.seed);
    return this.biomeSystem.getBiome(worldX, worldY, height);
  }
) : null;
```

- [ ] **Step 4: Fetch and convert rivers in chunk generation**

In `src/utils/errors.ts`, add:

```ts
export class RiverGenerationError extends ChunkGenerationError {
  constructor(chunkX: number, chunkY: number, cause?: Error) {
    super('River generation failed', chunkX, chunkY, 'rivers', cause);
    this.name = 'RiverGenerationError';
  }
}
```

Import it in `src/world/chunk-manager.ts` with the other generation errors.

After lake carving and before resources:

```ts
try {
  this.config.onProgress?.('rivers', 0.58);

  if (this.riverManager) {
    const worldRivers = this.riverManager.getRiversForChunk(chunkX, chunkY, this.config.chunkSize);
    chunk.rivers = this.convertWorldRiversToChunkRivers(worldRivers, chunkX, chunkY, this.config.chunkSize);
    if (chunk.rivers.length > 0) {
      this.carveTerrainForRivers(chunk.rivers, heightmap, this.config.chunkSize);
    }
  }
} catch (error) {
  logger.warn(LogCategory.RIVER, `River generation failed for chunk (${chunkX}, ${chunkY}), continuing without rivers`, error);
  chunk.rivers = [];
  if (!this.errorRecovery.allowPartialChunks) {
    throw new RiverGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
  }
}
```

Add `RIVER` to `LogCategory` in `src/utils/logger.ts`:

```ts
RIVER = 'river',
```

- [ ] **Step 5: Add conversion helper**

In `ChunkManager`:

```ts
private convertWorldRiversToChunkRivers(
  worldRivers: WorldRiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number
): RiverData[] {
  const chunkWorldX = chunkX * chunkSize;
  const chunkWorldY = chunkY * chunkSize;
  const bank = this.config.riverConfig?.carveBankWidth ?? DEFAULT_RIVER_CONFIG.carveBankWidth;
  const result: RiverData[] = [];

  const convertPath = (riverId: string, pathId: string, isTributary: boolean, points: RiverPoint[]): void => {
    const local = points
      .filter(p =>
        p.x >= chunkWorldX - bank &&
        p.x <= chunkWorldX + chunkSize + bank &&
        p.y >= chunkWorldY - bank &&
        p.y <= chunkWorldY + chunkSize + bank
      )
      .map(p => ({ ...p, x: p.x - chunkWorldX, y: p.y - chunkWorldY }));

    if (local.length < 2) return;

    const xs = local.map(p => p.x);
    const ys = local.map(p => p.y);
    result.push({
      riverId,
      pathId,
      isTributary,
      points: local,
      bounds: {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      },
    });
  };

  for (const river of worldRivers) {
    convertPath(river.id, `${river.id}:main`, false, river.mainPath);
    for (const tributary of river.tributaries) {
      convertPath(river.id, tributary.id, true, tributary.points);
    }
  }

  return result;
}
```

- [ ] **Step 6: Add carving helper**

In `ChunkManager`:

```ts
private carveTerrainForRivers(rivers: RiverData[], heightmap: Float32Array, chunkSize: number): void {
  const vertexSize = chunkSize + 1;
  const bankDefault = this.config.riverConfig?.carveBankWidth ?? DEFAULT_RIVER_CONFIG.carveBankWidth;

  for (const river of rivers) {
    const minX = Math.max(0, Math.floor(river.bounds.minX - bankDefault));
    const maxX = Math.min(chunkSize, Math.ceil(river.bounds.maxX + bankDefault));
    const minY = Math.max(0, Math.floor(river.bounds.minY - bankDefault));
    const maxY = Math.min(chunkSize, Math.ceil(river.bounds.maxY + bankDefault));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const sample = this.closestRiverSample(x, y, river.points);
        if (!sample) continue;

        const bankWidth = Math.max(sample.width * 0.5, bankDefault);
        if (sample.distance > bankWidth) continue;

        const centerTarget = Math.max(0, sample.surfaceLevel - sample.depth);
        const t = 1 - Math.min(sample.distance / bankWidth, 1);
        const falloff = t * t * (3 - 2 * t);
        const index = y * vertexSize + x;
        const target = heightmap[index] * (1 - falloff) + centerTarget * falloff;
        heightmap[index] = Math.min(heightmap[index], target);
      }
    }
  }
}
```

Add the distance helper:

```ts
private closestRiverSample(
  x: number,
  y: number,
  points: RiverPoint[]
): { distance: number; surfaceLevel: number; depth: number; width: number } | null {
  if (points.length < 2) return null;

  let best: { distance: number; surfaceLevel: number; depth: number; width: number } | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    const distance = Math.hypot(x - px, y - py);
    const sample = {
      distance,
      surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * t,
      depth: a.depth + (b.depth - a.depth) * t,
      width: a.width + (b.width - a.width) * t,
    };
    if (!best || sample.distance < best.distance) best = sample;
  }
  return best;
}
```

- [ ] **Step 7: Clear river cache with chunk cache**

Where `clearCache()` clears lake state, add:

```ts
this.riverManager?.clear();
```

Where chunk eviction notifies lakes, add:

```ts
this.riverManager?.notifyChunkEvicted(evictedChunkX, evictedChunkY);
```

- [ ] **Step 8: Run tests**

Run: `npm test -- tests/chunk-manager.test.ts tests/river-manager.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/world/chunk-manager.ts src/utils/logger.ts tests/chunk-manager.test.ts
git commit -m "feat: integrate rivers into chunk generation"
```

---

### Task 4: Tributaries

**Files:**
- Modify: `src/world/river-manager.ts`
- Test: `tests/river-manager.test.ts`

- [ ] **Step 1: Add tributary test**

Add to `tests/river-manager.test.ts`:

```ts
  it('adds bounded simple tributaries to valid main rivers', () => {
    const manager = new RiverManager(
      321,
      { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 96, maxTributaries: 2 },
      (x: number, y: number) => Math.max(0.2, 0.85 - x * 0.025 + Math.abs(y - 8) * 0.004),
      (x: number) => x >= 24 ? BiomeType.OCEAN : BiomeType.PLAINS,
    );

    const rivers = manager.getRiversForChunk(0, 0, 16);
    expect(rivers.length).toBeGreaterThan(0);
    expect(rivers[0].tributaries.length).toBeLessThanOrEqual(2);
    for (const tributary of rivers[0].tributaries) {
      expect(tributary.points.length).toBeGreaterThanOrEqual(2);
      expect(tributary.connectsToRiverId).toBe(rivers[0].id);
      expect(tributary.connectsAtIndex).toBeGreaterThanOrEqual(0);
    }
  });
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- tests/river-manager.test.ts`

Expected: FAIL because tributaries are always empty.

- [ ] **Step 3: Add tributary generation after main route validation**

In `createRiver`, build tributaries before returning:

```ts
const id = `river_${source.x}_${source.y}_${mouth.x}_${mouth.y}`;
const tributaries = this.createTributaries(id, points);
return {
  id,
  mainPath: points,
  tributaries,
  source: { x: source.x, y: source.y },
  mouth: { x: mouth.x, y: mouth.y },
  bounds: this.boundsForPoints([...points, ...tributaries.flatMap(t => t.points)]),
};
```

Add helpers:

```ts
private createTributaries(riverId: string, mainPath: RiverPoint[]): RiverPath[] {
  const result: RiverPath[] = [];
  if (this.config.maxTributaries <= 0 || mainPath.length < 8) return result;

  const spacing = Math.max(4, Math.floor(mainPath.length / (this.config.maxTributaries + 1)));
  for (let i = 1; i <= this.config.maxTributaries; i++) {
    const attachIndex = Math.min(mainPath.length - 3, i * spacing);
    const attach = mainPath[attachIndex];
    const side = i % 2 === 0 ? 1 : -1;
    const startX = attach.x - 6;
    const startY = attach.y + side * 6;
    const path = this.traceTributary(startX, startY, attach, riverId, attachIndex, i);
    if (path) result.push(path);
  }
  return result;
}

private traceTributary(
  startX: number,
  startY: number,
  attach: RiverPoint,
  riverId: string,
  attachIndex: number,
  ordinal: number
): RiverPath | null {
  const points: RiverPoint[] = [];
  let x = startX;
  let y = startY;

  for (let step = 0; step < Math.min(64, this.config.maxLength); step++) {
    const height = this.getHeightAt(x, y);
    points.push(this.createPoint(x, y, height, points.at(-1)));

    if (Math.hypot(x - attach.x, y - attach.y) <= 1.5) {
      points.push({ ...attach, width: attach.width * 0.7, depth: attach.depth * 0.75 });
      return {
        id: `${riverId}:tributary:${ordinal}`,
        points,
        connectsToRiverId: riverId,
        connectsAtIndex: attachIndex,
      };
    }

    const dx = Math.sign(attach.x - x);
    const dy = Math.sign(attach.y - y);
    const options = [[dx, dy], [dx, 0], [0, dy]] as const;
    let best: { x: number; y: number; height: number; score: number } | null = null;
    for (const [ox, oy] of options) {
      const nx = x + ox;
      const ny = y + oy;
      const h = this.getHeightAt(nx, ny);
      const distanceScore = -Math.hypot(nx - attach.x, ny - attach.y);
      const downhillScore = height - h;
      const score = distanceScore + downhillScore * 3;
      if (!best || score > best.score) best = { x: nx, y: ny, height: h, score };
    }
    if (!best) return null;
    x = best.x;
    y = best.y;
  }

  return null;
}

private boundsForPoints(points: RiverPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
```

Ensure `RiverPath` is imported from `../gen/rivers`.

- [ ] **Step 4: Run manager tests**

Run: `npm test -- tests/river-manager.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/river-manager.ts tests/river-manager.test.ts
git commit -m "feat: add simple river tributaries"
```

---

### Task 5: Serialization And Worker Round Trip

**Files:**
- Modify: `src/world/serialization.ts`
- Modify: `src/world/worker-pool.ts`
- Modify: `src/worker.ts`
- Test: `tests/serialization.test.ts`
- Test: `tests/worker.test.ts`

- [ ] **Step 1: Add serialization tests**

In `tests/serialization.test.ts`, import `DEFAULT_RIVER_CONFIG`:

```ts
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
```

Update `buildManager` and `restore` helpers:

```ts
config.riverConfig = { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 96 };
```

Add this test inside each format describe block:

```ts
      it('restores rivers with path points', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig = await manager.getChunk(0, 0);
        const fresh = await loaded.getChunk(0, 0);

        const normalize = (chunk: Awaited<ReturnType<typeof manager.getChunk>>) =>
          (chunk.rivers ?? []).map(r => ({
            riverId: r.riverId,
            pathId: r.pathId,
            isTributary: r.isTributary,
            points: r.points.map(p => [p.x, p.y, Number(p.surfaceLevel.toFixed(4))]),
          }));

        expect(normalize(fresh)).toEqual(normalize(orig));
      });
```

- [ ] **Step 2: Run serialization tests and verify failure**

Run: `npm test -- tests/serialization.test.ts`

Expected: FAIL because serialized chunks do not include rivers.

- [ ] **Step 3: Add serialized river interfaces**

In `src/world/serialization.ts`:

```ts
import type { RiverData, RiverPoint } from '../gen/rivers';

export interface SerializedRiverPoint {
  x: number;
  y: number;
  height: number;
  surfaceLevel: number;
  width: number;
  depth: number;
  flowX: number;
  flowY: number;
}

export interface SerializedRiver {
  riverId: string;
  pathId: string;
  isTributary: boolean;
  points: SerializedRiverPoint[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}
```

Add to `SerializedChunk`:

```ts
rivers: SerializedRiver[];
```

- [ ] **Step 4: Serialize and deserialize river arrays**

Where chunks serialize lakes, add:

```ts
const rivers: SerializedRiver[] = (chunk.rivers ?? []).map(river => ({
  riverId: river.riverId,
  pathId: river.pathId,
  isTributary: river.isTributary,
  points: river.points.map(point => ({ ...point })),
  bounds: river.bounds,
}));
```

Return `rivers` beside `lakes`.

Where chunks deserialize lakes into `ChunkData`, add:

```ts
const rivers: RiverData[] = (serializedChunk.rivers ?? []).map(sr => ({
  riverId: sr.riverId,
  pathId: sr.pathId,
  isTributary: sr.isTributary,
  points: sr.points.map((point: RiverPoint) => ({ ...point })),
  bounds: sr.bounds,
}));
```

Include `rivers` in constructed chunk objects. Keep `(serializedChunk.rivers ?? [])` for backward compatibility.

- [ ] **Step 5: Update binary export/import payloads**

Near the existing binary lake JSON blocks, write river JSON immediately after lakes:

```ts
const riversBytes = encoder.encode(JSON.stringify(chunk.rivers ?? []));
view.setUint32(offset, riversBytes.length, true);
offset += 4;
bytes.set(riversBytes, offset);
offset += riversBytes.length;
```

When reading binary chunks, read the river block after lakes:

```ts
const riversLength = view.getUint32(offset, true);
offset += 4;
const riversBytes = bytes.slice(offset, offset + riversLength);
const serializedRivers: SerializedRiver[] = JSON.parse(new TextDecoder().decode(riversBytes));
offset += riversLength;
```

Include `rivers: serializedRivers` in the pushed serialized chunk. If backward compatibility with older binary files is needed, guard this read by checking `offset < buffer.byteLength` before modifications count; otherwise tests cover the current writer/reader pair.

- [ ] **Step 6: Update worker round trip**

In `src/world/worker-pool.ts`, find the lake restore code and add:

```ts
rivers: (serialized.rivers ?? []).map(river => ({
  riverId: river.riverId,
  pathId: river.pathId,
  isTributary: river.isTributary,
  points: river.points.map(point => ({ ...point })),
  bounds: river.bounds,
})),
```

In `src/worker.ts`, include `rivers: chunk.rivers ?? []` anywhere worker messages serialize chunk data.

In `tests/worker.test.ts`, add `rivers` to the fixture chunk:

```ts
rivers: [{
  riverId: 'river_1',
  pathId: 'river_1:main',
  isTributary: false,
  points: [{ x: 0, y: 0, height: 0.6, surfaceLevel: 0.61, width: 1.5, depth: 0.03, flowX: 1, flowY: 0 }],
  bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
}],
```

Assert it round-trips:

```ts
expect(restored.rivers?.[0].riverId).toBe('river_1');
expect(restored.rivers?.[0].points[0].surfaceLevel).toBe(0.61);
```

- [ ] **Step 7: Run persistence tests**

Run: `npm test -- tests/serialization.test.ts tests/worker.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/world/serialization.ts src/world/worker-pool.ts src/worker.ts tests/serialization.test.ts tests/worker.test.ts
git commit -m "feat: persist river data"
```

---

### Task 6: Demo River Mesh Rendering

**Files:**
- Create: `demo/src/viewer/water/RiverMeshGenerator.ts`
- Create: `demo/src/viewer/water/RiverMeshGenerator.test.ts`
- Modify: `demo/src/viewer/water/types.ts`
- Modify: `demo/src/viewer/water/config.ts`
- Modify: `demo/src/viewer/water/WaterLayerManager.ts`
- Modify: `demo/src/viewer/water/index.ts`

- [ ] **Step 1: Write river mesh tests**

Create `demo/src/viewer/water/RiverMeshGenerator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RiverData } from '../../../../src/gen/rivers';
import { buildRiverGeometry } from './RiverMeshGenerator';

function river(points: RiverData['points']): RiverData {
  return {
    riverId: 'river_1',
    pathId: 'river_1:main',
    isTributary: false,
    points,
    bounds: { minX: 0, maxX: 4, minY: 1, maxY: 1 },
  };
}

describe('RiverMeshGenerator', () => {
  it('builds a strip for a two-point river', () => {
    const geometry = buildRiverGeometry([river([
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.35, surfaceLevel: 0.36, width: 1, depth: 0.03, flowX: 1, flowY: 0 },
    ])], 0, 0, 16);

    expect(geometry).not.toBeNull();
    expect(geometry!.getAttribute('position').count).toBe(4);
  });

  it('returns null for empty river data', () => {
    expect(buildRiverGeometry([], 0, 0, 16)).toBeNull();
  });
});
```

- [ ] **Step 2: Run mesh tests and verify failure**

Run: `npm test -- demo/src/viewer/water/RiverMeshGenerator.test.ts`

Expected: FAIL because generator does not exist.

- [ ] **Step 3: Add water types and config**

In `types.ts`:

```ts
export interface RiverRenderConfig {
  enabled: boolean;
  color: number;
  opacity: number;
  shininess: number;
}

export interface WaterConfig {
  // existing fields
  river: RiverRenderConfig;
}

export type WaterType = 'ocean' | 'lake' | 'river';

export interface WaterLayerData {
  ocean: WaterMesh[];
  lake: WaterMesh[];
  river: WaterMesh[];
  group: THREE.Group;
}
```

In `config.ts`:

```ts
export const DEFAULT_RIVER_RENDER_CONFIG = {
  enabled: true,
  color: 0x3aa6a6,
  opacity: 0.78,
  shininess: 55,
};
```

Add `river: DEFAULT_RIVER_RENDER_CONFIG` to `DEFAULT_WATER_CONFIG` and validate it like lake:

```ts
river: {
  enabled: config.river?.enabled ?? DEFAULT_RIVER_RENDER_CONFIG.enabled,
  color: config.river?.color ?? DEFAULT_RIVER_RENDER_CONFIG.color,
  opacity: clamp(config.river?.opacity ?? DEFAULT_RIVER_RENDER_CONFIG.opacity, 0, 1, 'River opacity'),
  shininess: clamp(config.river?.shininess ?? DEFAULT_RIVER_RENDER_CONFIG.shininess, 0, 100, 'River shininess'),
},
```

- [ ] **Step 4: Implement river geometry**

Create `RiverMeshGenerator.ts`:

```ts
import * as THREE from 'three';
import type { RiverData } from '../../../../src/gen/rivers';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';

export function buildRiverGeometry(
  rivers: RiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (const river of rivers) {
    if (river.points.length < 2) continue;

    for (let i = 0; i < river.points.length; i++) {
      const point = river.points[i];
      const prev = river.points[Math.max(0, i - 1)];
      const next = river.points[Math.min(river.points.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const halfWidth = point.width * 0.5;
      const worldX = chunkX * chunkSize + point.x;
      const worldZ = chunkY * chunkSize + point.y;
      const y = point.surfaceLevel * HEIGHT_SCALE + 0.18;

      positions.push(worldX + nx * halfWidth, y, worldZ + ny * halfWidth);
      positions.push(worldX - nx * halfWidth, y, worldZ - ny * halfWidth);
      normals.push(0, 1, 0, 0, 1, 0);
      colors.push(0.22, 0.65, 0.66, 0.16, 0.52, 0.58);
      uvs.push(0, i, 1, i);

      if (i < river.points.length - 1) {
        const base = vertexCount;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
      vertexCount += 2;
    }
  }

  if (vertexCount === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createRiverMaterial(config: RiverRenderConfig): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: config.color,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(0x88ffee),
  });
}
```

- [ ] **Step 5: Integrate into WaterLayerManager**

Import:

```ts
import { buildRiverGeometry, createRiverMaterial } from './RiverMeshGenerator';
```

Initialize layer:

```ts
const waterLayer: WaterLayerData = {
  ocean: [],
  lake: [],
  river: [],
  group: new THREE.Group(),
};
```

After lake mesh generation:

```ts
if (config.river.enabled && chunkData.rivers && chunkData.rivers.length > 0) {
  const riverGeometry = buildRiverGeometry(chunkData.rivers, chunkData.x, chunkData.y, chunkData.size);
  if (riverGeometry) {
    const riverMaterial = createRiverMaterial(config.river);
    const riverMesh = new THREE.Mesh(riverGeometry, riverMaterial);
    riverMesh.renderOrder = 2;
    riverMesh.visible = true;

    const boundingBox = new THREE.Box3();
    if (riverGeometry.boundingBox) boundingBox.copy(riverGeometry.boundingBox);

    const riverMeshData: WaterMesh = {
      type: 'river',
      mesh: riverMesh,
      material: riverMaterial,
      boundingBox,
    };

    waterLayer.river.push(riverMeshData);
    waterLayer.group.add(riverMesh);
  }
}
```

Dispose and frustum-cull `waterLayer.river` in the same loops as ocean/lake.

- [ ] **Step 6: Export generator**

In `demo/src/viewer/water/index.ts`:

```ts
export * from './RiverMeshGenerator';
```

- [ ] **Step 7: Run water tests**

Run: `npm test -- demo/src/viewer/water/RiverMeshGenerator.test.ts demo/src/viewer/water/config.test.ts demo/src/viewer/water/WaterLayerManager.test.ts`

Expected: PASS after updating config tests for `river` defaults if they assert exact shape.

- [ ] **Step 8: Commit**

```bash
git add demo/src/viewer/water
git commit -m "feat: render river water meshes"
```

---

### Task 7: Demo Controls And Defaults

**Files:**
- Modify: `demo/src/core/DemoApp.ts`
- Modify: `demo/src/ui/ControlPanel.ts`
- Modify: `docs/CONFIGURATION.md` if public docs list world config fields
- Test: `demo/src/config/volumetricPreset.test.ts` only if existing demo config tests fail

- [ ] **Step 1: Add demo default river config**

In `demo/src/core/DemoApp.ts`, import:

```ts
import { DEFAULT_RIVER_CONFIG } from '@engine/gen/rivers';
```

Add to default world config near `lakeConfig`:

```ts
riverConfig: DEFAULT_RIVER_CONFIG,
```

- [ ] **Step 2: Include river config in runtime config updates**

Where `DemoApp` detects config keys requiring world regeneration, add:

```ts
'riverConfig' in config ||
```

- [ ] **Step 3: Add a minimal river toggle**

In `ControlPanel.ts`, near the Lakes section, add:

```ts
const riversSection = document.createElement('div');
riversSection.style.marginBottom = '16px';
riversSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Rivers</h4>';
waterContainer.appendChild(riversSection);

const currentRiverConfig = this.currentConfig?.riverConfig;
const riversEnabled = currentRiverConfig?.enabled ?? true;

const enableRiversCheckbox = this.createCheckboxControl({
  id: 'enableRivers',
  label: 'Enable Rivers',
  defaultValue: riversEnabled,
  tooltip: 'Enable terrain-aware rivers that carve channels and flow to ocean.'
}, (checked: boolean) => {
  this.updateRiverConfig('enabled', checked);
});
riversSection.appendChild(enableRiversCheckbox);
```

Add method:

```ts
private updateRiverConfig(property: string, value: boolean | number): void {
  if (!this.app || !this.currentConfig) {
    console.warn('[ControlPanel] Cannot update river config - missing app or config');
    return;
  }

  const currentRiverConfig = this.currentConfig.riverConfig || DEFAULT_RIVER_CONFIG;
  const newConfig = {
    ...this.currentConfig,
    riverConfig: {
      ...currentRiverConfig,
      [property]: value,
    },
  };

  this.app.updateWorldConfig(newConfig);
}
```

Import `DEFAULT_RIVER_CONFIG` at the top of `ControlPanel.ts`.

- [ ] **Step 4: Run demo typecheck**

Run: `npm run typecheck:demo`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add demo/src/core/DemoApp.ts demo/src/ui/ControlPanel.ts docs/CONFIGURATION.md
git commit -m "feat: expose river controls in demo"
```

---

### Task 8: Final Verification And Performance Guard

**Files:**
- Modify: `tests/determinism.test.ts`
- Modify: `tests/performance.test.ts`
- Modify: `docs/API.md`, `docs/ARCHITECTURE.md`, `README.md` only if public docs describe all feature systems

- [ ] **Step 1: Add determinism test**

In `tests/determinism.test.ts`, import `DEFAULT_RIVER_CONFIG` and add:

```ts
  it('same seed produces identical rivers', async () => {
    const config = makeMinimalConfig(123);
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, sourceThreshold: -1, maxRiversPerRegion: 1, minRiverLength: 4, maxLength: 96 };

    const a = new ChunkManager(config);
    const b = new ChunkManager(config);
    const chunkA = await a.getChunk(0, 0);
    const chunkB = await b.getChunk(0, 0);

    const normalize = (chunk: typeof chunkA) =>
      (chunk.rivers ?? []).map(r => ({
        riverId: r.riverId,
        pathId: r.pathId,
        points: r.points.map(p => [p.x, p.y, Number(p.surfaceLevel.toFixed(4))]),
      }));

    expect(normalize(chunkA)).toEqual(normalize(chunkB));
  });
```

- [ ] **Step 2: Add performance coverage**

In `tests/performance.test.ts`, add one benchmark-like test next to lake performance:

```ts
  it('benchmarks 32x32 chunk generation (with rivers)', async () => {
    const config = makeMinimalConfig(123);
    config.riverConfig = DEFAULT_RIVER_CONFIG;
    const manager = new ChunkManager(config);

    const start = performance.now();
    await manager.getChunk(0, 0);
    const elapsed = performance.now() - start;

    console.log(`\n32x32 chunk (with rivers): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(300);
  });
```

Adjust the threshold only if existing CI performance characteristics require a nearby value; keep it explicit.

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm test -- tests/river-manager.test.ts tests/chunk-manager.test.ts tests/serialization.test.ts tests/determinism.test.ts demo/src/viewer/water/RiverMeshGenerator.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run build
npm run build:demo
npm test
```

Expected: all commands PASS.

- [ ] **Step 5: Optional browser smoke test**

Start demo:

```bash
npm run demo
```

Open the local Vite URL, enable rivers, and inspect several chunks. Expected: terrain loads, water layers render, rivers appear as sloped strips, existing oceans/lakes remain visible, console has no uncaught errors.

- [ ] **Step 6: Commit**

```bash
git add tests/determinism.test.ts tests/performance.test.ts docs/API.md docs/ARCHITECTURE.md README.md
git commit -m "test: verify river system behavior"
```

---

## Self-Review

Spec coverage:

- World-space manager and chunk-local slices: Tasks 2 and 3.
- Ocean termination and route validation: Task 2.
- Simple tributaries: Task 4.
- Terrain carving: Task 3.
- Rendering: Task 6.
- Config and validation: Task 1.
- Serialization and workers: Task 5.
- Determinism and performance verification: Task 8.

No first-version lake inflow, erosion simulation, flooding, or flow animation is included. Those are intentionally excluded by the spec.
