# Implementation Plan: Biome System Improvements

## Overview

Implement geographically plausible biome distributions by introducing a `ClimateSystem` class, a `BiomeCompatibilityMatrix` class, extending `EnhancedBiomeConfig` and `EnhancedBiomeSystem`, and adding terrain-aware micro-biome placement. All changes are opt-in via configuration flags and must preserve bit-identical output when new flags are absent or false.

## Tasks

- [x] 1. Create `ClimateSystem` class in `src/world/climate.ts`
  - [x] 1.1 Define `ClimateConfig` interface and `DEFAULT_CLIMATE_CONFIG` constant
    - Define all eight fields: `latitudeGradientStrength`, `climateScale`, `detailScale`, `climateDetailBlend`, `altitudeCoolingThreshold`, `altitudeCoolingRate`, `valleyGradientThreshold`, `valleyMoistureBonus` with the default values from the design
    - Export `ClimateConfig` and `DEFAULT_CLIMATE_CONFIG`
    - _Requirements: 1.3, 2.2, 3.2, 4.3, 7.4_

  - [x] 1.2 Implement `ClimateSystem` constructor with config validation
    - Accept `seed: number` and `config: ClimateConfig`
    - Instantiate four `NoiseEngine` instances at seed offsets +3000, +3001, +3002, +3003 for `tempClimate`, `tempDetail`, `moistClimate`, `moistDetail`
    - Validate all config fields and throw descriptive `Error` for out-of-range values (see design Error Handling section)
    - _Requirements: 1.3, 2.2, 3.2, 4.3, 8.4_

  - [x] 1.3 Implement `computeGradient` method
    - Sample height at four cardinal neighbours at configurable `step` distance (default 1)
    - Compute RMS of the four height differences using only stack-local numeric variables
    - Return gradient magnitude ≥ 0
    - _Requirements: 4.1, 8.4_

  - [x] 1.4 Write property test for gradient non-negativity (Property 9)
    - **Property 9: Gradient magnitude is always non-negative**
    - **Validates: Requirements 4.1**
    - Tag: `// Feature: biome-system-improvements, Property 9: Gradient magnitude is always non-negative`

  - [x] 1.5 Implement `getTemperature` method
    - Compute `latitudeBase` from world Y using `latitudeGradientStrength`
    - Blend `tempClimate` and `tempDetail` noise layers using `climateDetailBlend`
    - Combine latitude base with blended noise scaled by `(1 - latitudeGradientStrength)`
    - Apply altitude cooling when `height > altitudeCoolingThreshold`
    - Clamp final result to [−1, 1] using stack-local variables only (no heap allocation)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.3, 3.1, 3.3, 3.4, 3.5, 8.4_

  - [x] 1.6 Write property test for temperature range (Property 1)
    - **Property 1: Temperature output is always in range [-1, 1]**
    - **Validates: Requirements 1.5, 3.5**
    - Tag: `// Feature: biome-system-improvements, Property 1: Temperature output is always in range [-1, 1]`

  - [x] 1.7 Write property test for latitude monotonicity (Property 3)
    - **Property 3: Latitude gradient is monotonically decreasing with Y**
    - **Validates: Requirements 1.1**
    - Tag: `// Feature: biome-system-improvements, Property 3: Latitude gradient is monotonically decreasing with Y`

  - [x] 1.8 Write property test for altitude cooling monotonicity (Property 5)
    - **Property 5: Altitude cooling is monotonically decreasing above threshold**
    - **Validates: Requirements 3.1**
    - Tag: `// Feature: biome-system-improvements, Property 5: Altitude cooling is monotonically decreasing above threshold`

  - [x] 1.9 Write property test for no cooling below threshold (Property 6)
    - **Property 6: No altitude cooling below threshold**
    - **Validates: Requirements 3.4**
    - Tag: `// Feature: biome-system-improvements, Property 6: No altitude cooling below threshold`

  - [x] 1.10 Implement `getMoisture` method
    - Blend `moistClimate` and `moistDetail` noise layers using `climateDetailBlend`
    - Call `computeGradient` to get terrain gradient at (x, y)
    - Apply valley moisture bonus when `gradient < valleyGradientThreshold`
    - Clamp final result to [−1, 1] using stack-local variables only (no heap allocation)
    - _Requirements: 2.4, 4.2, 4.3, 4.4, 8.4_

  - [x] 1.11 Write property test for moisture range (Property 2)
    - **Property 2: Moisture output is always in range [-1, 1]**
    - **Validates: Requirements 4.4**
    - Tag: `// Feature: biome-system-improvements, Property 2: Moisture output is always in range [-1, 1]`

  - [x] 1.12 Write property test for valley bonus monotonicity (Property 7)
    - **Property 7: Valley moisture bonus is monotonically decreasing with gradient**
    - **Validates: Requirements 4.2**
    - Tag: `// Feature: biome-system-improvements, Property 7: Valley moisture bonus is monotonically decreasing with gradient`

  - [x] 1.13 Write property test for zero valley bonus (Property 8)
    - **Property 8: Zero valley moisture bonus preserves gradient-independent moisture**
    - **Validates: Requirements 4.5**
    - Tag: `// Feature: biome-system-improvements, Property 8: Zero valley moisture bonus preserves gradient-independent moisture`

  - [x] 1.14 Write property test for ClimateSystem determinism (Property 16)
    - **Property 16: ClimateSystem is deterministic**
    - **Validates: Requirements 8.1**
    - Tag: `// Feature: biome-system-improvements, Property 16: ClimateSystem is deterministic`

- [x] 2. Write unit tests for `ClimateSystem` in `src/world/climate.test.ts`
  - [x] 2.1 Write example-based unit tests for `ClimateSystem`
    - Verify `DEFAULT_CLIMATE_CONFIG` has the correct default values
    - Verify constructor throws on each out-of-range config field
    - Verify `getTemperature` with `latitudeGradientStrength = 0` produces noise-only output (no latitude effect)
    - Verify `getTemperature` with height ≤ `altitudeCoolingThreshold` applies zero altitude cooling
    - Verify `getMoisture` with `valleyMoistureBonus = 0` is unaffected by terrain gradient
    - Verify `computeGradient` returns 0 for a perfectly flat height function
    - _Requirements: 1.4, 3.4, 4.5, 7.4_

  - [x] 2.2 Write property test for zero latitude gradient = noise-only (Property 4)
    - **Property 4: Zero latitude gradient strength preserves noise-only temperature**
    - **Validates: Requirements 1.4**
    - Tag: `// Feature: biome-system-improvements, Property 4: Zero latitude gradient strength preserves noise-only temperature`

- [x] 3. Checkpoint — Ensure all ClimateSystem tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create `BiomeCompatibilityMatrix` class in `src/world/biome-compatibility.ts`
  - [x] 4.1 Define `SerializedCompatibilityMatrix` interface and `BiomeCompatibilityMatrix` class skeleton
    - Define `SerializedCompatibilityMatrix` with `version`, `compatible` (flat `number[]` of length `NUM_BIOMES²`), and `intermediate` (flat `number[]` of length `NUM_BIOMES²`)
    - Declare private flat arrays `_compatible` and `_intermediate` sized `NUM_BIOMES * NUM_BIOMES`
    - Export both the interface and the class
    - _Requirements: 5.1, 5.2, 8.5_

  - [x] 4.2 Implement constructor with built-in incompatible pairs
    - Pre-compute the full lookup table at construction time (not lazily)
    - Mark all pairs compatible by default
    - Mark DESERT↔TAIGA, DESERT↔TUNDRA, DESERT↔FOREST as incompatible with PLAINS as intermediate
    - Mark OCEAN↔MOUNTAIN as incompatible with BEACH as intermediate
    - Ensure symmetry: `isCompatible(a, b) === isCompatible(b, a)`
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 8.5_

  - [x] 4.3 Implement `isCompatible` and `getIntermediate` methods
    - `isCompatible(a, b)`: O(1) lookup via `_compatible[a * NUM_BIOMES + b]`; return boolean
    - `getIntermediate(a, b)`: O(1) lookup via `_intermediate[a * NUM_BIOMES + b]`; return `BiomeType | undefined`
    - _Requirements: 5.1, 5.2, 8.5_

  - [x] 4.4 Write property test for matrix completeness (Property 10)
    - **Property 10: Compatibility matrix covers all biome pairs**
    - **Validates: Requirements 5.1**
    - Tag: `// Feature: biome-system-improvements, Property 10: Compatibility matrix covers all biome pairs`

  - [x] 4.5 Write property test for incompatible pairs have intermediate (Property 11)
    - **Property 11: Incompatible pairs always have a defined intermediate biome**
    - **Validates: Requirements 5.2**
    - Tag: `// Feature: biome-system-improvements, Property 11: Incompatible pairs always have a defined intermediate biome`

  - [x] 4.6 Implement `serialise` and static `deserialise` methods
    - `serialise()`: return a plain `SerializedCompatibilityMatrix` object copying the flat arrays
    - `static deserialise(data)`: reconstruct a `BiomeCompatibilityMatrix` from the serialized arrays
    - _Requirements: 5.9_

  - [x] 4.7 Write property test for serialisation round-trip (Property 12)
    - **Property 12: Compatibility matrix serialisation round-trip**
    - **Validates: Requirements 5.9**
    - Tag: `// Feature: biome-system-improvements, Property 12: Compatibility matrix serialisation round-trip`

- [x] 5. Write unit tests for `BiomeCompatibilityMatrix` in `src/world/biome-compatibility.test.ts`
  - [x] 5.1 Write example-based unit tests for `BiomeCompatibilityMatrix`
    - Verify DESERT↔TAIGA is incompatible with PLAINS as intermediate
    - Verify DESERT↔TUNDRA is incompatible with PLAINS as intermediate
    - Verify DESERT↔FOREST is incompatible with PLAINS as intermediate
    - Verify OCEAN↔MOUNTAIN is incompatible with BEACH as intermediate
    - Verify a compatible pair (e.g. PLAINS↔FOREST) returns `isCompatible = true` and `getIntermediate = undefined`
    - Verify symmetry: `isCompatible(DESERT, TAIGA) === isCompatible(TAIGA, DESERT)`
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7_

- [x] 6. Checkpoint — Ensure all BiomeCompatibilityMatrix tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Extend `EnhancedBiomeConfig` and update `EnhancedBiomeSystem` in `src/world/enhanced-biome.ts`
  - [x] 7.1 Add new optional fields to `EnhancedBiomeConfig`
    - Add `enableClimateSystem?: boolean` (default false)
    - Add `enableCompatibilityMatrix?: boolean` (default false)
    - Add `climateConfig?: ClimateConfig`
    - Add `depressionDepthThreshold?: number` (default 0.05)
    - Add `clearingGradientThreshold?: number` (default 0.03)
    - Import `ClimateConfig` from `./climate`
    - _Requirements: 7.1, 7.3, 7.4, 6.6_

  - [x] 7.2 Add `ClimateSystem` and `BiomeCompatibilityMatrix` members to `EnhancedBiomeSystem`
    - Add private `climateSystem: ClimateSystem | null`
    - Add private `compatibilityMatrix: BiomeCompatibilityMatrix | null`
    - In the constructor, instantiate `ClimateSystem` when `enableClimateSystem` is true (using `climateConfig ?? DEFAULT_CLIMATE_CONFIG`)
    - In the constructor, instantiate `BiomeCompatibilityMatrix` when `enableCompatibilityMatrix` is true
    - Import `ClimateSystem`, `DEFAULT_CLIMATE_CONFIG` from `./climate` and `BiomeCompatibilityMatrix` from `./biome-compatibility`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.3 Update `getEnhancedBiome` to use `ClimateSystem` for temperature and moisture
    - When `climateSystem` is set, call `climateSystem.getTemperature(x, y, height)` and `climateSystem.getMoisture(x, y, height, getHeight)` instead of the parent `BiomeSystem` methods
    - When `climateSystem` is null, delegate to the existing parent `BiomeSystem.getTemperature/getMoisture` path (bit-identical to current behaviour)
    - Pass the resulting temperature and moisture into the existing `getBiome` classification logic
    - _Requirements: 7.1, 7.2_

  - [x] 7.4 Apply `BiomeCompatibilityMatrix` weight correction in `getEnhancedBiome`
    - After computing blend weights, when `compatibilityMatrix` is set, identify the primary biome (highest weight)
    - For each non-primary biome `b` with weight `w` that is incompatible with the primary biome `p`, set weight of `b` to 0 and add `w` to the weight of `getIntermediate(p, b)`
    - When `compatibilityMatrix` is null, skip correction entirely (bit-identical to current behaviour)
    - _Requirements: 5.3, 7.3_

  - [x] 7.5 Write property test for incompatible biomes zeroed after correction (Property 13)
    - **Property 13: Incompatible biomes have zero weight after compatibility correction**
    - **Validates: Requirements 5.3**
    - Tag: `// Feature: biome-system-improvements, Property 13: Incompatible biomes have zero weight after compatibility correction`

- [x] 8. Implement terrain-aware micro-biome placement in `EnhancedBiomeSystem`
  - [x] 8.1 Update `getMicroBiome` signature to accept `getHeight` callback
    - Change signature to `getMicroBiome(x, y, parentBiome, getHeight, height)`
    - Update the call site in `getEnhancedBiome` to pass `getHeight` and `height`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Add depression check for OASIS and POND micro-biomes
    - Compute `neighbourAvg` as the average of `getHeight` at four cardinal neighbours (step = 1)
    - When `(height - neighbourAvg) >= -depressionDepthThreshold` (i.e. not a depression), return `undefined` before the noise threshold check
    - When `depressionDepthThreshold === 0`, the condition is trivially satisfied — fall through to noise-only logic
    - _Requirements: 6.1, 6.3, 6.7_

  - [x] 8.3 Add gradient check for CLEARING and GROVE micro-biomes
    - Compute gradient using `climateSystem.computeGradient` if available, otherwise inline the same RMS formula
    - When `gradient >= clearingGradientThreshold`, return `undefined` before the noise threshold check
    - When `clearingGradientThreshold === 0`, the condition is trivially satisfied — fall through to noise-only logic
    - _Requirements: 6.2, 6.4, 6.7_

  - [x] 8.4 Write property test for depression micro-biomes in depressions (Property 14)
    - **Property 14: Depression-type micro-biomes only placed in depressions**
    - **Validates: Requirements 6.1, 6.3**
    - Tag: `// Feature: biome-system-improvements, Property 14: Depression-type micro-biomes only placed in depressions`

  - [x] 8.5 Write property test for flat-terrain micro-biomes on low-gradient terrain (Property 15)
    - **Property 15: Flat-terrain micro-biomes only placed on low-gradient terrain**
    - **Validates: Requirements 6.2, 6.4**
    - Tag: `// Feature: biome-system-improvements, Property 15: Flat-terrain micro-biomes only placed on low-gradient terrain`

- [x] 9. Checkpoint — Ensure all EnhancedBiomeSystem tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write property-based tests in `tests/property/biome-system-improvements.test.ts`
  - [x] 10.1 Set up the property test file with fast-check imports and shared arbitraries
    - Import `fc` from `fast-check`, `describe`, `it`, `expect` from `vitest`
    - Import `ClimateSystem`, `DEFAULT_CLIMATE_CONFIG`, `ClimateConfig` from `../../src/world/climate`
    - Import `BiomeCompatibilityMatrix` from `../../src/world/biome-compatibility`
    - Import `EnhancedBiomeSystem` from `../../src/world/enhanced-biome`
    - Import `BiomeType` from `../../src/world/chunk`
    - Define shared arbitraries: `validClimateConfigArb`, `worldPosArb`, `heightArb`, `biomeTypeArb`
    - _Requirements: 8.1, 8.2_

  - [x] 10.2 Implement property tests P1–P9 (ClimateSystem range and monotonicity)
    - P1: Temperature in [−1, 1] for arbitrary position, height, and config
    - P2: Moisture in [−1, 1] for arbitrary position, height, and config
    - P3: Latitude monotonicity — for y1 < y2 with `latitudeGradientStrength > 0`, temp at y1 ≥ temp at y2
    - P4: Zero latitude gradient — temperature equals noise-only path
    - P5: Altitude cooling monotonicity — for h1 > h2 > threshold, temp(h1) ≤ temp(h2)
    - P6: No cooling below threshold — temp with h ≤ threshold equals temp with h = 0
    - P7: Valley bonus monotonicity — for g1 < g2 < threshold, bonus at g1 ≥ bonus at g2
    - P8: Zero valley bonus — moisture identical for different gradients when `valleyMoistureBonus = 0`
    - P9: Gradient ≥ 0 for any position and height callback
    - _Requirements: 1.1, 1.4, 1.5, 3.1, 3.4, 3.5, 4.1, 4.2, 4.4, 4.5_

  - [x] 10.3 Implement property tests P10–P12 (BiomeCompatibilityMatrix)
    - P10: `isCompatible(a, b)` returns a boolean for all BiomeType pairs (never throws, never undefined)
    - P11: For all incompatible pairs, `getIntermediate(a, b)` returns a valid `BiomeType` ≠ a and ≠ b
    - P12: `deserialise(matrix.serialise())` produces a matrix with identical `isCompatible` and `getIntermediate` results for all pairs
    - _Requirements: 5.1, 5.2, 5.9_

  - [x] 10.4 Implement property tests P13–P16 (EnhancedBiomeSystem and determinism)
    - P13: After weight correction, incompatible biomes have weight 0 and intermediate biome weight increased by original weight
    - P14: OASIS and POND micro-biomes only appear at positions where `height < neighbourAvg - depressionDepthThreshold`
    - P15: CLEARING and GROVE micro-biomes only appear at positions where gradient < `clearingGradientThreshold`
    - P16: `getTemperature` and `getMoisture` return identical values on repeated calls with identical arguments
    - _Requirements: 5.3, 6.1, 6.2, 6.3, 6.4, 8.1_

- [x] 11. Write integration and performance tests in `tests/integration/biome-system-improvements.test.ts`
  - [x] 11.1 Write performance benchmark test
    - Generate a 32×32 chunk with all new features enabled (`enableClimateSystem: true`, `enableCompatibilityMatrix: true`)
    - Run 3 times and assert the median completion time is < 100 ms
    - _Requirements: 8.3_

  - [x] 11.2 Write backward compatibility test
    - Generate the same chunk with `enhancedBiomeConfig` absent (base `BiomeSystem` path) and with `enableClimateSystem: false`, `enableCompatibilityMatrix: false`
    - Assert the biome maps are identical in both cases
    - _Requirements: 7.2, 7.3, 8.2_

  - [x] 11.3 Write end-to-end biome map snapshot test
    - Generate a chunk with a fixed seed and known config with all new features enabled
    - Assert the biome map matches a stored inline snapshot to catch regressions
    - _Requirements: 8.1, 8.2_

- [x] 12. Export new types through `src/index.ts`
  - Add exports for `ClimateSystem` and `ClimateConfig` from `./world/climate`
  - Add exports for `BiomeCompatibilityMatrix` and `SerializedCompatibilityMatrix` from `./world/biome-compatibility`
  - Ensure `EnhancedBiomeConfig` export already covers the new optional fields (no separate export needed)
  - _Requirements: 7.4, 7.5_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Run `npm test` and confirm all unit, property, and integration tests pass with no regressions.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check 3.15+ with a minimum of 100 iterations each
- All property test files must include the tag comment: `// Feature: biome-system-improvements, Property N: <text>`
- Checkpoints ensure incremental validation after each major component
- The `ClimateSystem` hot path must not allocate heap objects per-tile; all intermediate values use stack-local numeric variables
- When `enableClimateSystem` is false and `enableCompatibilityMatrix` is false, output must be bit-identical to the current implementation
