# Procedural World Engine

A TypeScript-based procedural world generation engine designed for browser-based applications. The system generates infinite, deterministic worlds using seed-based random number generation, chunk-based loading, and multi-layer noise functions.

## Features

- **Deterministic Generation**: Same seed always produces the same world
- **Chunk-Based Architecture**: Efficient lazy loading with LRU caching
- **Multi-Layer Terrain**: Realistic heightmaps using fractional Brownian motion and domain warping
- **Biome System**: 8 diverse ecosystems with smooth transitions
- **Resource Clusters**: Natural resource distribution based on biomes (5 resource types)
- **Structure Placement**: Poisson Disk Sampling for realistic structure distribution (3 structure types)
- **River Networks**: Downhill flow algorithm for natural water features
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
  },
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2
  }
});

// Generate a chunk
const chunk = manager.getChunk(0, 0);
console.log(chunk.heightmap);
console.log(chunk.resources);
console.log(chunk.structures);
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

## Examples

See the `examples/` directory for more usage examples:
- `basic-usage.ts` - Simple world generation
- `with-resources.ts` - Resource configuration
- `with-structures.ts` - Structure placement
- `coordinate-utilities.ts` - Coordinate conversion helpers
- `web-worker-usage.ts` - Web Worker integration
- `performance-monitoring.ts` - Performance tracking

## API Documentation

### Core Types

- `ChunkManager` - Main entry point for world generation
- `ChunkData` - Complete chunk data with terrain, biomes, resources, structures, rivers
- `BiomeType` - Enum of 8 biome types (OCEAN, BEACH, DESERT, PLAINS, FOREST, TAIGA, TUNDRA, MOUNTAIN)
- `ResourceType` - Enum of 5 resource types (IRON, GOLD, COAL, STONE, WOOD)
- `StructureType` - Enum of 3 structure types (VILLAGE, RUINS, TOWER)

### Configuration Interfaces

- `WorldConfig` - Complete world generation configuration
- `TerrainConfig` - Terrain generation parameters
- `BiomeConfig` - Biome classification parameters
- `ResourceConfig` - Resource generation parameters
- `StructureConfig` - Structure placement parameters
- `RiverConfig` - River generation parameters

### Utility Functions

- `worldToChunk(x, y, chunkSize)` - Convert world coordinates to chunk coordinates
- `chunkToWorld(chunkX, chunkY, chunkSize)` - Convert chunk coordinates to world coordinates
- `worldToLocal(x, y, chunkSize)` - Convert world coordinates to local chunk coordinates
- `localToIndex(x, y, chunkSize)` - Convert local coordinates to flat array index
- `indexToLocal(index, chunkSize)` - Convert flat array index to local coordinates

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
- **275 tests** across 23 test files
- **Unit tests** for specific functionality
- **Property-based tests** using fast-check for correctness validation
- **Integration tests** for complete workflows
- **Performance benchmarks** validating <100ms per chunk target

## Project Structure

```
src/
├── core/          # Core utilities (RNG, noise, hashing)
│   ├── rng.ts     # Deterministic random number generator
│   ├── noise.ts   # Simplex noise with fBM and domain warping
│   └── hash.ts    # Hash functions for chunk seeds
├── world/         # World management
│   ├── chunk.ts   # Chunk data structures and coordinate utilities
│   ├── chunk-manager.ts  # Chunk generation orchestration with LRU caching
│   └── biome.ts   # Biome classification system
├── gen/           # Generation systems
│   ├── terrain.ts    # Heightmap generation
│   ├── resources.ts  # Resource cluster generation
│   ├── structures.ts # Structure placement with Poisson Disk Sampling
│   └── rivers.ts     # River network generation
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

## License

MIT
