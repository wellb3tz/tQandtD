# Requirements Document

## Introduction

This feature improves the biome system of the procedural world generation engine to produce geographically plausible biome distributions. Currently, temperature and moisture are independent noise fields at a single scale, height has no effect on temperature, and micro-biomes are placed by random noise without regard to terrain shape. The improvements introduce a latitudinal temperature gradient, altitude-based cooling, multi-scale climate zones, valley moisture accumulation, a biome compatibility matrix that prevents impossible neighbours, and terrain-aware micro-biome placement. All changes must remain deterministic, backward-compatible via opt-in configuration, and meet the existing <100 ms per-chunk performance target.

## Glossary

- **BiomeSystem**: The base class in `src/world/biome.ts` that classifies biome types from height, temperature, and moisture.
- **EnhancedBiomeSystem**: The subclass in `src/world/enhanced-biome.ts` that adds transitions, micro-biomes, and elevation bands.
- **ClimateSystem**: The new subsystem (introduced by this feature) responsible for computing climate values (temperature, moisture) that incorporate latitude, altitude, valley shape, and multi-scale noise.
- **BiomeCompatibilityMatrix**: A lookup structure that defines which biome pairs are geographically compatible as direct neighbours and which intermediate biome must be inserted when they are not.
- **Latitudinal Gradient**: The decrease in temperature as the world Y-coordinate (latitude) increases toward the poles.
- **Altitude Cooling**: The decrease in temperature as terrain height rises above a configurable elevation threshold.
- **Valley Moisture**: The increase in moisture in areas of low terrain gradient (valleys between mountains).
- **Climate Noise**: Large-scale noise used to define broad climate zones, distinct from the smaller-scale detail noise used for biome variation.
- **Detail Noise**: Small-scale noise layered on top of climate noise to add local variation within a climate zone.
- **Micro-Biome**: A small, localised biome feature embedded within a parent biome (e.g., oasis in desert).
- **Terrain Depression**: A local terrain minimum where water would naturally collect, identified by comparing a point's height to the average height of its neighbourhood.
- **Terrain Gradient**: The magnitude of the height difference between a point and its immediate neighbours; low gradient indicates flat or valley terrain.
- **Intermediate Biome**: A biome inserted between two incompatible neighbours during blending to produce a geographically plausible transition (e.g., PLAINS between DESERT and TAIGA).
- **WorldConfig**: The top-level configuration interface passed to `ChunkManager`.
- **EnhancedBiomeConfig**: The configuration interface for `EnhancedBiomeSystem`, extended by this feature.

---

## Requirements

### Requirement 1: Latitudinal Temperature Gradient

**User Story:** As a world-builder, I want temperature to decrease with increasing Y-coordinate (latitude), so that polar regions are cold and equatorial regions are warm regardless of random noise.

#### Acceptance Criteria

1. THE ClimateSystem SHALL compute a base latitude temperature from the world Y-coordinate using a configurable gradient strength, such that higher Y values produce lower base temperatures.
2. WHEN computing final temperature at a world position, THE ClimateSystem SHALL add the latitude base temperature to the noise-derived temperature variation.
3. THE ClimateSystem SHALL expose a `latitudeGradientStrength` configuration parameter (range 0–1, default 0.5) that controls how strongly latitude influences temperature relative to noise.
4. WHEN `latitudeGradientStrength` is 0, THE ClimateSystem SHALL produce temperature values identical to the current noise-only behaviour, preserving backward compatibility.
5. THE ClimateSystem SHALL clamp the final temperature value to the range [−1, 1] after combining latitude gradient and noise contributions.

---

### Requirement 2: Multi-Scale Climate Zones

**User Story:** As a world-builder, I want climate zones to be 3–5× larger than biome detail noise, so that temperature and moisture vary smoothly over continental distances rather than fragmenting into small patches.

#### Acceptance Criteria

1. THE ClimateSystem SHALL generate temperature using two noise layers: a large-scale climate layer and a small-scale detail layer.
2. THE ClimateSystem SHALL expose a `climateScale` configuration parameter (default 0.001) for the large-scale climate noise, and a `detailScale` configuration parameter (default 0.005) for the small-scale detail noise.
3. WHEN computing temperature, THE ClimateSystem SHALL blend the climate layer and the detail layer using a configurable `climateDetailBlend` weight (range 0–1, default 0.3), where the detail layer contributes `climateDetailBlend` of the final value and the climate layer contributes `1 − climateDetailBlend`.
4. THE ClimateSystem SHALL apply the same two-layer approach to moisture computation.
5. WHEN `climateScale` equals `detailScale`, THE ClimateSystem SHALL produce a single-layer result equivalent to the current single-scale behaviour.

---

### Requirement 3: Altitude-Based Temperature Cooling

**User Story:** As a world-builder, I want mountains to be colder than valleys, so that high-elevation terrain naturally produces alpine and snow biomes without requiring manual biome overrides.

#### Acceptance Criteria

1. WHEN the terrain height at a world position exceeds a configurable `altitudeCoolingThreshold` (range 0–1, default 0.6), THE ClimateSystem SHALL subtract a temperature penalty proportional to the excess height above the threshold.
2. THE ClimateSystem SHALL expose an `altitudeCoolingRate` configuration parameter (range 0–2, default 1.0) that scales the temperature reduction per unit of height above the threshold.
3. THE ClimateSystem SHALL require the terrain height value as an input to the temperature computation method.
4. WHEN terrain height is at or below `altitudeCoolingThreshold`, THE ClimateSystem SHALL apply zero altitude cooling, leaving temperature unaffected by height.
5. THE ClimateSystem SHALL clamp the altitude-adjusted temperature to the range [−1, 1].

---

### Requirement 4: Valley Moisture Accumulation

**User Story:** As a world-builder, I want valleys and low-gradient areas between mountains to have higher moisture, so that natural forest corridors form through plains and the world feels hydrologically coherent.

#### Acceptance Criteria

1. THE ClimateSystem SHALL compute a terrain gradient magnitude at each world position by sampling height at a configurable number of neighbouring points and computing the root-mean-square of height differences.
2. WHEN the terrain gradient magnitude is below a configurable `valleyGradientThreshold` (range 0–1, default 0.05), THE ClimateSystem SHALL add a moisture bonus proportional to `(valleyGradientThreshold − gradient) / valleyGradientThreshold`.
3. THE ClimateSystem SHALL expose a `valleyMoistureBonus` configuration parameter (range 0–1, default 0.3) that scales the maximum moisture increase applied in flat/valley areas.
4. THE ClimateSystem SHALL clamp the final moisture value to the range [−1, 1] after applying the valley bonus.
5. WHEN `valleyMoistureBonus` is 0, THE ClimateSystem SHALL produce moisture values unaffected by terrain gradient, preserving backward compatibility.

---

### Requirement 5: Biome Compatibility Matrix

**User Story:** As a world-builder, I want geographically impossible biome neighbours (such as desert directly bordering taiga) to be prevented, so that biome transitions always follow a plausible geographic sequence.

#### Acceptance Criteria

1. THE BiomeCompatibilityMatrix SHALL define, for every pair of BiomeType values, whether the pair is compatible as direct neighbours.
2. THE BiomeCompatibilityMatrix SHALL define, for every incompatible pair, exactly one intermediate BiomeType that must appear between them.
3. WHEN `EnhancedBiomeSystem` computes biome blend weights and detects that two sampled biomes form an incompatible pair, THE EnhancedBiomeSystem SHALL replace the weight of the incompatible distant biome with an equal weight assigned to the intermediate biome.
4. THE BiomeCompatibilityMatrix SHALL treat DESERT–TAIGA as incompatible with PLAINS as the intermediate biome.
5. THE BiomeCompatibilityMatrix SHALL treat DESERT–TUNDRA as incompatible with PLAINS as the intermediate biome.
6. THE BiomeCompatibilityMatrix SHALL treat DESERT–FOREST as incompatible with PLAINS as the intermediate biome.
7. THE BiomeCompatibilityMatrix SHALL treat OCEAN and MOUNTAIN as incompatible with BEACH as the intermediate biome.
8. WHEN `enableCompatibilityMatrix` is false in `EnhancedBiomeConfig`, THE EnhancedBiomeSystem SHALL skip compatibility enforcement and produce weights identical to the current behaviour.
9. THE BiomeCompatibilityMatrix SHALL be serialisable to and deserialisable from a plain JSON object, such that `deserialise(serialise(matrix))` produces a matrix with identical compatibility rules.

---

### Requirement 6: Terrain-Aware Micro-Biome Placement

**User Story:** As a world-builder, I want oases and other micro-biomes to appear in geographically logical locations (terrain depressions for oases, flat clearings for forest clearings), so that micro-biomes feel like natural consequences of terrain shape rather than random noise artefacts.

#### Acceptance Criteria

1. WHEN placing an OASIS micro-biome in a DESERT parent biome, THE EnhancedBiomeSystem SHALL only place the oasis at positions where the local terrain height is below the neighbourhood average height by at least a configurable `depressionDepthThreshold` (default 0.05).
2. WHEN placing a CLEARING micro-biome in a FOREST parent biome, THE EnhancedBiomeSystem SHALL only place the clearing at positions where the terrain gradient magnitude is below a configurable `clearingGradientThreshold` (default 0.03).
3. WHEN placing a POND micro-biome in a PLAINS parent biome, THE EnhancedBiomeSystem SHALL only place the pond at positions where the local terrain height is below the neighbourhood average height by at least `depressionDepthThreshold`.
4. WHEN placing a GROVE micro-biome in a TUNDRA parent biome, THE EnhancedBiomeSystem SHALL only place the grove at positions where the terrain gradient magnitude is below `clearingGradientThreshold`.
5. IF a candidate micro-biome position does not satisfy the terrain condition for its type, THEN THE EnhancedBiomeSystem SHALL not place a micro-biome at that position.
6. THE EnhancedBiomeSystem SHALL expose `depressionDepthThreshold` and `clearingGradientThreshold` as configuration parameters in `EnhancedBiomeConfig`.
7. WHEN both `depressionDepthThreshold` and `clearingGradientThreshold` are 0, THE EnhancedBiomeSystem SHALL place micro-biomes using only the existing noise-threshold logic, preserving backward compatibility.

---

### Requirement 7: Configuration and Backward Compatibility

**User Story:** As a library consumer, I want all new climate and biome improvements to be opt-in via configuration flags, so that existing worlds generated with the current system are not affected.

#### Acceptance Criteria

1. THE EnhancedBiomeConfig SHALL include an `enableClimateSystem` boolean flag (default false) that activates the ClimateSystem for temperature and moisture computation.
2. WHEN `enableClimateSystem` is false, THE EnhancedBiomeSystem SHALL compute temperature and moisture using the existing noise-only path in BiomeSystem, producing bit-identical results to the current implementation.
3. THE EnhancedBiomeConfig SHALL include an `enableCompatibilityMatrix` boolean flag (default false) that activates biome compatibility enforcement.
4. THE EnhancedBiomeConfig SHALL include a `climateConfig` sub-object grouping all ClimateSystem parameters: `latitudeGradientStrength`, `climateScale`, `detailScale`, `climateDetailBlend`, `altitudeCoolingThreshold`, `altitudeCoolingRate`, `valleyGradientThreshold`, and `valleyMoistureBonus`.
5. THE WorldConfig SHALL remain unchanged; all new parameters SHALL be nested within `enhancedBiomeConfig`.
6. WHEN `enhancedBiomeConfig` is absent from `WorldConfig`, THE ChunkManager SHALL use the existing `BiomeSystem` path without any climate computation, preserving full backward compatibility.

---

### Requirement 8: Determinism and Performance

**User Story:** As a library consumer, I want biome generation with the new climate system to remain deterministic and meet the existing performance target, so that worlds are reproducible and generation stays within the <100 ms per-chunk budget.

#### Acceptance Criteria

1. THE ClimateSystem SHALL produce identical temperature and moisture values for the same world position, seed, and configuration across multiple calls and across different JavaScript runtimes.
2. THE EnhancedBiomeSystem SHALL produce identical biome maps for the same chunk coordinates, seed, and configuration on repeated calls.
3. WHEN generating a 32×32 chunk with all new climate features enabled, THE ChunkManager SHALL complete generation in under 100 milliseconds on a modern desktop browser.
4. THE ClimateSystem SHALL not allocate heap objects per-tile during temperature or moisture computation; all intermediate values SHALL be computed using stack-local numeric variables.
5. THE BiomeCompatibilityMatrix SHALL resolve intermediate biomes in O(1) time using a pre-computed lookup table.
