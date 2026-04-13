# Procedural World Engine Examples

This directory contains example code demonstrating various features of the Procedural World Engine.

## Running Examples

To run any example, use ts-node or compile with TypeScript:

```bash
# Using ts-node
npx ts-node examples/basic-usage.ts

# Or compile and run
npx tsc examples/basic-usage.ts
node examples/basic-usage.js
```

## Available Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates the most basic usage of the engine:
- Creating a ChunkManager with minimal configuration
- Generating a single chunk
- Accessing heightmap and biome data
- Understanding chunk caching

**Key Concepts:**
- ChunkManager initialization
- Chunk generation
- Data access patterns

### 2. Resource Generation (`with-resources.ts`)

Shows how to configure and generate resources:
- Defining multiple resource types
- Setting biome restrictions
- Configuring rarity and amounts
- Analyzing generated resources

**Key Concepts:**
- ResourceConfig setup
- Biome-based resource distribution
- Resource clustering
- Resource statistics

### 3. Structure Placement (`with-structures.ts`)

Demonstrates structure placement with rules:
- Defining structure types
- Setting placement rules (biome, slope, elevation)
- Configuring minimum distance constraints
- Verifying placement rules

**Key Concepts:**
- StructureConfig setup
- Placement rule types
- Poisson Disk Sampling
- Distance constraints

### 4. Coordinate Utilities (`coordinate-utilities.ts`)

Explains coordinate system conversions:
- World to chunk coordinates
- Chunk to world coordinates
- Local coordinates within chunks
- Array index conversions
- Handling negative coordinates

**Key Concepts:**
- Coordinate systems
- Conversion functions
- Practical usage patterns

### 5. Web Worker Usage (`web-worker-usage.ts`)

Shows how to use Web Workers for non-blocking generation:
- Setting up a Web Worker
- Initializing the engine in worker context
- Generating chunks asynchronously
- Handling progress and errors
- Multiple chunk generation

**Key Concepts:**
- Web Worker integration
- Message-based communication
- Serialization/deserialization
- Non-blocking generation

### 6. Performance Monitoring (`performance-monitoring.ts`)

Demonstrates performance tracking and optimization:
- Enabling performance metrics
- Using progress callbacks
- Benchmarking chunk generation
- Cache statistics
- Custom performance tracking

**Key Concepts:**
- Performance measurement
- Progress tracking
- Cache management
- Optimization techniques

### 7. Incremental Generation (`incremental-generation.ts`)

Shows how to use incremental chunk generation for responsive applications:
- Enabling incremental generation
- Accessing partial chunk data during generation
- Parallel incremental generation of multiple chunks
- Cancelling generation
- Monitoring generation progress
- Integrating with game loops

**Key Concepts:**
- Incremental generation stages
- Time budget management
- Partial data access
- Frame budget integration
- Responsive generation

### 8. Binary Serialization (`binary-serialization.ts`)

Demonstrates world serialization and deserialization:
- Serializing world data to binary format
- Deserializing world data from binary format
- Compression options
- Checksum validation

**Key Concepts:**
- World persistence
- Binary format
- Compression
- Data integrity

### 9. Export World (`export-world.ts`)

Shows how to export world data to files:
- Exporting to JSON format
- Exporting to binary format
- Selective region export
- Import functionality

**Key Concepts:**
- File export
- Format selection
- Region filtering
- Import/export workflow

### 10. Modification Tracking (`modification-tracking.ts`)

Demonstrates how to track modifications to generated chunks for world persistence:
- Recording single terrain edits
- Recording multiple terrain edits at once
- Recording structure additions
- Recording structure removals
- Recording combined structure changes
- Complex modification scenarios (terraforming and building)

**Key Concepts:**
- Modification tracking
- Terrain editing
- Structure management
- Delta compression
- Persistence workflow

### 11. 3D Noise Usage (`3d-noise-usage.ts`)

Demonstrates 3D noise generation for more realistic terrain features:
- Enabling 3D noise configuration
- Comparing 2D vs 3D noise output
- Adjusting z-scale for different effects
- Combining 3D noise with domain warping
- Practical use cases for volumetric terrain

**Key Concepts:**
- 3D Simplex noise
- Vertical variation
- Z-scale configuration
- Volumetric terrain generation
- Cave and overhang detection

### 12. Enhanced Biomes (`enhanced-biomes.ts`)

Shows the enhanced biome system with advanced features:
- Smooth transition zones between biomes
- Micro-biomes (oasis, clearings, ponds, groves)
- Elevation bands in mountains (foothills, slopes, peaks)
- Biome distribution analysis
- Comparing standard vs enhanced biomes

**Key Concepts:**
- Biome transitions
- Micro-biome variations
- Elevation-based classification
- Natural biome boundaries
- Enhanced realism

### 13. River Networks (`river-networks.ts`)

Demonstrates river network data structures and concepts:
- Basic river generation
- River network data structures (RiverSegment, Lake, RiverNetwork)
- River configuration options
- River distribution analysis
- Future enhancements (tributaries, lakes, deltas)

**Key Concepts:**
- River flow simulation
- Network data structures
- Flow-based width calculation
- Cross-chunk rivers
- Hydrological features

### 14. Worker Pool Usage (`worker-pool-usage.ts`)

Shows how to use the WorkerPool for parallel chunk generation:
- Worker pool setup and configuration
- Submitting and managing tasks
- Priority-based task queue
- Task cancellation
- Pool statistics and monitoring
- Graceful shutdown

**Key Concepts:**
- Parallel processing
- Multi-threading
- Task prioritization
- Performance optimization
- Resource management

### 15. LOD System (`lod-system.ts`)

Demonstrates the Level of Detail system for performance optimization:
- LOD configuration and setup
- Distance-based LOD selection
- Applying LOD to chunks
- Dynamic LOD updates
- Performance benefits and memory savings
- Best practices

**Key Concepts:**
- Level of Detail
- Distance-based quality
- Mesh resolution reduction
- Feature density control
- Performance scaling

## Configuration Guide

### Terrain Configuration

```typescript
terrainConfig: {
  baseScale: 0.01,        // Scale of noise (smaller = more variation)
  octaves: 4,             // Number of noise layers (more = more detail)
  persistence: 0.5,       // Amplitude decrease per octave
  lacunarity: 2.0,        // Frequency increase per octave
  warpStrength: 30,       // Domain warping strength (0 = no warp)
  heightMultiplier: 1.0,  // Final height scaling
}
```

### Biome Configuration

```typescript
biomeConfig: {
  temperatureScale: 0.005,  // Scale of temperature noise
  moistureScale: 0.005,     // Scale of moisture noise
  blendRadius: 5,           // Radius for biome blending
}
```

### Resource Configuration

```typescript
resourceConfig: {
  types: [
    {
      type: ResourceType.STONE,
      rarity: 0.3,                              // 0-1, higher = more rare
      biomes: [BiomeType.MOUNTAIN],             // Allowed biomes
      minAmount: 10,                            // Minimum resource amount
      maxAmount: 50,                            // Maximum resource amount
    }
  ],
  clusterScale: 20,         // Scale of clustering noise
  densityThreshold: 0.6,    // Threshold for resource placement (0-1)
}
```

### Structure Configuration

```typescript
structureConfig: {
  types: [
    {
      type: StructureType.VILLAGE,
      rarity: 1.0,                              // Relative rarity weight
      rules: [
        { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
        { type: 'slope', params: { maxSlope: 0.1 } },
        { type: 'elevation', params: { minHeight: 0.3, maxHeight: 0.7 } },
        { type: 'nearWater', params: { maxDistance: 10 } },
      ],
    }
  ],
  minDistance: 10,          // Minimum distance between structures
  maxAttempts: 30,          // Max attempts for Poisson sampling
}
```

### River Configuration

```typescript
riverConfig: {
  sourceElevation: 0.7,     // Minimum elevation for river sources
  minFlowLength: 10,        // Minimum river length to keep
  flowWidth: 2,             // Width of river paths (in tiles)
}
```

### Incremental Generation Configuration

```typescript
incrementalConfig: {
  enabled: true,            // Enable incremental generation
  timeBudgetMs: 16,         // Time budget per stage in ms (16ms = 60fps)
}
```

### 3D Noise Configuration

```typescript
noise3DConfig: {
  enable3D: true,           // Enable 3D noise generation
  zScale: 0.5,              // Z-axis scale factor (smaller = more vertical variation)
}
```

### Enhanced Biome Configuration

```typescript
enhancedBiomeConfig: {
  temperatureScale: 0.005,
  moistureScale: 0.005,
  blendRadius: 5,
  enableTransitions: true,        // Enable smooth transition zones
  transitionWidth: 10,            // Transition zone width in tiles
  enableMicroBiomes: true,        // Enable micro-biome variations
  microBiomeFrequency: 0.1,       // Micro-biome frequency (0-1)
  microBiomeMaxSize: 20,          // Maximum micro-biome size in tiles
  enableElevationBands: true,     // Enable mountain elevation bands
  snowLineElevation: 0.8,         // Snow line threshold (0-1)
  treeLineElevation: 0.75,        // Tree line threshold (0-1)
}
```

### LOD Configuration

```typescript
lodConfig: {
  distances: [2, 5],              // LOD distance thresholds in chunks
  meshResolutions: [1.0, 0.5, 0.25],  // Mesh resolution per LOD level
  featureDensities: [1.0, 0.5, 0.1],  // Feature density per LOD level
}
```

### Worker Pool Configuration

```typescript
workerPoolConfig: {
  maxWorkers: 4,                  // Maximum number of worker threads
  workerScriptUrl: './worker.js', // Path to worker script
  taskTimeout: 30000,             // Task timeout in milliseconds
}
```

## Tips and Best Practices

1. **Seed Selection**: Use consistent seeds for reproducible worlds. Different seeds produce completely different worlds.

2. **Chunk Size**: Larger chunks (64x64) are more efficient but use more memory. Smaller chunks (16x16) allow finer-grained loading.

3. **Cache Management**: The ChunkManager caches chunks by default. Use `clearCache()` if memory is a concern.

4. **Resource Density**: Lower `densityThreshold` values create more resources. Adjust based on gameplay needs.

5. **Structure Placement**: More restrictive rules result in fewer structures. Balance rules with `maxAttempts` for good coverage.

6. **Performance**: Chunk generation is CPU-intensive. Consider generating chunks in a Web Worker for non-blocking operation.

7. **Incremental Generation**: Use incremental generation when you need to maintain responsiveness during chunk generation. Set `timeBudgetMs` to match your target frame rate (16ms for 60fps).

8. **Partial Data Access**: With incremental generation, you can access and render partial chunk data (e.g., terrain) while other stages (e.g., structures) are still generating.

9. **3D Noise**: Enable 3D noise for more realistic terrain with vertical variation. Adjust `zScale` to control the amount of variation (lower = more variation).

10. **Enhanced Biomes**: Use enhanced biomes for more realistic worlds with smooth transitions, micro-biomes, and elevation bands. All features can be toggled independently.

11. **LOD System**: Implement LOD to improve performance with large view distances. Tune distance thresholds based on your target hardware and visual quality requirements.

12. **Worker Pool**: Use the worker pool for parallel chunk generation on multi-core systems. Set `maxWorkers` to `navigator.hardwareConcurrency` for optimal performance.

13. **Serialization**: Choose binary format for smaller file sizes and faster loading. Use JSON format for debugging and human-readable exports.

14. **Modification Tracking**: Enable modification tracking to persist player changes across sessions. Modifications are stored separately from generated data for efficient delta compression.

## Further Reading

- See the main README.md for architecture overview
- Check the design document in `.kiro/specs/procedural-world-engine/design.md`
- Review test files for more usage examples
