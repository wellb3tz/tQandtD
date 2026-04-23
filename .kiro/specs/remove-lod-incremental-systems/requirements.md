# Requirements Document

## Introduction

This feature removes the Level of Detail (LOD) system (`src/world/lod.ts`) and the incremental generation system (`src/world/incremental-generator.ts`) from the procedural world engine. Both systems are deleted along with all their references across the codebase. The worker pool (`src/world/worker-pool.ts`) remains as the sole mechanism for asynchronous chunk generation. The goal is a clean removal that leaves the engine in a fully compilable, testable state with no dangling references to the removed systems.

## Glossary

- **ChunkManager**: The main API class in `src/world/chunk-manager.ts` that orchestrates chunk generation, caching, and serialization.
- **LOD_System**: The level-of-detail system defined in `src/world/lod.ts`, comprising `LODManager`, `LODLevel`, and `LODConfig`.
- **Incremental_System**: The incremental generation system defined in `src/world/incremental-generator.ts`, comprising `IncrementalGenerator`, `IncrementalConfig`, `GenerationStage`, and `PartialChunkData`.
- **Worker_Pool**: The multi-threaded chunk generation system defined in `src/world/worker-pool.ts`, comprising `WorkerPool` and `WorkerPoolConfig`.
- **Public_API**: The set of symbols exported from `src/index.ts`.
- **DemoApp**: The demo application coordinator in `demo/src/core/DemoApp.ts`.
- **WorldConfig**: The configuration interface for `ChunkManager` defined in `src/world/chunk-manager.ts`.
- **ChunkData**: The complete chunk data structure defined in `src/world/chunk.ts`.

---

## Requirements

### Requirement 1: Delete LOD and Incremental Source Files

**User Story:** As a developer, I want the LOD and incremental generation source files removed from the repository, so that no dead code remains and the codebase is unambiguous about which systems are active.

#### Acceptance Criteria

1. THE Engine SHALL NOT contain the file `src/world/lod.ts`.
2. THE Engine SHALL NOT contain the file `src/world/incremental-generator.ts`.

---

### Requirement 2: Remove LOD and Incremental References from ChunkManager

**User Story:** As a developer, I want `ChunkManager` to have no references to the LOD or incremental systems, so that the class compiles cleanly and its API reflects only the systems that remain.

#### Acceptance Criteria

1. THE ChunkManager SHALL NOT import `LODManager`, `LODLevel`, or `LODConfig` from any module.
2. THE ChunkManager SHALL NOT import `IncrementalGenerator` from any module.
3. THE ChunkManager SHALL NOT declare private fields of type `LODManager` or `IncrementalGenerator`.
4. THE ChunkManager SHALL NOT expose the methods `getChunkIncremental`, `continueGeneration`, `getGenerationStage`, or `cancelIncrementalGeneration` in its public interface.
5. WHEN `getChunk` is called, THE ChunkManager SHALL generate the chunk using the Worker_Pool if a `workerPoolConfig` is present in `WorldConfig`, or synchronously otherwise.
6. THE ChunkManager SHALL NOT apply LOD transformations to chunks at any point during generation or retrieval.

---

### Requirement 3: Remove LOD and Incremental Fields from WorldConfig

**User Story:** As a developer, I want `WorldConfig` to no longer accept LOD or incremental configuration, so that callers cannot pass configuration for systems that no longer exist.

#### Acceptance Criteria

1. THE WorldConfig SHALL NOT contain a `lodConfig` field.
2. THE WorldConfig SHALL NOT contain an `incrementalConfig` field.

---

### Requirement 4: Remove LOD and Incremental Types from chunk.ts

**User Story:** As a developer, I want the incremental-generation-specific types removed from `chunk.ts`, so that the data model only describes types that are actively used.

#### Acceptance Criteria

1. THE Engine SHALL NOT export `GenerationStage` from `src/world/chunk.ts`.
2. THE Engine SHALL NOT export `PartialChunkData` from `src/world/chunk.ts`.
3. THE Engine SHALL NOT export `IncrementalConfig` from `src/world/chunk.ts`.

---

### Requirement 5: Remove LOD and Incremental Exports from the Public API

**User Story:** As a library consumer, I want the public API to not expose removed systems, so that I receive a compile-time error if I attempt to use them rather than a silent runtime failure.

#### Acceptance Criteria

1. THE Public_API SHALL NOT export `LODManager`, `LODLevel`, or `LODConfig`.
2. THE Public_API SHALL NOT export `IncrementalGenerator`.
3. THE Public_API SHALL NOT export `GenerationStage`, `PartialChunkData`, or `IncrementalConfig`.

---

### Requirement 6: Update DemoApp to Remove LOD and Incremental Usage

**User Story:** As a developer, I want the demo application to compile and run without any reference to the removed systems, so that the demo remains a valid showcase of the engine's current capabilities.

#### Acceptance Criteria

1. THE DemoApp SHALL NOT import `LODManager` or `LODLevel` from the engine.
2. THE DemoApp SHALL NOT maintain a `lodManager` field in `AppState`.
3. THE DemoApp SHALL NOT call `getChunkIncremental`, `continueGeneration`, `getGenerationStage`, or `cancelIncrementalGeneration` on `ChunkManager`.
4. THE DemoApp SHALL NOT maintain `incrementalEnabled` or `chunksInProgress` fields in `AppState`.
5. THE DemoApp SHALL NOT maintain `lodHighCount`, `lodMediumCount`, or `lodLowCount` fields in `AppState`.
6. WHEN `loadChunksAround` is called, THE DemoApp SHALL generate each chunk by calling `getChunk` on `ChunkManager` directly.

---

### Requirement 7: Update Tests to Remove LOD and Incremental References

**User Story:** As a developer, I want the test suite to pass without referencing the removed systems, so that CI remains green and tests accurately reflect the current codebase.

#### Acceptance Criteria

1. THE Test_Suite SHALL NOT reference `LODManager`, `LODLevel`, `LODConfig`, `IncrementalGenerator`, `IncrementalConfig`, `GenerationStage`, or `PartialChunkData`.
2. WHEN the test suite is executed, THE Test_Suite SHALL pass all tests without errors or failures caused by the removal.
3. THE Test_Suite SHALL NOT call `getChunkIncremental`, `continueGeneration`, `getGenerationStage`, or `cancelIncrementalGeneration` on any `ChunkManager` instance.

---

### Requirement 8: Worker Pool Remains the Async Generation Mechanism

**User Story:** As a developer, I want the worker pool to remain fully functional as the only asynchronous chunk generation path, so that multi-threaded generation continues to work after the removal.

#### Acceptance Criteria

1. THE Worker_Pool SHALL remain in `src/world/worker-pool.ts` with no modifications to its public interface.
2. WHEN `workerPoolConfig` is provided in `WorldConfig`, THE ChunkManager SHALL delegate chunk generation to the Worker_Pool.
3. IF the Worker_Pool fails to generate a chunk, THEN THE ChunkManager SHALL fall back to synchronous generation on the main thread.
4. THE Public_API SHALL continue to export `WorkerPool` and `WorkerPoolConfig`.

---

### Requirement 9: TypeScript Compilation Succeeds After Removal

**User Story:** As a developer, I want the entire project to compile without TypeScript errors after the removal, so that the codebase is in a valid, shippable state.

#### Acceptance Criteria

1. WHEN `npm run build` is executed, THE Engine SHALL compile to `dist/` without TypeScript errors.
2. WHEN `npm run build:demo` is executed, THE DemoApp SHALL compile to `dist-demo/` without TypeScript errors.
3. THE Engine SHALL NOT contain any TypeScript `import` statements that reference `./lod`, `./incremental-generator`, or their types.
