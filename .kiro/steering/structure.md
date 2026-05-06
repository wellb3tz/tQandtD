# Project Structure

## Root Directory Layout

```
procedural-world-engine/
├── src/              # Core library source code
├── app/              # Interactive world application
├── examples/         # Usage examples and tutorials
├── tests/            # Test suites (integration, property-based)
├── dist/             # Compiled library output (gitignored)
├── dist-app/         # Compiled app output (gitignored)
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
- `chunk.ts`: Core data structures, coordinate utilities, sparse biome weight helpers
- `chunk-manager.ts`: Main API entry point, chunk generation orchestration, LRU caching
- `biome.ts`: Base biome classification (13 biome types)
- `enhanced-biome.ts`: Advanced biomes with transitions, micro-biomes, elevation bands
- `lake-manager.ts`: Lake generation with flood-fill, LRU eviction, race condition prevention
- `worker-pool.ts`: Multi-threaded chunk generation
- `serialization.ts`: World persistence and modification tracking

### Generation Systems (`src/gen/`)
Specialized generators for world features:
- `terrain.ts`: Heightmap generation using 2D/3D noise
- `resources.ts`: Resource cluster placement based on biomes
- `structures.ts`: Structure placement using Poisson Disk Sampling

### Utilities (`src/utils/`)
- `poisson.ts`: Poisson Disk Sampling implementation
- `validation.ts`: Configuration validation with ValidationError
- `errors.ts`: Error hierarchy for chunk generation failures
- `logger.ts`: Structured logging system with levels and categories

### Entry Points
- `index.ts`: Main library exports (public API)
- `worker.ts`: Web Worker support for non-blocking generation

## Interactive App (`app/`)

### Structure
```
app/
├── index.html           # Entry HTML
├── main.ts              # Application entry point
├── styles.css           # Global styles
├── worker-loader.ts     # Worker initialization
├── public/              # Static assets
└── src/
    ├── core/            # App core (WorldApp)
    ├── viewer/          # Three.js 3D rendering
    ├── ui/              # UI components (controls, stats, modals)
    └── utils/           # App-specific utilities
```

### App Components
- **WorldApp**: Main application orchestrator
- **WorldViewer**: Three.js scene management and rendering
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
- `tests/*.test.ts`: Core functionality tests (chunk-manager, terrain, determinism, serialization)
- `tests/validation.test.ts`: Configuration validation tests
- `tests/error-handling.test.ts`: Error recovery and handling tests
- `tests/performance.test.ts`: Performance benchmarks and memory usage tests
- `app/src/**/*.test.ts`: Co-located unit tests with app source

### Test Patterns
- Unit tests: Co-located with source files (`.test.ts`)
- Integration tests: Test complete generation pipelines
- Property-based tests: Use fast-check for correctness validation
- Performance tests: Validate <100ms generation target and memory usage
- Error handling tests: Validate graceful degradation and recovery

### Test Coverage
- 151 tests total
- 100% pass rate
- Covers all major systems: terrain, biomes, lakes, resources, structures, serialization
- Performance benchmarks for 16×16, 32×32, and 64×64 chunks

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

### Sparse Biome Weights (v2.0)
Biome weights use sparse representation to reduce memory:
- Three parallel arrays: `sparseBiomeTypes`, `sparseBiomeWeights`, `sparseBiomeOffsets`
- Only non-zero weights are stored
- 70% memory reduction for biome weights
- Helper functions: `getBiomeWeightsForTile()`, `getBiomeWeightForTile()`

### Configuration Objects
All systems accept configuration interfaces (e.g., `TerrainConfig`, `BiomeConfig`) passed through `WorldConfig` to `ChunkManager`.

### Error Handling
- Configuration validation on construction (throws `ValidationError`)
- Graceful degradation with `ErrorRecoveryOptions`
- Granular error types: `TerrainGenerationError`, `BiomeGenerationError`, `LakeGenerationError`, etc.
- Fallback to empty chunks on catastrophic failure

### Logging System
- Structured logging with `Logger` class
- Log levels: DEBUG, INFO, WARN, ERROR, NONE
- Log categories: CHUNK, LAKE, WORKER, CACHE, PERFORMANCE, GENERAL
- Default: WARN level (production-ready)
- Configurable via `configureLogger()`

### Optional Features
Advanced features (3D noise, enhanced biomes, lakes, worker pool) are opt-in via configuration flags, maintaining backward compatibility.

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
- App imports library via alias: `'procedural-world-engine'`
- Test files import directly from source for better coverage
