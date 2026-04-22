# Procedural World Engine

A TypeScript-based procedural world generation engine designed for browser-based applications. The system generates infinite, deterministic worlds using seed-based random number generation, chunk-based loading, and multi-layer noise functions.

## Features

- **Deterministic Generation**: Same seed always produces the same world
- **Chunk-Based Architecture**: Efficient lazy loading with LRU caching
- **Multi-Layer Terrain**: Realistic heightmaps using fractional Brownian motion and domain warping
- **3D Noise Generation**: Volumetric noise for enhanced terrain features with vertical variation
- **Enhanced Biome System**: 8 diverse ecosystems with smooth transitions, micro-biomes, and elevation bands
- **Comprehensive Water System**: Separate rendering layer for oceans and lakes with transparency, configurable materials, and underwater terrain effects
- **Resource Clusters**: Natural resource distribution based on biomes (5 resource types)
- **Structure Placement**: Poisson Disk Sampling for realistic structure distribution (3 structure types)
- **Multi-Threaded Generation**: Worker pool for parallel chunk generation across CPU cores
- **Level of Detail (LOD)**: Distance-based detail reduction for improved rendering performance
- **Incremental Generation**: Progressive chunk generation with time budgets for responsive applications
- **World Persistence**: JSON and binary serialization with compression and modification tracking
- **Web Worker Support**: Non-blocking chunk generation for smooth browser performance
- **Performance Monitoring**: Optional timing measurements and progress callbacks
- **Browser Optimized**: <100ms per chunk generation (typically 20-50ms)

## Installation

```bash
npm install procedural-world-engine
```

## Quick Start

```typescript
import { ChunkManager, BiomeType, ResourceType, StructureType } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5
  },
  resourceConfig: {
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.3,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50
      }
    ],
    clusterScale: 20,
    densityThreshold: 0.6
  },
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } }
        ]
      }
    ],
    minDistance: 10,
    maxAttempts: 30
  }
});

// Generate a chunk
const chunk = manager.getChunk(0, 0);
console.log(chunk.heightmap);
console.log(chunk.resources);
console.log(chunk.structures);
```

## Advanced Features

### 3D Noise Generation

The engine supports 3D Simplex noise for volumetric terrain features and enhanced variation:

```typescript
import { ChunkManager } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  // Enable 3D noise generation
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5  // Z-coordinate scale factor
  },
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  },
  // ... other config
});

// 3D noise is automatically used for terrain generation when enabled
const chunk = manager.getChunk(0, 0);
```

**Key Features:**
- 3D Simplex noise with deterministic generation
- Fractional Brownian motion (fBM) support
- 3D domain warping for organic patterns
- Configurable z-scale for vertical variation
- Backward compatible (defaults to 2D when disabled)

### Enhanced Biome System

The enhanced biome system adds realistic transitions, localized variations, and altitude-based zones:

```typescript
import { ChunkManager, BiomeType, MicroBiomeType, ElevationBand } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  enhancedBiomeConfig: {
    // Base biome settings
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    
    // Transition zones
    enableTransitions: true,
    transitionWidth: 10,  // Width in world units
    
    // Micro-biomes (localized variations)
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,  // 0-1, controls rarity
    microBiomeMaxSize: 20,     // Maximum size in tiles
    
    // Elevation bands for mountains
    enableElevationBands: true,
    snowLineElevation: 0.8,    // Snow above this height
    treeLineElevation: 0.75    // Trees below this height
  },
  // ... other config
});

// Access enhanced biome data
const chunk = manager.getChunk(0, 0);
// Enhanced biome data includes:
// - Smooth transitions between biomes
// - Micro-biomes: OASIS (desert), CLEARING (forest), POND (plains), GROVE (tundra)
// - Elevation bands: FOOTHILLS, SLOPES, PEAKS (mountains only)
```

**Biome Transitions:**
- Smooth blending between adjacent biomes
- Configurable transition width
- Blend weights for terrain characteristics

**Micro-Biomes:**
- Oasis in deserts
- Clearings in forests
- Ponds in plains
- Groves in tundra
- Size-constrained for realism

**Elevation Bands (Mountains):**
- Foothills: Below tree line, forested
- Slopes: Above tree line, rocky
- Peaks: Above snow line, snowy

### Performance Optimizations

#### Worker Pool (Multi-Threading)

Generate chunks in parallel across multiple CPU cores:

```typescript
import { ChunkManager } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  workerPoolConfig: {
    maxWorkers: navigator.hardwareConcurrency,  // Use all CPU cores
    workerScriptUrl: '/worker.js',
    taskTimeout: 30000  // 30 second timeout
  },
  // ... other config
});

// Chunks are automatically generated in parallel
// No changes needed to your code!
const chunk1 = manager.getChunk(0, 0);
const chunk2 = manager.getChunk(1, 0);
const chunk3 = manager.getChunk(0, 1);
```

### Water Rendering System

Comprehensive water rendering with separate layers for oceans and lakes:

```typescript
import type { WaterConfig } from 'procedural-world-engine';

// Configure water appearance
const waterConfig: Partial<WaterConfig> = {
  enabled: true,
  seaLevel: 0.3,
  
  ocean: {
    color: 0x0066cc,      // Hex color
    opacity: 0.7,         // 0-1
    shininess: 80,        // 0-100
  },
  
  lake: {
    color: 0x4da6ff,
    opacity: 0.65,
  },
  
  rendering: {
    waterOffset: 0.1,                    // Prevents z-fighting
    underwaterDarkenFactor: 0.4,         // Darkens underwater terrain
    underwaterDesaturationFactor: 0.5,   // Desaturates underwater colors
    enableDepthGradient: true,           // Depth-based darkening
  },
  
  performance: {
    enableLOD: true,                     // Distance-based detail
    enableFrustumCulling: true,          // Hide off-screen water
  },
};

// Apply to viewer (demo application)
viewer.setWaterConfig(waterConfig);
viewer.setWaterVisibility(true);
```

**Features:**
- Independent water meshes (ocean, lake)
- Configurable colors, opacity, and materials
- Underwater terrain color adjustments
- Performance optimizations (LOD, frustum culling)
- Seamless chunk boundaries

#### Level of Detail (LOD)

Reduce detail for distant chunks to improve rendering performance:

```typescript
import { ChunkManager, LODLevel } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  lodConfig: {
    distances: [2, 5],           // LOD distance thresholds in chunks
    meshResolutions: [1.0, 0.5, 0.25],  // Resolution multipliers
    featureDensities: [1.0, 0.5, 0.1]   // Feature density multipliers
  },
  // ... other config
});

// Generate chunk at specific LOD level
const viewerX = 0;
const viewerY = 0;
const chunk = manager.getChunk(5, 5);  // Automatically uses appropriate LOD

// LOD levels:
// - HIGH (0-2 chunks): Full detail
// - MEDIUM (2-5 chunks): 50% resolution, 50% features
// - LOW (5+ chunks): 25% resolution, 10% features
```

**Key Features:**
- **Seamless Boundaries**: Downsampled heightmaps maintain `(newSize + 1) x (newSize + 1)` structure to prevent gaps between chunks
- **Bilinear Interpolation**: Smooth height transitions when reducing resolution
- **Automatic Size Updates**: Chunk size is automatically updated to match downsampled heightmap dimensions
- **Feature Culling**: Resources rendered only at HIGH LOD; structures at HIGH/MEDIUM LOD
- **Performance**: 2-4x frame rate improvement with 50+ chunks loaded

#### Incremental Generation

Generate chunks progressively to maintain responsiveness:

```typescript
import { ChunkManager, GenerationStage } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16  // 16ms for 60fps
  },
  // ... other config
});

// Start incremental generation
const partial = manager.getChunkIncremental(0, 0);

// Check generation progress
console.log('Stage:', GenerationStage[partial.stage]);
// Stages: TERRAIN → BIOMES → RESOURCES → STRUCTURES → COMPLETE

// Access partial data while generating
if (partial.stage >= GenerationStage.TERRAIN) {
  console.log('Terrain ready:', partial.data.heightmap);
}

// Continue generation in your game loop
function gameLoop() {
  const complete = manager.continueGeneration(0, 0);
  if (complete) {
    console.log('Chunk generation complete!');
  }
  requestAnimationFrame(gameLoop);
}
```

### World Serialization

Save and load worlds with full modification tracking:

#### JSON Format

```typescript
import { ChunkManager, WorldSerializer, SerializationFormat } from 'procedural-world-engine';

const manager = new ChunkManager({ /* config */ });

// Generate some chunks
manager.getChunk(0, 0);
manager.getChunk(1, 0);

// Save world to JSON
const savedWorld = manager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: false  // Save all chunks
});

console.log('Saved:', savedWorld.chunks.length, 'chunks');
console.log('Checksum:', savedWorld.checksum);

// Load world
const newManager = new ChunkManager({ /* same config */ });
newManager.loadWorld(savedWorld);
```

#### Binary Format

```typescript
// Save world to binary format (more efficient)
const savedWorld = manager.saveWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false
});

// Export to file
const blob = manager.exportWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  region: {
    minX: 0, minY: 0,
    maxX: 10, maxY: 10  // Export specific region
  }
});

// Save blob to file
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'world.bin';
a.click();
```

#### Modification Tracking

Track and persist player changes to the world:

```typescript
// Make modifications to terrain
manager.recordModification(0, 0, {
  chunkX: 0,
  chunkY: 0,
  timestamp: Date.now(),
  modifiedTiles: new Set([0, 1, 2]),
  heightChanges: new Map([
    [0, 0.5],  // Set tile 0 to height 0.5
    [1, 0.6],
    [2, 0.7]
  ]),
  addedStructures: [],
  removedStructures: []
});

// Modifications are automatically included in serialization
const savedWorld = manager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: true  // Only save modified chunks
});

// When loaded, modifications are automatically applied
newManager.loadWorld(savedWorld);
```

## Advanced Usage

### Web Worker Support

```typescript
import { installWorkerHandler } from 'procedural-world-engine';

// In your worker file (worker.ts)
installWorkerHandler();

// In your main thread
const worker = new Worker('worker.js');

worker.postMessage({
  type: 'init',
  config: { /* your WorldConfig */ }
});

worker.postMessage({
  type: 'generateChunk',
  chunkX: 0,
  chunkY: 0
});

worker.onmessage = (e) => {
  if (e.data.type === 'chunkReady') {
    console.log('Chunk generated:', e.data.chunk);
  }
};
```

### Performance Monitoring

```typescript
const manager = new ChunkManager({
  // ... other config
  enablePerformanceMetrics: true,
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
  }
});

// Metrics will be logged to console
const chunk = manager.getChunk(0, 0);

// Get cache statistics
const stats = manager.getCacheStats();
console.log(`Cache: ${stats.size}/${stats.maxSize}`);
```

## Configuration Guide

### Complete Configuration Example

```typescript
import { ChunkManager, BiomeType, ResourceType, StructureType } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  maxCacheSize: 100,
  
  // 3D Noise (optional)
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5
  },
  
  // Terrain Generation
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  },
  
  // Enhanced Biome System (optional, falls back to basic BiomeConfig)
  enhancedBiomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    enableTransitions: true,
    transitionWidth: 10,
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,
    microBiomeMaxSize: 20,
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75
  },
  
  // Resources
  resourceConfig: {
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.3,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50
      }
    ],
    clusterScale: 20,
    densityThreshold: 0.6
  },
  
  // Structures
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } }
        ]
      }
    ],
    minDistance: 10,
    maxAttempts: 30
  },
  
  // Worker Pool (optional)
  workerPoolConfig: {
    maxWorkers: navigator.hardwareConcurrency,
    workerScriptUrl: '/worker.js',
    taskTimeout: 30000
  },
  
  // Level of Detail (optional)
  lodConfig: {
    distances: [2, 5],
    meshResolutions: [1.0, 0.5, 0.25],
    featureDensities: [1.0, 0.5, 0.1]
  },
  
  // Incremental Generation (optional)
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16
  },
  
  // Performance Monitoring (optional)
  enablePerformanceMetrics: true,
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
  }
});
```

### Configuration Parameters

#### Terrain Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `baseScale` | number | 0.01 | Scale of noise (smaller = more variation) |
| `octaves` | number | 4 | Number of noise layers (more = more detail) |
| `persistence` | number | 0.5 | Amplitude decrease per octave |
| `lacunarity` | number | 2.0 | Frequency increase per octave |
| `warpStrength` | number | 30 | Domain warping strength (0 = no warp) |
| `heightMultiplier` | number | 1.0 | Final height scaling |

#### Enhanced Biome Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperatureScale` | number | 0.005 | Scale of temperature noise |
| `moistureScale` | number | 0.005 | Scale of moisture noise |
| `blendRadius` | number | 5 | Radius for biome blending |
| `enableTransitions` | boolean | true | Enable smooth biome transitions |
| `transitionWidth` | number | 10 | Transition zone width in world units |
| `enableMicroBiomes` | boolean | true | Enable localized biome variations |
| `microBiomeFrequency` | number | 0.1 | Micro-biome rarity (0-1) |
| `microBiomeMaxSize` | number | 20 | Maximum micro-biome size in tiles |
| `enableElevationBands` | boolean | true | Enable mountain elevation bands |
| `snowLineElevation` | number | 0.8 | Snow line threshold (0-1) |
| `treeLineElevation` | number | 0.75 | Tree line threshold (0-1) |

#### LOD Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `distances` | number[] | [2, 5] | LOD distance thresholds in chunks |
| `meshResolutions` | number[] | [1.0, 0.5, 0.25] | Resolution multipliers per LOD |
| `featureDensities` | number[] | [1.0, 0.5, 0.1] | Feature density multipliers per LOD |

#### Incremental Generation Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | false | Enable incremental generation |
| `timeBudgetMs` | number | 16 | Time budget per stage in ms (16ms = 60fps) |

## Examples

See the `examples/` directory for more usage examples:
- `basic-usage.ts` - Simple world generation
- `with-resources.ts` - Resource configuration
- `with-structures.ts` - Structure placement
- `coordinate-utilities.ts` - Coordinate conversion helpers
- `web-worker-usage.ts` - Web Worker integration
- `performance-monitoring.ts` - Performance tracking
- `incremental-generation.ts` - Incremental chunk generation
- `binary-serialization.ts` - World serialization
- `export-world.ts` - Export/import functionality
- `modification-tracking.ts` - Track world modifications

## API Documentation

### Core Types

- `ChunkManager` - Main entry point for world generation
- `ChunkData` - Complete chunk data with terrain, biomes, resources, structures
- `BiomeType` - Enum of 8 biome types (OCEAN, BEACH, DESERT, PLAINS, FOREST, TAIGA, TUNDRA, MOUNTAIN)
- `ResourceType` - Enum of 5 resource types (IRON, GOLD, COAL, STONE, WOOD)
- `StructureType` - Enum of 3 structure types (VILLAGE, RUINS, TOWER)
- `MicroBiomeType` - Enum of micro-biome types (OASIS, CLEARING, POND, GROVE)
- `ElevationBand` - Enum of elevation bands (FOOTHILLS, SLOPES, PEAKS)
- `LODLevel` - Enum of LOD levels (HIGH, MEDIUM, LOW)
- `GenerationStage` - Enum of generation stages (TERRAIN, BIOMES, RESOURCES, STRUCTURES, COMPLETE)
- `SerializationFormat` - Enum of serialization formats (JSON, BINARY)

### Configuration Interfaces

- `WorldConfig` - Complete world generation configuration
- `TerrainConfig` - Terrain generation parameters
- `BiomeConfig` - Biome classification parameters
- `EnhancedBiomeConfig` - Enhanced biome system parameters (transitions, micro-biomes, elevation bands)
- `ResourceConfig` - Resource generation parameters
- `StructureConfig` - Structure placement parameters
- `Noise3DConfig` - 3D noise generation parameters
- `WorkerPoolConfig` - Worker pool configuration
- `LODConfig` - Level of detail configuration
- `IncrementalConfig` - Incremental generation configuration
- `SerializationOptions` - Serialization options

### Enhanced Data Structures

- `EnhancedBiomeData` - Biome data with transitions, micro-biomes, and elevation bands
- `ChunkModification` - Modification record for terrain and structure changes
- `SerializedWorld` - Serialized world data with checksum
- `PartialChunkData` - Partial chunk data during incremental generation

### Utility Functions

- `worldToChunk(x, y, chunkSize)` - Convert world coordinates to chunk coordinates
- `chunkToWorld(chunkX, chunkY, chunkSize)` - Convert chunk coordinates to world coordinates
- `worldToLocal(x, y, chunkSize)` - Convert world coordinates to local chunk coordinates
- `localToIndex(x, y, chunkSize)` - Convert local coordinates to flat array index
- `indexToLocal(index, chunkSize)` - Convert flat array index to local coordinates

### ChunkManager Methods

- `getChunk(x, y)` - Get or generate a chunk at the specified coordinates
- `getChunkIncremental(x, y)` - Start incremental generation for a chunk
- `continueGeneration(x, y)` - Continue incremental generation (returns true when complete)
- `saveWorld(options)` - Serialize world data with specified options
- `loadWorld(data)` - Deserialize and restore world data
- `exportWorld(options)` - Export world data to Blob or string for file saving
- `recordModification(x, y, modification)` - Record a modification to a chunk
- `clearCache()` - Clear the chunk cache
- `getCacheStats()` - Get cache statistics
- `getCacheSize()` - Get current cache size

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Testing

The project includes comprehensive test coverage:
- **275+ tests** across 23+ test files
- **Unit tests** for specific functionality (Vitest)
- **Property-based tests** using fast-check for correctness validation
- **Integration tests** for complete workflows
- **E2E tests** using Playwright for real browser behavior
- **Performance benchmarks** validating <100ms per chunk target

### Test Categories

- `tests/unit/` - Unit tests for individual components (Vitest)
- `tests/property/` - Property-based tests for correctness properties (fast-check)
- `tests/integration/` - Integration tests with mocked browser APIs (Vitest)
- `tests/e2e/` - End-to-end tests in real browser (Playwright)
- `tests/bugfix/` - Regression tests for specific bugs
- `tests/performance/` - Performance benchmarks

### Running Tests

```bash
# Unit and integration tests
npm test                    # Run all Vitest tests once
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report

# E2E tests (Playwright)
npx playwright test         # Run all E2E tests
npx playwright test --ui    # Run with UI mode
npx playwright test --headed # Run with visible browser
```

### When to Use Each Testing Tool

**Vitest (Unit/Integration)** - Use for:
- Pure logic and algorithms
- Isolated component testing
- Fast feedback during development
- Mocked browser APIs

**Playwright (E2E)** - Use for:
- Browser-specific features (Web Workers, Storage, etc.)
- UI interactions and user workflows
- Console output verification
- Real browser behavior (timing, memory, performance)
- Integration of multiple systems

**Example: Worker Pool Bug Discovery**

Unit tests showed the fix worked (shutdown() was called), but Playwright revealed the real issue:
- Unit tests: Expected 1 WorkerPool initialization ✅
- Playwright: Found 90 initializations ❌
- Root cause: Recursive WorkerPool creation in workers

See `.kiro/steering/playwright-best-practices.md` for detailed E2E testing guidelines.

## Project Structure

```
src/
├── core/          # Core utilities (RNG, noise, hashing)
│   ├── rng.ts     # Deterministic random number generator
│   ├── noise.ts   # Simplex noise with 2D/3D support, fBM, and domain warping
│   └── hash.ts    # Hash functions for chunk seeds
├── world/         # World management
│   ├── chunk.ts              # Chunk data structures and coordinate utilities
│   ├── chunk-manager.ts      # Chunk generation orchestration with LRU caching
│   ├── biome.ts              # Base biome classification system
│   ├── enhanced-biome.ts     # Enhanced biomes with transitions and micro-biomes
│   ├── lod.ts                # Level of detail management
│   ├── incremental-generator.ts  # Incremental generation with time budgets
│   ├── worker-pool.ts        # Multi-threaded chunk generation
│   └── serialization.ts      # World serialization and modification tracking
├── gen/           # Generation systems
│   ├── terrain.ts    # Heightmap generation with 2D/3D noise
│   ├── resources.ts  # Resource cluster generation
│   └── structures.ts # Structure placement with Poisson Disk Sampling
├── utils/         # Utility functions
│   └── poisson.ts # Poisson Disk Sampling implementation
├── worker.ts      # Web Worker support
└── index.ts       # Main API exports
```

## Performance

- Chunk generation: 20-50ms average (target: <100ms)
- Memory per chunk: ~46KB for 32x32 chunks
- LRU caching for efficient memory usage
- Web Worker support for non-blocking generation
- Multi-threaded generation scales with CPU cores
- LOD system reduces detail for distant chunks
- Incremental generation maintains 60fps responsiveness
- Binary serialization with compression for efficient storage

### Performance Tips

1. **Use Worker Pool**: Enable multi-threading for parallel chunk generation
2. **Enable LOD**: Reduce detail for distant chunks to improve rendering
3. **Incremental Generation**: Use time budgets to maintain frame rate
4. **Binary Format**: Use binary serialization for faster save/load
5. **Compression**: Enable compression to reduce storage size
6. **Cache Management**: Adjust `maxCacheSize` based on available memory

## License

MIT
