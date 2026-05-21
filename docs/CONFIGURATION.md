# Configuration Guide

Detailed reference for all configuration options in Procedural World Engine.

## Table of Contents

- [WorldConfig](#worldconfig)
- [TerrainConfig](#terrainconfig)
- [BiomeConfig](#biomeconfig)
- [EnhancedBiomeConfig](#enhancedbiomeconfig)
- [LakeConfig](#lakeconfig)
- [RiverConfig](#riverconfig)
- [ResourceConfig](#resourceconfig)
- [StructureConfig](#structureconfig)
- [WorkerPoolConfig](#workerpoolconfig)
- [Noise3DConfig](#noise3dconfig)
- [ErrorRecoveryOptions](#errorrecoveryoptions)
- [Validation Rules](#validation-rules)
- [World Units](#world-units)

---

## World Units

Runtime world coordinates are metric: **1 world unit equals 1 meter**. This applies to X/Z positions, chunk sizes, river widths, lake tile coverage, camera positions, first-person eye height, and rendered foliage dimensions.

Heightmaps remain normalized values in `[0, 1]`; rendering converts them to meters with `TERRAIN_HEIGHT_SCALE_METERS` (default `240`). Terrain samples render `TERRAIN_TILE_SIZE_METERS` apart (default `4`), so with the default config a `chunkSize` of `32` means a `128 m x 128 m` rendered chunk, and full heightmap range spans `240 m` vertically.

Useful exported constants:

```typescript
import {
  WORLD_METERS_PER_UNIT,
  TERRAIN_TILE_SIZE_METERS,
  TERRAIN_HEIGHT_SCALE_METERS,
  FIRST_PERSON_EYE_HEIGHT_METERS,
} from 'procedural-world-engine';
```

Foliage uses trees as the visual scale anchor: default adult trees are roughly `10-25 m` tall depending on biome and deterministic jitter.

---

## WorldConfig

Main configuration object passed to `ChunkManager` constructor.

```typescript
interface WorldConfig {
  seed: number;
  chunkSize: number;
  terrainConfig?: TerrainConfig;
  biomeConfig?: BiomeConfig;
  enhancedBiomeConfig?: EnhancedBiomeConfig;
  resourceConfig?: ResourceConfig;
  structureConfig?: StructureConfig;
  lakeConfig?: LakeConfig;
  riverConfig?: RiverConfig;
  maxCacheSize?: number;
  workerPoolConfig?: WorkerPoolConfig;
  errorRecovery?: ErrorRecoveryOptions;
  enablePerformanceMetrics?: boolean;
  onProgress?: ProgressCallback;
  noise3DConfig?: Noise3DConfig;
}
```

### Required Fields

#### `seed: number`

World seed for deterministic generation. Same seed always produces the same world.

**Valid range:** Any finite number

**Examples:**
```typescript
seed: 12345
seed: Date.now()
seed: hashString('my-world-name')
```

---

#### `chunkSize: number`

Number of terrain samples per chunk side. Chunks are square; rendering places samples `TERRAIN_TILE_SIZE_METERS` apart while object dimensions remain in meters.

**Valid range:** 4 to 256

**Recommended values:**
- `16x16` - Fast generation, low memory, more chunks
- `32x32` - Balanced (recommended)
- `64x64` - Fewer chunks, slower generation

**Memory per chunk:**
- 16x16: ~2 KB
- 32x32: ~6.2 KB
- 64x64: ~25 KB

**Example:**
```typescript
chunkSize: 32
```

---

### Optional Fields

#### `maxCacheSize?: number`

Maximum number of chunks to keep in LRU cache.

**Default:** 100 when using bare `ChunkManager`, 1000 when using `createDefaultWorldConfig()`.

**Valid range:** 1 to 10000

**Memory usage:**
```
Total memory = maxCacheSize x memory per chunk
```

**Examples:**
```typescript
maxCacheSize: 100   // ~620 KB (32x32 chunks)
maxCacheSize: 500   // ~3.1 MB
maxCacheSize: 1000  // ~6.2 MB
```

---

#### `enablePerformanceMetrics?: boolean`

Enable performance logging for slow chunk generation.

**Default:** false

**Example:**
```typescript
enablePerformanceMetrics: true
```

---

#### `onProgress?: ProgressCallback`

Callback for generation progress updates.

**Type:**
```typescript
type ProgressCallback = (stage: string, progress: number) => void;
```

**Example:**
```typescript
onProgress: (stage, progress) => {
  console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
}
```

---

## TerrainConfig

Configuration for heightmap generation using fractional Brownian motion (fBM).

```typescript
interface TerrainConfig {
  baseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  warpStrength: number;
  heightMultiplier: number;
  enable3D?: boolean;
  zScale?: number;
  enableContinentalness?: boolean;
  continentalScale?: number;
  continentalStrength?: number;
}
```

### Required Fields

#### `baseScale: number`

Base noise frequency. Lower values = larger features.

**Valid range:** 0.001 to 0.1

**Recommended values:**
- `0.001` - Continent-sized features
- `0.005` - Large mountains and valleys
- `0.01` - Medium terrain (recommended)
- `0.02` - Small hills
- `0.05` - Very detailed, noisy terrain

**Example:**
```typescript
baseScale: 0.01
```

---

#### `octaves: number`

Number of noise layers to combine. More octaves = more detail.

**Valid range:** 1 to 16

**Recommended values:**
- `2` - Fast, smooth terrain
- `4` - Balanced detail (recommended)
- `6` - High detail
- `8+` - Very detailed, slower

**Performance impact:** Each octave adds a small amount of time, but terrain generation is very fast overall (~0.3ms for 32x32).

**Example:**
```typescript
octaves: 4
```

---

#### `persistence: number`

Amplitude decay per octave. Controls how much each octave contributes.

**Valid range:** 0 to 1

**Recommended values:**
- `0.3` - Smooth, gentle terrain
- `0.5` - Balanced (recommended)
- `0.7` - Rough, detailed terrain

**Formula:** `amplitude[i] = amplitude[i-1] x persistence`

**Example:**
```typescript
persistence: 0.5
```

---

#### `lacunarity: number`

Frequency multiplier per octave. Controls detail scale.

**Valid range:** 1 to 4

**Recommended values:**
- `1.5` - Gradual detail increase
- `2.0` - Standard (recommended)
- `2.5` - Sharp detail increase
- `3.0+` - Very sharp, noisy

**Formula:** `frequency[i] = frequency[i-1] x lacunarity`

**Example:**
```typescript
lacunarity: 2.0
```

---

#### `warpStrength: number`

Domain warping intensity. Creates swirls and organic shapes.

**Valid range:** 0 to 100

**Recommended values:**
- `0` - No warping (straight noise)
- `10` - Subtle warping
- `30` - Moderate warping (recommended)
- `50` - Strong warping
- `100` - Extreme warping

**Example:**
```typescript
warpStrength: 30
```

---

#### `heightMultiplier: number`

Final height scaling factor.

**Valid range:** 0.1 to 10

**Recommended values:**
- `0.5` - Flat world
- `1.0` - Normal height
- `2.0` - Tall mountains (default in createDefaultWorldConfig)
- `3.0+` - Extreme elevation

**Example:**
```typescript
heightMultiplier: 2.0
```

---

### Optional Fields

#### `enable3D?: boolean`

Use 3D volumetric noise instead of 2D.

**Default:** false

**Benefits:**
- More varied terrain
- Better overhangs and caves
- Unique terrain slices

**Performance impact:** Slight increase (~1-2ms per chunk)

**Example:**
```typescript
enable3D: true
```

---

#### `zScale?: number`

Z-axis position in 3D noise volume. Only used if `enable3D` is true.

**Default:** 0.5

**Valid range:** 0 to 1

**Example:**
```typescript
zScale: 0.5
```

---

#### `enableContinentalness?: boolean`

Add large-scale ocean/land separation.

**Default:** true

**Example:**
```typescript
enableContinentalness: true
```

---

#### `continentalScale?: number`

Continental noise frequency.

**Default:** 0.002

**Valid range:** 0.0001 to 0.01

**Example:**
```typescript
continentalScale: 0.002
```

---

#### `continentalStrength?: number`

Continental layer influence.

**Default:** 0.45

**Valid range:** 0 to 1

**Example:**
```typescript
continentalStrength: 0.45
```

---

## BiomeConfig

Basic biome classification configuration.

```typescript
interface BiomeConfig {
  temperatureScale: number;
  moistureScale: number;
  blendRadius: number;
}
```

### Fields

#### `temperatureScale: number`

Temperature noise frequency.

**Valid range:** 0.0001 to 0.01

**Default:** 0.001

**Example:**
```typescript
temperatureScale: 0.001
```

---

#### `moistureScale: number`

Moisture noise frequency.

**Valid range:** 0.0001 to 0.01

**Default:** 0.001

**Example:**
```typescript
moistureScale: 0.001
```

---

#### `blendRadius: number`

Biome blending radius in tiles.

**Valid range:** 0 to 20

**Default:** 0.5

**Example:**
```typescript
blendRadius: 0.5
```

---

## EnhancedBiomeConfig

Advanced biome system with transitions and elevation bands.

```typescript
interface EnhancedBiomeConfig extends BiomeConfig {
  enableTransitions: boolean;
  transitionWidth: number;
  enableElevationBands: boolean;
  snowLineElevation: number;
  treeLineElevation: number;
  enableClimateSystem?: boolean;
  enableCompatibilityMatrix?: boolean;
}
```

### Transition Fields

#### `enableTransitions: boolean`

Enable smooth biome boundary blending.

**Default:** false

**Example:**
```typescript
enableTransitions: true
```

---

#### `transitionWidth: number`

Transition zone width in tiles.

**Valid range:** 1 to 50

**Default:** 4

**Example:**
```typescript
transitionWidth: 4
```

---

### Elevation Band Fields

#### `enableElevationBands: boolean`

Enable mountain elevation zones.

**Default:** true

**Elevation bands:**
- FOOTHILLS (below tree line)
- SLOPES (tree line to snow line)
- PEAKS (above snow line)

**Example:**
```typescript
enableElevationBands: true
```

---

#### `snowLineElevation: number`

Snow line elevation (normalized 0-1).

**Valid range:** 0 to 1

**Default:** 0.8

**Example:**
```typescript
snowLineElevation: 0.8
```

---

#### `treeLineElevation: number`

Tree line elevation (normalized 0-1).

**Valid range:** 0 to 1

**Default:** 0.75

**Example:**
```typescript
treeLineElevation: 0.75
```

---

### Climate Fields

#### `enableClimateSystem?: boolean`

Use geographically plausible climate system.

**Default:** false

**Example:**
```typescript
enableClimateSystem: true
```

---

#### `enableCompatibilityMatrix?: boolean`

Prevent impossible biome neighbors (Desert -> Taiga, etc.).

**Default:** false

**Example:**
```typescript
enableCompatibilityMatrix: true
```

---

## LakeConfig

Configuration for lake generation using noise-guided flood-fill algorithm.

```typescript
interface LakeConfig {
  enabled: boolean;
  useMultiChunk?: boolean;
  noiseScale: number;
  noiseThreshold: number;
  minElevation: number;
  maxElevation: number;
  allowedBiomes: BiomeType[];
  maxLakeTiles: number;
  maxFillDepth: number;
}
```

### Fields

#### `enabled: boolean`

Enable lake generation.

**Default:** true

**Example:**
```typescript
enabled: true
```

---

#### `useMultiChunk?: boolean`

Allow lakes to span multiple chunks.

**Default:** false

**Example:**
```typescript
useMultiChunk: true
```

---

#### `noiseScale: number`

Lake candidate region frequency.

**Valid range:** 0.001 to 0.1

**Default:** 0.01

**Example:**
```typescript
noiseScale: 0.01
```

---

#### `noiseThreshold: number`

Threshold for lake placement. Higher = fewer lakes.

**Valid range:** 0 to 1

**Default:** 0.62

**Example:**
```typescript
noiseThreshold: 0.62
```

---

#### `minElevation: number`

Minimum elevation for lakes (must be above sea level).

**Valid range:** 0 to 1

**Default:** 0.32

**Example:**
```typescript
minElevation: 0.32
```

---

#### `maxElevation: number`

Maximum elevation for lakes (no lakes on peaks).

**Valid range:** 0 to 1

**Default:** 0.72

**Example:**
```typescript
maxElevation: 0.72
```

---

#### `allowedBiomes: BiomeType[]`

Biomes that can have lakes.

**Default:** `[PLAINS, FOREST, TAIGA, SWAMP]`

**Example:**
```typescript
allowedBiomes: [
  BiomeType.PLAINS,
  BiomeType.FOREST,
  BiomeType.TAIGA,
  BiomeType.SWAMP,
]
```

---

#### `maxLakeTiles: number`

Maximum tiles per lake.

**Valid range:** 10 to 500

**Default:** 80

**Example:**
```typescript
maxLakeTiles: 80
```

---

#### `maxFillDepth: number`

Maximum water rise above seed tile.

**Valid range:** 0.01 to 0.2

**Default:** 0.06

**Example:**
```typescript
maxFillDepth: 0.06
```

---

## RiverConfig

Configuration for river generation using A* pathfinding.

```typescript
interface RiverConfig {
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
}
```

### Fields

#### `enabled: boolean`

Enable river generation.

**Default:** true

**Performance impact:** +40-60ms per chunk (the most expensive optional feature)

**Example:**
```typescript
enabled: true
```

---

#### `sourceNoiseScale: number`

Noise scale for river source candidates.

**Valid range:** 0.001 to 0.1

**Default:** 0.005

**Example:**
```typescript
sourceNoiseScale: 0.005
```

---

#### `sourceThreshold: number`

Threshold for source placement. Higher = fewer rivers.

**Valid range:** 0 to 1

**Default:** 0.7

**Example:**
```typescript
sourceThreshold: 0.7
```

---

#### `minSourceElevation: number`

Minimum elevation for river sources.

**Valid range:** 0 to 1

**Default:** 0.5

**Example:**
```typescript
minSourceElevation: 0.5
```

---

#### `maxSourceElevation: number`

Maximum elevation for river sources.

**Valid range:** 0 to 1

**Default:** 0.95

**Example:**
```typescript
maxSourceElevation: 0.95
```

---

#### `allowedSourceBiomes: BiomeType[]`

Biomes that can spawn river sources.

**Default:** `[MOUNTAIN, TAIGA, FOREST]`

**Example:**
```typescript
allowedSourceBiomes: [
  BiomeType.MOUNTAIN,
  BiomeType.TAIGA,
  BiomeType.FOREST,
]
```

---

#### `maxLength: number`

Maximum river length in tiles.

**Valid range:** 10 to 1000

**Default:** 200

**Example:**
```typescript
maxLength: 200
```

---

#### `maxUphillBudget: number`

Maximum elevation the river can climb.

**Valid range:** 0 to 1

**Default:** 0.15

**Example:**
```typescript
maxUphillBudget: 0.15
```

---

#### `minRiverLength: number`

Minimum river length.

**Valid range:** 5 to 100

**Default:** 20

**Example:**
```typescript
minRiverLength: 20
```

---

#### `maxRiversPerRegion: number`

Maximum rivers per region.

**Valid range:** 1 to 10

**Default:** 3

**Example:**
```typescript
maxRiversPerRegion: 3
```

---

#### `maxTributaries: number`

Maximum tributaries per river.

**Valid range:** 0 to 5

**Default:** 2

**Example:**
```typescript
maxTributaries: 2
```

---

#### `baseWidth: number`

Base river width.

**Valid range:** 1 to 10

**Default:** 2.0

**Example:**
```typescript
baseWidth: 2.0
```

---

## ResourceConfig

Configuration for resource placement using noise clustering.

```typescript
interface ResourceConfig {
  types: ResourceTypeConfig[];
  clusterScale: number;
  densityThreshold: number;
}

interface ResourceTypeConfig {
  type: ResourceType;
  rarity: number;
  biomes: BiomeType[];
  minAmount: number;
  maxAmount: number;
}
```

### Fields

#### `types: ResourceTypeConfig[]`

Array of resource types to generate.

**Example:**
```typescript
types: [
  {
    type: ResourceType.IRON,
    rarity: 0.3,
    biomes: [BiomeType.MOUNTAIN, BiomeType.TUNDRA],
    minAmount: 10,
    maxAmount: 50,
  },
  {
    type: ResourceType.GOLD,
    rarity: 0.1,
    biomes: [BiomeType.MOUNTAIN],
    minAmount: 5,
    maxAmount: 20,
  },
]
```

---

#### `clusterScale: number`

Cluster noise scale.

**Valid range:** 1 to 100

**Default:** 20

**Example:**
```typescript
clusterScale: 20
```

---

#### `densityThreshold: number`

Density threshold for resource placement.

**Valid range:** 0 to 1

**Default:** 0.6

**Example:**
```typescript
densityThreshold: 0.6
```

---

## StructureConfig

Configuration for structure placement using Poisson Disk Sampling.

```typescript
interface StructureConfig {
  types: StructureTypeConfig[];
  minDistance: number;
  maxAttempts: number;
}

interface StructureTypeConfig {
  type: StructureType;
  rarity: number;
  rules: PlacementRule[];
}

interface PlacementRule {
  type: 'biome' | 'slope' | 'elevation' | 'distance';
  params: any;
}
```

### Fields

#### `types: StructureTypeConfig[]`

Array of structure types to generate.

**Example:**
```typescript
types: [
  {
    type: StructureType.VILLAGE,
    rarity: 1.0,
    rules: [
      { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
      { type: 'slope', params: { maxSlope: 0.1 } },
    ],
  },
]
```

---

#### `minDistance: number`

Minimum distance between structures.

**Valid range:** 1 to 100

**Default:** 30

**Example:**
```typescript
minDistance: 30
```

---

#### `maxAttempts: number`

Maximum placement attempts per structure.

**Valid range:** 1 to 100

**Default:** 30

**Example:**
```typescript
maxAttempts: 30
```

---

## WorkerPoolConfig

Configuration for multi-threaded chunk generation.

```typescript
interface WorkerPoolConfig {
  maxWorkers: number;
  workerScriptUrl: string;
  taskTimeout: number;
  worldConfig?: any;
  createWorker?: (workerScriptUrl: string) => Worker;
}
```

### Fields

#### `maxWorkers: number`

Maximum number of worker threads.

**Valid range:** 1 to 16

**Recommended:** `navigator.hardwareConcurrency || 4`

**Example:**
```typescript
maxWorkers: 4
```

---

#### `workerScriptUrl: string`

URL to worker script.

**Example:**
```typescript
workerScriptUrl: '/worker.js'
```

---

#### `taskTimeout: number`

Task timeout in milliseconds.

**Valid range:** 1000 to 60000

**Default:** 30000

**Example:**
```typescript
taskTimeout: 30000
```

---

## Noise3DConfig

Configuration for 3D noise generation. Usually derived automatically from `terrainConfig` via `deriveNoise3DConfig`.

```typescript
interface Noise3DConfig {
  enable3D: boolean;
  octaves: number;
  persistence: number;
  lacunarity: number;
  scale: number;
  zScale?: number;
}
```

### Fields

#### `enable3D: boolean`

Enable 3D noise mode.

**Default:** false

**Example:**
```typescript
enable3D: true
```

---

#### `zScale?: number`

Z-axis scale factor for 3D noise.

**Default:** 0.5

**Example:**
```typescript
zScale: 0.5
```

---

## ErrorRecoveryOptions

Configuration for error handling and recovery.

```typescript
interface ErrorRecoveryOptions {
  retryOnFailure: boolean;
  maxRetries: number;
  allowPartialChunks: boolean;
  onError?: (error: Error) => void;
}
```

### Fields

#### `retryOnFailure: boolean`

Retry generation on failure.

**Default:** false

**Example:**
```typescript
retryOnFailure: true
```

---

#### `maxRetries: number`

Maximum retry attempts.

**Valid range:** 1 to 10

**Default:** 3

**Example:**
```typescript
maxRetries: 3
```

---

#### `allowPartialChunks: boolean`

Allow chunks with failed optional features.

**Default:** false

**Example:**
```typescript
allowPartialChunks: true
```

---

#### `onError?: (error: Error) => void`

Error callback.

**Example:**
```typescript
onError: (error) => {
  console.error('Generation error:', error);
}
```

---

## Validation Rules

All configuration values are validated on `ChunkManager` construction. Invalid values throw `ValidationError`.

### Common Validation Errors

```typescript
import { ValidationError } from 'procedural-world-engine';

try {
  new ChunkManager({ seed: 12345, chunkSize: 1000 });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`${error.field}: ${error.constraint}`);
    // "chunkSize: Must be between 4 and 256"
  }
}
```

### Validation Ranges

| Field | Min | Max | Default |
|-------|-----|-----|---------|
| `chunkSize` | 4 | 256 | - |
| `maxCacheSize` | 1 | 10000 | 100 |
| `terrainConfig.baseScale` | 0.001 | 0.1 | - |
| `terrainConfig.octaves` | 1 | 16 | - |
| `terrainConfig.persistence` | 0 | 1 | - |
| `terrainConfig.lacunarity` | 1 | 4 | - |
| `terrainConfig.warpStrength` | 0 | 100 | - |
| `terrainConfig.heightMultiplier` | 0.1 | 10 | - |
| `biomeConfig.blendRadius` | 0 | 20 | 0.5 |
| `lakeConfig.maxLakeTiles` | 10 | 500 | 80 |
| `lakeConfig.maxFillDepth` | 0.01 | 0.2 | 0.06 |
| `riverConfig.maxLength` | 10 | 1000 | 200 |
| `riverConfig.maxRiversPerRegion` | 1 | 10 | 3 |
| `riverConfig.maxTributaries` | 0 | 5 | 2 |

---

**[Back to Documentation](README.md)**
