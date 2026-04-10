# Implementation Plan: Procedural World Engine

## Overview

This implementation plan breaks down the procedural world engine into incremental, testable steps. The approach follows a bottom-up strategy: build core utilities first (RNG, noise), then world management (chunks, biomes), and finally generation systems (terrain, resources, structures, rivers). Each major component includes property-based tests to validate correctness properties from the design document.

## Tasks

- [x] 1. Set up project structure and core utilities
  - Create TypeScript project with directory structure: /src/core, /src/world, /src/gen, /src/utils
  - Set up package.json with TypeScript, fast-check, and testing framework (Jest or Vitest)
  - Create tsconfig.json with strict type checking enabled
  - Create index.ts with main API exports
  - _Requirements: 8.1, 8.5_

- [x] 2. Implement deterministic RNG system
  - [x] 2.1 Create SeededRNG class in src/core/rng.ts
    - Implement constructor accepting numeric seed
    - Implement mulberry32 or xorshift128+ algorithm for deterministic random generation
    - Implement nextInt(min, max) method for random integers
    - Implement nextFloat() method for random floats in [0, 1)
    - Implement derive(offset) method for creating derived RNG instances
    - Add input validation and error handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.2 Write property test for RNG determinism
    - **Property 1: RNG Determinism**
    - **Validates: Requirements 1.2**
  
  - [x] 2.3 Write property test for RNG float range
    - **Property 2: RNG Float Range**
    - **Validates: Requirements 1.5**
  
  - [x] 2.4 Write unit tests for RNG edge cases
    - Test invalid seed handling (NaN, Infinity)
    - Test invalid range in nextInt (min >= max)
    - Test boundary values (min, max-1)
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 3. Implement noise generation system
  - [x] 3.1 Create NoiseEngine class in src/core/noise.ts
    - Implement Simplex noise algorithm with seed support
    - Implement noise2D(x, y) method returning values in [-1, 1]
    - Implement fbm(x, y, config) for fractional Brownian motion
    - Implement domainWarp(x, y, strength) for coordinate distortion
    - Add NoiseConfig interface with octaves, persistence, lacunarity, scale
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 3.2 Write property test for noise determinism
    - **Property 16: Noise Generation Determinism**
    - **Validates: Requirements 10.4**
  
  - [x] 3.3 Write unit tests for noise functions
    - Test noise output range [-1, 1]
    - Test fBM with different octave counts
    - Test domain warping produces different coordinates
    - Test invalid config handling
    - _Requirements: 10.2, 10.3, 10.5_

- [x] 4. Implement hash utilities
  - [x] 4.1 Create hash functions in src/core/hash.ts
    - Implement hash(...values) function combining multiple numbers
    - Implement chunkSeed(worldSeed, chunkX, chunkY) function
    - Use a fast, deterministic hash algorithm (e.g., MurmurHash3 or simple bit mixing)
    - _Requirements: 2.2_
  
  - [x] 4.2 Write property test for chunk seed uniqueness
    - **Property 3: Chunk Seed Uniqueness**
    - **Validates: Requirements 2.2**
  
  - [x] 4.3 Write unit tests for hash functions
    - Test hash produces consistent output for same inputs
    - Test different inputs produce different hashes
    - Test edge cases (zero, negative numbers)
    - _Requirements: 2.2_

- [x] 5. Checkpoint - Ensure core utilities work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement chunk data structures
  - [x] 6.1 Create chunk types in src/world/chunk.ts
    - Define ChunkData interface with x, y, size, heightmap, biomeMap, biomeWeights, resources, structures, rivers
    - Define Resource interface with x, y, type, amount
    - Define Structure interface with x, y, type
    - Define ResourceType enum (IRON, GOLD, COAL, STONE, WOOD)
    - Define StructureType enum (VILLAGE, RUINS, TOWER)
    - Define BiomeType enum (OCEAN, BEACH, DESERT, PLAINS, FOREST, TAIGA, TUNDRA, MOUNTAIN)
    - _Requirements: 2.1, 4.5, 5.5_
  
  - [x] 6.2 Write unit tests for chunk data structures
    - Test ChunkData creation with correct array sizes
    - Test enum values are accessible
    - _Requirements: 2.1_

- [x] 7. Implement biome system
  - [x] 7.1 Create BiomeSystem class in src/world/biome.ts
    - Implement constructor accepting seed and BiomeConfig
    - Implement getTemperature(x, y) using noise
    - Implement getMoisture(x, y) using noise
    - Implement getBiome(x, y, height) with classification logic
    - Implement getBiomeWeights(x, y, height) for blending
    - Add biome classification rules based on height, temperature, moisture
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.2 Write unit tests for biome classification
    - Test ocean biome for low heights
    - Test mountain biome for high heights
    - Test temperature/moisture affect biome selection
    - Test getBiomeWeights returns normalized weights
    - _Requirements: 4.1, 4.4_

- [x] 8. Implement terrain generation
  - [x] 8.1 Create TerrainGenerator class in src/gen/terrain.ts
    - Implement constructor accepting TerrainConfig
    - Implement generateHeightmap(chunkSeed, chunkSize) returning Float32Array
    - Implement getHeight(x, y, seed) for single position queries
    - Apply domain warping to coordinates before noise sampling
    - Apply fBM with configured octaves, persistence, lacunarity
    - Normalize and scale height values to [0, 1] range
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 8.2 Write property test for heightmap size correctness
    - **Property 6: Heightmap Size Correctness**
    - **Validates: Requirements 3.3**
  
  - [x] 8.3 Write property test for terrain generation determinism
    - **Property 7: Terrain Generation Determinism**
    - **Validates: Requirements 3.4**
  
  - [x] 8.4 Write unit tests for terrain generation
    - Test height values are in [0, 1] range
    - Test different configs produce different terrain
    - Test invalid config handling
    - _Requirements: 3.3, 3.5_

- [x] 9. Implement chunk manager
  - [x] 9.1 Create ChunkManager class in src/world/chunk-manager.ts
    - Implement constructor accepting WorldConfig
    - Implement getChunk(chunkX, chunkY) with LRU caching
    - Implement generateChunk(chunkX, chunkY) orchestrating all generators
    - Implement clearCache() method
    - Compute chunk seed using hash(worldSeed, chunkX, chunkY)
    - Call TerrainGenerator to create heightmap
    - Call BiomeSystem to populate biome data
    - Initialize empty arrays for resources, structures, rivers
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 9.2 Write property test for chunk generation determinism
    - **Property 4: Chunk Generation Determinism**
    - **Validates: Requirements 2.3**
  
  - [x] 9.3 Write property test for chunk independence
    - **Property 5: Chunk Independence**
    - **Validates: Requirements 2.4**
  
  - [x] 9.4 Write unit tests for chunk manager
    - Test chunk caching works correctly
    - Test clearCache removes cached chunks
    - Test chunk coordinates are stored correctly
    - Test invalid coordinates handling
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 10. Checkpoint - Ensure basic world generation works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement resource generation
  - [x] 11.1 Create ResourceGenerator class in src/gen/resources.ts
    - Implement constructor accepting ResourceConfig
    - Implement generateResources(chunkData, chunkSeed) returning Resource[]
    - For each resource type, generate noise map using derived seed
    - Place resources where noise exceeds density threshold
    - Filter resources by biome compatibility
    - Use RNG to determine resource amounts within configured range
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 11.2 Write property test for resource-biome matching
    - **Property 8: Resource-Biome Matching**
    - **Validates: Requirements 5.3**
  
  - [x] 11.3 Write property test for resource generation determinism
    - **Property 9: Resource Generation Determinism**
    - **Validates: Requirements 5.4**
  
  - [x] 11.4 Write unit tests for resource generation
    - Test resources are generated in valid positions
    - Test resource amounts are within configured ranges
    - Test different resource types are supported
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 12. Implement Poisson Disk Sampling utility
  - [x] 12.1 Create poissonDiskSampling function in src/utils/poisson.ts
    - Implement Bridson's algorithm for Poisson Disk Sampling
    - Accept PoissonConfig with width, height, minDistance, maxAttempts, seed
    - Use SeededRNG for deterministic point generation
    - Return array of {x, y} positions
    - _Requirements: 6.1_
  
  - [x] 12.2 Write unit tests for Poisson Disk Sampling
    - Test minimum distance constraint is maintained
    - Test same seed produces same point distribution
    - Test points are within bounds
    - _Requirements: 6.1, 6.2_

- [x] 13. Implement structure placement
  - [x] 13.1 Create StructurePlacer class in src/gen/structures.ts
    - Implement constructor accepting StructureConfig
    - Implement generateStructures(chunkData, chunkSeed) returning Structure[]
    - Use Poisson Disk Sampling to generate candidate positions
    - Implement placement rule evaluation (biome, slope, nearWater, elevation)
    - Filter candidates by rule satisfaction
    - Assign structure types based on rarity weights
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 13.2 Write property test for structure minimum distance
    - **Property 10: Structure Minimum Distance**
    - **Validates: Requirements 6.2**
  
  - [x] 13.3 Write property test for structure placement rules
    - **Property 11: Structure Placement Rules**
    - **Validates: Requirements 6.3**
  
  - [x] 13.4 Write property test for structure generation determinism
    - **Property 12: Structure Generation Determinism**
    - **Validates: Requirements 6.5**
  
  - [x] 13.5 Write unit tests for structure placement
    - Test placement rules are evaluated correctly
    - Test structures are assigned correct types
    - Test invalid structure type handling
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 14. Implement river generation
  - [x] 14.1 Create RiverGenerator class in src/gen/rivers.ts
    - Implement constructor accepting RiverConfig
    - Implement generateRivers(chunkData, chunkSeed) returning Set<number>
    - Use RNG to select river source positions at high elevations
    - Implement downhill flow algorithm (steepest descent among 8 neighbors)
    - Trace river paths until reaching ocean level or local minimum
    - Filter rivers shorter than minFlowLength
    - Apply flowWidth to widen river paths
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 14.2 Write property test for river downhill flow
    - **Property 13: River Downhill Flow**
    - **Validates: Requirements 7.2**
  
  - [x] 14.3 Write property test for river termination conditions
    - **Property 14: River Termination Conditions**
    - **Validates: Requirements 7.3**
  
  - [x] 14.4 Write property test for river generation determinism
    - **Property 15: River Generation Determinism**
    - **Validates: Requirements 7.5**
  
  - [x] 14.5 Write unit tests for river generation
    - Test rivers start at high elevations
    - Test rivers are marked in chunk data
    - Test river width is applied correctly
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 15. Integrate all generators into ChunkManager
  - [x] 15.1 Update ChunkManager to call all generators
    - Instantiate ResourceGenerator, StructurePlacer, RiverGenerator in constructor
    - Call generateResources and populate chunkData.resources
    - Call generateStructures and populate chunkData.structures
    - Call generateRivers and populate chunkData.rivers
    - Ensure generators are called in correct order (terrain → biomes → resources → structures → rivers)
    - _Requirements: 2.3, 2.4, 8.4_
  
  - [x] 15.2 Write integration tests for complete chunk generation
    - Test complete chunk has all data populated
    - Test chunk generation with all features enabled
    - Test chunk generation with features disabled
    - _Requirements: 2.3, 2.4_

- [x] 16. Checkpoint - Ensure complete world generation works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Add coordinate conversion utilities
  - [x] 17.1 Create coordinate utilities in src/world/chunk.ts
    - Implement worldToChunk(worldX, worldY, chunkSize)
    - Implement chunkToWorld(chunkX, chunkY, chunkSize)
    - Implement worldToLocal(worldX, worldY, chunkSize)
    - Add helper function to convert local coordinates to flat array index
    - _Requirements: 2.1, 2.4_
  
  - [x] 17.2 Write unit tests for coordinate conversions
    - Test worldToChunk handles positive and negative coordinates
    - Test chunkToWorld produces correct world positions
    - Test worldToLocal handles chunk boundaries correctly
    - Test round-trip conversions preserve coordinates
    - _Requirements: 2.1_

- [x] 18. Create main API and exports
  - [x] 18.1 Update src/index.ts with public API
    - Export ChunkManager as main entry point
    - Export all configuration interfaces (WorldConfig, TerrainConfig, BiomeConfig, etc.)
    - Export all data types (ChunkData, Resource, Structure, BiomeType, etc.)
    - Export coordinate utility functions
    - Add JSDoc comments for all public APIs
    - _Requirements: 8.2, 8.4_
  
  - [x] 18.2 Write API documentation examples
    - Create example usage in comments or separate examples/ directory
    - Show basic world generation
    - Show configuration customization
    - Show chunk querying
    - _Requirements: 8.2_

- [x] 19. Add Web Worker support
  - [x] 19.1 Create Web Worker wrapper in src/worker.ts
    - Create worker message handler for chunk generation requests
    - Implement serialization of ChunkData for postMessage
    - Handle worker initialization with WorldConfig
    - Add error handling for worker communication
    - _Requirements: 9.2, 9.5_
  
  - [x] 19.2 Write integration tests for Web Worker
    - Test chunk generation in worker context
    - Test message passing and serialization
    - Test error handling in worker
    - _Requirements: 9.2_

- [x] 20. Performance optimization and validation
  - [x] 20.1 Add performance monitoring
    - Add optional timing measurements for chunk generation
    - Add progress callbacks for long-running operations
    - Optimize hot paths identified by profiling
    - _Requirements: 9.4, 9.5_
  
  - [x] 20.2 Write performance benchmarks
    - Benchmark chunk generation time
    - Benchmark memory usage
    - Test target of <100ms per chunk is met
    - _Requirements: 9.4_

- [x] 21. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows a bottom-up approach: core utilities → world management → generation systems
- Web Worker support is added near the end as it depends on the complete system
