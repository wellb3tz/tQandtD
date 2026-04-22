# Implementation Plan: Remove Lake Generation System

## Overview

This plan removes the lake generation system from the Procedural World Engine demo application. Lakes exist only in `demo/src/viewer/water/` and were never implemented in the core engine. This removal simplifies the water rendering system to focus exclusively on ocean water rendering while preserving all ocean functionality.

The implementation follows a 4-phase approach:
1. Remove lake types and configuration (establishes compile-time prevention)
2. Remove lake material creation
3. Remove lake mesh management
4. Update documentation and verify

## Tasks

- [ ] 1. Phase 1: Remove lake types and configuration
  - [x] 1.1 Remove lake types from types.ts
    - Remove `LakeConfig` interface
    - Change `WaterType` from `'ocean' | 'lake'` to `'ocean'`
    - Remove `lakes` field from `WaterLayerData` interface
    - Remove `lake` field from `WaterConfig` interface
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 13.1, 13.2, 13.3_
  
  - [x] 1.2 Remove lake configuration from config.ts
    - Remove `DEFAULT_LAKE_CONFIG` constant
    - Remove `lake` field from `DEFAULT_WATER_CONFIG`
    - Remove lake validation logic from `validateWaterConfig` function
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 14.1, 14.2, 14.3, 14.4_
  
  - [x] 1.3 Write unit tests for type and configuration changes
    - Test that `WaterType` only accepts `'ocean'`
    - Test that `WaterLayerData` does not have `lakes` field
    - Test that `WaterConfig` does not have `lake` field
    - Test that `validateWaterConfig` returns ocean-only configuration
    - Test that `validateWaterConfig` ignores lake properties if provided
    - _Requirements: 1.5, 2.5, 5.4, 6.4, 13.4, 13.5, 14.5_
  
  - [x] 1.4 Verify TypeScript compilation succeeds
    - Run `npx tsc --noEmit` to verify no type errors
    - Confirm lake-related code now produces compile errors
    - _Requirements: 11.4, 13.1, 13.2, 13.3_

- [ ] 2. Phase 2: Remove lake material creation
  - [x] 2.1 Remove createLakeMaterial from WaterMaterialFactory.ts
    - Remove `createLakeMaterial` function
    - Remove `LakeConfig` import (will already be a compile error)
    - Update JSDoc comments to remove lake references
    - _Requirements: 3.1, 3.2, 3.3, 8.4, 11.2_
  
  - [x] 2.2 Update water system exports in index.ts
    - Remove `LakeConfig` from type exports
    - Remove `DEFAULT_LAKE_CONFIG` from configuration exports
    - Verify `createLakeMaterial` is not exported
    - _Requirements: 3.4, 15.1, 15.2, 15.3, 15.4_
  
  - [x] 2.3 Write unit tests for material factory changes
    - Test that `createOceanMaterial` creates valid ocean material
    - Test that `createLakeMaterial` function does not exist (import test)
    - _Requirements: 3.3, 3.4_
  
  - [x] 2.4 Verify TypeScript compilation succeeds
    - Run `npx tsc --noEmit` to verify no type errors
    - Confirm no broken imports or references
    - _Requirements: 11.1, 11.2, 11.4_

- [ ] 3. Phase 3: Remove lake mesh management
  - [x] 3.1 Remove lake mesh creation from WaterLayerManager.addWaterToChunk
    - Remove `lakes: []` from `WaterLayerData` initialization
    - Remove any lake mesh generation logic (if present)
    - Simplify to ocean-only mesh generation
    - _Requirements: 4.1, 4.6, 5.3_
  
  - [x] 3.2 Remove lake mesh disposal from WaterLayerManager.removeWaterFromChunk
    - Remove lake mesh disposal loop
    - Keep only ocean mesh disposal
    - _Requirements: 4.2, 4.7_
  
  - [x] 3.3 Remove lake mesh disposal from WaterLayerManager.dispose
    - Remove lake mesh disposal loop
    - Keep only ocean mesh disposal
    - _Requirements: 4.3, 4.7_
  
  - [x] 3.4 Remove lake visibility logic from WaterLayerManager.applyLOD
    - Remove lake-specific visibility logic at medium distance
    - Keep only ocean visibility control
    - _Requirements: 4.4, 4.7, 9.1, 9.2, 9.3, 9.4_
  
  - [x] 3.5 Remove lake mesh checks from WaterLayerManager.applyFrustumCulling
    - Remove lake mesh bounding box intersection checks
    - Keep only ocean mesh checks
    - _Requirements: 4.5, 4.7, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 3.6 Write integration tests for WaterLayerManager changes
    - Test that `addWaterToChunk` creates only ocean meshes
    - Test that `removeWaterFromChunk` disposes only ocean meshes
    - Test that `dispose` cleans up only ocean meshes
    - Test that `applyLOD` controls only ocean visibility
    - Test that `applyFrustumCulling` checks only ocean meshes
    - Test that `WaterLayerData` does not have `lakes` property
    - _Requirements: 4.6, 4.7, 5.4, 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 3.7 Verify TypeScript compilation succeeds
    - Run `npx tsc --noEmit` to verify no type errors
    - Confirm no references to `waterLayer.lakes`
    - _Requirements: 11.3, 11.4, 13.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npm test` to verify all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 4: Update documentation and verify
  - [x] 5.1 Update JSDoc comments across water system files
    - Update `types.ts` interface documentation to remove lake references
    - Update `config.ts` configuration documentation to describe ocean-only
    - Update `WaterLayerManager.ts` method documentation to remove lake descriptions
    - Update `WaterMaterialFactory.ts` documentation to describe ocean-only material creation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 5.2 Perform code search verification
    - Search for `'lake'` string literal in `demo/src/viewer/water/`
    - Search for `'Lake'` string in `demo/src/viewer/water/`
    - Search for `LakeConfig` type references
    - Search for `createLakeMaterial` function calls
    - Search for `waterLayer.lakes` property access
    - Verify no matches except in comments/documentation
    - _Requirements: 11.1, 11.2, 11.3, 11.6_
  
  - [x] 5.3 Run full build verification
    - Run `npm run build` (library build)
    - Run `npm run build:demo` (demo build)
    - Run `npm test` (all tests)
    - Run `npx tsc --noEmit` (type checking)
    - Verify all commands succeed without errors
    - _Requirements: 11.4, 11.5_
  
  - [x] 5.4 Perform visual verification of ocean rendering
    - Run demo application with `npm run demo`
    - Verify ocean water renders correctly with proper color, opacity, and shininess
    - Verify ocean meshes appear at correct elevation (sea level)
    - Verify water visibility toggle works correctly
    - Verify no console errors appear
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [x] 5.5 Verify type system prevents lake code reintroduction
    - Attempt to assign `'lake'` to `WaterType` variable (should fail at compile time)
    - Attempt to access `waterLayer.lakes` property (should fail at compile time)
    - Attempt to add `lake` field to `WaterConfig` (should fail at compile time)
    - Document that type system successfully prevents invalid code
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 6. Final checkpoint - Complete verification
  - Ensure all tests pass, ask the user if questions arise.
  - Confirm ocean rendering works correctly
  - Confirm no lake references remain in code

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster completion
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Phase 1 establishes compile-time prevention by removing types first
- Phase 2 removes material creation before mesh management
- Phase 3 completes the code removal
- Phase 4 ensures documentation accuracy and comprehensive verification
- Ocean rendering functionality must remain unchanged throughout all phases
