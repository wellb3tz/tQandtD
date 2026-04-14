# Bugfix Requirements Document

## Introduction

This document describes critical bugs in the incremental generation system that prevent proper chunk generation and rendering. A comprehensive diagnostic revealed multiple severe issues:

1. **Infinite Loop in Stage Progression** (MOST CRITICAL): The TERRAIN and BIOMES stages get stuck in infinite loops because they perform all work first, then check the time budget. If the budget is exceeded, they return false (incomplete), but the work is already done. The next call regenerates everything again, exceeding the budget again, and the stage never advances.

2. **Missing Stage Completion Tracking**: Stages don't track whether their work has been completed, causing redundant regeneration on every continueGeneration() call.

3. **Premature Rendering**: DemoApp.loadChunksAround() calls continueGeneration() only once and immediately emits CHUNK_LOADED, rendering chunks before biomes are generated (grey terrain).

4. **Fundamental Design Flaw**: The incremental generator does all work for a stage, THEN checks if it exceeded the time budget. This means work is never actually "incremental" within a stage, and stages that take longer than the budget can never complete.

These bugs prevent the incremental generation system from functioning correctly, causing infinite loops, wasted computation, and poor visual quality during world loading.

**Performance Impact**: Testing shows the current implementation is completely non-functional:
- 0% chunk completion rate (all chunks stuck in infinite loops)
- 135x slower than standard generation (67 seconds vs 0.5 seconds for 9 chunks)
- Worse FPS (14.90 vs 18.14 average)
- Severe stuttering (minimum FPS drops from 13.89 to 1.12)
- System runs for 1000+ iterations without completing a single chunk

The incremental generation feature does not provide any FPS benefit in its current broken state and must be fixed before it can be used.

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: Infinite Loop in TERRAIN Stage**

1.1 WHEN IncrementalGenerator.continueGeneration() is called for TERRAIN stage THEN the system generates the entire heightmap

1.2 WHEN the heightmap generation completes THEN the system checks if elapsed time exceeds timeBudgetMs

1.3 WHEN elapsed time exceeds timeBudgetMs THEN the system returns false (stage "not complete") even though the heightmap is fully generated

1.4 WHEN continueGeneration() is called again for the same chunk THEN the system regenerates the entire heightmap from scratch (because no completion flag exists)

1.5 WHEN the regenerated heightmap exceeds timeBudgetMs again THEN the system returns false again, creating an infinite loop where the stage never advances to BIOMES

**Bug 2: Infinite Loop in BIOMES Stage**

1.6 WHEN IncrementalGenerator.continueGeneration() is called for BIOMES stage THEN the system generates all biomes for the entire chunk

1.7 WHEN biome generation completes THEN the system checks if elapsed time exceeds timeBudgetMs

1.8 WHEN elapsed time exceeds timeBudgetMs THEN the system returns false (stage "not complete") even though biomes are fully generated

1.9 WHEN continueGeneration() is called again THEN the system would regenerate all biomes from scratch (same infinite loop pattern as TERRAIN)

**Bug 3: Premature Rendering**

1.10 WHEN DemoApp.loadChunksAround() processes an incremental chunk THEN the system calls continueGeneration() only once

1.11 WHEN continueGeneration() is called once THEN only the TERRAIN stage executes (if it completes within budget)

1.12 WHEN TERRAIN stage completes THEN the system emits CHUNK_LOADED event immediately with partial.data that has heightmap but no biomeMap

1.13 WHEN WorldViewer receives chunk data without biomeMap THEN the system renders terrain with grey fallback color (r: 0.5, g: 0.5, b: 0.5)

**Bug 4: Missing Stage Completion Tracking**

1.14 WHEN a stage completes its work (e.g., heightmap generated) THEN the system has no flag or state to indicate the work is done

1.15 WHEN continueGeneration() is called again for the same stage THEN the system re-executes all work from scratch instead of recognizing it's already complete

1.16 WHEN executeTerrainStage() or executeBiomesStage() runs THEN the system performs all generation work before checking time budget, making work non-incremental

**Bug 5: Fundamental Design Flaw**

1.17 WHEN any stage executes THEN the system does ALL work for that stage first, THEN checks if time budget was exceeded

1.18 WHEN a stage's work takes longer than timeBudgetMs THEN the stage can never advance because it always exceeds budget and returns false

1.19 WHEN time budget is checked after work completion THEN the system cannot yield mid-stage, making "incremental" generation actually batch generation per stage

### Expected Behavior (Correct)

**Fix 1: Stage Completion Tracking**

2.1 WHEN a stage completes its work (e.g., heightmap generated) THEN the system SHALL set a completion flag for that stage

2.2 WHEN continueGeneration() is called for a stage that has already completed THEN the system SHALL immediately advance to the next stage without re-executing work

2.3 WHEN a stage completes its work THEN the system SHALL advance to the next stage regardless of whether time budget was exceeded

**Fix 2: Separate Completion from Time Budget**

2.4 WHEN executeTerrainStage() completes heightmap generation THEN the system SHALL return true (stage complete) and advance stage to BIOMES

2.5 WHEN executeBiomesStage() completes biome generation THEN the system SHALL return true (stage complete) and advance stage to RIVERS

2.6 WHEN time budget is exceeded during a stage THEN the system SHALL still mark the stage as complete if the work is done, but MAY choose not to continue to the next stage in the same call

2.7 WHEN continueGeneration() returns false THEN it SHALL mean "don't continue to next stage yet" NOT "current stage is incomplete"

**Fix 3: Proper Initial Rendering**

2.8 WHEN DemoApp.loadChunksAround() processes an incremental chunk THEN the system SHALL call continueGeneration() at least twice (once for TERRAIN, once for BIOMES)

2.9 WHEN both TERRAIN and BIOMES stages complete THEN the system SHALL emit CHUNK_LOADED event with chunk data containing both heightmap and biomeMap

2.10 WHEN WorldViewer receives chunk data with biomeMap THEN the system SHALL render terrain with proper biome colors

**Fix 4: Correct Stage Progression Logic**

2.11 WHEN continueGeneration() is called THEN the system SHALL check if current stage work is already done before executing

2.12 WHEN current stage work is already done THEN the system SHALL advance to next stage immediately

2.13 WHEN current stage work is not done THEN the system SHALL execute the stage work and mark it complete

2.14 WHEN a stage completes within time budget THEN the system SHALL advance to next stage and MAY continue executing

2.15 WHEN a stage completes but exceeds time budget THEN the system SHALL advance to next stage but return false to yield control

### Unchanged Behavior (Regression Prevention)

3.1 WHEN incremental generation is disabled (standard generation mode) THEN the system SHALL CONTINUE TO generate complete chunks with all stages including biomes in a single operation

3.2 WHEN a chunk completes all generation stages (stage 5 - COMPLETE) THEN the system SHALL CONTINUE TO render with full biome colors and all features

3.3 WHEN WorldViewer receives a complete chunk (partial=false) THEN the system SHALL CONTINUE TO render terrain with proper biome colors from biomeMap

3.4 WHEN incremental generation progresses through RIVERS, RESOURCES, and STRUCTURES stages THEN the system SHALL CONTINUE TO add those layers progressively without affecting terrain biome colors

3.5 WHEN LOD (Level of Detail) is enabled THEN the system SHALL CONTINUE TO apply LOD tints correctly regardless of incremental generation state

3.6 WHEN a chunk is updated during incremental generation THEN the system SHALL CONTINUE TO replace the previous mesh and apply the current stage's visualization correctly
