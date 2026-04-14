# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Chunk Boundary Biome Discontinuity
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate visible seams at chunk boundaries
  - **Scoped PBT Approach**: Scope the property to positions near chunk boundaries (within blendRadius distance from edges)
  - Test that biome values and blend weights are continuous across chunk boundaries
  - For adjacent chunks (0,0) and (1,0), verify biome data at shared boundary positions produces identical or smoothly transitioning values
  - Generate chunks with various seeds and compare boundary positions
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: specific chunk coordinates, boundary positions, and biome discontinuities observed
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Interior Tile Biome Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for interior tiles (distance > blendRadius from all chunk edges)
  - Record biome values and blend weights for interior positions in various chunks
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test that interior tiles (far from boundaries) produce identical biome values and weights
  - Test that determinism is preserved (same seed produces same biomes)
  - Test that API compatibility is maintained (same parameters, same return types)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for chunk seam biomes

  - [x] 3.1 Add getHeightAt() method to TerrainGenerator
    - Add public method `getHeightAt(worldX: number, worldY: number, seed: number): number`
    - Use same noise configuration and calculations as `generateHeightmap()` for consistency
    - Sample noise at the world position and return height value in [0, 1] range
    - Ensure deterministic: same world position and seed always returns same height
    - _Bug_Condition: isBugCondition(input) where input is near chunk boundary (within blendRadius)_
    - _Expected_Behavior: Height sampling is consistent across chunk boundaries_
    - _Preservation: Interior tile height generation unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

  - [x] 3.2 Modify BiomeSystem.getBiomeWeights() to accept height callback
    - Change signature from `getBiomeWeights(x: number, y: number, height: number)` to `getBiomeWeights(x: number, y: number, getHeight: (worldX: number, worldY: number) => number)`
    - Inside sampling loop, call `getHeight(sampleX, sampleY)` for each sampled position
    - Use the sampled height for biome classification: `this.getBiome(sampleX, sampleY, sampleHeight)`
    - Remove the height parameter since each position needs its own height
    - _Bug_Condition: isBugCondition(input) where getBiomeWeights samples across chunk boundaries_
    - _Expected_Behavior: Each sampled position uses its own height for correct biome classification_
    - _Preservation: Blend weight calculation logic unchanged, only height sampling method changed_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.7_

  - [x] 3.3 Update EnhancedBiomeSystem.getEnhancedBiome() to use height callback
    - Change signature from `getEnhancedBiome(x: number, y: number, height: number)` to `getEnhancedBiome(x: number, y: number, getHeight: (worldX: number, worldY: number) => number)`
    - Pass height callback to `getBiomeWeights()` call
    - Sample height at center position for primary biome classification: `const height = getHeight(x, y)`
    - Update transition factor calculation to use height callback if needed
    - _Bug_Condition: isBugCondition(input) where enhanced biome features sample across boundaries_
    - _Expected_Behavior: Enhanced biome features (transitions, micro-biomes) work seamlessly across boundaries_
    - _Preservation: Enhanced biome features continue to work correctly_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4, 3.7_

  - [x] 3.4 Update ChunkManager.generateBiomeData() to provide height callback
    - Create height sampling closure that handles both current chunk and neighboring chunk positions
    - For positions within current chunk bounds, sample from heightmap directly
    - For positions outside current chunk bounds, use `terrainGenerator.getHeightAt()` to generate height on-demand
    - Pass height callback to `biomeSystem.getBiomeWeights()` and `enhancedBiomeSystem.getEnhancedBiome()`
    - Ensure world coordinates are used consistently throughout
    - _Bug_Condition: isBugCondition(input) where biome data generation occurs near chunk boundaries_
    - _Expected_Behavior: Biome data generation uses correct heights for all sampled positions, including cross-chunk samples_
    - _Preservation: Biome data generation for interior tiles unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.7_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Seamless Chunk Boundaries
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (seamless boundaries)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify biome values and blend weights are continuous across chunk boundaries
    - Verify no visible seams in rendered terrain
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Interior Tile Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm interior tile biomes unchanged
    - Confirm determinism preserved (same seed = same biomes)
    - Confirm API compatibility maintained
    - Confirm enhanced biome features still work
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Code review and manual testing instructions
  - **SKIP AUTOMATIC TEST EXECUTION** - Running all tests causes Kiro to hang
  - Instead, perform quick code review to verify implementation is correct
  - Provide user with manual testing commands they can run in terminal
  - User can run specific tests as needed: `npm test -- <test-file-name>`
  - User can run visual demo to verify no seams: `npm run dev`
  - Mark complete after providing testing instructions to user
