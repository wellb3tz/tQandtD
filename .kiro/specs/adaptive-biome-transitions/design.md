# Design Document: Adaptive Biome Transitions

## Overview

The Adaptive Biome Transitions feature enhances the existing `BiomeSystem.getBiomeWeights()` method to create terrain-aware transitions that adapt to local topography. The current implementation uses a uniform 3x3 grid sampling pattern with fixed blend radius, producing identical transition widths regardless of terrain characteristics. This results in unrealistic blending where steep mountain slopes have the same gradual transitions as flat plains.

The new system introduces:
1. **Terrain gradient calculation** from heightmap samples
2. **Adaptive blend radius** that narrows on steep terrain and widens on flat areas
3. **Height-aware weighting** that reduces blend contributions across elevation boundaries
4. **Intelligent sampling** that adjusts density based on terrain complexity
5. **Performance optimizations** including gradient caching and sample reuse

The implementation maintains backward compatibility through an opt-in configuration flag and preserves the existing public API.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      BiomeSystem                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  getBiomeWeights(x, y, getHeight)                      │ │
│  │    ↓                                                    │ │
│  │  [Check enableAdaptiveTransitions flag]                │ │
│  │    ↓                                                    │ │
│  │  ┌──────────────────┐  ┌──────────────────────────┐   │ │
│  │  │ Legacy Path      │  │ Adaptive Path            │   │ │
│  │  │ (uniform radius) │  │ (terrain-aware)          │   │ │
│  │  └──────────────────┘  └──────────────────────────┘   │ │
│  │                           ↓                             │ │
│  │                    ┌──────────────────────┐            │ │
│  │                    │ calculateGradient()  │            │ │
│  │                    └──────────────────────┘            │ │
│  │                           ↓                             │ │
│  │                    ┌──────────────────────┐            │ │
│  │                    │ computeAdaptiveRadius│            │ │
│  │                    └──────────────────────┘            │ │
│  │                           ↓                             │ │
│  │                    ┌──────────────────────┐            │ │
│  │                    │ determineSampleCount │            │ │
│  │                    └──────────────────────┘            │ │
│  │                           ↓                             │ │
│  │                    ┌──────────────────────┐            │ │
│  │                    │ sampleWithWeighting  │            │ │
│  │                    └──────────────────────┘            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Input**: World position (x, y), height callback, configuration
2. **Gradient Calculation**: Sample 4 cardinal neighbors to compute terrain slope
3. **Adaptive Radius**: Apply formula `baseRadius / (1 + gradient * sharpnessFactor)`
4. **Complexity Analysis**: Calculate elevation standard deviation in sampling region
5. **Sample Count**: Determine grid size (2x2, 3x3, 4x4, or 5x5) based on complexity
6. **Weighted Sampling**: Sample biomes with distance and elevation weighting
7. **Output**: Normalized biome weight map

### Integration Points

- **BiomeSystem**: Extends existing class with new private methods
- **BiomeConfig**: Adds optional adaptive transition configuration fields
- **EnhancedBiomeSystem**: Inherits adaptive behavior automatically
- **ChunkManager**: Passes configuration through WorldConfig
- **TerrainGenerator**: Provides height callback for sampling

## Components and Interfaces

### Configuration Interface Extension

```typescript
export interface BiomeConfig {
  // Existing fields
  temperatureScale: number;
  moistureScale: number;
  blendRadius: number;
  
  // New adaptive transition fields
  enableAdaptiveTransitions?: boolean;
  transitionSharpnessFactor?: number;
  baseBlendRadius?: number;
  elevationSensitivity?: number;
  biomeTransitionOverrides?: Map<string, number>;
}
```

### Internal Data Structures

```typescript
interface GradientCache {
  position: { x: number; y: number };
  gradient: number;
  timestamp: number;
}

interface HeightSampleCache {
  position: { x: number; y: number };
  height: number;
  timestamp: number;
}

interface TransitionDebugData {
  position: { x: number; y: number };
  adaptiveRadius: number;
  gradient: number;
  category: 'narrow' | 'medium' | 'wide';
  sampleCount: number;
}
```

### Private Methods

```typescript
class BiomeSystem {
  private gradientCache: Map<string, GradientCache>;
  private heightCache: Map<string, HeightSampleCache>;
  private debugData: TransitionDebugData[];
  
  private calculateGradient(
    x: number, 
    y: number, 
    getHeight: (x: number, y: number) => number
  ): number;
  
  private computeAdaptiveRadius(
    gradient: number, 
    baseRadius: number, 
    sharpnessFactor: number
  ): number;
  
  private analyzeTerrainComplexity(
    x: number, 
    y: number, 
    radius: number,
    getHeight: (x: number, y: number) => number
  ): number;
  
  private determineSampleCount(complexity: number): number;
  
  private applyElevationWeighting(
    weight: number, 
    heightDiff: number, 
    sensitivity: number
  ): number;
  
  private getBiomePairKey(biome1: BiomeType, biome2: BiomeType): string;
  
  private getCachedGradient(x: number, y: number): number | undefined;
  
  private setCachedGradient(x: number, y: number, gradient: number): void;
  
  private getCachedHeight(x: number, y: number): number | undefined;
  
  private setCachedHeight(x: number, y: number, height: number): void;
  
  private clearCaches(): void;
}
```

## Data Models

### Gradient Representation

Terrain gradient is represented as a scalar magnitude (non-negative number) calculated from the slope vector:

```
gradient = sqrt((dh/dx)² + (dh/dy)²)
```

Where derivatives are approximated using central differences:
- `dh/dx ≈ (h(x+1, y) - h(x-1, y)) / 2`
- `dh/dy ≈ (h(x, y+1) - h(x, y-1)) / 2`

**Range**: [0, ∞)
- 0 = perfectly flat terrain
- 0.1 = gentle slope (10% grade)
- 0.5 = moderate slope (50% grade)
- 1.0+ = steep slope (100%+ grade)

### Adaptive Radius Formula

```
adaptiveRadius = baseRadius / (1 + gradient * sharpnessFactor)
```

**Parameters**:
- `baseRadius`: Maximum blend radius on flat terrain (default: 25.0)
- `gradient`: Terrain gradient magnitude
- `sharpnessFactor`: Sensitivity to gradient (default: 2.0, range: 0.0-10.0)

**Behavior**:
- Flat terrain (gradient ≈ 0): `adaptiveRadius ≈ baseRadius`
- Steep terrain (gradient = 1.0, sharpness = 2.0): `adaptiveRadius = baseRadius / 3`
- Very steep (gradient = 2.0, sharpness = 2.0): `adaptiveRadius = baseRadius / 5`

### Elevation Weighting Function

```
elevationWeight = 1 / (1 + (heightDiff / sensitivity)²)
```

**Parameters**:
- `heightDiff`: Absolute elevation difference between sample and target
- `sensitivity`: Controls how quickly weight decreases (default: 5.0)

**Behavior**:
- Same elevation (diff = 0): weight = 1.0 (no reduction)
- Small difference (diff = 2.5, sens = 5.0): weight ≈ 0.8
- Large difference (diff = 10.0, sens = 5.0): weight ≈ 0.2

### Terrain Complexity Metric

```
complexity = standardDeviation(heightSamples)
```

Calculated from 9 preliminary height samples in a 3x3 grid.

**Sample Count Mapping**:
- Low complexity (σ < 1.0): 4-9 samples (2x2 or 3x3 grid)
- Medium complexity (1.0 ≤ σ < 3.0): 9 samples (3x3 grid)
- High complexity (σ ≥ 3.0): 16-25 samples (4x4 or 5x5 grid)

### Cache Key Format

Position-based cache keys use string concatenation for O(1) Map lookup:

```typescript
const key = `${Math.floor(x * 10) / 10},${Math.floor(y * 10) / 10}`;
```

Positions are rounded to 0.1 unit precision to increase cache hit rate while maintaining accuracy.

### Biome Pair Override Key

Biome pairs are represented as unordered keys:

```typescript
function getBiomePairKey(b1: BiomeType, b2: BiomeType): string {
  const [min, max] = b1 < b2 ? [b1, b2] : [b2, b1];
  return `${min}-${max}`;
}
```

This ensures `(FOREST, DESERT)` and `(DESERT, FOREST)` map to the same override.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following consolidations to eliminate redundancy:

**Consolidated Properties:**
- **Gradient calculation correctness** (1.1, 1.2): Combined into single property verifying gradient formula
- **Caching behavior** (1.5, 7.2): Combined into single property about cache reuse
- **Adaptive radius bounds** (2.2, 2.3): Combined into single property verifying radius ranges for different gradients
- **Elevation weighting behavior** (3.3, 3.5, 3.6): Combined into single property about weight reduction based on elevation difference
- **Sample count adaptation** (4.3, 4.4, 4.5): Combined into single property mapping complexity to sample count
- **Determinism** (9.4, 10.1, 10.4): Combined into single comprehensive determinism property
- **Backward compatibility** (9.1, 9.3): Combined into single property about disabled feature behavior

**Properties Excluded** (not suitable for property-based testing):
- Performance tests (1.4, 4.7, 7.1, 7.6): Integration tests
- Configuration structure tests (5.1-5.5, 6.1, 6.2, 8.1-8.6): Example-based unit tests
- Implementation details (7.5, 10.2, 10.3, 10.5): Code review or example tests
- Test suite execution (9.5): Integration test

### Property 1: Gradient Calculation Correctness

*For any* position (x, y) and heightmap function, the calculated terrain gradient SHALL equal the Euclidean norm of the slope vector computed from cardinal neighbor samples at distance 1.0: `gradient = sqrt((dh/dx)² + (dh/dy)²)` where `dh/dx = (h(x+1,y) - h(x-1,y)) / 2` and `dh/dy = (h(x,y+1) - h(x,y-1)) / 2`.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Adaptive Radius Formula Correctness

*For any* valid terrain gradient g, base radius b, and sharpness factor s, the computed adaptive radius SHALL equal exactly `b / (1 + g * s)`.

**Validates: Requirements 2.1**

### Property 3: Adaptive Radius Bounds

*For any* terrain gradient and valid configuration, the adaptive radius SHALL be between 5 and 10 tiles when gradient is high (≥ 1.0 with default sharpness), and between 20 and 30 tiles when gradient is low (≤ 0.1 with default sharpness).

**Validates: Requirements 2.2, 2.3**

### Property 4: Adaptive Radius Validity

*For all* valid terrain gradients (≥ 0) and configuration parameters (baseRadius > 0, 0 ≤ sharpnessFactor ≤ 10), the computed adaptive radius SHALL be a positive finite number.

**Validates: Requirements 2.7**

### Property 5: Configuration Validation

*For any* configuration object, the system SHALL accept values within valid ranges (sharpnessFactor: 0-10, baseRadius > 0, elevationSensitivity > 0, multipliers: 0.1-3.0) and reject invalid values with descriptive error messages.

**Validates: Requirements 2.5, 5.7, 6.4**

### Property 6: Sharpness Factor Zero Edge Case

*For any* terrain gradient and base radius, when sharpness factor is 0.0, the adaptive radius SHALL equal the base radius (producing uniform transitions).

**Validates: Requirements 2.6**

### Property 7: Default Configuration Application

*For any* configuration object with omitted optional fields, the system SHALL apply documented default values (baseRadius: 25.0, sharpnessFactor: 2.0, elevationSensitivity: 5.0, enableAdaptiveTransitions: true).

**Validates: Requirements 5.8**

### Property 8: Elevation Difference Calculation

*For any* two height values h1 and h2, the computed elevation difference SHALL equal the absolute difference |h1 - h2|.

**Validates: Requirements 3.2**

### Property 9: Elevation-Based Weight Reduction

*For any* sample point with elevation difference d and sensitivity s, the weight contribution SHALL be reduced according to the formula `weight * (1 / (1 + (d/s)²))`, where larger differences produce greater reduction.

**Validates: Requirements 3.3, 3.5, 3.6**

### Property 10: Terrain Complexity Calculation

*For any* set of elevation samples within a sampling region, the computed terrain complexity SHALL equal the standard deviation of those elevation values.

**Validates: Requirements 4.2**

### Property 11: Sample Count Adaptation

*For any* terrain complexity value c, the determined sample count SHALL be: 4-9 samples when c < 1.0, 9 samples when 1.0 ≤ c < 3.0, and 16-25 samples when c ≥ 3.0, with a maximum of 25 samples regardless of complexity.

**Validates: Requirements 4.3, 4.4, 4.5, 7.4**

### Property 12: Grid Sample Distribution

*For any* target position and adaptive radius, the sample positions SHALL form a regular grid pattern centered on the target position with spacing determined by radius and sample count.

**Validates: Requirements 4.6**

### Property 13: Biome Pair Override Application

*For any* biome pair (A, B) with a configured override multiplier m, the adaptive radius SHALL be multiplied by m when calculating weights between those biomes.

**Validates: Requirements 6.3**

### Property 14: Biome Pair Override Fallback

*For any* biome pair without a configured override, the system SHALL use the standard adaptive radius calculation without modification.

**Validates: Requirements 6.5**

### Property 15: Biome Pair Symmetry

*For any* two biomes A and B, the biome pair key and override behavior SHALL be identical regardless of order: (A, B) ≡ (B, A).

**Validates: Requirements 6.6**

### Property 16: Gradient Cache Reuse

*For any* position that is sampled multiple times during a single operation, the gradient calculation SHALL be performed only once and subsequent accesses SHALL return the cached value.

**Validates: Requirements 1.5, 7.2**

### Property 17: Height Sample Cache Reuse

*For any* two positions within 2.0 world units of each other sampled during the same operation, the system SHALL reuse height samples when possible to minimize getHeight callback invocations.

**Validates: Requirements 7.3**

### Property 18: Backward Compatibility with Feature Disabled

*For any* input (position, seed, heightmap) when enableAdaptiveTransitions is false, the system SHALL produce biome weights identical to the original uniform transition implementation.

**Validates: Requirements 9.1, 9.3, 5.6**

### Property 19: Deterministic Behavior

*For all* identical inputs (position, seed, configuration, heightmap), repeated calls to getBiomeWeights SHALL produce bit-identical output, with no dependence on non-deterministic random number generation, system time, or external state.

**Validates: Requirements 9.4, 10.1, 10.4**

## Error Handling

### Input Validation

The system validates all configuration parameters at construction time:

```typescript
constructor(seed: number, config: BiomeConfig) {
  // Validate adaptive transition parameters if provided
  if (config.enableAdaptiveTransitions !== false) {
    if (config.baseBlendRadius !== undefined) {
      if (config.baseBlendRadius <= 0) {
        throw new Error('baseBlendRadius must be positive');
      }
    }
    
    if (config.transitionSharpnessFactor !== undefined) {
      if (config.transitionSharpnessFactor < 0 || 
          config.transitionSharpnessFactor > 10) {
        throw new Error('transitionSharpnessFactor must be between 0 and 10');
      }
    }
    
    if (config.elevationSensitivity !== undefined) {
      if (config.elevationSensitivity <= 0) {
        throw new Error('elevationSensitivity must be positive');
      }
    }
    
    if (config.biomeTransitionOverrides !== undefined) {
      for (const [pair, multiplier] of config.biomeTransitionOverrides) {
        if (multiplier < 0.1 || multiplier > 3.0) {
          throw new Error(
            `Biome pair override multiplier for ${pair} must be between 0.1 and 3.0`
          );
        }
      }
    }
  }
  
  // Initialize with validated config
  // ...
}
```

### Runtime Error Handling

**Gradient Calculation Errors:**
- If getHeight callback throws, propagate error with context
- If gradient calculation produces NaN/Infinity, clamp to valid range [0, 10]

**Cache Overflow:**
- Implement LRU eviction when cache exceeds 1000 entries
- Clear caches between chunk generations to prevent memory leaks

**Numerical Stability:**
- Use epsilon comparisons for floating-point equality (ε = 1e-10)
- Clamp intermediate values to prevent overflow in weight calculations
- Handle division by zero in weight normalization (return uniform weights)

### Error Messages

All validation errors include:
1. Parameter name that failed validation
2. Actual value provided
3. Valid range or constraint
4. Suggested fix

Example: `"transitionSharpnessFactor must be between 0 and 10 (got: 15.5). Use a value in range [0, 10] to control transition sharpness."`

## Testing Strategy

### Dual Testing Approach

This feature requires both property-based tests and example-based unit tests for comprehensive coverage:

**Property-Based Tests** (using fast-check):
- Test universal properties that must hold for all valid inputs
- Verify mathematical correctness of formulas
- Validate invariants (e.g., positive radius, determinism)
- Test edge cases through random generation
- Minimum 100 iterations per property test

**Unit Tests** (using Vitest):
- Test specific configuration scenarios
- Verify error messages for invalid inputs
- Test debug visualization output structure
- Verify API compatibility
- Test integration with existing BiomeSystem

### Property-Based Testing Configuration

Each property test will:
1. Use fast-check generators for input randomization
2. Run minimum 100 iterations (configured via `fc.assert` numRuns parameter)
3. Include a comment tag referencing the design property
4. Use appropriate shrinking for failure case minimization

**Example Property Test Structure:**

```typescript
import fc from 'fast-check';

// Feature: adaptive-biome-transitions, Property 2: Adaptive Radius Formula Correctness
test('adaptive radius formula correctness', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 10, noNaN: true }), // gradient
      fc.double({ min: 1, max: 100, noNaN: true }), // baseRadius
      fc.double({ min: 0, max: 10, noNaN: true }), // sharpnessFactor
      (gradient, baseRadius, sharpnessFactor) => {
        const expected = baseRadius / (1 + gradient * sharpnessFactor);
        const actual = computeAdaptiveRadius(gradient, baseRadius, sharpnessFactor);
        expect(actual).toBeCloseTo(expected, 10);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Custom Generators

**Heightmap Generator:**
```typescript
const heightmapArbitrary = fc.func(fc.double({ min: 0, max: 1 }));
```

**Terrain Gradient Generator:**
```typescript
const gradientArbitrary = fc.double({ min: 0, max: 5, noNaN: true });
```

**Configuration Generator:**
```typescript
const configArbitrary = fc.record({
  enableAdaptiveTransitions: fc.boolean(),
  baseBlendRadius: fc.double({ min: 5, max: 50 }),
  transitionSharpnessFactor: fc.double({ min: 0, max: 10 }),
  elevationSensitivity: fc.double({ min: 1, max: 20 }),
});
```

**Biome Pair Generator:**
```typescript
const biomePairArbitrary = fc.tuple(
  fc.constantFrom(...Object.values(BiomeType)),
  fc.constantFrom(...Object.values(BiomeType))
);
```

### Unit Test Coverage

**Configuration Tests:**
- Default values are applied correctly
- Invalid configurations are rejected with appropriate errors
- Optional fields can be omitted
- Biome pair overrides are parsed correctly

**Debug Visualization Tests:**
- Debug data is collected when enabled
- Debug data has correct structure
- No performance overhead when disabled

**Integration Tests:**
- Performance: 32x32 chunk generation completes within 100ms
- Memory: Cache overhead stays under 10KB per chunk
- Compatibility: Existing test suite passes with feature disabled

### Test Organization

```
tests/
├── unit/
│   ├── adaptive-radius.test.ts          # Property tests for radius calculation
│   ├── gradient-calculation.test.ts     # Property tests for gradient
│   ├── elevation-weighting.test.ts      # Property tests for elevation
│   ├── sample-adaptation.test.ts        # Property tests for sampling
│   ├── caching.test.ts                  # Property tests for cache behavior
│   ├── determinism.test.ts              # Property tests for determinism
│   ├── configuration.test.ts            # Unit tests for config validation
│   └── debug-visualization.test.ts      # Unit tests for debug output
├── integration/
│   ├── performance.test.ts              # Performance benchmarks
│   ├── backward-compatibility.test.ts   # Compatibility verification
│   └── end-to-end.test.ts              # Full chunk generation
```

### Continuous Integration

- Run all tests on every commit
- Generate coverage report (target: >90% line coverage)
- Run performance benchmarks on main branch
- Fail build if any property test fails
- Fail build if performance regresses >10%

## Implementation Notes

### Performance Considerations

**Cache Strategy:**
- Use Map<string, T> for O(1) lookups with position-based keys
- Round positions to 0.1 unit precision for cache key generation
- Implement LRU eviction when cache exceeds 1000 entries
- Clear caches between chunk generations to prevent memory leaks
- Cache lifetime: single chunk generation operation

**Optimization Techniques:**
1. **Early termination**: Skip adaptive logic when feature is disabled
2. **Lazy evaluation**: Calculate gradient only when needed
3. **Sample reuse**: Share height samples between nearby positions
4. **Vectorization**: Batch height queries when possible
5. **Complexity gating**: Use cheaper 2x2 grid on flat terrain

**Memory Budget:**
- Gradient cache: ~40 bytes per entry × 100 entries = 4KB
- Height cache: ~40 bytes per entry × 100 entries = 4KB
- Debug data: ~80 bytes per position × 25 positions = 2KB
- Total: ~10KB per chunk (within requirement)

### Algorithm Pseudocode

```
function getBiomeWeights(x, y, getHeight):
  if not config.enableAdaptiveTransitions:
    return legacyGetBiomeWeights(x, y, getHeight)
  
  // Calculate terrain gradient
  gradient = getCachedGradient(x, y) ?? calculateGradient(x, y, getHeight)
  
  // Compute adaptive radius
  baseRadius = config.baseBlendRadius ?? 25.0
  sharpness = config.transitionSharpnessFactor ?? 2.0
  adaptiveRadius = baseRadius / (1 + gradient * sharpness)
  
  // Analyze terrain complexity
  complexity = analyzeTerrainComplexity(x, y, adaptiveRadius, getHeight)
  sampleCount = determineSampleCount(complexity)
  
  // Generate sample grid
  gridSize = sqrt(sampleCount)
  step = adaptiveRadius / gridSize
  samples = generateGridSamples(x, y, gridSize, step)
  
  // Calculate weighted biome distribution
  weights = new Map()
  totalWeight = 0
  targetHeight = getHeight(x, y)
  
  for each sample in samples:
    sampleHeight = getCachedHeight(sample.x, sample.y) ?? getHeight(sample.x, sample.y)
    biome = getBiome(sample.x, sample.y, sampleHeight)
    
    // Distance weighting
    distance = sqrt((sample.x - x)² + (sample.y - y)²)
    distanceWeight = distance == 0 ? 1 : 1 / (1 + distance)
    
    // Elevation weighting
    heightDiff = abs(sampleHeight - targetHeight)
    sensitivity = config.elevationSensitivity ?? 5.0
    elevationWeight = 1 / (1 + (heightDiff / sensitivity)²)
    
    // Combined weight
    weight = distanceWeight * elevationWeight
    
    // Apply biome pair override if exists
    primaryBiome = getBiome(x, y, targetHeight)
    pairKey = getBiomePairKey(primaryBiome, biome)
    if config.biomeTransitionOverrides.has(pairKey):
      multiplier = config.biomeTransitionOverrides.get(pairKey)
      weight *= multiplier
    
    weights[biome] += weight
    totalWeight += weight
  
  // Normalize weights
  for each biome in weights:
    weights[biome] /= totalWeight
  
  // Collect debug data if enabled
  if config.debugMode:
    collectDebugData(x, y, adaptiveRadius, gradient, sampleCount)
  
  return weights
```

### Integration Steps

1. **Extend BiomeConfig interface** with new optional fields
2. **Add private methods** to BiomeSystem class:
   - `calculateGradient()`
   - `computeAdaptiveRadius()`
   - `analyzeTerrainComplexity()`
   - `determineSampleCount()`
   - `applyElevationWeighting()`
   - Cache management methods
3. **Modify getBiomeWeights()** to branch on `enableAdaptiveTransitions` flag
4. **Add validation** in BiomeSystem constructor
5. **Initialize caches** as private class members
6. **Add debug data collection** conditionally
7. **Update documentation** with new configuration options
8. **Add TypeScript types** for debug data structures

### Backward Compatibility Strategy

**API Preservation:**
- No changes to method signatures
- No changes to return types
- No changes to existing BiomeConfig required fields

**Behavioral Preservation:**
- Default `enableAdaptiveTransitions: false` (opt-in)
- When disabled, use original algorithm exactly
- Existing code works without modification

**Migration Path:**
```typescript
// Before (still works)
const biomeSystem = new BiomeSystem(seed, {
  temperatureScale: 200,
  moistureScale: 200,
  blendRadius: 15
});

// After (opt-in to new feature)
const biomeSystem = new BiomeSystem(seed, {
  temperatureScale: 200,
  moistureScale: 200,
  blendRadius: 15,
  enableAdaptiveTransitions: true,
  baseBlendRadius: 25.0,
  transitionSharpnessFactor: 2.0,
  elevationSensitivity: 5.0
});
```

### Edge Cases

**Extreme Gradients:**
- Very steep (gradient > 10): Clamp to prevent radius < 1
- Perfectly flat (gradient = 0): Use base radius

**Degenerate Heightmaps:**
- Constant height: Complexity = 0, use minimum samples
- NaN/Infinity heights: Throw descriptive error

**Cache Edge Cases:**
- First access: Cache miss, calculate and store
- Cache full: Evict LRU entry
- Between chunks: Clear all caches

**Numerical Edge Cases:**
- Division by zero in normalization: Return uniform weights
- Floating-point precision: Use epsilon comparisons (1e-10)
- Overflow in weight accumulation: Use double precision

### Debug Visualization Format

```typescript
interface TransitionDebugData {
  position: { x: number; y: number };
  adaptiveRadius: number;
  gradient: number;
  category: 'narrow' | 'medium' | 'wide';
  sampleCount: number;
  complexity: number;
  samples: Array<{
    position: { x: number; y: number };
    biome: BiomeType;
    weight: number;
    distanceWeight: number;
    elevationWeight: number;
  }>;
}
```

**Visualization Rendering:**
- Color code by category: Red (narrow), Yellow (medium), Green (wide)
- Overlay on terrain with transparency
- Show sample points as dots
- Display radius as circle
- Include tooltip with detailed metrics

## Design Review Checklist

### Requirements Coverage
- ✓ All 10 requirements addressed in design
- ✓ All acceptance criteria mapped to components
- ✓ Edge cases identified and handled

### Architecture
- ✓ Clear component boundaries
- ✓ Integration points documented
- ✓ Data flow diagrams provided
- ✓ Backward compatibility preserved

### Correctness Properties
- ✓ 19 properties identified from requirements
- ✓ All properties universally quantified
- ✓ Requirements traceability maintained
- ✓ Property reflection performed to eliminate redundancy

### Testing Strategy
- ✓ Property-based tests specified (fast-check)
- ✓ Unit tests specified (Vitest)
- ✓ Integration tests specified
- ✓ Custom generators defined
- ✓ Minimum 100 iterations per property test
- ✓ Test organization structure provided

### Performance
- ✓ <100ms per chunk target addressed
- ✓ Caching strategy defined
- ✓ Memory budget calculated (<10KB)
- ✓ Optimization techniques listed

### Error Handling
- ✓ Input validation specified
- ✓ Runtime error handling defined
- ✓ Error messages documented
- ✓ Edge cases covered

### Implementation Guidance
- ✓ Algorithm pseudocode provided
- ✓ Integration steps outlined
- ✓ Migration path documented
- ✓ Debug visualization format specified

---

**Design Status**: Ready for implementation

**Next Steps**:
1. User review and approval of design
2. Create implementation tasks
3. Set up test infrastructure
4. Begin implementation following TDD approach
