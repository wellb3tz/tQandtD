# Implementation Plan: Remove LOD and Incremental Generation Systems

## Overview

Remove `src/world/lod.ts` and `src/world/incremental-generator.ts` along with every reference to them across the library, demo, and test suite. The worker pool remains untouched as the sole async generation path. Each task below produces a compilable intermediate state so the codebase is never left broken between steps.

## Tasks

- [x] 1. Remove LOD and incremental type definitions from `chunk.ts`
  - Delete the `GenerationStage` enum
  - Delete the `PartialChunkData` interface
  - Delete the `IncrementalConfig` interface
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Clean up `ChunkManager` — remove LOD and incremental fields, methods, and config
  - [x] 2.1 Remove imports of `LODManager`, `LODLevel`, `LODConfig` from `lod.ts` and `IncrementalGenerator` from `incremental-generator.ts`
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Remove private fields `lodManager` and `incrementalGenerator` from the class body
    - _Requirements: 2.3_
  - [x] 2.3 Remove `lodConfig` and `incrementalConfig` fields from the `WorldConfig` interface
    - _Requirements: 3.1, 3.2_
  - [x] 2.4 Remove the constructor logic that instantiates `LODManager` and `IncrementalGenerator`; remove the LOD application inside `getChunk`
    - _Requirements: 2.5, 2.6_
  - [x] 2.5 Delete the public methods `getChunkIncremental`, `continueGeneration`, `getGenerationStage`, and `cancelIncrementalGeneration`
    - _Requirements: 2.4_

- [x] 3. Delete the source files for the removed systems
  - Delete `src/world/lod.ts`
  - Delete `src/world/incremental-generator.ts`
  - _Requirements: 1.1, 1.2_

- [x] 4. Remove LOD and incremental exports from the public API (`src/index.ts`)
  - Remove the export line for `LODManager`, `LODLevel`, and `LODConfig`
  - Remove the export line for `IncrementalGenerator`
  - Remove `GenerationStage`, `PartialChunkData`, and `IncrementalConfig` from the `chunk` re-export
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Update `DemoApp` to remove all LOD and incremental usage
  - [x] 5.1 Remove `LODManager` and `LODLevel` from the import statement at the top of `demo/src/core/DemoApp.ts`
    - _Requirements: 6.1_
  - [x] 5.2 Remove `lodManager`, `lodHighCount`, `lodMediumCount`, `lodLowCount`, `incrementalEnabled`, and `chunksInProgress` fields from the `AppState` interface and the initial state object in the constructor
    - _Requirements: 6.2, 6.4, 6.5_
  - [x] 5.3 Rewrite `loadChunksAround` to always call `getChunk` directly, removing the incremental branch and the LOD application block; remove the `updateChunkLODLevels` call after loading
    - _Requirements: 6.3, 6.6_
  - [x] 5.4 Delete the `continueIncrementalGeneration` method entirely
    - _Requirements: 6.3_
  - [x] 5.5 Remove the LOD manager update logic from `updateEngineConfig` (the `lodManager` variable, the `'lodConfig' in config` branch, and the `lodManager` field in the `updateState` call); remove `incrementalEnabled` from the `updateState` call
    - _Requirements: 6.2, 6.4_
  - [x] 5.6 Delete the private `updateChunkLODLevels` method and the public `getChunkLODLevel` method
    - _Requirements: 6.2_
  - [x] 5.7 Remove the `updateCameraPosition` call to `updateChunkLODLevels`
    - _Requirements: 6.2_

- [x] 6. Update demo UI components to remove LOD and incremental references
  - [x] 6.1 Update `demo/src/ui/ControlPanel.ts`: remove the LOD enable/disable toggle and distance controls, remove the incremental generation enable/disable toggle and time-budget control, and delete the private `updateLODConfig` and `updateIncrementalConfig` methods
    - _Requirements: 6.1_
  - [x] 6.2 Update `demo/src/ui/PerformanceMonitor.ts`: remove the `LODStats` and `IncrementalStats` interfaces, remove the LOD and incremental HTML section creation, remove the `updateLODStats` and `updateIncrementalStats` methods, and remove the corresponding private element fields
    - _Requirements: 6.2, 6.4, 6.5_
  - [x] 6.3 Update `demo/src/ui/WorldManager.ts`: remove `lodConfig` and `incrementalConfig` from the config object passed to `updateEngineConfig`
    - _Requirements: 6.1_
  - [x] 6.4 Update `demo/src/viewer/WorldViewer.ts`: remove the `lodLevel` metadata read and the LOD-tint logic from `createTerrainMesh`; remove the LOD-conditional resource/structure rendering guards that reference `GenerationStage` numeric values
    - _Requirements: 6.1_

- [x] 7. Update the test suite to remove LOD and incremental references
  - [x] 7.1 Update `tests/bugfix/worker-pool-integration.test.ts`: remove the property test that calls `updateEngineConfig({ lodConfig })` and asserts `state.lodManager`; remove the property test that calls `updateEngineConfig({ incrementalConfig })` and asserts `state.incrementalEnabled`; remove the inline test that sets `incrementalConfig` and asserts `state.incrementalEnabled`
    - _Requirements: 7.1, 7.3_

- [x] 8. Verify TypeScript compilation succeeds
  - Run `npm run build` and confirm zero TypeScript errors in `dist/`
  - Run `npm run build:demo` and confirm zero TypeScript errors in `dist-demo/`
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 9. Run the full test suite and confirm all tests pass
  - Run `npm test` and confirm all tests pass with no failures related to the removal
  - _Requirements: 7.2_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
