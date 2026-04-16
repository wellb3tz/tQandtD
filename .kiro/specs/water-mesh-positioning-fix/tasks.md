# Implementation Plan

## Overview

This task list implements the water mesh positioning fix using the bug condition methodology. The fix addresses a coordinate system mismatch where water meshes use local coordinates while terrain uses world coordinates, causing water to appear in incorrect locations.

## Task Execution Order

1. **Bug Condition Exploration Test** (BEFORE fix) - Confirms bug exists
2. **Preservation Property Tests** (BEFORE fix) - Captures baseline behavior
3. **Implementation** - Apply the fix with verification
4. **Checkpoint** - Final validation

---

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Water Positioned at World Coordinates
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the coordinate mismatch bug
  - **Scoped PBT Approach**: Test specific chunks at different coordinates to ensure reproducibility
  - Test implementation details from Bug Condition in design:
    - Generate ocean meshes for chunks at coordinates (0,0), (1,0), (-1,0), (5,5)
    - Verify ocean geometry vertices use world coordinates (worldX = chunkX * chunkSize + localX)
    - Verify water group positioned at origin (0, 0, 0)
    - Verify water elevation = (seaLevel + waterOffset) * HEIGHT_SCALE
  - The test assertions should match the Expected Behavior Properties from design:
    - Ocean vertices at world positions matching terrain coordinate system
    - Water group at origin since geometry contains world coordinates
    - Water appears above underwater terrain (grey areas) at all chunk positions
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Chunk (1,0): Ocean vertices at local positions 0-32 instead of world positions 32-64
    - Chunk (-1,0): Ocean vertices at local positions 0-32 instead of world positions -32-0
    - Water group positioned at chunk offset causes double offset
    - River mesh generation fails due to undefined `heightScale` variable
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Water Features and Materials Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-coordinate-related features:
    - Water material creation (color, opacity, shininess)
    - Ocean tile identification (tiles where height < seaLevel)
    - Underwater terrain coloring (darkening and desaturation)
    - Water visibility toggling
    - HEIGHT_SCALE consistency across water types
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all water configurations, material properties remain unchanged
    - For all heightmaps, ocean tile identification remains unchanged
    - For all underwater terrain, coloring effects remain unchanged
    - For all visibility states, toggle behavior remains unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix for water mesh positioning coordinate mismatch

  - [x] 3.1 Update OceanMeshGenerator to use world coordinates
    - File: `demo/src/viewer/water/OceanMeshGenerator.ts`
    - Function: `buildOceanGeometry`
    - Change vertex position calculations from local to world coordinates:
      - Current: `const x0 = localX; const y0 = localY;`
      - Fixed: `const x0 = chunkData.x * size + localX; const z0 = chunkData.y * size + localY;`
      - Apply to all vertex positions (x0, x1, z0, z1)
    - Update boundary alignment comments to reflect world coordinate usage
    - Remove redundant worldX/worldY calculations (now incorporated into vertices)
    - _Bug_Condition: isBugCondition(input) where oceanGeometryUsesLocalCoordinates AND waterGroupPositionedAtChunkOffset AND terrainGeometryUsesWorldCoordinates_
    - _Expected_Behavior: Ocean geometry uses world coordinates (worldX = chunkX * size + localX)_
    - _Preservation: Material properties, tile identification, underwater coloring unchanged_
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Update WaterLayerManager to position group at origin
    - File: `demo/src/viewer/water/WaterLayerManager.ts`
    - Function: `addWaterToChunk`
    - Change water group positioning from chunk offset to origin:
      - Current: `waterLayer.group.position.set(chunkData.x * chunkData.size, 0, chunkData.y * chunkData.size);`
      - Fixed: `waterLayer.group.position.set(0, 0, 0);`
    - Update positioning comments:
      - Current: "Ocean/river/lake geometries use local chunk coordinates (0 to size), so we need to offset the group to the chunk's world position"
      - Fixed: "Ocean/river/lake geometries use world coordinates, so group is positioned at origin"
    - _Bug_Condition: Water group positioned at chunk offset with local coordinates_
    - _Expected_Behavior: Water group at origin (0, 0, 0) since geometry contains world coordinates_
    - _Preservation: Visibility toggling, material management unchanged_
    - _Requirements: 2.2, 3.7, 3.8_

  - [x] 3.3 Fix RiverMeshGenerator HEIGHT_SCALE reference
    - File: `demo/src/viewer/water/RiverMeshGenerator.ts`
    - Function: `buildRiverPathGeometry`
    - Fix undefined variable reference:
      - Current: `const terrainHeight = heightmap[heightIndex] * heightScale;`
      - Fixed: `const terrainHeight = heightmap[heightIndex] * HEIGHT_SCALE;`
    - Apply world coordinates to river vertex positions:
      - Add chunk offset: `const worldX = chunkData.x * size + localX;`
      - Add chunk offset: `const worldZ = chunkData.y * size + localY;`
      - Use worldX and worldZ in vertex position calculations
    - _Bug_Condition: River uses undefined heightScale and local coordinates_
    - _Expected_Behavior: River uses HEIGHT_SCALE constant and world coordinates_
    - _Preservation: River width calculations, flow-based rendering unchanged_
    - _Requirements: 2.1, 2.3, 3.6_

  - [x] 3.4 Update LakeMeshGenerator to use world coordinates
    - File: `demo/src/viewer/water/LakeMeshGenerator.ts`
    - Function: `buildLakeGeometry`
    - Apply world coordinates to lake vertex positions:
      - Current: Uses local coordinates (x0 = localX, y0 = localY)
      - Fixed: Add chunk offset (x0 = chunkData.x * size + localX, z0 = chunkData.y * size + localY)
      - Apply to all vertex positions (x0, x1, z0, z1)
    - _Bug_Condition: Lake uses local coordinates_
    - _Expected_Behavior: Lake uses world coordinates matching terrain and ocean_
    - _Preservation: Lake elevation calculations, tile identification unchanged_
    - _Requirements: 2.1, 2.3, 3.6_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Water Positioned at World Coordinates
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify for all tested chunks:
      - Ocean vertices use world coordinates
      - Water group positioned at origin
      - Water appears at correct world positions matching terrain
      - Rivers and lakes align with ocean and terrain
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Water Features and Materials Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix:
      - Material properties unchanged
      - Ocean tile identification unchanged
      - Underwater terrain coloring unchanged
      - Visibility toggling unchanged
      - HEIGHT_SCALE consistency maintained
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run complete test suite: `npm test`
  - Verify all bug condition tests pass (water positioned correctly)
  - Verify all preservation tests pass (no regressions)
  - Verify existing water system tests still pass
  - Check for any console errors or warnings
  - If any issues arise, document and ask user for guidance
