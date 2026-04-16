# Water Mesh Positioning Fix Design

## Overview

This bugfix addresses a coordinate system mismatch between terrain rendering and water rendering that causes water meshes to appear in incorrect locations. The fix modifies the water system to use world coordinates consistently with terrain rendering, ensuring water appears correctly above underwater terrain areas.

The core issue is that terrain meshes use world coordinates directly in their geometry, while water meshes use local chunk coordinates with group positioning. This inconsistency causes water to be offset incorrectly. The solution is to change water mesh generation to use world coordinates and position water groups at the origin.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when water meshes use local coordinates while terrain uses world coordinates
- **Property (P)**: The desired behavior - water meshes positioned at correct world coordinates matching terrain
- **Preservation**: Existing water features (rivers, lakes, materials, visibility) that must remain unchanged by the fix
- **OceanMeshGenerator**: The module in `demo/src/viewer/water/OceanMeshGenerator.ts` that generates ocean surface geometry
- **WaterLayerManager**: The module in `demo/src/viewer/water/WaterLayerManager.ts` that manages water mesh lifecycle and positioning
- **World Coordinates**: Absolute positions calculated as `chunkX * chunkSize + localX`
- **Local Coordinates**: Positions within a chunk ranging from 0 to chunkSize
- **HEIGHT_SCALE**: Constant value of 50 used to scale terrain and water elevations

## Bug Details

### Bug Condition

The bug manifests when water meshes are generated and positioned in the scene. The `buildOceanGeometry` function uses local chunk coordinates (0 to size) for vertex positions, then `WaterLayerManager.addWaterToChunk` applies a chunk world offset to the group. This differs from terrain rendering which uses world coordinates directly in vertex positions.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { chunkData: ChunkData, waterConfig: WaterConfig }
  OUTPUT: boolean
  
  RETURN input.waterConfig.enabled == true
         AND oceanGeometryUsesLocalCoordinates(input.chunkData)
         AND waterGroupPositionedAtChunkOffset(input.chunkData)
         AND terrainGeometryUsesWorldCoordinates(input.chunkData)
END FUNCTION
```

### Examples

- **Chunk (0,0) with ocean tiles**: Water geometry has vertices at local positions (0-32), group positioned at (0, 0, 0). Terrain geometry has vertices at world positions (0-32). Result: Water appears correctly by coincidence.
- **Chunk (1,0) with ocean tiles**: Water geometry has vertices at local positions (0-32), group positioned at (32, 0, 0). Terrain geometry has vertices at world positions (32-64). Result: Water appears at wrong location (64-96 instead of 32-64).
- **Chunk (-1,0) with ocean tiles**: Water geometry has vertices at local positions (0-32), group positioned at (-32, 0, 0). Terrain geometry has vertices at world positions (-32-0). Result: Water appears at wrong location (-64--32 instead of -32-0).
- **Edge case - Chunk boundaries**: Adjacent chunks have misaligned water at boundaries due to coordinate mismatch, creating visible gaps or overlaps.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- River mesh generation must continue to work with existing flow-based width calculations
- Lake mesh generation must continue to work with existing elevation-based positioning
- Water material properties (color, opacity, shininess) must remain unchanged
- Water visibility toggling must continue to show/hide all water layers
- Underwater terrain coloring (darkening and desaturation) must remain unchanged
- HEIGHT_SCALE value of 50 must remain consistent across all water types

**Scope:**
All inputs that do NOT involve coordinate positioning should be completely unaffected by this fix. This includes:
- Water material creation and configuration
- Water visibility controls
- Underwater terrain color processing
- Water feature identification (ocean tiles, river segments, lake tiles)
- LOD and frustum culling systems

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Inconsistent Coordinate Systems**: Ocean geometry uses local coordinates (0 to size) while terrain uses world coordinates (chunkX * size + localX). This creates a mismatch when both are rendered in the same scene.

2. **Double Offset Application**: Water group is positioned at chunk world offset `(chunkX * size, 0, chunkY * size)`, which would be correct for local coordinates. However, this creates incorrect positioning when combined with the local coordinate system.

3. **Missing HEIGHT_SCALE in Rivers**: RiverMeshGenerator.ts references `heightScale` variable that doesn't exist, causing rivers to be positioned incorrectly. Should use `HEIGHT_SCALE` constant.

4. **Coordinate System Documentation**: Code comments in OceanMeshGenerator.ts describe a boundary alignment strategy that assumes local coordinates, but this strategy doesn't work when terrain uses world coordinates.

## Correctness Properties

Property 1: Bug Condition - Water Positioned at World Coordinates

_For any_ chunk where water is enabled and ocean tiles exist, the fixed water system SHALL generate ocean geometry using world coordinates (worldX = chunkX * chunkSize + localX, worldZ = chunkY * chunkSize + localZ) and position the water group at origin (0, 0, 0), ensuring water appears at the correct world position matching terrain coordinates.

**Validates: Requirements 2.1, 2.2, 2.4, 2.5**

Property 2: Preservation - Water Features and Materials

_For any_ water configuration that does NOT involve coordinate positioning (materials, visibility, underwater coloring), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing water features including rivers, lakes, material properties, visibility controls, and underwater terrain effects.

**Validates: Requirements 3.2, 3.3, 3.4, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `demo/src/viewer/water/OceanMeshGenerator.ts`

**Function**: `buildOceanGeometry`

**Specific Changes**:
1. **Change Coordinate System**: Modify vertex position calculations to use world coordinates
   - Current: `const x0 = localX; const y0 = localY;`
   - Fixed: `const x0 = chunkData.x * size + localX; const z0 = chunkData.y * size + localY;`
   - Apply to all vertex positions (x0, x1, z0, z1)

2. **Update Comments**: Revise boundary alignment documentation to reflect world coordinate usage
   - Remove references to local coordinate boundary alignment strategy
   - Document that world coordinates ensure automatic boundary alignment

3. **Remove Redundant Calculations**: Remove worldX/worldY calculations that are no longer needed
   - Current code calculates worldX/worldY but doesn't use them
   - After fix, these calculations are incorporated into vertex positions

**File**: `demo/src/viewer/water/WaterLayerManager.ts`

**Function**: `addWaterToChunk`

**Specific Changes**:
1. **Change Group Positioning**: Position water group at origin instead of chunk offset
   - Current: `waterLayer.group.position.set(chunkData.x * chunkData.size, 0, chunkData.y * chunkData.size);`
   - Fixed: `waterLayer.group.position.set(0, 0, 0);`

2. **Update Comments**: Revise positioning documentation
   - Current: "Ocean/river/lake geometries use local chunk coordinates (0 to size), so we need to offset the group to the chunk's world position"
   - Fixed: "Ocean/river/lake geometries use world coordinates, so group is positioned at origin"

**File**: `demo/src/viewer/water/RiverMeshGenerator.ts`

**Function**: `buildRiverPathGeometry`

**Specific Changes**:
1. **Fix HEIGHT_SCALE Reference**: Change undefined `heightScale` variable to `HEIGHT_SCALE` constant
   - Current: `const terrainHeight = heightmap[heightIndex] * heightScale;`
   - Fixed: `const terrainHeight = heightmap[heightIndex] * HEIGHT_SCALE;`

2. **Apply World Coordinates**: Update river vertex positions to use world coordinates
   - Add chunk offset to localX and localY when calculating vertex positions
   - Ensures rivers align with terrain and ocean meshes

**File**: `demo/src/viewer/water/LakeMeshGenerator.ts`

**Function**: `buildLakeGeometry`

**Specific Changes**:
1. **Apply World Coordinates**: Update lake vertex positions to use world coordinates
   - Current: Uses local coordinates (localX, localY)
   - Fixed: Add chunk offset `(chunkData.x * size + localX, chunkData.y * size + localY)`
   - Ensures lakes align with terrain and ocean meshes

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that generate water meshes for chunks at different coordinates and verify that water vertex positions match terrain coordinate system. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Chunk (0,0) Ocean Test**: Generate ocean for chunk (0,0), verify vertices use world coordinates (will pass on unfixed code by coincidence)
2. **Chunk (1,0) Ocean Test**: Generate ocean for chunk (1,0), verify vertices at world positions 32-64 (will fail on unfixed code - vertices at 0-32 with group offset)
3. **Chunk (-1,0) Ocean Test**: Generate ocean for chunk (-1,0), verify vertices at world positions -32-0 (will fail on unfixed code)
4. **River HEIGHT_SCALE Test**: Generate river mesh, verify terrain height calculation doesn't throw undefined error (will fail on unfixed code)

**Expected Counterexamples**:
- Ocean vertices use local coordinates (0-32) instead of world coordinates
- Water group positioned at chunk offset causes double offset when combined with local coordinates
- River mesh generation fails or produces incorrect heights due to undefined `heightScale`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  oceanGeometry := buildOceanGeometry_fixed(input.oceanTiles, input.chunkData, input.config)
  waterGroup := createWaterGroup_fixed(input.chunkData)
  
  ASSERT oceanGeometry.vertices use world coordinates
  ASSERT waterGroup.position == (0, 0, 0)
  ASSERT waterElevation == (seaLevel + waterOffset) * HEIGHT_SCALE
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT createOceanMaterial_original(input.config) == createOceanMaterial_fixed(input.config)
  ASSERT identifyOceanTiles_original(input.chunkData) == identifyOceanTiles_fixed(input.chunkData)
  ASSERT underwaterTerrainProcessing_original(input) == underwaterTerrainProcessing_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-coordinate-related inputs

**Test Plan**: Observe behavior on UNFIXED code first for material creation, tile identification, and underwater coloring, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Material Creation Preservation**: Verify water materials have same color, opacity, shininess after fix
2. **Ocean Tile Identification Preservation**: Verify same tiles identified as ocean (height < seaLevel) after fix
3. **Underwater Coloring Preservation**: Verify terrain below sea level has same darkening and desaturation after fix
4. **Visibility Toggle Preservation**: Verify water visibility controls work identically after fix

### Unit Tests

- Test ocean geometry generation for chunks at various coordinates (0,0), (1,0), (-1,0), (5,5)
- Test water group positioning at origin for all chunks
- Test HEIGHT_SCALE consistency across ocean, river, and lake meshes
- Test boundary alignment between adjacent chunks
- Test river mesh generation with correct HEIGHT_SCALE reference

### Property-Based Tests

- Generate random chunk coordinates and verify ocean vertices always use world coordinates
- Generate random water configurations and verify materials unchanged by coordinate fix
- Generate random heightmaps and verify ocean tile identification unchanged
- Test that all water types (ocean, river, lake) use consistent HEIGHT_SCALE value

### Integration Tests

- Test full water system with multiple chunks at different coordinates
- Test water-terrain alignment across chunk boundaries
- Test that water appears above underwater terrain (grey areas) at all chunk positions
- Test switching between chunks and verifying water positioning remains correct
