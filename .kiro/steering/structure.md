# Project Structure

## Root Directory Layout

```
procedural-world-engine/
├── src/              # Core library source code
├── demo/             # Interactive demo application
├── examples/         # Usage examples and tutorials
├── tests/            # Test suites (integration, property-based)
├── dist/             # Compiled library output (gitignored)
├── dist-demo/        # Compiled demo output (gitignored)
└── scripts/          # Build and verification scripts
```

## Library Source (`src/`)

### Core Utilities (`src/core/`)
Foundation algorithms used throughout the engine:
- `rng.ts`: Deterministic seeded random number generator
- `noise.ts`: Simplex noise with 2D/3D support, fBM, domain warping
- `hash.ts`: Hash functions for generating chunk-specific seeds

### World Management (`src/world/`)
Chunk orchestration and world-level systems:
- `chunk.ts`: Core data structures, coordinate utilities
- `chunk-manager.ts`: Main API entry point, chunk generation orchestration, LRU caching
- `biome.ts`: Base biome classification (8 biome types)
- `enhanced-biome.ts`: Advanced biomes with transitions, micro-biomes, elevation bands
- `lod.ts`: Level of detail management for performance
- `incremental-generator.ts`: Progressive generation with time budgets
- `worker-pool.ts`: Multi-threaded chunk generation
- `serialization.ts`: World persistence and modification tracking

### Generation Systems (`src/gen/`)
Specialized generators for world features:
- `terrain.ts`: Heightmap generation using 2D/3D noise
- `resources.ts`: Resource cluster placement based on biomes
- `structures.ts`: Structure placement using Poisson Disk Sampling

### Utilities (`src/utils/`)
- `poisson.ts`: Poisson Disk Sampling implementation

### Entry Points
- `index.ts`: Main library exports (public API)
- `worker.ts`: Web Worker support for non-blocking generation

## Demo Application (`demo/`)

### Structure
```
demo/
├── index.html           # Entry HTML
├── main.ts              # Application entry point
├── styles.css           # Global styles
├── worker-loader.ts     # Worker initialization
├── public/              # Static assets
└── src/
    ├── core/            # Demo application core (DemoApp)
    ├── viewer/          # Three.js 3D rendering
    ├── editor/          # Terrain editing tools
    ├── ui/              # UI components (controls, stats, modals)
    └── utils/           # Demo-specific utilities
```

### Demo Components
- **DemoApp**: Main application orchestrator
- **WorldViewer**: Three.js scene management and rendering
- **TerrainEditor**: Interactive terrain modification
- **ControlPanel**: User controls for generation parameters
- **WorldManager**: World state and serialization UI

## Examples (`examples/`)

Self-contained usage examples demonstrating specific features:
- `basic-usage.ts`: Simple world generation
- `3d-noise-usage.ts`: 3D noise configuration
- `enhanced-biomes.ts`: Enhanced biome system
- `web-worker-usage.ts`: Multi-threading
- `lod-system.ts`: Level of detail
- `incremental-generation.ts`: Progressive generation
- `binary-serialization.ts`: World persistence
- `modification-tracking.ts`: Change tracking

## Tests (`tests/`)

### Organization
- `tests/integration/`: End-to-end workflow tests
- `tests/bugfix/`: Bug-specific regression tests
- `demo/src/**/*.test.ts`: Co-located unit tests with source

### Test Patterns
- Unit tests: Co-located with source files (`.test.ts`)
- Integration tests: Separate `tests/integration/` directory
- Property-based tests: Use fast-check for correctness validation
- Performance tests: Validate <100ms generation target

## Architecture Patterns

### Deterministic Generation
All generators accept a seed parameter and produce identical output for the same inputs. Use `SeededRNG` and `NoiseEngine` for all randomness.

### Chunk Coordinate System
- **Chunk coordinates**: Integer grid positions (e.g., chunk 0,0, chunk 1,0)
- **World coordinates**: Absolute positions within the world
- **Local coordinates**: Positions within a chunk (0 to chunkSize-1)
- **Vertex coordinates**: Heightmap positions (0 to chunkSize for seamless boundaries)

### Seamless Boundaries
Heightmaps use `(chunkSize + 1) × (chunkSize + 1)` vertices where boundary vertices overlap with adjacent chunks, ensuring no gaps in rendering.

### Configuration Objects
All systems accept configuration interfaces (e.g., `TerrainConfig`, `BiomeConfig`) passed through `WorldConfig` to `ChunkManager`.

### Optional Features
Advanced features (3D noise, enhanced biomes, LOD, worker pool) are opt-in via configuration flags, maintaining backward compatibility.

## Naming Conventions

- **Files**: kebab-case (e.g., `chunk-manager.ts`)
- **Classes**: PascalCase (e.g., `ChunkManager`)
- **Interfaces**: PascalCase with descriptive suffixes (e.g., `WorldConfig`, `TerrainConfig`)
- **Functions/Methods**: camelCase (e.g., `generateChunk`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_CACHE_SIZE`)
- **Private members**: Prefix with underscore discouraged; use TypeScript `private` keyword

## Import Patterns

- Use relative imports within the library
- Export public API through `src/index.ts`
- Demo imports library via alias: `'procedural-world-engine'`
- Test files import directly from source for better coverage
