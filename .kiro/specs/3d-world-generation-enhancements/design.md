# Design Document: 3D World Generation Enhancements

## Overview

This design extends the existing procedural world generation library to support 3D visualization with enhanced realism and complexity. The enhancements are organized into five major areas:

1. **3D Noise Generation**: Extend the NoiseEngine to support 3D Perlin and Simplex noise for volumetric terrain features
2. **Advanced Biome System**: Implement transition zones, micro-biomes, and elevation bands for richer biome diversity
3. **Enhanced River Networks**: Add tributaries, lakes, deltas, and flow-based width calculation for realistic hydrology
4. **Performance Optimization**: Implement multi-threading, LOD system, and incremental generation for scalability
5. **World Persistence**: Add serialization, deserialization, and modification tracking for save/load functionality

The design maintains backward compatibility with the existing 2D generation system while adding opt-in 3D features.

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      ChunkManager                            │
│  - Orchestrates all generation systems                       │
│  - Manages LRU cache and worker pool                         │
│  - Handles LOD selection and incremental generation          │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│ NoiseEngine3D  │  │ BiomeSystem │  │ RiverNetwork    │
│ - 3D Perlin    │  │ Enhanced    │  │ Generator       │
│ - 3D Simplex   │  │ - Transitions│  │ - Tributaries   │
│ - fBM support  │  │ - Micro-biomes│ │ - Lakes         │
└────────────────┘  │ - Elev. bands│  │ - Deltas        │
                    └──────────────┘  │ - Flow calc     │
                                      └─────────────────┘
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│ WorkerPool     │  │ LODManager  │  │ Serializer      │
│ - Thread mgmt  │  │ - Distance  │  │ - JSON format   │
│ - Task queue   │  │ - Mesh LOD  │  │ - Binary format │
│ - Load balance │  │ - Feature   │  │ - Compression   │
└────────────────┘  │   density   │  │ - Modifications │
                    └─────────────┘  └─────────────────┘
```

### Data Flow

1. **Chunk Request** → ChunkManager receives request with LOD level
2. **Cache Check** → Check LRU cache for existing chunk at requested LOD
3. **Worker Assignment** → If not cached, assign to available worker thread
4. **Incremental Generation**:
   - Stage 1: Terrain heightmap (3D noise)
   - Stage 2: Biome classification (with transitions and micro-biomes)
   - Stage 3: River network (with tributaries and lakes)
   - Stage 4: Resources and structures (density based on LOD)
5. **Cache Storage** → Store completed chunk in LRU cache
6. **Return** → Return chunk data to caller

## Components and Interfaces

### 1. NoiseEngine3D

Extends the existing NoiseEngine to support 3D noise generation.

```typescript
/**
 * Configuration for 3D noise generation
 */
interface Noise3DConfig extends NoiseConfig {
  /** Enable 3D mode (default: false for backward compatibility) */
  enable3D: boolean;
  /** Z-coordinate scale factor for 3D noise */
  zScale?: number;
}

/**
 * 3D noise generation engine extending 2D NoiseEngine
 */
class NoiseEngine3D extends NoiseEngine {
  /**
   * Generates 3D Simplex noise at the given coordinates
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @returns Noise value in range [-1, 1]
   */
  noise3D(x: number, y: number, z: number): number;

  /**
   * Generates 3D fractional Brownian motion noise
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @param config - Noise configuration
   * @returns Noise value in range approximately [-1, 1]
   */
  fbm3D(x: number, y: number, z: number, config: Noise3DConfig): number;

  /**
   * Applies 3D domain warping to coordinates
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @param strength - Warping strength multiplier
   * @returns Warped [x, y, z] coordinates
   */
  domainWarp3D(x: number, y: number, z: number, strength: number): [number, number, number];
}
```

**Implementation Notes**:
- 3D Simplex noise uses 4D simplex grid with skewing factors F3 = 1/3 and G3 = 1/6
- Gradient vectors for 3D: 12 edge midpoints of a cube
- Permutation table remains the same as 2D version
- For terrain generation, z-coordinate can represent depth or be used as a variation parameter

### 2. Enhanced BiomeSystem

Extends BiomeSystem with transition zones, micro-biomes, and elevation bands.

```typescript
/**
 * Enhanced biome configuration
 */
interface EnhancedBiomeConfig extends BiomeConfig {
  /** Enable transition zones (default: true) */
  enableTransitions: boolean;
  /** Transition zone width in world units (default: 10) */
  transitionWidth: number;
  
  /** Enable micro-biomes (default: true) */
  enableMicroBiomes: boolean;
  /** Micro-biome frequency (0-1, default: 0.1) */
  microBiomeFrequency: number;
  /** Maximum micro-biome size in tiles (default: 20) */
  microBiomeMaxSize: number;
  
  /** Enable elevation bands in mountains (default: true) */
  enableElevationBands: boolean;
  /** Snow line elevation threshold (default: 0.8) */
  snowLineElevation: number;
  /** Tree line elevation threshold (default: 0.75) */
  treeLineElevation: number;
}

/**
 * Micro-biome types
 */
enum MicroBiomeType {
  OASIS = 0,        // In deserts
  CLEARING = 1,     // In forests
  POND = 2,         // In plains
  GROVE = 3,        // In tundra
}

/**
 * Elevation band types for mountains
 */
enum ElevationBand {
  FOOTHILLS = 0,    // Below tree line, forested
  SLOPES = 1,       // Above tree line, rocky
  PEAKS = 2,        // Above snow line, snowy
}

/**
 * Enhanced biome data with additional information
 */
interface EnhancedBiomeData {
  /** Primary biome type */
  biome: BiomeType;
  /** Biome blend weights for smooth transitions */
  weights: Map<BiomeType, number>;
  /** Micro-biome type if present */
  microBiome?: MicroBiomeType;
  /** Elevation band for mountain biomes */
  elevationBand?: ElevationBand;
  /** Transition factor (0 = pure biome, 1 = full transition) */
  transitionFactor: number;
}

class EnhancedBiomeSystem extends BiomeSystem {
  private microBiomeNoise: NoiseEngine;
  private config: EnhancedBiomeConfig;

  /**
   * Gets enhanced biome data at a world position
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param height - Height value at this position (0-1 range)
   * @returns Enhanced biome data with transitions and micro-biomes
   */
  getEnhancedBiome(x: number, y: number, height: number): EnhancedBiomeData;

  /**
   * Determines if a micro-biome should exist at this location
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param parentBiome - The parent biome type
   * @returns Micro-biome type or undefined
   */
  private getMicroBiome(x: number, y: number, parentBiome: BiomeType): MicroBiomeType | undefined;

  /**
   * Determines elevation band for mountain terrain
   * @param height - Height value (0-1 range)
   * @returns Elevation band type
   */
  private getElevationBand(height: number): ElevationBand;

  /**
   * Calculates transition factor based on distance to biome boundaries
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param height - Height value
   * @returns Transition factor (0-1)
   */
  private calculateTransitionFactor(x: number, y: number, height: number): number;
}
```

**Implementation Notes**:
- Transition zones use distance-based blending with configurable width
- Micro-biomes use separate noise layer with frequency control
- Micro-biome placement respects parent biome constraints (e.g., oasis only in desert)
- Elevation bands use height thresholds with smooth transitions
- Transition factor affects vegetation density and terrain features

### 3. RiverNetworkGenerator

Replaces RiverGenerator with enhanced network generation supporting tributaries, lakes, and deltas.

```typescript
/**
 * Enhanced river configuration
 */
interface RiverNetworkConfig extends RiverConfig {
  /** Enable tributary generation (default: true) */
  enableTributaries: boolean;
  /** Maximum tributary order (1 = no tributaries, 2 = tributaries of main rivers, etc.) */
  maxTributaryOrder: number;
  /** Tributary spawn probability (0-1, default: 0.3) */
  tributaryProbability: number;
  
  /** Enable lake generation (default: true) */
  enableLakes: boolean;
  /** Minimum depression depth for lake formation (default: 0.05) */
  lakeDepressionThreshold: number;
  /** Maximum lake size in tiles (default: 100) */
  maxLakeSize: number;
  
  /** Enable delta generation (default: true) */
  enableDeltas: boolean;
  /** Delta branch count (default: 3) */
  deltaBranchCount: number;
  /** Delta spread angle in radians (default: Math.PI / 3) */
  deltaSpreadAngle: number;
  
  /** Minimum flow for river width calculation (default: 1.0) */
  minFlow: number;
  /** Maximum flow for river width calculation (default: 100.0) */
  maxFlow: number;
  /** Width scaling factor (default: 0.5) */
  widthScale: number;
}

/**
 * River segment with flow information
 */
interface RiverSegment {
  /** Flat index in chunk */
  index: number;
  /** Accumulated flow at this segment */
  flow: number;
  /** Calculated width at this segment */
  width: number;
  /** River order (1 = main river, 2 = tributary, etc.) */
  order: number;
  /** Next segment index (-1 if terminus) */
  next: number;
}

/**
 * Lake data structure
 */
interface Lake {
  /** Set of tile indices forming the lake */
  tiles: Set<number>;
  /** Lake surface elevation */
  elevation: number;
  /** Outlet river segment index (-1 if no outlet) */
  outlet: number;
}

/**
 * River network data for a chunk
 */
interface RiverNetwork {
  /** All river segments */
  segments: RiverSegment[];
  /** Lakes in this chunk */
  lakes: Lake[];
  /** Map from tile index to segment index */
  tileToSegment: Map<number, number>;
}

class RiverNetworkGenerator {
  private config: RiverNetworkConfig;

  /**
   * Generates complete river network for a chunk
   * @param chunkData - The chunk data containing heightmap
   * @param chunkSeed - Unique seed for this chunk
   * @param neighborChunks - Adjacent chunks for cross-chunk rivers
   * @returns River network data
   */
  generateNetwork(
    chunkData: ChunkData,
    chunkSeed: number,
    neighborChunks?: Map<string, ChunkData>
  ): RiverNetwork;

  /**
   * Finds depressions in terrain for lake placement
   * @param heightmap - Chunk heightmap
   * @param size - Chunk size
   * @returns Array of lake data
   */
  private findLakes(heightmap: Float32Array, size: number): Lake[];

  /**
   * Generates main rivers from high elevation sources
   * @param chunkData - Chunk data
   * @param seed - Random seed
   * @returns Array of river segments
   */
  private generateMainRivers(chunkData: ChunkData, seed: number): RiverSegment[];

  /**
   * Generates tributaries for existing rivers
   * @param mainRivers - Existing river segments
   * @param chunkData - Chunk data
   * @param seed - Random seed
   * @returns Array of tributary segments
   */
  private generateTributaries(
    mainRivers: RiverSegment[],
    chunkData: ChunkData,
    seed: number
  ): RiverSegment[];

  /**
   * Calculates accumulated flow for all river segments
   * @param segments - All river segments
   * @returns Updated segments with flow values
   */
  private calculateFlow(segments: RiverSegment[]): RiverSegment[];

  /**
   * Calculates river width based on accumulated flow
   * @param flow - Accumulated flow value
   * @returns River width in tiles
   */
  private calculateWidth(flow: number): number;

  /**
   * Generates delta formation where river meets ocean
   * @param riverSegment - River segment at ocean boundary
   * @param chunkData - Chunk data
   * @returns Array of delta branch segments
   */
  private generateDelta(riverSegment: RiverSegment, chunkData: ChunkData): RiverSegment[];

  /**
   * Merges tributary into main river
   * @param tributary - Tributary segment
   * @param mainRiver - Main river segment
   * @returns Updated main river with increased flow
   */
  private mergeTributary(tributary: RiverSegment, mainRiver: RiverSegment): RiverSegment;
}
```

**Implementation Notes**:
- River network generation requires multi-pass algorithm:
  1. Find lakes (depression filling)
  2. Generate main rivers from sources
  3. Generate tributaries near main rivers
  4. Calculate accumulated flow (topological sort)
  5. Calculate widths based on flow
  6. Generate deltas at ocean boundaries
- Tributaries use proximity detection to find merge points
- Flow calculation uses topological ordering (upstream to downstream)
- Width calculation uses logarithmic scaling: `width = widthScale * log(flow + 1)`
- Delta generation creates branching pattern with terrain modification
- Cross-chunk rivers require neighbor chunk data for continuity

### 4. WorkerPool

Manages multiple Web Workers for parallel chunk generation.

```typescript
/**
 * Worker pool configuration
 */
interface WorkerPoolConfig {
  /** Maximum number of worker threads (default: navigator.hardwareConcurrency) */
  maxWorkers: number;
  /** Worker script URL */
  workerScriptUrl: string;
  /** Timeout for worker tasks in ms (default: 30000) */
  taskTimeout: number;
}

/**
 * Worker task data
 */
interface WorkerTask {
  /** Unique task ID */
  id: string;
  /** Chunk coordinates */
  chunkX: number;
  chunkY: number;
  /** LOD level */
  lodLevel: number;
  /** Task priority (higher = more urgent) */
  priority: number;
  /** Callback for task completion */
  onComplete: (chunk: ChunkData) => void;
  /** Callback for task error */
  onError: (error: Error) => void;
}

/**
 * Worker state tracking
 */
interface WorkerState {
  /** Worker instance */
  worker: Worker;
  /** Currently assigned task (null if idle) */
  currentTask: WorkerTask | null;
  /** Number of completed tasks */
  completedTasks: number;
}

class WorkerPool {
  private config: WorkerPoolConfig;
  private workers: WorkerState[];
  private taskQueue: WorkerTask[];
  private activeTasks: Map<string, WorkerTask>;

  /**
   * Creates a new WorkerPool
   * @param config - Worker pool configuration
   */
  constructor(config: WorkerPoolConfig);

  /**
   * Submits a chunk generation task to the pool
   * @param task - Worker task data
   * @returns Task ID for tracking
   */
  submitTask(task: WorkerTask): string;

  /**
   * Cancels a pending or active task
   * @param taskId - Task ID to cancel
   * @returns True if task was cancelled
   */
  cancelTask(taskId: string): boolean;

  /**
   * Gets pool statistics
   * @returns Object with pool statistics
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    queuedTasks: number;
    completedTasks: number;
  };

  /**
   * Shuts down all workers
   */
  shutdown(): void;

  /**
   * Assigns next task from queue to an idle worker
   */
  private assignNextTask(): void;

  /**
   * Handles task completion from worker
   * @param workerId - Worker index
   * @param result - Chunk data result
   */
  private handleTaskComplete(workerId: number, result: ChunkData): void;

  /**
   * Handles task error from worker
   * @param workerId - Worker index
   * @param error - Error object
   */
  private handleTaskError(workerId: number, error: Error): void;
}
```

**Implementation Notes**:
- Worker pool size defaults to `navigator.hardwareConcurrency` (typically CPU core count)
- Task queue uses priority-based ordering (higher priority tasks execute first)
- Workers are initialized with world configuration on pool creation
- Task timeout prevents hung workers from blocking the pool
- Load balancing uses simple round-robin assignment to idle workers
- Worker communication uses structured cloning for chunk data transfer

### 5. LODManager

Manages level-of-detail selection and chunk generation at different detail levels.

```typescript
/**
 * LOD configuration
 */
interface LODConfig {
  /** LOD distance thresholds (in chunks) */
  distances: number[];
  /** Mesh resolution multipliers for each LOD (1.0 = full resolution) */
  meshResolutions: number[];
  /** Feature density multipliers for each LOD (1.0 = full density) */
  featureDensities: number[];
}

/**
 * LOD level enumeration
 */
enum LODLevel {
  HIGH = 0,    // Full detail, close to viewer
  MEDIUM = 1,  // Reduced detail, medium distance
  LOW = 2,     // Minimal detail, far distance
}

class LODManager {
  private config: LODConfig;

  /**
   * Creates a new LODManager
   * @param config - LOD configuration
   */
  constructor(config: LODConfig);

  /**
   * Determines appropriate LOD level based on distance
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param viewerX - Viewer X coordinate (in chunks)
   * @param viewerY - Viewer Y coordinate (in chunks)
   * @returns LOD level
   */
  getLODLevel(chunkX: number, chunkY: number, viewerX: number, viewerY: number): LODLevel;

  /**
   * Gets mesh resolution for a LOD level
   * @param level - LOD level
   * @returns Resolution multiplier (0-1)
   */
  getMeshResolution(level: LODLevel): number;

  /**
   * Gets feature density for a LOD level
   * @param level - LOD level
   * @returns Density multiplier (0-1)
   */
  getFeatureDensity(level: LODLevel): number;

  /**
   * Applies LOD to chunk data
   * @param chunk - Full-resolution chunk data
   * @param level - Target LOD level
   * @returns LOD-adjusted chunk data
   */
  applyLOD(chunk: ChunkData, level: LODLevel): ChunkData;

  /**
   * Reduces heightmap resolution for LOD
   * @param heightmap - Full-resolution heightmap
   * @param size - Original size
   * @param resolution - Target resolution multiplier
   * @returns Downsampled heightmap
   */
  private downsampleHeightmap(
    heightmap: Float32Array,
    size: number,
    resolution: number
  ): Float32Array;

  /**
   * Reduces feature count based on density multiplier
   * @param features - Array of resources or structures
   * @param density - Target density multiplier
   * @param seed - Random seed for consistent selection
   * @returns Filtered feature array
   */
  private filterFeatures<T>(features: T[], density: number, seed: number): T[];
}
```

**Implementation Notes**:
- LOD levels are determined by Euclidean distance from viewer position
- Default LOD distances: [0-2 chunks = HIGH, 2-5 chunks = MEDIUM, 5+ chunks = LOW]
- Mesh resolution affects heightmap sampling density (e.g., 0.5 = half resolution)
- Feature density affects resource and structure count (e.g., 0.25 = 25% of features)
- Downsampling uses bilinear interpolation for smooth transitions
- Feature filtering uses deterministic random selection based on chunk seed

### 6. IncrementalGenerator

Manages incremental chunk generation with yielding for responsiveness.

```typescript
/**
 * Generation stage enumeration
 */
enum GenerationStage {
  TERRAIN = 0,
  BIOMES = 1,
  RIVERS = 2,
  RESOURCES = 3,
  STRUCTURES = 4,
  COMPLETE = 5,
}

/**
 * Partial chunk data during incremental generation
 */
interface PartialChunkData {
  /** Chunk coordinates */
  x: number;
  y: number;
  /** Current generation stage */
  stage: GenerationStage;
  /** Partial chunk data (fields populated as stages complete) */
  data: Partial<ChunkData>;
}

/**
 * Incremental generation configuration
 */
interface IncrementalConfig {
  /** Time budget per stage in ms (default: 16 for 60fps) */
  timeBudgetMs: number;
  /** Enable incremental generation (default: false) */
  enabled: boolean;
}

class IncrementalGenerator {
  private config: IncrementalConfig;
  private activeGenerations: Map<string, PartialChunkData>;

  /**
   * Creates a new IncrementalGenerator
   * @param config - Incremental generation configuration
   */
  constructor(config: IncrementalConfig);

  /**
   * Starts incremental generation for a chunk
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param worldConfig - World configuration
   * @returns Partial chunk data (updated as generation progresses)
   */
  startGeneration(chunkX: number, chunkY: number, worldConfig: WorldConfig): PartialChunkData;

  /**
   * Continues generation for a chunk (call repeatedly until complete)
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns True if generation is complete
   */
  continueGeneration(chunkX: number, chunkY: number): boolean;

  /**
   * Gets current generation stage for a chunk
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Current generation stage or undefined if not generating
   */
  getStage(chunkX: number, chunkY: number): GenerationStage | undefined;

  /**
   * Cancels incremental generation for a chunk
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   */
  cancelGeneration(chunkX: number, chunkY: number): void;

  /**
   * Executes a generation stage with time budget
   * @param partial - Partial chunk data
   * @param stage - Stage to execute
   * @returns True if stage completed within time budget
   */
  private executeStage(partial: PartialChunkData, stage: GenerationStage): boolean;
}
```

**Implementation Notes**:
- Incremental generation divides chunk generation into 5 stages
- Each stage respects time budget (default 16ms for 60fps)
- Stages execute in order: TERRAIN → BIOMES → RIVERS → RESOURCES → STRUCTURES
- Partial chunk data can be accessed before completion (e.g., render terrain while resources generate)
- Time budget uses `performance.now()` for accurate timing
- If stage exceeds time budget, it yields and continues on next call

### 7. WorldSerializer

Handles serialization and deserialization of world data with modification tracking.

```typescript
/**
 * Serialization format enumeration
 */
enum SerializationFormat {
  JSON = 'json',
  BINARY = 'binary',
}

/**
 * Serialization options
 */
interface SerializationOptions {
  /** Output format */
  format: SerializationFormat;
  /** Enable compression (default: true) */
  compress: boolean;
  /** Include only modified chunks (default: false) */
  modifiedOnly: boolean;
  /** Chunk region to export (undefined = all chunks) */
  region?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Modification record for chunk changes
 */
interface ChunkModification {
  /** Chunk coordinates */
  chunkX: number;
  chunkY: number;
  /** Modification timestamp */
  timestamp: number;
  /** Modified tile indices */
  modifiedTiles: Set<number>;
  /** Height modifications (sparse array) */
  heightChanges: Map<number, number>;
  /** Structure additions */
  addedStructures: Structure[];
  /** Structure removals (by index) */
  removedStructures: number[];
}

/**
 * Serialized world data
 */
interface SerializedWorld {
  /** Format version for compatibility */
  version: string;
  /** World seed */
  seed: number;
  /** World configuration */
  config: WorldConfig;
  /** Serialized chunks */
  chunks: SerializedChunk[];
  /** Modification records */
  modifications: ChunkModification[];
  /** Checksum for integrity validation */
  checksum: string;
}

/**
 * Serialized chunk data
 */
interface SerializedChunk {
  x: number;
  y: number;
  /** Compressed heightmap data */
  heightmap: ArrayBuffer | string;
  /** Compressed biome data */
  biomeMap: ArrayBuffer | string;
  /** Resources array */
  resources: Resource[];
  /** Structures array */
  structures: Structure[];
  /** River indices array */
  rivers: number[];
}

class WorldSerializer {
  /**
   * Serializes world data to specified format
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Serialized world data
   */
  serialize(chunkManager: ChunkManager, options: SerializationOptions): SerializedWorld;

  /**
   * Deserializes world data and restores to chunk manager
   * @param data - Serialized world data
   * @param chunkManager - Target chunk manager
   */
  deserialize(data: SerializedWorld, chunkManager: ChunkManager): void;

  /**
   * Exports world data to file-compatible format
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Blob or string for file export
   */
  export(chunkManager: ChunkManager, options: SerializationOptions): Blob | string;

  /**
   * Imports world data from file
   * @param data - File data (Blob or string)
   * @param format - Expected format
   * @returns Serialized world data
   */
  import(data: Blob | string, format: SerializationFormat): Promise<SerializedWorld>;

  /**
   * Compresses data using LZ-based compression
   * @param data - Data to compress
   * @returns Compressed data
   */
  private compress(data: ArrayBuffer): ArrayBuffer;

  /**
   * Decompresses data
   * @param data - Compressed data
   * @returns Decompressed data
   */
  private decompress(data: ArrayBuffer): ArrayBuffer;

  /**
   * Calculates checksum for integrity validation
   * @param data - Serialized world data
   * @returns Checksum string
   */
  private calculateChecksum(data: SerializedWorld): string;

  /**
   * Validates checksum
   * @param data - Serialized world data
   * @returns True if checksum is valid
   */
  private validateChecksum(data: SerializedWorld): boolean;
}
```

**Implementation Notes**:
- JSON format uses base64 encoding for binary data (heightmaps, biome maps)
- Binary format uses custom binary protocol with type markers
- Compression uses pako library (zlib/deflate) for browser compatibility
- Checksum uses CRC32 for fast integrity validation
- Modification tracking stores only changed data (delta compression)
- Deserialization validates version compatibility before loading
- Export/import handles file I/O with proper MIME types

## Data Models

### Enhanced ChunkData

```typescript
interface EnhancedChunkData extends ChunkData {
  /** LOD level of this chunk */
  lodLevel: LODLevel;
  /** Enhanced biome data with transitions */
  enhancedBiomes?: EnhancedBiomeData[];
  /** River network data */
  riverNetwork?: RiverNetwork;
  /** Modification record if chunk has been modified */
  modifications?: ChunkModification;
  /** Generation stage (for incremental generation) */
  generationStage?: GenerationStage;
}
```

### WorldConfig Extensions

```typescript
interface EnhancedWorldConfig extends WorldConfig {
  /** 3D noise configuration */
  noise3DConfig?: Noise3DConfig;
  /** Enhanced biome configuration */
  enhancedBiomeConfig?: EnhancedBiomeConfig;
  /** River network configuration */
  riverNetworkConfig?: RiverNetworkConfig;
  /** Worker pool configuration */
  workerPoolConfig?: WorkerPoolConfig;
  /** LOD configuration */
  lodConfig?: LODConfig;
  /** Incremental generation configuration */
  incrementalConfig?: IncrementalConfig;
}
```


## Error Handling

### Noise Generation Errors

**Invalid Coordinates**:
- **Detection**: Check for `NaN`, `Infinity`, or extremely large values
- **Handling**: Return 0 for invalid coordinates, log warning in debug mode
- **Prevention**: Validate coordinates at API boundaries

**Invalid Configuration**:
- **Detection**: Validate config parameters (octaves >= 1, persistence > 0, etc.)
- **Handling**: Throw descriptive error with parameter name and valid range
- **Prevention**: Use TypeScript types and runtime validation

### River Network Errors

**Circular Flow Detection**:
- **Detection**: Track visited segments during flow calculation
- **Handling**: Break cycle at detection point, log warning
- **Prevention**: Use topological sort for flow calculation

**Cross-Chunk Boundary Issues**:
- **Detection**: Check if river exits chunk without neighbor data
- **Handling**: Terminate river at boundary, mark as incomplete
- **Prevention**: Request neighbor chunks before river generation

**Lake Overflow**:
- **Detection**: Check if lake exceeds maximum size during filling
- **Handling**: Cap lake size, create outlet river
- **Prevention**: Set reasonable `maxLakeSize` in configuration

### Worker Pool Errors

**Worker Timeout**:
- **Detection**: Track task start time, compare against timeout threshold
- **Handling**: Terminate worker, restart with new worker, retry task once
- **Prevention**: Set appropriate timeout based on chunk complexity

**Worker Crash**:
- **Detection**: Listen for worker `error` and `messageerror` events
- **Handling**: Log error, remove worker from pool, create replacement worker
- **Prevention**: Validate all data sent to workers

**Task Queue Overflow**:
- **Detection**: Check queue size against maximum threshold
- **Handling**: Reject new tasks with error, suggest increasing worker count
- **Prevention**: Implement backpressure mechanism

### Serialization Errors

**Checksum Mismatch**:
- **Detection**: Calculate checksum on deserialization, compare with stored value
- **Handling**: Throw error with corruption details, refuse to load
- **Prevention**: Validate data integrity before writing

**Version Incompatibility**:
- **Detection**: Compare serialized version with current version
- **Handling**: Attempt migration if possible, otherwise throw error
- **Prevention**: Maintain version compatibility matrix

**Compression Failure**:
- **Detection**: Catch exceptions from compression library
- **Handling**: Fall back to uncompressed format, log warning
- **Prevention**: Validate data size before compression

### LOD Errors

**Invalid LOD Level**:
- **Detection**: Check if LOD level is within valid range
- **Handling**: Clamp to valid range, log warning
- **Prevention**: Use enum type for LOD levels

**Downsampling Artifacts**:
- **Detection**: Check for discontinuities in downsampled heightmap
- **Handling**: Apply smoothing filter to reduce artifacts
- **Prevention**: Use appropriate interpolation method (bilinear)

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Specific biome transition scenarios
- Known river network configurations
- LOD downsampling with known inputs
- Serialization round-trips with sample data
- Worker pool lifecycle events

**Property-Based Tests**: Verify universal properties across all inputs
- Noise generation properties (continuity, determinism)
- River network properties (no cycles, flow conservation)
- Biome transition properties (smooth blending, weight sum)
- Serialization properties (round-trip identity)
- LOD properties (monotonic quality degradation)

Both approaches are complementary and necessary for ensuring correctness.

### Property-Based Testing Configuration

**Testing Library**: Use `fast-check` (already in project dependencies)

**Test Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: 3d-world-generation-enhancements, Property {number}: {property_text}`

**Example Test Structure**:
```typescript
import fc from 'fast-check';

// Feature: 3d-world-generation-enhancements, Property 1: 3D noise determinism
test('3D noise produces same output for same seed and coordinates', () => {
  fc.assert(
    fc.property(
      fc.integer(),           // seed
      fc.float(),             // x
      fc.float(),             // y
      fc.float(),             // z
      (seed, x, y, z) => {
        const engine1 = new NoiseEngine3D(seed);
        const engine2 = new NoiseEngine3D(seed);
        const value1 = engine1.noise3D(x, y, z);
        const value2 = engine2.noise3D(x, y, z);
        return Math.abs(value1 - value2) < 1e-10;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Organization

```
tests/
├── unit/
│   ├── noise-3d.test.ts
│   ├── enhanced-biomes.test.ts
│   ├── river-network.test.ts
│   ├── worker-pool.test.ts
│   ├── lod-manager.test.ts
│   ├── incremental-generator.test.ts
│   └── world-serializer.test.ts
├── property/
│   ├── noise-3d-properties.test.ts
│   ├── biome-properties.test.ts
│   ├── river-properties.test.ts
│   ├── serialization-properties.test.ts
│   └── lod-properties.test.ts
├── integration/
│   ├── full-generation.test.ts
│   ├── cross-chunk-rivers.test.ts
│   └── save-load-cycle.test.ts
└── performance/
    ├── generation-benchmarks.test.ts
    └── worker-pool-benchmarks.test.ts
```

### Integration Testing

**Full Generation Pipeline**:
- Generate chunks with all enhancements enabled
- Verify all components work together correctly
- Check for memory leaks during extended generation

**Cross-Chunk Features**:
- Generate adjacent chunks and verify river continuity
- Verify biome transitions across chunk boundaries
- Test LOD transitions between adjacent chunks

**Save/Load Cycle**:
- Generate world, save to both formats, load back
- Verify world state is identical after round-trip
- Test with modifications applied

### Performance Testing

**Benchmarks**:
- Chunk generation time with 3D noise vs 2D noise
- River network generation time with tributaries vs without
- Worker pool throughput with varying worker counts
- Serialization/deserialization time for different world sizes

**Performance Targets**:
- Chunk generation: <150ms per chunk (50% increase from current <100ms due to added complexity)
- Worker pool: Linear scaling up to CPU core count
- Serialization: <1s for 100 chunks
- Deserialization: <2s for 100 chunks


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: 3D Noise Determinism

*For any* seed value and any set of 3D coordinates (x, y, z), generating noise twice with the same seed and coordinates should produce identical values.

**Validates: Requirements 1.5**

### Property 2: Biome Transition Existence

*For any* two adjacent positions with different biomes, there should exist a transition zone between them where biome weights blend smoothly.

**Validates: Requirements 2.1**

### Property 3: Biome Transition Smoothness

*For any* position within a transition zone, all blended characteristics (terrain features, vegetation density, temperature, moisture) should vary smoothly based on distance from biome centers, with no abrupt discontinuities.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: Micro-Biome Parent Constraint

*For any* generated micro-biome, it should only appear within its valid parent biome type (oasis in desert, clearing in forest, pond in plains, grove in tundra).

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 5: Micro-Biome Size Constraint

*For any* generated micro-biome, its size in tiles should not exceed the configured maximum size threshold.

**Validates: Requirements 3.5**

### Property 6: Elevation Band Classification

*For any* position in mountain terrain, it should be classified into the correct elevation band based on its height: forested foothills below tree line, rocky slopes between tree line and snow line, snowy peaks above snow line.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 7: Elevation Band Transition Smoothness

*For any* two adjacent positions in different elevation bands, the transition should be smooth with no abrupt changes in terrain characteristics.

**Validates: Requirements 4.5**

### Property 8: Tributary Merge Behavior

*For any* tributary that flows within merge distance of a larger river, it should merge into the main river at the closest point.

**Validates: Requirements 5.2**

### Property 9: River Flow Conservation

*For any* river segment, its accumulated flow should equal the sum of all upstream tributary contributions, and when tributaries merge, the main river's flow should increase by the tributary's flow.

**Validates: Requirements 5.3, 5.4**

### Property 10: River Network Acyclicity

*For any* generated river network, there should be no cycles—following the flow direction from any segment should never return to the same segment.

**Validates: Requirements 5.5**

### Property 11: Lake Formation in Depressions

*For any* terrain depression below the elevation threshold and not in an ocean biome, it should be identified and filled to create a lake.

**Validates: Requirements 6.1, 6.2, 6.5**

### Property 12: River-Lake Interaction

*For any* river that flows into a lake, it should terminate at the lake boundary, and for any lake with sufficient water volume, an outlet river should be created.

**Validates: Requirements 6.3, 6.4**

### Property 13: Delta Formation at Ocean

*For any* river that reaches ocean-level terrain, it should be identified as a delta formation point and branch into multiple channels spreading in a fan pattern toward the ocean.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 14: Delta Channel Width Hierarchy

*For any* delta, child channels should have narrower width than their parent channels, creating a hierarchical branching structure.

**Validates: Requirements 7.4**

### Property 15: River Width Based on Flow

*For any* river segment, its width should be calculated based on accumulated flow, increase proportionally with flow, and remain within configured minimum and maximum bounds.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 16: River Width Smoothness

*For any* two adjacent river segments, the width transition should be smooth with no abrupt jumps.

**Validates: Requirements 8.5**

### Property 17: Worker Task Distribution

*For any* set of chunk generation requests, tasks should be distributed across available workers such that no worker is idle while tasks remain in the queue.

**Validates: Requirements 9.2**

### Property 18: Thread-Safe Parameter Access

*For any* concurrent access to shared world generation parameters from multiple workers, the data should remain consistent with no corruption or race conditions.

**Validates: Requirements 9.3**

### Property 19: LOD Distance-Based Selection

*For any* chunk at a given distance from the viewer, it should be generated at the appropriate LOD level according to configured distance thresholds, with farther chunks using lower LOD.

**Validates: Requirements 10.2**

### Property 20: LOD Quality Degradation

*For any* chunk generated at a lower LOD level, both terrain mesh resolution and feature density should be reduced compared to higher LOD levels.

**Validates: Requirements 10.3, 10.4**

### Property 21: Serialization Completeness

*For any* world state, serialization should preserve all chunk data, world seed, configuration parameters, terrain, biomes, resources, structures, and river data.

**Validates: Requirements 12.3, 12.5**

### Property 22: Serialization Round-Trip Identity

*For any* world state, serializing then deserializing (in either JSON or binary format) should produce a world state identical to the original.

**Validates: Requirements 13.5**

### Property 23: Modification Tracking Completeness

*For any* modification to terrain or structures, the modification should be recorded in the change log and included in serialized data.

**Validates: Requirements 14.2, 14.3, 14.4**

### Property 24: Modification Persistence

*For any* world with modifications, deserializing should apply all recorded modifications to regenerated chunks, preserving the modified state.

**Validates: Requirements 14.5**

### Property 25: Export Integrity Validation

*For any* exported world data, it should include a valid checksum that can be verified to detect corruption.

**Validates: Requirements 15.5**
