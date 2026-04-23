# Implementation Plan: Terrain-Aware Micro-Biomes

## Overview

Fix the micro-biome frequency threshold bug, improve terrain-aware placement, add visual
feedback in the demo, and provide comprehensive property-based tests. All changes are
confined to `src/world/enhanced-biome.ts`, `demo/src/`, `src/world/enhanced-biome.test.ts`,
`examples/`, and `README.md`.

## Tasks

- [x] 1. Fix threshold formula and add backward-compat flag in EnhancedBiomeSystem
  - In `src/world/enhanced-biome.ts`, add `useLegacyMicroBiomeThreshold?: boolean` to `EnhancedBiomeConfig` with JSDoc `@deprecated` notice
  - Change the threshold line in `getMicroBiome` from `1.0 - microBiomeFrequency * 2` to the conditional: legacy path keeps `* 2`, corrected path uses `* 4`
  - Clamp `microBiomeFrequency` to `[0.0, 0.5]` before computing the threshold
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 1.1 Write regression test for legacy threshold flag
    - Verify that with `useLegacyMicroBiomeThreshold: true` and a fixed seed/position the system produces the same result as the old formula
    - _Requirements: 9.5_

- [x] 2. Add JSDoc comments to EnhancedBiomeConfig fields
  - Add JSDoc to `microBiomeFrequency` explaining valid range `[0.0, 0.5]`, density effect, and terrain-aware interaction
  - Add JSDoc to `depressionDepthThreshold` explaining depression detection and recommended range
  - Add JSDoc to `clearingGradientThreshold` explaining gradient check and recommended range
  - _Requirements: 10.1, 10.2_

- [x] 3. Improve depression detection for OASIS and POND micro-biomes
  - In `getMicroBiome`, sample `getHeight` at `(x+1,y)`, `(x-1,y)`, `(x,y+1)`, `(x,y-1)` using stack-local variables (no heap allocation)
  - Compute `neighbourAvg = (h_xp + h_xm + h_yp + h_ym) / 4`
  - Gate OASIS/POND placement on `(centerHeight - neighbourAvg) < -(depressionDepthThreshold ?? 0.05)`
  - When `depressionDepthThreshold` is `0.0`, all positions pass (noise-only fallback)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.2_

- [x] 4. Improve flat-terrain detection for CLEARING and GROVE micro-biomes
  - Compute `dx1`, `dx2`, `dy1`, `dy2` as height differences from centre to each cardinal neighbour using stack-local variables
  - Compute `gradient = Math.sqrt((dx1*dx1 + dx2*dx2 + dy1*dy1 + dy2*dy2) / 4)`
  - Gate CLEARING/GROVE placement on `gradient < (clearingGradientThreshold ?? 0.03)`
  - When `clearingGradientThreshold` is very high (e.g. `1.0`), all positions pass (noise-only fallback)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2_

- [x] 5. Checkpoint — core library changes complete
  - Ensure all existing tests still pass after tasks 1–4; ask the user if questions arise.

- [x] 6. Add property-based tests for frequency parameter correctness
  - Extend `src/world/enhanced-biome.test.ts` using `fast-check`

  - [x] 6.1 Write property test for threshold range validity (Property 1)
    - `fc.float({ min: 0, max: 0.5 })` → assert `threshold ∈ [-1.0, 1.0]`
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 1: Threshold is always in the valid noise range`
    - _Requirements: 1.1, 7.1_

  - [x] 6.2 Write property test for zero-frequency produces no micro-biomes (Property 2)
    - `fc.float` (x, y) + `fc.float` (height) with `microBiomeFrequency = 0.0` → assert `microBiome === undefined`
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 2: Zero frequency produces no micro-biomes`
    - _Requirements: 1.2, 7.2_

  - [x] 6.3 Write property test for frequency monotonicity (Property 3)
    - `fc.tuple(fc.float({min:0,max:0.5}), fc.float({min:0,max:0.5}))` filtered `f1 < f2`, measure counts over 200 positions → assert `count(f2) >= count(f1)`
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 3: Frequency monotonicity`
    - _Requirements: 1.4, 7.3, 7.4_

- [x] 7. Add property-based tests for terrain-aware placement
  - Continue extending `src/world/enhanced-biome.test.ts`

  - [x] 7.1 Write property test for depression gate on OASIS/POND (Property 4)
    - Generate depressed and non-depressed height functions; assert OASIS/POND only placed when depression condition holds
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 4: Depression-type micro-biomes only in depressions`
    - _Requirements: 2.3, 2.4, 8.1, 8.3_

  - [x] 7.2 Write property test for gradient gate on CLEARING/GROVE (Property 5)
    - Generate flat and steep height functions; assert CLEARING/GROVE only placed when `gradient < clearingGradientThreshold`
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 5: Flat-terrain micro-biomes only on low-gradient terrain`
    - _Requirements: 3.3, 3.4, 8.2_

  - [x] 7.3 Write property test for micro-biome type matches parent biome (Property 6)
    - For each of the four parent biomes, assert the returned micro-biome type matches the expected mapping
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 6: Micro-biome type matches parent biome`
    - _Requirements: 8.4_

  - [x] 7.4 Write property test for determinism (Property 7)
    - `fc.integer` (seed), `fc.float` (x, y) → call `getEnhancedBiome` twice, assert identical `microBiome` result
    - Tag: `// Feature: terrain-aware-micro-biomes, Property 7: Determinism`
    - _Requirements: 6.1_

- [x] 8. Add property-based test for micro-biome colour contrast (Property 8)
  - In `src/world/enhanced-biome.test.ts`, for each `MicroBiomeType` assert the tint colour differs from parent biome colour by ≥ 0.2 in at least one RGB channel
  - Tag: `// Feature: terrain-aware-micro-biomes, Property 8: Micro-biome colour contrast`
  - _Requirements: 4.1_

- [x] 8.1 Write performance benchmark test
  - Generate a 32×32 grid of `getEnhancedBiome` calls with `microBiomeFrequency = 0.5` and all terrain checks enabled; assert total time < 100 ms
  - _Requirements: 6.3_

- [x] 9. Checkpoint — all property-based and regression tests pass
  - Run `npm test` and confirm all new and existing tests pass; ask the user if questions arise.

- [x] 10. Add micro-biome colour tinting to WorldViewer
  - In `demo/src/viewer/WorldViewer.ts`, define `MICRO_BIOME_TINT` constant mapping each `MicroBiomeType` to an RGB offset
  - After resolving biome colour in `createTerrainMesh`, apply the tint additively (clamped to `[0, 1]`) when `tile.microBiome` is set
  - Track micro-biome tile count per render cycle; expose via `getMicroBiomeCount(): number`
  - _Requirements: 4.1, 4.3_

- [x] 11. Add debug highlight overlay to WorldViewer
  - Add `private highlightMicroBiomes = false` flag to `WorldViewer`
  - Add `setHighlightMicroBiomes(enabled: boolean): void` public method that sets the flag and triggers a full chunk re-render
  - When flag is true, blend a yellow `#ffff00` overlay at 50 % on micro-biome tiles during `createTerrainMesh`
  - _Requirements: 4.2_

- [x] 12. Fix microBiomeFrequency slider and add Highlight toggle in ControlPanel
  - In `demo/src/ui/ControlPanel.ts`, correct the existing `microBiomeFrequency` slider: set `min=0.0`, `max=0.5`, `step=0.01`
  - Ensure the numeric label next to the slider displays the value formatted to two decimal places
  - Add a "Highlight Micro-Biomes" checkbox control that calls `worldViewer.setHighlightMicroBiomes(checked)`
  - _Requirements: 4.5, 5.1, 5.5_

- [x] 13. Add "Micro-Biomes Visible" counter to StatisticsDisplay
  - In `demo/src/ui/StatisticsDisplay.ts`, add a private `microBiomeCountElement` field
  - Create a "Micro-Biomes" section in `createStatisticsUI` with a "Micro-Biomes Visible" statistic element
  - Add `updateMicroBiomeCount(count: number): void` public method
  - Wire `WorldManager` (or `DemoApp`) to call `updateMicroBiomeCount` each frame using `worldViewer.getMicroBiomeCount()`
  - _Requirements: 4.4, 5.3, 5.4_

- [ ] 14. Checkpoint — demo visual features complete
  - Manually verify: slider at 0.0 shows 0 micro-biomes; slider at 0.5 shows > 0; highlight toggle works; label shows two decimal places. Ask the user if questions arise.

- [ ] 15. Add micro-biome-tuning.ts example
  - Create `examples/micro-biome-tuning.ts` with three `EnhancedBiomeConfig` presets: Sparse (`frequency=0.05`), Moderate (`frequency=0.15`), Dense (`frequency=0.40`)
  - Each preset should include `depressionDepthThreshold` and `clearingGradientThreshold` values and a brief comment explaining the aesthetic goal
  - _Requirements: 10.3, 10.5_

- [ ] 16. Update README.md with micro-biomes section
  - Add a "Micro-Biomes" section explaining the frequency parameter (`[0.0, 0.5]` range), terrain-aware placement (depression and gradient checks), and visual feedback features
  - _Requirements: 10.4_

- [ ] 17. Final checkpoint — all tasks complete
  - Run `npm test` to confirm all tests pass; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `{ numRuns: 100 }` minimum as specified in the design
- The `useLegacyMicroBiomeThreshold` flag defaults to `false` via `=== true` guard — no migration needed for existing consumers
- All intermediate height values in tasks 3 and 4 must use stack-local numeric variables (no heap allocation) per Requirement 6.2
