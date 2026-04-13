# Seamless Chunk Boundaries Bugfix Design

## Overview

This design addresses the visible gaps (white lines) between adjacent chunks in the 3D procedural world generation engine. The bug occurs because chunks are generated independently with separate geometry, causing vertices at chunk boundaries to have slightly different positions and heights. The fix ensures that boundary vertices share identical world coordinates and heights by using a unified coordinate system and deterministic height calculations.

The approach maintains backward compatibility with existing terrain generation while ensuring visual continuity across chunk boundaries. The fix focuses on coordinate system alignment and deterministic noise sampling rather than geometry restructuring.

## Glossary

- **Bug_Condition (C)**: The condition that triggers visible gaps - when two adjacent chunks are rendered and their boundary vertices have different positions/heights
- **Property (P)**: The desired behavior - boundary vertices must have identical world coordinates and heights, producing seamless visual transitions
- **Preservation**: Existing terrain generation, caching, biome/resource/structure placement, deterministic generation, and memory management that must remain unchanged
- **ChunkManager**: The class in `src/world/chunk-manager.ts` that orchestrates chunk generation and caching
- **TerrainGenerator**: The class in `src/gen/terrain.ts` that generates heightmaps using noise functions
- **Boundary Vertex**: A vertex located at the edge of a chunk (x=0, x=chunkSize-1, y=0, or y=chunkSize-1 in local coordinates)
- **World Coordinates**: Global coordinate system where position = chunkCoord * chunkSize + localCoord
- **Deterministic Noise**: Noise function that returns identical values for identical input coordinates regardless of when/how it's called

## Bug Details

### Bug Condition

The bug manifests when two adjacent chunks are generated and rendered in the 3D scene. The `generateChunk` method in ChunkManager creates independent heightmaps for each chunk, and the rendering system (in demo/main.js) creates separate BufferGeometry meshes. Although the demo uses manual BufferGeometry creation with corner positioning (not centered PlaneGeometry), boundary vertices still don't share identical world coordinates because chunks have exactly `chunkSize` vertices (0 to chunkSize-1), creating a 1-unit gap between adjacent chunks.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { chunk1: ChunkData, chunk2: ChunkData, adjacency: 'horizontal' | 'vertical' }
  OUTPUT: boolean
  
  RETURN areAdjacent(input.chunk1, input.chunk2, input.adjacency)
         AND boundaryVerticesExist(input.chunk1, input.chunk2, input.adjacency)
         AND NOT boundaryVerticesMatch(input.chunk1, input.chunk2, input.adjacency)
END FUNCTION

FUNCTION boundaryVerticesMatch(chunk1, chunk2, adjacency)
  // For horizontal adjacency (chunk2 is to the right of chunk1)
  IF adjacency == 'horizontal' THEN
    rightEdge = getRightEdgeVertices(chunk1)  // x = chunkSize - 1
    leftEdge = getLeftEdgeVertices(chunk2)    // x = 0
    
    // Check if world coordinates match
    FOR each vertex pair (v1, v2) in (rightEdge, leftEdge) DO
      worldX1 = chunk1.x * chunk1.size + (chunk1.size - 1)
      worldX2 = chunk2.x * chunk2.size + 0
      
      IF worldX1 + 1 != worldX2 THEN RETURN false  // Gap exists
      IF abs(v1.height - v2.height) > EPSILON THEN RETURN false
    END FOR
  END IF
  
  // Similar logic for vertical adjacency
  RETURN true
END FUNCTION
```

### Examples

- **Horizontal Gap**: Chunk (0,0) has right edge at world x=31, Chunk (1,0) has left edge at world x=32. Gap of 1 unit exists between x=31 and x=32, causing visible white line.
- **Vertical Gap**: Chunk (0,0) has bottom edge at world y=31, Chunk (0,1) has top edge at world y=32. Gap of 1 unit exists between y=31 and y=32, causing visible white line.
- **Corner Gap**: At the meeting point of four chunks (0,0), (1,0), (0,1), (1,1), the corner vertices are at positions (31,31), (32,31), (31,32), (32,32) - none share the same world coordinates.
- **Edge Case - Single Chunk**: When only one chunk is rendered, no gaps appear because there are no boundaries with adjacent chunks.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Terrain generation for non-boundary vertices must continue to produce identical heightmaps
- Chunk caching system must continue to work with the same LRU eviction policy
- Biome, resource, structure, and river generation must continue to function correctly
- Deterministic generation with seed must continue to produce reproducible results
- Memory management (chunk disposal) must continue to work correctly
- Performance characteristics must remain similar (no significant slowdown)

**Scope:**
All inputs that do NOT involve chunk boundary vertices should be completely unaffected by this fix. This includes:
- Interior vertices (not on chunk edges)
- Single-chunk rendering scenarios
- Chunk generation without adjacent chunks loaded
- All non-terrain generation systems (biomes, resources, structures, rivers)
- Serialization and deserialization of chunks
- LOD system behavior
- Incremental generation behavior

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Non-Overlapping Vertex Grids**: Chunks generate exactly `chunkSize x chunkSize` vertices (e.g., 32x32), with local coordinates from 0 to chunkSize-1. This creates a 1-unit gap between adjacent chunks:
   - Chunk (0,0) right edge: world x = 0 * 32 + 31 = 31
   - Chunk (1,0) left edge: world x = 1 * 32 + 0 = 32
   - Gap: 32 - 31 = 1 unit

2. **Missing Vertex Overlap Strategy**: The standard approach for seamless chunks is to generate `chunkSize + 1` vertices (33x33) so that the last vertex of one chunk overlaps with the first vertex of the next chunk. The current implementation doesn't use this strategy.

3. **Independent Heightmap Generation**: Each chunk's heightmap is generated independently in `TerrainGenerator.generateHeightmap()` without considering that boundary vertices should be shared with adjacent chunks.

4. **Rendering Geometry Mismatch**: While the demo uses BufferGeometry with corner positioning (which is correct), the underlying vertex data doesn't account for the need to share boundary vertices between chunks.

## Correctness Properties

Property 1: Bug Condition - Seamless Boundary Vertices

_For any_ pair of adjacent chunks where the bug condition holds (boundary vertices don't match), the fixed terrain generation SHALL ensure that boundary vertices have identical world coordinates and heights, eliminating visible gaps between chunks.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Interior Vertex Generation

_For any_ vertex that is NOT on a chunk boundary (interior vertices), the fixed terrain generation SHALL produce exactly the same height values as the original implementation, preserving all existing terrain characteristics for non-boundary regions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, we need to implement vertex overlap at chunk boundaries:

**File**: `src/gen/terrain.ts`

**Function**: `generateHeightmap`

**Specific Changes**:

1. **Extend Vertex Grid to Include Overlap**: Modify `generateHeightmap` to generate `(chunkSize + 1) x (chunkSize + 1)` vertices instead of `chunkSize x chunkSize`:
   - Change heightmap array size from `chunkSize * chunkSize` to `(chunkSize + 1) * (chunkSize + 1)`
   - Update loop bounds to iterate from 0 to chunkSize (inclusive) instead of 0 to chunkSize-1
   - This ensures the last vertex of one chunk overlaps with the first vertex of the adjacent chunk

2. **Adjust World Coordinate Calculation**: Ensure that boundary vertices use consistent world coordinates:
   - For chunk (chunkX, chunkY), vertex at local (x, y) maps to world (chunkX * chunkSize + x, chunkY * chunkSize + y)
   - The vertex at local (chunkSize, y) in chunk (0, 0) will have world x = 32
   - The vertex at local (0, y) in chunk (1, 0) will also have world x = 32
   - Both vertices sample the noise function at the same world coordinate, ensuring identical heights

3. **Update Height Sampling**: The `getHeightInternal` method already uses world coordinates for noise sampling, so no changes needed there - it will automatically return identical heights for identical world coordinates due to deterministic noise.

4. **Maintain Backward Compatibility**: Add a configuration flag `seamlessChunks` to TerrainConfig (default: true) to allow disabling this behavior if needed for testing or backward compatibility.

**File**: `src/world/chunk.ts`

**Interface**: `ChunkData`

**Specific Changes**:

5. **Update ChunkData Interface Documentation**: Add documentation clarifying that heightmap size is `(size + 1) * (size + 1)` when seamless chunks are enabled, not `size * size`.

6. **Add Helper Functions**: Add utility functions for accessing boundary vertices:
   - `getBoundaryVertex(chunk, edge, index)` - get vertex at specific boundary position
   - `getWorldCoordinate(chunk, localX, localY)` - convert local to world coordinates

**File**: `demo/main.js` (if needed)

**Function**: `createChunkMesh`

**Specific Changes**:

7. **Update Geometry Creation**: Adjust the BufferGeometry creation to handle `(chunkSize + 1) x (chunkSize + 1)` vertices:
   - Update vertex loop bounds to match new heightmap size
   - Update triangle index calculation to account for new vertex count
   - Ensure mesh positioning remains at chunk corner (no changes needed here)

8. **Verify Triangle Count**: With `(chunkSize + 1)` vertices per side, we still create `chunkSize x chunkSize` quads (2 triangles each), so triangle count remains the same.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by measuring gaps between adjacent chunks, then verify the fix eliminates gaps and preserves existing terrain generation behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis by measuring actual gaps between chunk boundaries. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that generate pairs of adjacent chunks, extract their boundary vertices, and measure the distance between corresponding boundary positions. Run these tests on the UNFIXED code to observe gaps and confirm the root cause.

**Test Cases**:
1. **Horizontal Boundary Gap Test**: Generate chunks (0,0) and (1,0), measure distance between right edge of (0,0) and left edge of (1,0) (will fail on unfixed code - expect 1-unit gap)
2. **Vertical Boundary Gap Test**: Generate chunks (0,0) and (0,1), measure distance between bottom edge of (0,0) and top edge of (0,1) (will fail on unfixed code - expect 1-unit gap)
3. **Corner Gap Test**: Generate four chunks (0,0), (1,0), (0,1), (1,1), measure distances at the central corner point (will fail on unfixed code - expect gaps)
4. **Height Mismatch Test**: For adjacent chunks, compare heights at boundary positions and measure differences (may show small differences due to coordinate mismatch)

**Expected Counterexamples**:
- Boundary vertices have world coordinates that differ by 1 unit (e.g., x=31 vs x=32)
- Visual gaps appear as white lines in rendered output
- Possible causes: non-overlapping vertex grids, missing vertex overlap strategy, independent heightmap generation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior - seamless boundaries with no gaps.

**Pseudocode:**
```
FOR ALL chunk_pair WHERE areAdjacent(chunk_pair.chunk1, chunk_pair.chunk2) DO
  chunk1_fixed := generateChunk_fixed(chunk_pair.chunk1.x, chunk_pair.chunk1.y)
  chunk2_fixed := generateChunk_fixed(chunk_pair.chunk2.x, chunk_pair.chunk2.y)
  
  boundaryVertices1 := getBoundaryVertices(chunk1_fixed, adjacency_direction)
  boundaryVertices2 := getBoundaryVertices(chunk2_fixed, adjacency_direction)
  
  ASSERT boundaryVerticesMatch(boundaryVertices1, boundaryVertices2)
  ASSERT noVisibleGaps(chunk1_fixed, chunk2_fixed)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function - interior vertices remain unchanged.

**Pseudocode:**
```
FOR ALL chunk WHERE isValidChunk(chunk) DO
  chunk_original := generateChunk_original(chunk.x, chunk.y)
  chunk_fixed := generateChunk_fixed(chunk.x, chunk.y)
  
  FOR ALL vertex WHERE isInteriorVertex(vertex, chunk.size) DO
    ASSERT chunk_original.heightmap[vertex.index] == chunk_fixed.heightmap[vertex.index]
  END FOR
  
  ASSERT chunk_original.biomeMap == chunk_fixed.biomeMap
  ASSERT chunk_original.resources == chunk_fixed.resources
  ASSERT chunk_original.structures == chunk_fixed.structures
  ASSERT chunk_original.rivers == chunk_fixed.rivers
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (different chunk coordinates, seeds, configurations)
- It catches edge cases that manual unit tests might miss (corner chunks, negative coordinates, large coordinates)
- It provides strong guarantees that behavior is unchanged for all non-boundary vertices

**Test Plan**: Observe behavior on UNFIXED code first for interior vertices and non-terrain systems, then write property-based tests capturing that behavior to ensure it's preserved after the fix.

**Test Cases**:
1. **Interior Vertex Preservation**: Generate random chunks, verify that interior vertices (not on edges) have identical heights before and after fix
2. **Biome Generation Preservation**: Generate random chunks, verify that biome maps are identical before and after fix
3. **Resource Generation Preservation**: Generate random chunks, verify that resource positions and amounts are identical before and after fix
4. **Structure Generation Preservation**: Generate random chunks, verify that structure positions and types are identical before and after fix
5. **Deterministic Generation Preservation**: Generate same chunk with same seed multiple times, verify results are identical before and after fix
6. **Cache Behavior Preservation**: Verify that cache hit/miss behavior and LRU eviction work identically before and after fix

### Unit Tests

- Test heightmap generation with new vertex count (chunkSize + 1)²
- Test boundary vertex extraction for all four edges (top, bottom, left, right)
- Test world coordinate calculation for boundary vertices
- Test that adjacent chunks share identical boundary vertex coordinates
- Test that adjacent chunks have identical heights at boundary positions
- Test edge cases: chunk (0,0), negative chunk coordinates, large chunk coordinates

### Property-Based Tests

- Generate random pairs of adjacent chunks and verify boundary vertices match
- Generate random chunks and verify interior vertices are unchanged from original implementation
- Generate random seeds and verify deterministic generation still works
- Generate random chunk configurations and verify no visual gaps appear
- Test across many chunk sizes and terrain configurations

### Integration Tests

- Test full chunk generation pipeline with multiple adjacent chunks
- Test rendering of 3x3 grid of chunks and verify no visible gaps
- Test chunk loading/unloading with seamless boundaries maintained
- Test LOD transitions with seamless boundaries
- Test incremental generation with seamless boundaries
- Test serialization/deserialization preserves seamless boundaries
