# API Reference

Complete API documentation for tQandtD project.

## Table of Contents

- [ChunkManager](#chunkmanager)
- [Configuration Types](#configuration-types)
- [Data Types](#data-types)
- [Enums](#enums)
- [Utility Functions](#utility-functions)
- [Error Types](#error-types)
- [Logging](#logging)

---

## ChunkManager

Main entry point for world generation.

### Constructor

```typescript
new ChunkManager(config: WorldConfig)
```

Creates a new chunk manager with the specified configuration.

**Parameters:**
- `config: WorldConfig` - World configuration object

**Throws:**
- `ValidationError` - If configuration is invalid

**Example:**
```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
});
```

---

### Methods

#### `getChunk(chunkX: number, chunkY: number): Promise<ChunkData>`

Generates or retrieves a chunk from cache. Uses LRU caching for performance.

**Parameters:**
- `chunkX: number` - Chunk X coordinate
- `chunkY: number` - Chunk Y coordinate

**Returns:** `Promise<ChunkData>` - The generated or cached chunk

**Performance:**
- First access: ~20ms (generation, 32x32)
- Cached access: <0.01ms
- Cache hit rate: typically 50%+

**Example:**
```typescript
const chunk = await manager.getChunk(0, 0);
console.log('Heightmap:', chunk.heightmap);
console.log('Biomes:', chunk.biomeMap);
```

---

#### `generateChunk(chunkX: number, chunkY: number): ChunkData`

Synchronously generates a chunk without caching. Use for one-off generation.

**Parameters:**
- `chunkX: number` - Chunk X coordinate
- `chunkY: number` - Chunk Y coordinate

**Returns:** `ChunkData` - The generated chunk

**Throws:**
- `ChunkGenerationError` - If generation fails
- `TerrainGenerationError` - If terrain stage fails
- `BiomeGenerationError` - If biome stage fails
- `LakeGenerationError` - If lake stage fails
- `RiverGenerationError` - If river stage fails
- `ResourceGenerationError` - If resource stage fails
- `StructureGenerationError` - If structure stage fails

**Example:**
```typescript
try {
  const chunk = manager.generateChunk(0, 0);
} catch (error) {
  if (error instanceof ChunkGenerationError) {
    console.error('Failed at stage:', error.stage);
  }
}
```

---

#### `clearCache(): void`

Clears all cached chunks. Useful for freeing memory.

**Example:**
```typescript
manager.clearCache();
console.log('Cache cleared');
```

---

#### `getCacheSize(): number`

Returns the current number of chunks in cache.

**Returns:** `number` - Cache size

**Example:**
```typescript
const size = manager.getCacheSize();
console.log(`${size} chunks cached`);
```

---

#### `getCacheStats(): CacheStats`

Returns detailed cache statistics.

**Returns:** `CacheStats`
```typescript
{
  size: number;        // Current cache size
  maxSize: number;     // Maximum cache size
  hitRate: number;     // Cache hit rate (0-1)
}
```

**Example:**
```typescript
const stats = manager.getCacheStats();
console.log(`Cache: ${stats.size}/${stats.maxSize}`);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

---

## Configuration Types

### WorldConfig

Main configuration object for world generation.

```typescript
interface WorldConfig {
  // Required
  seed: number;                    // World seed (any number)
  chunkSize: number;               // Chunk size (4-256)

  // Optional
  terrainConfig?: TerrainConfig;
  biomeConfig?: BiomeConfig;
  enhancedBiomeConfig?: EnhancedBiomeConfig;
  resourceConfig?: ResourceConfig;
  structureConfig?: StructureConfig;
  lakeConfig?: LakeConfig;
  riverConfig?: RiverConfig;
  maxCacheSize?: number;           // Default: 100 (ChunkManager), 1000 (createDefaultWorldConfig)
  workerPoolConfig?: WorkerPoolConfig;
  errorRecovery?: ErrorRecoveryOptions;
  enablePerformanceMetrics?: boolean;
  onProgress?: ProgressCallback;
  noise3DConfig?: Noise3DConfig;
}
```

---

### TerrainConfig

Configuration for terrain generation.

```typescript
interface TerrainConfig {
  baseScale: number;          // Noise scale (0.001-0.1, default: 0.01)
  octaves: number;            // Noise octaves (1-16, default: 4)
  persistence: number;        // Amplitude decay (0-1, default: 0.5)
  lacunarity: number;         // Frequency multiplier (1-4, default: 2.0)
  warpStrength: number;       // Domain warping (0-100, default: 0.2)
  heightMultiplier: number;   // Height scaling (0.1-10, default: 2.0)
  enable3D?: boolean;         // Enable volumetric noise (default: false)
  zScale?: number;            // Z-axis scale for 3D (default: 0.5)
  enableContinentalness?: boolean;  // Enable continental plates (default: true)
  continentalScale?: number;        // Continental noise scale (default: 0.002)
  continentalStrength?: number;     // Continental effect strength (default: 0.45)
}
```

---

### EnhancedBiomeConfig

Configuration for enhanced biome system with transitions and elevation bands.

```typescript
interface EnhancedBiomeConfig extends BiomeConfig {
  enableTransitions: boolean;           // Enable biome transitions (default: false)
  transitionWidth: number;              // Transition width in tiles (default: 4)
  enableElevationBands: boolean;        // Enable mountain bands (default: true)
  snowLineElevation: number;            // Snow line (0-1, default: 0.8)
  treeLineElevation: number;            // Tree line (0-1, default: 0.75)
  enableClimateSystem?: boolean;        // Use climate system (default: false)
  enableCompatibilityMatrix?: boolean;  // Enforce biome compatibility (default: false)
}
```

---

### LakeConfig

Configuration for lake generation.

```typescript
interface LakeConfig {
  enabled: boolean;              // Enable lakes (default: true)
  useMultiChunk?: boolean;       // Allow multi-chunk lakes (default: false)
  noiseScale: number;            // Noise scale for placement (default: 0.01)
  noiseThreshold: number;        // Threshold for lake placement (default: 0.62)
  minElevation: number;          // Min elevation for lakes (default: 0.32)
  maxElevation: number;          // Max elevation for lakes (default: 0.72)
  allowedBiomes: BiomeType[];    // Biomes that can have lakes
  maxLakeTiles: number;          // Max tiles per lake (default: 80)
  maxFillDepth: number;          // Max water depth (default: 0.06)
}
```

---

### RiverConfig

Configuration for river generation.

```typescript
interface RiverConfig {
  enabled: boolean;                 // Enable rivers (default: true)
  sourceNoiseScale: number;         // Noise scale for source candidates (default: 0.005)
  sourceThreshold: number;          // Threshold for source placement (default: 0.7)
  minSourceElevation: number;       // Minimum source elevation (default: 0.5)
  maxSourceElevation: number;       // Maximum source elevation (default: 0.95)
  allowedSourceBiomes: BiomeType[]; // Biomes that can spawn rivers
  maxLength: number;                // Max river length in tiles (default: 200)
  maxUphillBudget: number;          // Max elevation the river can climb (default: 0.15)
  minRiverLength: number;           // Minimum river length (default: 20)
  maxRiversPerRegion: number;       // Max rivers per region (default: 3)
  maxTributaries: number;           // Max tributaries per river (default: 2)
  baseWidth: number;                // Base river width (default: 2.0)
}
```

---

### ResourceConfig

Configuration for resource placement.

```typescript
interface ResourceConfig {
  types: ResourceTypeConfig[];   // Resource types to generate
  clusterScale: number;          // Cluster noise scale
  densityThreshold: number;      // Density threshold
}

interface ResourceTypeConfig {
  type: ResourceType;            // Resource type
  rarity: number;                // Rarity (0-1)
  biomes: BiomeType[];           // Allowed biomes
  minAmount: number;             // Min amount per cluster
  maxAmount: number;             // Max amount per cluster
}
```

---

### WorkerPoolConfig

Configuration for multi-threaded chunk generation.

```typescript
interface WorkerPoolConfig {
  maxWorkers: number;            // Max worker threads
  workerScriptUrl: string;       // Worker script URL
  taskTimeout: number;           // Task timeout (ms)
  worldConfig?: any;             // Internal: config forwarded to workers
  createWorker?: (workerScriptUrl: string) => Worker; // Custom worker factory
}
```

**Example:**
```typescript
workerPoolConfig: {
  maxWorkers: navigator.hardwareConcurrency || 4,
  workerScriptUrl: '/worker.js',
  taskTimeout: 30000,
}
```

---

### Noise3DConfig

Configuration for 3D noise generation (derived automatically from terrainConfig when `enable3D` is true).

```typescript
interface Noise3DConfig {
  enable3D: boolean;      // Enable 3D mode
  octaves: number;        // Noise octaves
  persistence: number;    // Amplitude decay
  lacunarity: number;     // Frequency multiplier
  scale: number;          // Noise scale
  zScale?: number;        // Z-coordinate scale (default: 0.5)
}
```

---

## Data Types

### ChunkData

Complete chunk data structure.

```typescript
interface ChunkData {
  x: number;                          // Chunk X coordinate
  y: number;                          // Chunk Y coordinate
  size: number;                       // Chunk size
  heightmap: Float32Array;            // (size+1)x(size+1) heights
  biomeMap: Uint8Array;               // size*size biome IDs
  sparseBiomeTypes: Uint8Array;       // Sparse biome types
  sparseBiomeWeights: Float32Array;   // Sparse biome weights
  sparseBiomeOffsets: Uint16Array;    // Sparse offsets
  lakes?: LakeData[];                 // Lake bodies
  rivers?: RiverData[];               // River paths intersecting this chunk
  resources: Resource[];              // Resource instances
  structures: Structure[];            // Structure instances
}
```

**Memory Usage (32x32 chunk):**
- Heightmap: 1.13 KB
- Biome map: 0.25 KB
- Sparse biome weights: ~4.75 KB
- Resources: ~0 KB
- Structures: 0.09 KB
- **Total: ~6.2 KB**

---

### Resource

Resource instance data.

```typescript
interface Resource {
  x: number;              // Local X coordinate (0-size)
  y: number;              // Local Y coordinate (0-size)
  type: ResourceType;     // Resource type
  amount: number;         // Amount available
}
```

---

### Structure

Structure instance data.

```typescript
interface Structure {
  x: number;              // Local X coordinate (0-size)
  y: number;              // Local Y coordinate (0-size)
  type: StructureType;    // Structure type
}
```

---

### LakeData

Lake body data.

```typescript
interface LakeData {
  waterLevel: number;         // Water surface elevation
  tiles: Set<number>;         // Tile indices in lake
  maxDepth: number;           // Maximum depth
  minTerrainHeight?: number;  // Minimum terrain height
}
```

---

### RiverData

River path data for a chunk.

```typescript
interface RiverData {
  riverId: string;                              // Unique river identifier
  pathId: string;                               // Path identifier
  isTributary: boolean;                         // Whether this is a tributary
  points: RiverPoint[];                         // Path points
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

interface RiverPoint {
  x: number;           // World X coordinate
  y: number;           // World Y coordinate
  height: number;      // Terrain height at this point
  surfaceLevel: number; // Water surface level
  width: number;       // River width
  depth: number;       // River depth
  flowX: number;       // Flow direction X
  flowY: number;       // Flow direction Y
}
```

---

## Enums

### BiomeType

```typescript
enum BiomeType {
  OCEAN = 0,
  BEACH = 1,
  DESERT = 2,
  PLAINS = 3,
  FOREST = 4,
  TAIGA = 5,
  TUNDRA = 6,
  MOUNTAIN = 7,
  SAVANNA = 8,
  SWAMP = 9,
  RAINFOREST = 10,
  VOLCANIC = 11,
  GLACIER = 12,
}
```

---

### ResourceType

```typescript
enum ResourceType {
  IRON = 0,
  GOLD = 1,
  COAL = 2,
  STONE = 3,
  WOOD = 4,
}
```

---

### StructureType

```typescript
enum StructureType {
  VILLAGE = 0,
  RUINS = 1,
  TOWER = 2,
}
```

---

## Utility Functions

### Coordinate Conversion

#### `worldToChunk(worldX: number, worldY: number, chunkSize: number): [number, number]`

Converts world coordinates to chunk coordinates.

**Example:**
```typescript
const [chunkX, chunkY] = worldToChunk(100, 200, 32);
// chunkX = 3, chunkY = 6
```

---

#### `worldToLocal(worldX: number, worldY: number, chunkSize: number): [number, number]`

Converts world coordinates to local tile coordinates within a chunk.

**Example:**
```typescript
const [localX, localY] = worldToLocal(100, 200, 32);
// localX = 4, localY = 8
```

---

#### `chunkToWorld(chunkX: number, chunkY: number, chunkSize: number): [number, number]`

Converts chunk coordinates to world coordinates (top-left corner).

**Example:**
```typescript
const [worldX, worldY] = chunkToWorld(3, 6, 32);
// worldX = 96, worldY = 192
```

---

#### `localToIndex(localX: number, localY: number, chunkSize: number): number`

Converts local tile coordinates to flat array index.

**Example:**
```typescript
const index = localToIndex(5, 10, 32);
// index = 10 * 32 + 5 = 325
```

---

### Biome Weight Access

#### `getBiomeWeightsForTile(chunk: ChunkData, tileIndex: number): Map<BiomeType, number>`

Gets all biome weights for a tile from sparse representation.

**Example:**
```typescript
const weights = getBiomeWeightsForTile(chunk, 325);
for (const [biome, weight] of weights) {
  console.log(`${BiomeType[biome]}: ${weight}`);
}
```

---

#### `getBiomeWeightForTile(chunk: ChunkData, tileIndex: number, biomeType: BiomeType): number`

Gets weight for a specific biome at a tile.

**Example:**
```typescript
const forestWeight = getBiomeWeightForTile(chunk, 325, BiomeType.FOREST);
console.log(`Forest: ${forestWeight}`);
```

---

## Error Types

### ChunkGenerationError

Base error for chunk generation failures.

```typescript
class ChunkGenerationError extends Error {
  chunkX: number;
  chunkY: number;
  stage: string;
  cause?: Error;
}
```

---

### ValidationError

Error for invalid configuration.

```typescript
class ValidationError extends Error {
  field: string;
  value: any;
  constraint: string;
}
```

**Example:**
```typescript
try {
  new ChunkManager({ seed: 12345, chunkSize: 1000 });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`${error.field}: ${error.constraint}`);
  }
}
```

---

## Logging

### configureLogger

```typescript
function configureLogger(config: Partial<LoggerConfig>): void
```

Configures the global logger.

**Parameters:**
```typescript
interface LoggerConfig {
  level: LogLevel;
  categories?: Set<LogCategory>;
  timestamps?: boolean;
  handler?: (level, category, message, data?) => void;
}
```

**Example:**
```typescript
import { configureLogger, LogLevel, LogCategory } from 'tqandtd-project';

// Development
configureLogger({
  level: LogLevel.DEBUG,
  timestamps: true,
});

// Production
configureLogger({
  level: LogLevel.WARN,
});

// Custom handler
configureLogger({
  level: LogLevel.ERROR,
  handler: (level, category, message, data) => {
    // Send to error tracking service
    errorTracker.log({ level, category, message, data });
  },
});
```

---

### LogLevel

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}
```

---

### LogCategory

```typescript
enum LogCategory {
  CHUNK = 'Chunk',
  LAKE = 'Lake',
  RIVER = 'River',
  WORKER = 'Worker',
  CACHE = 'Cache',
  PERFORMANCE = 'Performance',
  GENERAL = 'General',
}
```

---

**[Back to Documentation](README.md)**
