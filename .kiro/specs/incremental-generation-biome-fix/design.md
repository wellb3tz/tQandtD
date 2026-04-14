# Incremental Generation Biome Fix Design

## Overview

This design addresses four critical bugs in the incremental generation system that prevent proper chunk generation and rendering. The current implementation has a fundamental flaw: stages perform all work first, then check the time budget. When the budget is exceeded, they return false (incomplete), but the work is already done. The next call regenerates everything again, creating infinite loops where stages never advance.

The fix separates stage completion from time budget checking, adds proper stage completion tracking, ensures DemoApp continues generation through BIOMES before first render, and redesigns the stage execution logic to be truly incremental. This will enable the system to actually improve FPS during chunk loading as intended.

**Current State**: 0% completion rate, 135x slower than standard generation, severe stuttering (min FPS drops from 13.89 to 1.12).

**Target State**: Stages advance properly, chunks complete generation, FPS improves during loading, no grey terrain artifacts.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bugs - when incremental generation is enabled and continueGeneration() is called
- **Property (P)**: The desired behavior - stages should advance after completing work, regardless of time budget
- **Preservation**: Standard generation mode and complete chunk rendering that must remain unchanged
- **IncrementalGenerator**: The class in `src/world/incremental-generator.ts` that manages staged chunk generation
- **GenerationStage**: Enum representing stages: TERRAIN (0), BIOMES (1), RIVERS (2), RESOURCES (3), STRUCTURES (4), COMPLETE (5)
- **PartialChunkData**: Object tracking generation progress with current stage and partial chunk data
- **timeBudgetMs**: Time limit per continueGeneration() call (default 16ms for 60 FPS)
- **DemoApp.loadChunksAround()**: Function in `demo/src/core/DemoApp.ts` that initiates chunk loading
- **continueGeneration()**: Function that advances generation by one step, respecting time budget

## Bug Details

### Bug Condition

The bugs manifest when incremental generation is enabled and `continueGeneration()` is called. The system has four interconnected issues:

1. **Infinite Loop**: TERRAIN and BIOMES stages do all work, check time budget, return false if exceeded, causing regeneration on next call
2. **No Completion Tracking**: No flags track whether stage work is done, causing redundant work
3. **Premature Rendering**: DemoApp calls continueGeneration() once, emits CHUNK_LOADED before biomes exist (grey terrain)
4. **Design Flaw**: Time budget checked after work completes, making generation batch-per-stage instead of incremental

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { incrementalEnabled: boolean, stage: GenerationStage, timeBudgetMs: number }
  OUTPUT: boolean
  
  RETURN input.incrementalEnabled == true
         AND input.stage IN [TERRAIN, BIOMES]
         AND stageWorkTime > input.timeBudgetMs
         AND NOT stageCompletionTracked
         AND stageReturns(false) // "incomplete"
         AND nextCallRegeneratesWork
END FUNCTION
```

### Examples

**Bug 1: Infinite Loop in TERRAIN Stage**
- Input: continueGeneration() called for chunk (0,0) at TERRAIN stage
- Current behavior: Generates entire heightmap (takes 20ms), checks budget (16ms), returns false, next call regenerates heightmap again
- Expected behavior: Generates heightmap, marks TERRAIN complete, advances to BIOMES, returns false to yield

**Bug 2: Infinite Loop in BIOMES Stage**
- Input: continueGeneration() called for chunk (0,0) at BIOMES stage (if it ever reaches it)
- Current behavior: Generates all biomes (takes 25ms), checks budget (16ms), returns false, next call regenerates biomes again
- Expected behavior: Generates biomes, marks BIOMES complete, advances to RIVERS, returns false to yield

**Bug 3: Premature Rendering**
- Input: DemoApp.loadChunksAround() processes chunk (1,1) with incremental enabled
- Current behavior: Calls continueGeneration() once (TERRAIN completes), emits CHUNK_LOADED with heightmap but no biomeMap, renders grey terrain
- Expected behavior: Calls continueGeneration() twice (TERRAIN then BIOMES), emits CHUNK_LOADED with both heightmap and biomeMap, renders colored terrain

**Bug 4: Missing Completion Tracking**
- Input: continueGeneration() called twice for same chunk at TERRAIN stage
- Current behavior: First call generates heightmap, second call regenerates heightmap from scratch
- Expected behavior: First call generates heightmap and sets completion flag, second call sees flag and advances to BIOMES immediately

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Standard generation mode (incrementalConfig.enabled = false) must continue to generate complete chunks with all stages in a single operation
- Complete chunks (stage = COMPLETE) must continue to render with full biome colors and all features
- WorldViewer rendering of complete chunks must remain unchanged
- LOD system must continue to work correctly with incremental generation
- Chunk caching and unloading must remain unchanged

**Scope:**
All inputs that do NOT involve incremental generation (incrementalConfig.enabled = false) should be completely unaffected by this fix. This includes:
- Standard chunk generation via getChunk()
- Complete chunk rendering
- LOD application
- Chunk serialization and deserialization
- River, resource, and structure generation in standard mode

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Incorrect Stage Completion Logic**: The `executeTerrainStage()` and `executeBiomesStage()` functions perform all work first, then return `elapsed < timeBudgetMs`. When this returns false, the stage doesn't advance, but the work is already done. The next call has no way to know the work is complete, so it regenerates everything.

2. **Missing Completion Flags**: The `PartialChunkData` object has no flags to track whether individual stages have completed their work. The only state is the current `stage` enum value, which doesn't advance when time budget is exceeded.

3. **DemoApp Single Call**: The `loadChunksAround()` function calls `continueGeneration()` only once after starting incremental generation. This completes TERRAIN (if within budget) but doesn't continue to BIOMES, causing grey terrain rendering.

4. **Fundamental Design Flaw**: The current design treats each stage as an atomic operation that must complete within the time budget. This is impossible for stages that inherently take longer than 16ms. The design should allow stages to complete their work and advance, while using the time budget to decide whether to continue to the next stage in the same call.

## Correctness Properties

Property 1: Bug Condition - Stage Progression After Work Completion

_For any_ chunk generation where a stage completes its work (heightmap generated for TERRAIN, biomes generated for BIOMES), the fixed IncrementalGenerator SHALL advance to the next stage and mark the current stage as complete, regardless of whether the time budget was exceeded.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Bug Condition - No Redundant Work

_For any_ chunk generation where continueGeneration() is called for a stage that has already completed its work, the fixed IncrementalGenerator SHALL immediately advance to the next stage without re-executing the stage's work.

**Validates: Requirements 2.2, 2.11, 2.12**

Property 3: Bug Condition - Proper Initial Rendering

_For any_ chunk loading in DemoApp where incremental generation is enabled, the fixed loadChunksAround() SHALL call continueGeneration() at least twice (once for TERRAIN, once for BIOMES) before emitting the first CHUNK_LOADED event, ensuring both heightmap and biomeMap exist for proper rendering.

**Validates: Requirements 2.8, 2.9, 2.10**

Property 4: Preservation - Standard Generation Unchanged

_For any_ chunk generation where incremental generation is disabled (incrementalConfig.enabled = false), the fixed system SHALL produce exactly the same result as the original system, generating complete chunks with all stages in a single operation.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `src/world/incremental-generator.ts`

**Changes**:

1. **Add Stage Completion Tracking**: Extend `PartialChunkData` interface to include completion flags for each stage
   - Add `completedStages: Set<GenerationStage>` to track which stages have finished their work
   - Initialize empty Set when starting generation

2. **Separate Completion from Time Budget**: Modify `executeStage()` to always mark stage complete when work is done
   - Change return value semantics: true = "continue to next stage", false = "yield control"
   - Always advance stage when work completes, regardless of time budget
   - Return false if time budget exceeded (to yield), but stage still advances

3. **Check Completion Before Executing**: Modify `continueGeneration()` to check if current stage is already complete
   - Before calling `executeStage()`, check if `partial.completedStages.has(partial.stage)`
   - If already complete, advance to next stage immediately without executing
   - This prevents redundant work on subsequent calls

4. **Fix executeTerrainStage()**: Change logic to separate work from budget check
   - Generate heightmap (work)
   - Add TERRAIN to completedStages
   - Check time budget
   - Return true if within budget (continue), false if exceeded (yield)

5. **Fix executeBiomesStage()**: Change logic to separate work from budget check
   - Generate biomes (work)
   - Add BIOMES to completedStages
   - Check time budget
   - Return true if within budget (continue), false if exceeded (yield)

6. **Apply Same Pattern to Other Stages**: Update RIVERS, RESOURCES, STRUCTURES stages with same pattern
   - Do work
   - Mark complete
   - Check budget
   - Return true/false based on budget (not completion)

**File 2**: `demo/src/core/DemoApp.ts`

**Function**: `loadChunksAround()`

**Changes**:

1. **Continue Through BIOMES Before First Emit**: After starting incremental generation, call continueGeneration() twice
   - First call: TERRAIN stage (generates heightmap)
   - Second call: BIOMES stage (generates biomes)
   - Only emit CHUNK_LOADED after both stages complete

2. **Check for Required Data**: Before emitting CHUNK_LOADED, verify both heightmap and biomeMap exist
   - If biomeMap is missing, continue calling continueGeneration() until it exists
   - This ensures proper rendering even if TERRAIN stage exceeds budget

3. **Update Progress Tracking**: Update chunksInProgress map after each continueGeneration() call
   - Track current stage accurately
   - Remove from progress map only when stage = COMPLETE

**File 3**: `src/world/chunk.ts` (interface definition)

**Changes**:

1. **Extend PartialChunkData Interface**: Add completion tracking field
   ```typescript
   export interface PartialChunkData {
     x: number;
     y: number;
     stage: GenerationStage;
     completedStages: Set<GenerationStage>; // NEW: Track completed stages
     data: Partial<ChunkData>;
   }
   ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate incremental generation with time budget constraints. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:

1. **Infinite Loop Test - TERRAIN**: Start incremental generation for chunk (0,0), call continueGeneration() 10 times, assert that stage advances beyond TERRAIN (will fail on unfixed code - stage stays at TERRAIN)

2. **Infinite Loop Test - BIOMES**: Manually advance chunk to BIOMES stage, call continueGeneration() 10 times, assert that stage advances beyond BIOMES (will fail on unfixed code - stage stays at BIOMES)

3. **Redundant Work Test**: Start generation, call continueGeneration() once (TERRAIN completes), call continueGeneration() again, measure if heightmap is regenerated (will fail on unfixed code - heightmap regenerated)

4. **Premature Rendering Test**: Simulate DemoApp.loadChunksAround() behavior, call continueGeneration() once, check if biomeMap exists (will fail on unfixed code - biomeMap is undefined)

5. **Completion Rate Test**: Start generation for 9 chunks, call continueGeneration() up to 1000 times, measure completion rate (will fail on unfixed code - 0% completion)

**Expected Counterexamples**:
- Stages never advance beyond TERRAIN/BIOMES even after many iterations
- Heightmap/biomes are regenerated on every continueGeneration() call
- BiomeMap is undefined after first continueGeneration() call
- Chunks never reach COMPLETE stage within reasonable iteration count
- Possible causes: no completion tracking, time budget checked after work, stage doesn't advance when budget exceeded

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := continueGeneration_fixed(input.chunkX, input.chunkY)
  stage := getStage_fixed(input.chunkX, input.chunkY)
  
  // Stage should advance after work completes
  ASSERT stage > input.previousStage OR stage == COMPLETE
  
  // No redundant work
  IF input.stageAlreadyComplete THEN
    ASSERT workNotRegenerated
  END IF
  
  // Proper rendering data
  IF stage >= BIOMES THEN
    ASSERT biomeMapExists
  END IF
END FOR
```

**Test Cases**:

1. **Stage Progression Test**: Start generation, call continueGeneration() repeatedly, assert stage advances: TERRAIN → BIOMES → RIVERS → RESOURCES → STRUCTURES → COMPLETE

2. **No Redundant Work Test**: Start generation, complete TERRAIN, call continueGeneration() again, verify heightmap is not regenerated (check memory reference or generation time)

3. **Completion Tracking Test**: Start generation, complete TERRAIN, verify completedStages contains TERRAIN, call continueGeneration(), verify it skips TERRAIN work

4. **Time Budget Yield Test**: Start generation with 1ms budget (very tight), verify stages still advance even when budget exceeded

5. **Full Completion Test**: Start generation for 9 chunks, call continueGeneration() repeatedly, verify all chunks reach COMPLETE within reasonable iterations (< 100)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // Standard generation mode
  IF input.incrementalEnabled == false THEN
    ASSERT getChunk_original(input.chunkX, input.chunkY) == getChunk_fixed(input.chunkX, input.chunkY)
  END IF
  
  // Complete chunk rendering
  IF input.stage == COMPLETE THEN
    ASSERT renderChunk_original(input.chunk) == renderChunk_fixed(input.chunk)
  END IF
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for standard generation, then write property-based tests capturing that behavior.

**Test Cases**:

1. **Standard Generation Preservation**: Generate 100 chunks with incrementalEnabled=false on both original and fixed code, assert identical results (heightmap, biomeMap, resources, structures, rivers)

2. **Complete Chunk Rendering Preservation**: Generate complete chunks, render with WorldViewer, assert visual output is identical (compare pixel data or mesh geometry)

3. **LOD Preservation**: Generate chunks with LOD enabled, assert LOD application works identically on fixed code

4. **Serialization Preservation**: Generate chunks, serialize/deserialize, assert data integrity is preserved

5. **Performance Preservation**: Measure standard generation performance (time per chunk), assert fixed code has similar performance (within 5%)

### Unit Tests

- Test IncrementalGenerator.startGeneration() initializes completedStages Set
- Test IncrementalGenerator.continueGeneration() advances stage after work completes
- Test IncrementalGenerator.continueGeneration() skips work for already-completed stages
- Test executeTerrainStage() marks TERRAIN complete and returns budget status
- Test executeBiomesStage() marks BIOMES complete and returns budget status
- Test DemoApp.loadChunksAround() calls continueGeneration() at least twice for incremental chunks
- Test DemoApp.loadChunksAround() emits CHUNK_LOADED only after biomeMap exists

### Property-Based Tests

- Generate random chunk coordinates and verify all stages complete within bounded iterations
- Generate random time budgets (1ms to 100ms) and verify stages always advance
- Generate random chunk grids (1x1 to 10x10) and verify all chunks complete
- Generate random seeds and verify standard generation produces identical results on fixed code
- Test that for any chunk, calling continueGeneration() N times eventually reaches COMPLETE (no infinite loops)

### Integration Tests

- Test full DemoApp workflow: initialize, load chunks, verify all chunks render with proper colors
- Test switching between standard and incremental generation modes
- Test unloading and reloading chunks with incremental generation
- Test LOD system with incremental generation enabled
- Test performance: measure FPS during chunk loading, verify improvement over standard generation
- Test visual quality: verify no grey terrain artifacts during incremental loading
