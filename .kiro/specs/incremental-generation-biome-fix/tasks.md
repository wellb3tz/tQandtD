# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Stage Progression and Completion Tracking
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design
  - The test assertions should match the Expected Behavior Properties from design
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19_

  - [x] 1.1 Create test file `tests/bugfix/incremental-generation-biome-fix.exploration.test.ts`
    - Set up test infrastructure with IncrementalGenerator and test chunks
    - Import necessary types: GenerationStage, PartialChunkData, IncrementalConfig

  - [x] 1.2 Test: Infinite Loop in TERRAIN Stage
    - **Property 1a: Bug Condition** - TERRAIN Stage Never Advances
    - Start incremental generation for chunk (0,0) at TERRAIN stage
    - Call continueGeneration() 10 times in a loop
    - Assert that stage advances beyond TERRAIN (to BIOMES or later)
    - **EXPECTED**: Test FAILS - stage stays at TERRAIN after 10 iterations
    - Document: "TERRAIN stage stuck in infinite loop, never advances to BIOMES"
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Test: Infinite Loop in BIOMES Stage
    - **Property 1b: Bug Condition** - BIOMES Stage Never Advances
    - Manually create PartialChunkData at BIOMES stage (skip TERRAIN)
    - Call continueGeneration() 10 times in a loop
    - Assert that stage advances beyond BIOMES (to RIVERS or later)
    - **EXPECTED**: Test FAILS - stage stays at BIOMES after 10 iterations
    - Document: "BIOMES stage stuck in infinite loop, never advances to RIVERS"
    - _Requirements: 1.6, 1.7, 1.8, 1.9_

  - [x] 1.4 Test: Redundant Work Regeneration
    - **Property 1c: Bug Condition** - Work Regenerated on Every Call
    - Start generation for chunk (0,0), call continueGeneration() once
    - Capture heightmap reference or measure generation time
    - Call continueGeneration() again for same chunk
    - Assert heightmap is NOT regenerated (same reference or similar time)
    - **EXPECTED**: Test FAILS - heightmap regenerated from scratch
    - Document: "Heightmap regenerated on every continueGeneration() call"
    - _Requirements: 1.4, 1.14, 1.15, 1.16_

  - [x] 1.5 Test: Premature Rendering (Missing BiomeMap)
    - **Property 1d: Bug Condition** - BiomeMap Missing After First Call
    - Simulate DemoApp.loadChunksAround() behavior
    - Start generation, call continueGeneration() once
    - Check if partial.data.biomeMap exists
    - Assert biomeMap is defined
    - **EXPECTED**: Test FAILS - biomeMap is undefined
    - Document: "BiomeMap undefined after first continueGeneration() call, causes grey terrain"
    - _Requirements: 1.10, 1.11, 1.12, 1.13_

  - [x] 1.6 Test: Zero Completion Rate
    - **Property 1e: Bug Condition** - Chunks Never Complete
    - Start generation for 9 chunks (3x3 grid)
    - Call continueGeneration() up to 1000 times total
    - Count how many chunks reach COMPLETE stage
    - Assert completion rate > 0%
    - **EXPECTED**: Test FAILS - 0% completion rate
    - Document: "No chunks complete within 1000 iterations, system stuck in infinite loops"
    - _Requirements: 1.5, 1.9, 1.17, 1.18, 1.19_

  - [x] 1.7 Test: Time Budget Design Flaw
    - **Property 1f: Bug Condition** - Work Done Before Budget Check
    - Mock executeTerrainStage() to track when work happens vs when budget is checked
    - Start generation, call continueGeneration()
    - Assert budget is checked BEFORE or DURING work, not AFTER
    - **EXPECTED**: Test FAILS - budget checked after all work completes
    - Document: "Time budget checked after work completes, making generation non-incremental"
    - _Requirements: 1.16, 1.17, 1.18, 1.19_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Standard Generation and Complete Chunk Rendering
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.1 Create test file `tests/bugfix/incremental-generation-biome-fix.preservation.test.ts`
    - Set up test infrastructure with IncrementalGenerator and WorldViewer
    - Import necessary types and test utilities

  - [x] 2.2 Test: Standard Generation Mode Unchanged
    - **Property 2a: Preservation** - Standard Generation Produces Complete Chunks
    - Generate 10 chunks with incrementalConfig.enabled = false
    - For each chunk, assert:
      - heightmap exists and has correct dimensions
      - biomeMap exists and has correct dimensions
      - stage = COMPLETE (5)
      - rivers, resources, structures are generated
    - Run on UNFIXED code
    - **EXPECTED**: Test PASSES - standard generation works correctly
    - Document observed behavior: "Standard generation produces complete chunks with all stages"
    - _Requirements: 3.1_

  - [x] 2.3 Test: Complete Chunk Rendering Unchanged
    - **Property 2b: Preservation** - Complete Chunks Render With Biome Colors
    - Generate complete chunks (stage = COMPLETE) with standard generation
    - Render chunks with WorldViewer
    - Assert terrain has proper biome colors (not grey fallback)
    - Check that mesh vertices have color attributes from biomeMap
    - Run on UNFIXED code
    - **EXPECTED**: Test PASSES - complete chunks render correctly
    - Document observed behavior: "Complete chunks render with proper biome colors"
    - _Requirements: 3.2, 3.3_

  - [x] 2.4 Test: LOD System Unchanged
    - **Property 2c: Preservation** - LOD Works With Standard Generation
    - Generate chunks with LOD enabled (standard generation)
    - Apply LOD tints to chunks at different distances
    - Assert LOD tints are applied correctly
    - Assert chunk rendering quality matches distance
    - Run on UNFIXED code
    - **EXPECTED**: Test PASSES - LOD system works correctly
    - Document observed behavior: "LOD system applies tints correctly with standard generation"
    - _Requirements: 3.5_

  - [x] 2.5 Test: Serialization Unchanged
    - **Property 2d: Preservation** - Chunk Serialization Works
    - Generate complete chunks with standard generation
    - Serialize chunks to binary format
    - Deserialize chunks back
    - Assert deserialized data matches original
    - Run on UNFIXED code
    - **EXPECTED**: Test PASSES - serialization works correctly
    - Document observed behavior: "Chunk serialization/deserialization preserves data integrity"
    - _Requirements: 3.1_

  - [x] 2.6 Test: Performance Baseline
    - **Property 2e: Preservation** - Standard Generation Performance
    - Generate 100 chunks with standard generation
    - Measure average time per chunk
    - Document baseline performance (e.g., "~0.5ms per chunk")
    - Run on UNFIXED code
    - **EXPECTED**: Test PASSES - establishes performance baseline
    - Document observed behavior: "Standard generation completes in X ms per chunk"
    - _Requirements: 3.1_

- [x] 3. Fix for incremental generation stage progression and completion tracking

  - [x] 3.1 Extend PartialChunkData interface with completion tracking
    - File: `src/world/chunk.ts`
    - Add `completedStages: Set<GenerationStage>` field to PartialChunkData interface
    - This tracks which stages have finished their work
    - _Bug_Condition: isBugCondition(input) where stages don't track completion (1.14, 1.15)_
    - _Expected_Behavior: Stages marked complete when work done (2.1, 2.2)_
    - _Preservation: Interface extension doesn't affect standard generation (3.1)_
    - _Requirements: 1.14, 1.15, 2.1, 2.2, 3.1_

  - [x] 3.2 Initialize completedStages Set in IncrementalGenerator.startGeneration()
    - File: `src/world/incremental-generator.ts`
    - When creating new PartialChunkData, initialize `completedStages: new Set<GenerationStage>()`
    - Ensures tracking starts from beginning of generation
    - _Bug_Condition: No completion tracking initialized (1.14)_
    - _Expected_Behavior: Completion tracking available from start (2.1)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.14, 2.1, 3.1_

  - [x] 3.3 Add completion check at start of continueGeneration()
    - File: `src/world/incremental-generator.ts`
    - Before calling executeStage(), check if `partial.completedStages.has(partial.stage)`
    - If already complete, advance to next stage immediately without executing
    - This prevents redundant work on subsequent calls
    - _Bug_Condition: Work regenerated on every call (1.4, 1.15, 1.16)_
    - _Expected_Behavior: Skip work for completed stages (2.2, 2.11, 2.12)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.4, 1.15, 1.16, 2.2, 2.11, 2.12, 3.1_

  - [x] 3.4 Redesign executeTerrainStage() to separate work from budget check
    - File: `src/world/incremental-generator.ts`
    - Generate heightmap (work)
    - Add GenerationStage.TERRAIN to partial.completedStages
    - Advance partial.stage to BIOMES
    - Check time budget
    - Return true if within budget (continue to next stage), false if exceeded (yield)
    - Change return semantics: true = "continue", false = "yield", NOT "complete/incomplete"
    - _Bug_Condition: Work done then budget checked, stage doesn't advance (1.1, 1.2, 1.3, 1.4, 1.5, 1.17, 1.18)_
    - _Expected_Behavior: Stage advances after work, regardless of budget (2.3, 2.4, 2.6, 2.13, 2.14, 2.15)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.17, 1.18, 2.3, 2.4, 2.6, 2.13, 2.14, 2.15, 3.1_

  - [x] 3.5 Redesign executeBiomesStage() to separate work from budget check
    - File: `src/world/incremental-generator.ts`
    - Generate biomes (work)
    - Add GenerationStage.BIOMES to partial.completedStages
    - Advance partial.stage to RIVERS
    - Check time budget
    - Return true if within budget (continue), false if exceeded (yield)
    - Same return semantics as executeTerrainStage()
    - _Bug_Condition: Work done then budget checked, stage doesn't advance (1.6, 1.7, 1.8, 1.9, 1.17, 1.18)_
    - _Expected_Behavior: Stage advances after work, regardless of budget (2.3, 2.5, 2.6, 2.13, 2.14, 2.15)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.17, 1.18, 2.3, 2.5, 2.6, 2.13, 2.14, 2.15, 3.1_

  - [x] 3.6 Apply same pattern to executeRiversStage(), executeResourcesStage(), executeStructuresStage()
    - File: `src/world/incremental-generator.ts`
    - For each stage: do work, mark complete, advance stage, check budget, return true/false
    - Ensures consistent behavior across all stages
    - _Bug_Condition: Same design flaw affects all stages (1.17, 1.18, 1.19)_
    - _Expected_Behavior: All stages advance properly (2.3, 2.6, 2.13, 2.14, 2.15)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.17, 1.18, 1.19, 2.3, 2.6, 2.13, 2.14, 2.15, 3.1_

  - [x] 3.7 Update continueGeneration() loop to handle new return semantics
    - File: `src/world/incremental-generator.ts`
    - Interpret executeStage() return value: true = continue to next stage, false = yield control
    - Continue loop while return is true AND time budget allows
    - Exit loop when return is false (yield) or all stages complete
    - _Bug_Condition: Current logic treats false as "incomplete" (1.3, 1.8)_
    - _Expected_Behavior: False means "yield", not "incomplete" (2.7, 2.14, 2.15)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.3, 1.8, 2.7, 2.14, 2.15, 3.1_

  - [x] 3.8 Fix DemoApp.loadChunksAround() to continue through BIOMES before first render
    - File: `demo/src/core/DemoApp.ts`
    - After starting incremental generation, call continueGeneration() in a loop
    - Continue until partial.stage >= GenerationStage.BIOMES (at least TERRAIN and BIOMES complete)
    - Verify partial.data.biomeMap exists before emitting CHUNK_LOADED
    - If biomeMap missing, continue calling continueGeneration()
    - Only emit CHUNK_LOADED after both heightmap and biomeMap exist
    - _Bug_Condition: Single call, emits before biomes exist (1.10, 1.11, 1.12, 1.13)_
    - _Expected_Behavior: Multiple calls, emit after biomes exist (2.8, 2.9, 2.10)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.10, 1.11, 1.12, 1.13, 2.8, 2.9, 2.10, 3.1_

  - [x] 3.9 Update DemoApp progress tracking after each continueGeneration() call
    - File: `demo/src/core/DemoApp.ts`
    - Update chunksInProgress map with current stage after each call
    - Track progress accurately through all stages
    - Remove from progress map only when stage = COMPLETE
    - _Bug_Condition: Progress tracking doesn't reflect actual stage (1.11)_
    - _Expected_Behavior: Progress tracking accurate (2.8)_
    - _Preservation: Only affects incremental mode (3.1)_
    - _Requirements: 1.11, 2.8, 3.1_

  - [x] 3.10 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Stage Progression and Completion Tracking
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run all exploration tests from task 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - Verify:
      - TERRAIN stage advances to BIOMES (test 1.2 passes)
      - BIOMES stage advances to RIVERS (test 1.3 passes)
      - Heightmap not regenerated (test 1.4 passes)
      - BiomeMap exists after proper calls (test 1.5 passes)
      - Chunks complete within reasonable iterations (test 1.6 passes)
      - Budget checked appropriately (test 1.7 passes)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15_

  - [x] 3.11 Verify preservation tests still pass
    - **Property 2: Preservation** - Standard Generation and Complete Chunk Rendering
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run all preservation tests from task 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Verify:
      - Standard generation unchanged (test 2.2 passes)
      - Complete chunk rendering unchanged (test 2.3 passes)
      - LOD system unchanged (test 2.4 passes)
      - Serialization unchanged (test 2.5 passes)
      - Performance within acceptable range (test 2.6 passes)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Add integration tests for full workflow validation

  - [x] 4.1 Create integration test file `tests/integration/incremental-generation-biome-fix.integration.test.ts`
    - Set up full DemoApp environment with WorldViewer
    - Import necessary components and utilities

  - [x] 4.2 Test: Full DemoApp workflow with incremental generation
    - Initialize DemoApp with incremental generation enabled
    - Load 3x3 chunk grid around origin
    - Verify all chunks complete generation (stage = COMPLETE)
    - Verify all chunks render with proper biome colors (no grey terrain)
    - Measure completion time and FPS during loading
    - Assert completion time < 10 seconds for 9 chunks
    - Assert FPS improves during loading (min FPS > 10)
    - _Requirements: 2.1, 2.2, 2.3, 2.8, 2.9, 2.10_

  - [x] 4.3 Test: Switching between standard and incremental modes
    - Generate chunks with standard mode
    - Switch to incremental mode
    - Generate new chunks with incremental mode
    - Verify both sets of chunks render identically
    - Assert no visual differences between modes
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.4 Test: Unloading and reloading chunks with incremental generation
    - Load chunks with incremental generation
    - Unload chunks (move camera away)
    - Reload same chunks (move camera back)
    - Verify chunks reload correctly with proper colors
    - Assert no grey terrain on reload
    - _Requirements: 2.8, 2.9, 2.10, 3.6_

  - [x] 4.5 Test: LOD system with incremental generation
    - Enable LOD system
    - Load chunks with incremental generation at various distances
    - Verify LOD tints applied correctly
    - Verify chunk quality matches distance
    - Assert incremental generation doesn't break LOD
    - _Requirements: 3.5_

  - [x] 4.6 Test: Performance improvement over standard generation
    - Measure FPS during chunk loading with standard generation (baseline)
    - Measure FPS during chunk loading with incremental generation (fixed)
    - Assert incremental FPS > standard FPS (or at least not significantly worse)
    - Assert min FPS with incremental > 10 (no severe stuttering)
    - Document performance metrics
    - _Requirements: 2.1, 2.2, 2.3, 2.14, 2.15_

  - [x] 4.7 Test: Visual quality - no grey terrain artifacts
    - Load chunks with incremental generation
    - Capture screenshots or analyze mesh colors during loading
    - Assert no grey fallback colors (r: 0.5, g: 0.5, b: 0.5) in rendered terrain
    - Assert all terrain has proper biome colors from biomeMap
    - _Requirements: 2.8, 2.9, 2.10_

- [x] 5. Checkpoint - Ensure all tests pass
  - Run all exploration tests (task 1) - should now PASS
  - Run all preservation tests (task 2) - should still PASS
  - Run all integration tests (task 4) - should PASS
  - Verify no regressions in existing test suites
  - Measure and document performance improvements
  - Ask the user if questions arise or if additional testing is needed
