# Tasks: Remove River Generation System

## Overview

This task list implements the complete removal of the river generation system from the Procedural World Engine. The tasks follow the phased approach defined in the design document, progressing from core data structures through serialization, workers, generation, API, documentation, demo application, and testing.

## Task Breakdown

### Phase 1: Core Data Structures

- [x] 1.1 Remove rivers field from ChunkData interface in src/world/chunk.ts
- [x] 1.2 Update ChunkData JSDoc comment to remove rivers reference
- [x] 1.3 Remove RIVERS stage from GenerationStage enum
- [x] 1.4 Renumber GenerationStage enum values (RESOURCES=2, STRUCTURES=3, COMPLETE=4)
- [x] 1.5 Update GenerationStage JSDoc comment to remove RIVERS stage
- [x] 1.6 Verify TypeScript compilation identifies all affected files

### Phase 2: Serialization Layer

- [x] 2.1 Remove rivers field from SerializedChunk interface in src/world/serialization.ts
- [x] 2.2 Update SerializedChunk JSDoc comment to remove rivers reference
- [x] 2.3 Remove rivers serialization from serializeChunkJSON method
- [x] 2.4 Remove rivers serialization from serializeChunkBinary method
- [x] 2.5 Update deserializeChunkJSON to ignore rivers field (backward compatibility)
- [x] 2.6 Update deserializeChunkBinary to skip rivers data (backward compatibility)
- [x] 2.7 Remove rivers from serializeWorldToBinary size calculation
- [x] 2.8 Remove rivers writing loop from serializeWorldToBinary
- [x] 2.9 Update deserializeWorldFromBinary to skip legacy rivers data (backward compatibility)
- [x] 2.10 Update validateSerializedWorld to make rivers field optional
- [x] 2.11 Update all serialization JSDoc comments to remove rivers references

### Phase 3: Worker Layer

- [x] 3.1 Remove rivers field from SerializedChunkData interface in src/worker.ts
- [x] 3.2 Remove rivers serialization from serializeChunkData in src/worker.ts
- [x] 3.3 Remove rivers deserialization from deserializeChunkData in src/worker.ts
- [x] 3.4 Remove rivers deserialization from deserializeChunkData in src/world/worker-pool.ts
- [x] 3.5 Update worker JSDoc comments to remove rivers references

### Phase 4: Generation Layer

- [x] 4.1 Remove rivers initialization from getChunk in src/world/chunk-manager.ts
- [x] 4.2 Update chunk-manager JSDoc comment to remove rivers reference
- [x] 4.3 Remove rivers from temporary ChunkData in executeResourcesStage (src/world/incremental-generator.ts)
- [x] 4.4 Remove rivers from temporary ChunkData in executeStructuresStage (src/world/incremental-generator.ts)
- [x] 4.5 Update evaluatePlacementRule to remove rivers parameter in src/gen/structures.ts
- [x] 4.6 Update or remove distanceToWater function in src/gen/structures.ts
- [x] 4.7 Update generation JSDoc comments to remove rivers references
- [x] 4.8 Verify npm run build succeeds

### Phase 5: Public API

- [x] 5.1 Check if RiverConfig type exists in src/index.ts and remove if present
- [x] 5.2 Check if RiverNetworkConfig type exists in src/index.ts and remove if present
- [x] 5.3 Check if RiverSegment type exists in src/index.ts and remove if present
- [x] 5.4 Check if Lake type exists in src/index.ts and remove if present
- [x] 5.5 Check if RiverNetwork type exists in src/index.ts and remove if present
- [x] 5.6 Verify dist/ output doesn't include river types

### Phase 6: Documentation

- [x] 6.1 Remove "Advanced River Networks" from Features section in README.md
- [x] 6.2 Remove "River Networks" configuration section from README.md
- [x] 6.3 Remove River Network Configuration table from README.md
- [x] 6.4 Remove river-related examples from Quick Start section in README.md
- [x] 6.5 Remove river-related examples from Advanced Features section in README.md
- [x] 6.6 Remove RiverSegment, Lake, RiverNetwork from API Documentation in README.md
- [x] 6.7 Remove river configuration from Complete Configuration Example in README.md
- [x] 6.8 Update GenerationStage description to remove RIVERS stage in README.md
- [x] 6.9 Remove "rivers" from ChunkData description in README.md
- [x] 6.10 Update Project Structure to remove src/gen/rivers.ts reference in README.md
- [x] 6.11 Update LOD Feature Culling description to remove river references in README.md
- [x] 6.12 Remove "River Networks" from Core Capabilities in .kiro/steering/product.md
- [x] 6.13 Remove "rivers.ts" from Generation Systems in .kiro/steering/structure.md
- [x] 6.14 Verify no river references remain in documentation

### Phase 7: Demo Application

- [x] 7.1 Analyze water rendering system in demo/src/viewer/water/ for river-specific code
- [x] 7.2 Remove river mesh creation and management from water system
- [x] 7.3 Remove river configuration from WaterConfig interface
- [x] 7.4 Update water rendering to only handle oceans and lakes
- [x] 7.5 Update demo UI to remove river controls
- [x] 7.6 Verify npm run demo starts without errors
- [x] 7.7 Verify water rendering works for oceans and lakes

### Phase 8: Test Updates

- [x] 8.1 Update chunk generation tests to remove rivers assertions
- [x] 8.2 Update serialization tests to not expect rivers field
- [x] 8.3 Update worker tests to not include rivers in messages
- [x] 8.4 Create test fixture with legacy JSON save data containing rivers
- [x] 8.5 Create test fixture with legacy binary save data containing rivers
- [x] 8.6 Add backward compatibility test for legacy JSON deserialization
- [x] 8.7 Add backward compatibility test for legacy binary deserialization
- [x] 8.8 Update incremental generation tests to skip RIVERS stage
- [x] 8.9 Update GenerationStage enum tests for new numbering
- [x] 8.10 Verify npm test passes all tests
- [x] 8.11 Verify npm run test:coverage maintains coverage levels

### Phase 9: Final Verification

- [x] 9.1 Run npm run build and verify success
- [x] 9.2 Run npm run build:demo and verify success
- [x] 9.3 Run npm test and verify all tests pass
- [x] 9.4 Run npm run demo and verify demo works correctly
- [x] 9.5 Manual test: Generate chunks and verify no rivers field
- [x] 9.6 Manual test: Save and load world in JSON format
- [x] 9.7 Manual test: Save and load world in binary format
- [x] 9.8 Manual test: Load legacy save file with rivers data
- [x] 9.9 Manual test: Verify incremental generation works
- [x] 9.10 Manual test: Verify worker pool generation works
- [x] 9.11 Search codebase for remaining "river" references (case-insensitive)
- [x] 9.12 Review all modified files for completeness

## Task Dependencies

```
Phase 1 (Core Data Structures)
  ↓
Phase 2 (Serialization Layer)
  ↓
Phase 3 (Worker Layer)
  ↓
Phase 4 (Generation Layer)
  ↓
Phase 5 (Public API)
  ↓
Phase 6 (Documentation) ← Can be done in parallel with Phase 7
  ↓
Phase 7 (Demo Application)
  ↓
Phase 8 (Test Updates)
  ↓
Phase 9 (Final Verification)
```

## Notes

- **Backward Compatibility**: Phases 2.5, 2.6, 2.9, and 2.10 are critical for maintaining backward compatibility with legacy save files
- **TypeScript Errors**: After Phase 1, TypeScript compilation will show errors in multiple files - this is expected and will be resolved in subsequent phases
- **Testing**: Phase 8 should be completed after all code changes to ensure comprehensive test coverage
- **Demo Application**: Phase 7 requires careful analysis of the water rendering system to avoid breaking ocean and lake rendering
- **Final Verification**: Phase 9 includes both automated and manual testing to ensure complete removal

## Success Criteria

- [ ] All tasks completed
- [ ] npm run build succeeds
- [ ] npm test passes all tests
- [ ] npm run demo runs without errors
- [ ] Legacy save files load successfully
- [ ] No river references in documentation
- [ ] No river types in public API
- [ ] Migration guide created for users

## Estimated Time

- Phase 1: 1 hour
- Phase 2: 2 hours
- Phase 3: 1 hour
- Phase 4: 1 hour
- Phase 5: 0.5 hours
- Phase 6: 2 hours
- Phase 7: 2 hours
- Phase 8: 2 hours
- Phase 9: 1 hour

**Total: 12.5 hours**
