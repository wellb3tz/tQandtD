# tQandtD project

A TypeScript library for generating infinite, deterministic procedural worlds in the browser. Built around a chunk-based architecture with seed-driven randomness — the same seed always produces the same world, on any device.

## Features

- **Deterministic generation** — seed-based RNG guarantees reproducible worlds
- **Chunk-based loading** — lazy generation with LRU caching, load only what you need
- **Multi-layer terrain** — fBM noise with domain warping, continental shapes, mountain ridges
- **3D noise support** — volumetric noise for more varied terrain slices
- **13 biome types** — climate-driven classification with smooth transitions
- **Lakes** — flood-fill detection of closed depressions with physically correct water levels
- **Resources & structures** — noise-clustered resources and Poisson Disk Sampling for structures
- **Web Worker support** — non-blocking parallel chunk generation
- **World persistence** — JSON and binary serialization with zlib compression and CRC32 validation
- **Modification tracking** — delta-based change recording for efficient saves
- **World sessions** — high-level lifecycle facade for world, runtime, renderer, save/load, and regeneration
- **Renderer adapters** — runtime renderer boundary with an optional Three.js adapter entrypoint
- **Memory optimized** — sparse biome weights reduce memory by 56% per chunk
- **Structured logging** — configurable log levels and categories for debugging

## Installation

```bash
npm install procedural-world-engine
```

> **Runtime dependency**: `pako` is installed automatically and used for world serialization with compression.
> Three.js is only needed if you use the interactive app.

## Documentation

📚 **[Complete Documentation](docs/README.md)**

- [Getting Started Guide](docs/GETTING_STARTED.md) — Installation and basic usage
- [Engine API](docs/ENGINE_API.md) — Public entrypoints and recommended imports
- [Rendering Helpers](docs/RENDERING.md) — Renderer-neutral geometry and placement data
- [API Reference](docs/API.md) — Complete API documentation
- [Examples](docs/EXAMPLES.md) — Code examples for common tasks
- [Configuration Guide](docs/CONFIGURATION.md) — Detailed configuration options
- [Architecture](docs/ARCHITECTURE.md) — Internal architecture explanation
- [Advanced Topics](docs/ADVANCED.md) — Multi-threading, serialization, custom biomes
- [Performance Guide](docs/PERFORMANCE.md) — Optimization tips and benchmarks
- [Migration Guide](docs/MIGRATION_GUIDE.md) — Upgrading from older versions
- [FAQ](docs/FAQ.md) — Frequently asked questions

## Public Entrypoints

```typescript
import { ChunkManager, WorldSession } from 'procedural-world-engine';
import { createDefaultWorldConfig } from 'procedural-world-engine/config';
import { buildTerrainGridGeometryData } from 'procedural-world-engine/rendering';
import { ThreeWorldRendererAdapter } from 'procedural-world-engine/adapters/three';
```

The app uses the same public API that package consumers use. Rendering helpers return plain data and do not require Three.js unless you choose the optional adapter.

## Quick Start

```typescript
import {
  ChunkManager,
  BiomeType,
  ResourceType,
  StructureType,
  SerializationFormat,
  getBiomeWeightsForTile,
  configureLogger,
  LogLevel,
} from 'procedural-world-engine';

// Configure logging (optional)
configureLogger({
  level: LogLevel.WARN,  // Production: only warnings and errors
  timestamps: true,
});

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0,
    enableContinentalness: true,
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
  },
  resourceConfig: {
    types: [
      {
        type: ResourceType.IRON,
        rarity: 0.5,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 1,
        maxAmount: 10,
      },
    ],
    clusterScale: 20,
    densityThreshold: 0.6,
  },
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } },
        ],
      },
    ],
    minDistance: 10,
    maxAttempts: 30,
  },
});

// Generate a chunk — returns a Promise
const chunk = await manager.getChunk(0, 0);

console.log(chunk.heightmap);   // Float32Array, (size+1)² vertices
console.log(chunk.biomeMap);    // Uint8Array, size² biome indices
console.log(chunk.resources);   // Resource[]
console.log(chunk.structures);  // Structure[]
console.log(chunk.lakes);       // LakeData[]

// Access biome weights (sparse representation)
const tileIndex = 16 * 32 + 16; // Center tile
const weights = getBiomeWeightsForTile(chunk, tileIndex);
for (const [biome, weight] of weights) {
  console.log(`${BiomeType[biome]}: ${(weight * 100).toFixed(1)}%`);
}
```

## Core Concepts

### Coordinate System

| Space | Description |
|-------|-------------|
| Chunk coordinates | Integer grid — chunk `(1, 0)` is one chunk-width to the right of `(0, 0)` |
| World coordinates | Absolute positions: `worldX = chunkX * chunkSize + localX` |
| Local coordinates | Position within a chunk: `[0, chunkSize)` |
| Vertex coordinates | Heightmap positions: `[0, chunkSize]` (inclusive, for seamless boundaries) |

```typescript
import { worldToChunk, chunkToWorld, worldToLocal } from 'procedural-world-engine';

const [chunkX, chunkY] = worldToChunk(75, 40, 32); // → [2, 1]
const [worldX, worldY] = chunkToWorld(2, 1, 32);   // → [64, 32]
```

### Heightmap Layout

Chunks use `(size + 1) × (size + 1)` vertices so boundary vertices overlap with adjacent chunks, eliminating visible seams in 3D rendering.

```typescript
// Access height at local position (x, y)
const vertexSize = chunk.size + 1;
const height = chunk.heightmap[localY * vertexSize + localX];
```

Heights are normalized to `[0, 1]`. Sea level is `0.3`.

### Biomes

The engine classifies terrain into 13 biome types based on height, temperature, and moisture:

```
OCEAN · BEACH · DESERT · PLAINS · FOREST · TAIGA · TUNDRA · MOUNTAIN
SAVANNA · SWAMP · RAINFOREST · VOLCANIC · GLACIER
```

Each tile also carries blend weights (`biomeWeights`) for smooth color interpolation at biome boundaries.

## Configuration Reference

### `WorldConfig`

| Field | Type | Description |
|-------|------|-------------|
| `seed` | `number` | World seed |
| `chunkSize` | `number` | Tiles per chunk side (e.g. `32`) |
| `terrainConfig` | `TerrainConfig` | Heightmap generation parameters |
| `biomeConfig` | `BiomeConfig` | Temperature/moisture noise scales |
| `resourceConfig` | `ResourceConfig` | Resource types and placement rules |
| `structureConfig` | `StructureConfig` | Structure types and placement rules |
| `enhancedBiomeConfig` | `EnhancedBiomeConfig?` | Transitions, elevation bands |
| `lakeConfig` | `LakeConfig?` | Lake generation parameters |
| `noise3DConfig` | `Noise3DConfig?` | Enable 3D volumetric noise |
| `workerPoolConfig` | `WorkerPoolConfig?` | Multi-threaded generation |
| `maxCacheSize` | `number?` | LRU cache limit (default: `100`) |
| `enablePerformanceMetrics` | `boolean?` | Log slow chunk generation |

### `TerrainConfig`

| Field | Default | Description |
|-------|---------|-------------|
| `baseScale` | — | Base noise frequency |
| `octaves` | — | Number of fBM octaves |
| `persistence` | — | Amplitude decay per octave |
| `lacunarity` | — | Frequency growth per octave |
| `warpStrength` | — | Domain warp intensity |
| `heightMultiplier` | — | Final height scale |
| `enableContinentalness` | `true` | Large-scale ocean/land separation |
| `continentalScale` | `0.002` | Continental noise frequency |
| `continentalStrength` | `0.6` | Continental layer influence |
| `enable3D` | `false` | Use 3D noise slice |
| `zScale` | `0.5` | Z-axis position in 3D noise volume |

## Enhanced Biomes

Enable richer biome behavior with `enhancedBiomeConfig`:

```typescript
const manager = new ChunkManager({
  // ...
  enhancedBiomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,

    // Smooth biome boundary blending
    enableTransitions: true,
    transitionWidth: 10,


    // Mountain elevation zones
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75,

    // Geographically plausible climate
    enableClimateSystem: true,

    // Prevent impossible biome neighbors (Desert↔Taiga, etc.)
    enableCompatibilityMatrix: true,
  },
});
```


**Elevation bands**: `FOOTHILLS`, `SLOPES`, `PEAKS`.

## Lakes

Lakes are generated automatically when `lakeConfig` is provided (or by default). The algorithm uses BFS flood-fill to find closed terrain depressions above sea level:

```typescript
const manager = new ChunkManager({
  // ...
  lakeConfig: {
    enabled: true,
    noiseScale: 0.01,       // Lake candidate region frequency
    noiseThreshold: 0.62,   // Higher = fewer, more concentrated lakes
    minElevation: 0.32,     // Must be above sea level
    maxElevation: 0.72,     // No lakes on mountain peaks
    maxLakeTiles: 80,       // Max size per lake
    maxFillDepth: 0.06,     // Max water rise above seed tile
    allowedBiomes: [BiomeType.PLAINS, BiomeType.FOREST, BiomeType.SWAMP],
  },
});

const chunk = await manager.getChunk(0, 0);
for (const lake of chunk.lakes ?? []) {
  console.log(`Water level: ${lake.waterLevel}, depth: ${lake.maxDepth}`);
  console.log(`Tiles covered: ${lake.tiles.size}`);
}
```

## Web Workers

Offload chunk generation to background threads:

```typescript
// worker.ts — your worker entry point
import { installWorkerHandler } from 'procedural-world-engine/worker';
installWorkerHandler();
```

```typescript
// main thread
const manager = new ChunkManager({
  // ...
  workerPoolConfig: {
    maxWorkers: 4,
    workerScriptUrl: '/worker.js',
    taskTimeout: 30000,
  },
});

// getChunk() now resolves via the worker pool
const chunk = await manager.getChunk(0, 0);
```

If a worker fails, generation falls back to the main thread automatically.

## World Session

Use `WorldSession` when you want the engine to own the world manager and runtime scene as one lifecycle unit:

```typescript
import { SerializationFormat, WorldSession } from 'procedural-world-engine';

const session = new WorldSession({
  worldConfig,
  scene: {
    renderer,
    player: {
      position: { x: 0, y: 8, z: 0 },
      streamingTarget: { radius: 2 },
    },
  },
});

session.start();
const loaded = await session.loadChunksAround(0, 0, 2);
const unsubscribe = session.on('chunk_loaded', ({ coordinate, chunk }) => {
  console.log(`Loaded chunk ${coordinate.x},${coordinate.y}`, chunk);
});
session.unloadDistantChunks(0, 0, 4);
session.regenerate({ seed: 98765 });
const saved = session.saveWorld({ format: SerializationFormat.JSON, compress: true, modifiedOnly: false });
session.loadWorld(saved);
unsubscribe();
session.dispose();
```

The session keeps `ChunkManager`, `WorldScene`, loaded/explored chunk tracking, renderer sync, cache clearing, regeneration, and save/load under a single API.

## World Persistence

```typescript
import { SerializationFormat } from 'procedural-world-engine';

// Save
const saved = manager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: false,
});

// Save only a region
const region = manager.saveWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false,
  region: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
});

// Load
manager.loadWorld(saved);
```

## Low-Level API

The core primitives are exported for direct use:

```typescript
import { SeededRNG, NoiseEngine, hash, chunkSeed } from 'procedural-world-engine';

// Deterministic RNG
const rng = new SeededRNG(42);
const value = rng.nextFloat();   // [0, 1)
const roll  = rng.nextInt(1, 7); // [1, 6]
const child = rng.derive(100);   // independent stream

// Simplex noise
const noise = new NoiseEngine(42);
const n2 = noise.noise2D(x, y);
const n3 = noise.noise3D(x, y, z);
const fbm = noise.fbm(x, y, { octaves: 4, persistence: 0.5, lacunarity: 2.0, scale: 0.01 });
const ridge = noise.ridgeFbm(x, y, config); // sharp mountain ridges
const [wx, wy] = noise.domainWarp(x, y, 30);

// Poisson Disk Sampling
import { poissonDiskSampling } from 'procedural-world-engine';
const points = poissonDiskSampling({ width: 100, height: 100, minDistance: 10, maxAttempts: 30, seed: 42 });
```

## Interactive App

The repository includes a full 3D world app built with Three.js:

```bash
npm run app         # Dev server on http://localhost:3000
npm run build:app   # Production build → dist-app/
npm run preview     # Preview production build
```

**App features:**
- FPS camera (WASD + mouse, Shift for speed boost)
- Top-down orthographic view
- Biome color blending with biome tinting
- Separate ocean and lake water meshes
- Underwater terrain darkening
- Fog of War for explored chunks
- Real-time statistics and performance monitor
- World save / load UI

### Three.js Adapter

Use the optional adapter entrypoint when wiring the runtime to a Three.js-backed renderer:

```typescript
import { WorldScene } from 'procedural-world-engine';
import { ThreeWorldRendererAdapter } from 'procedural-world-engine/adapters/three';

const renderer = new ThreeWorldRendererAdapter({ target: worldRenderer });
const scene = new WorldScene({ world: chunkManager, renderer });
```

The target implements chunk rendering and camera sync methods, so applications can keep their own Three.js scene setup while using the engine runtime lifecycle.

## Development

```bash
npm run build           # Compile library → dist/
npm test                # Run all tests once
npm run test:bench      # Run machine-dependent performance benchmarks
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report → coverage/
npm run build:verify    # Verify build output integrity
npm run build:analyze   # Bundle size analysis
```

## Performance

| Metric | Value |
|--------|-------|
| Chunk generation | < 100ms (typically 30–50ms) |
| Memory per chunk | ~7 KB (32×32) — 56% reduction from v1.x |
| Biome weights | Sparse representation — 70% memory savings |
| Cache | LRU with configurable size |
| Rendering | 60 fps with incremental loading |

**Recent optimizations:**
- Sparse biome weight representation (v2.0) — 56% less memory per chunk
- Circular buffer for flood-fill — 75% faster lake generation
- Pre-allocated noise configs — eliminated 1000+ allocations per chunk
- Swap-and-pop for Poisson sampling — O(1) removal operations

Generation time scales with `octaves`, `chunkSize`, and whether enhanced biomes / lakes are enabled. The worker pool keeps the main thread free during generation.

## Project Structure

```
src/
├── core/           # RNG, Simplex noise, hash functions
├── gen/            # Terrain, resource, structure, lake generators
├── world/          # ChunkManager, biome systems, serialization, worker pool
├── utils/          # Poisson Disk Sampling
├── index.ts        # Public API
└── worker.ts       # Web Worker entry point

app/
├── src/
│   ├── core/       # WorldApp — state management
│   ├── viewer/     # Three.js scene, water layer, materials
│   ├── ui/         # Control panel, stats, minimap, tooltips
│   └── utils/      # Coordinate helpers, error handling
└── index.html
```

## License

MIT
