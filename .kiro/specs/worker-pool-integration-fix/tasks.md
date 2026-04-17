# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - WorkerPool Infinite Creation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate infinite WorkerPool creation
  - **Scoped PBT Approach**: Scope the property to the concrete failing case - enabling workerPoolConfig and calling updateEngineConfig() multiple times
  - Test that enabling workerPoolConfig and calling updateEngineConfig() multiple times results in exactly one WorkerPool instance (from Bug Condition in design)
  - Test that shutdown() is called on old WorkerPool before creating new ChunkManager
  - Test that old workers are terminated when new WorkerPool is created
  - The test assertions should match the Expected Behavior Properties from design (exactly one WorkerPool, shutdown called, workers terminated)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: multiple WorkerPool instances, shutdown never called, workers not terminated
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-WorkerPool Configuration Updates
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-workerPoolConfig updates (terrain config, biome config, LOD config, incremental config, cache size)
  - Observe that these updates work correctly without any WorkerPool shutdown logic
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that updateEngineConfig() with non-workerPoolConfig changes produces same behavior as before
  - Test that synchronous chunk generation continues to work when workerPoolConfig is null
  - Test that LOD configuration updates work correctly
  - Test that incremental generation configuration updates work correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for infinite WorkerPool creation

  - [x] 3.1 Implement the fix in DemoApp.updateEngineConfig()
    - Add WorkerPool shutdown before ChunkManager recreation
    - Access old ChunkManager: `const oldManager = this.state.chunkManager as any;`
    - Check if WorkerPool exists: `if (oldManager?.workerPool)`
    - Call shutdown: `oldManager.workerPool.shutdown();`
    - Add logging: `console.log('[DemoApp] Shutting down old worker pool');`
    - Place shutdown call BEFORE all ChunkManager recreation paths (enabling worker pool, disabling worker pool, other config changes)
    - Ensure shutdown happens in the correct location (after shouldRecreateManager check, before creating new ChunkManager)
    - _Bug_Condition: isBugCondition(input) where 'workerPoolConfig' IN input.config AND oldChunkManager.workerPool exists AND shutdown() is NOT called_
    - _Expected_Behavior: expectedBehavior(result) - exactly one WorkerPool instance exists, shutdown() is called on old instance, old workers are terminated_
    - _Preservation: Non-workerPoolConfig updates remain unchanged, synchronous generation continues to work, LOD/incremental/cache updates work correctly_
    - _Requirements: 2.1, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Single WorkerPool Instance
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify exactly one WorkerPool instance exists after multiple updateEngineConfig() calls
    - Verify shutdown() is called on old WorkerPool before creating new ChunkManager
    - Verify old workers are terminated
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-WorkerPool Configuration Updates
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Verify non-workerPoolConfig updates work exactly as before
    - Verify synchronous generation continues to work
    - Verify LOD/incremental/cache updates work correctly
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
