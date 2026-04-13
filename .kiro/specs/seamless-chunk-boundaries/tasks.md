# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Visible Gaps Between Adjacent Chunks
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that adjacent chunks have non-overlapping vertex grids (chunks generate 32x32 vertices, creating 1-unit gaps)
  - Generate pairs of adjacent chunks (horizontal and vertical adjacency)
  - Measure distance between boundary vertices (right edge of chunk1 vs left edge of chunk2)
  - Assert that boundary vertices have identical world coordinates (will fail - expect 1-unit gap)
  - Assert that boundary vertices have identical heights (may fail due to coordinate mismatch)
  - Test cases: horizontal adjacency (chunks (0,0) and (1,0)), vertical adjacency (chunks (0,0) and (0,1)), corner meeting point (four chunks)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "chunk (0,0) right edge at x=31, chunk (1,0) left edge at x=32, gap=1 unit")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Interior Vertex and Non-Terrain Generation Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (interior vertices, biomes, resources, structures, rivers)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test that interior vertices (not on chunk edges) have identical heights before and after fix
  - Test that biome maps are identical before and after fix
  - Test that resource positions and amounts are identical before and after fix
  - Test that structure positions and types are identical before and after fix
  - Test that river generation is identical before and after fix
  - Test that deterministic generation with same seed produces identical results
  - Test that cache behavior (hit/miss, LRU eviction) works identically
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for seamless chunk boundaries

  - [x] 3.1 Extend vertex grid to include boundary overlap
    - Modify `TerrainGenerator.generateHeightmap()` in `src/gen/terrain.ts`
    - Change heightmap array size from `chunkSize * chunkSize` to `(chunkSize + 1) * (chunkSize + 1)`
    - Update loop bounds to iterate from 0 to chunkSize (inclusive) instead of 0 to chunkSize-1
    - This ensures the last vertex of one chunk overlaps with the first vertex of the adjacent chunk
    - For chunk (chunkX, chunkY), vertex at local (x, y) maps to world (chunkX * chunkSize + x, chunkY * chunkSize + y)
    - The vertex at local (chunkSize, y) in chunk (0, 0) will have world x = 32
    - The vertex at local (0, y) in chunk (1, 0) will also have world x = 32
    - Both vertices sample the noise function at the same world coordinate, ensuring identical heights
    - _Bug_Condition: isBugCondition(input) where areAdjacent(chunk1, chunk2) AND NOT boundaryVerticesMatch(chunk1, chunk2)_
    - _Expected_Behavior: boundaryVerticesMatch(chunk1, chunk2) for all adjacent chunks - boundary vertices have identical world coordinates and heights_
    - _Preservation: Interior vertices (not on edges) must have identical heights as before; biome, resource, structure, river generation unchanged; cache behavior unchanged; deterministic generation unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Update ChunkData interface documentation
    - Update `ChunkData` interface in `src/world/chunk.ts`
    - Add documentation clarifying that heightmap size is `(size + 1) * (size + 1)` when seamless chunks are enabled
    - Add helper functions for accessing boundary vertices: `getBoundaryVertex(chunk, edge, index)`, `getWorldCoordinate(chunk, localX, localY)`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Update rendering geometry to handle new vertex count
    - Modify `createChunkMesh()` in `demo/main.js`
    - Update vertex loop bounds to iterate from 0 to chunkSize (inclusive) to match new heightmap size `(chunkSize + 1) x (chunkSize + 1)`
    - Update triangle index calculation to account for new vertex count
    - Ensure mesh positioning remains at chunk corner (no changes needed)
    - Verify triangle count: with `(chunkSize + 1)` vertices per side, we still create `chunkSize x chunkSize` quads (2 triangles each)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Seamless Boundaries with No Gaps
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify that boundary vertices have identical world coordinates (no 1-unit gap)
    - Verify that boundary vertices have identical heights
    - Verify that no visible gaps appear in rendered output
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Interior Vertex and Non-Terrain Generation Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Verify interior vertices have identical heights as before
    - Verify biome, resource, structure, river generation unchanged
    - Verify cache behavior unchanged
    - Verify deterministic generation unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify no visual gaps between chunks in demo
  - Verify performance characteristics remain similar
  - Verify all existing functionality (biomes, resources, structures, rivers, caching, LOD, incremental generation) works correctly
