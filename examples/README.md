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

## Tips and Best Practices

1. **Seed Selection**: Use consistent seeds for reproducible worlds. Different seeds produce completely different worlds.

2. **Chunk Size**: Larger chunks (64x64) are more efficient but use more memory. Smaller chunks (16x16) allow finer-grained loading.

3. **Cache Management**: The ChunkManager caches chunks by default. Use `clearCache()` if memory is a concern.

4. **Resource Density**: Lower `densityThreshold` values create more resources. Adjust based on gameplay needs.

5. **Structure Placement**: More restrictive rules result in fewer structures. Balance rules with `maxAttempts` for good coverage.

6. **Performance**: Chunk generation is CPU-intensive. Consider generating chunks in a Web Worker for non-blocking operation.

## Further Reading

- See the main README.md for architecture overview
- Check the design document in `.kiro/specs/procedural-world-engine/design.md`
- Review test files for more usage examples
