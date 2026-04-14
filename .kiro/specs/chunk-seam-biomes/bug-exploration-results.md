# Bug Condition Exploration Results

## Test Execution Summary

**Date**: Task 1 Execution  
**Status**: ✅ Test FAILED as expected (confirms bug exists)  
**Test File**: `tests/property/chunk-boundary-biome-discontinuity.property.test.ts`

## Purpose

This document records the counterexamples found during bug condition exploration testing. The test was designed to FAIL on unfixed code to prove the bug exists. The failures confirm that biome values and blend weights are NOT continuous across chunk boundaries, causing visible seams.

## Counterexamples Found

### 1. Horizontal Boundary Discontinuity

**Test**: Property 1 - Biome values should be continuous across horizontal chunk boundaries

**Counterexample**:
- Seed: 1000
- Adjacent Chunks: (-1, -2) and (0, -2)
- Boundary Position: Y = 0
- Result: Biome values and/or blend weights differ significantly at the shared boundary

**Observation**: When comparing the right edge of chunk (-1, -2) with the left edge of chunk (0, -2), the biome data shows discontinuities. The blend weights differ by more than the 15% tolerance threshold, indicating an abrupt transition rather than a smooth blend.

### 2. Vertical Boundary Discontinuity

**Test**: Property 1 - Biome values should be continuous across vertical chunk boundaries

**Counterexample**:
- Seed: 4840
- Adjacent Chunks: (0, 0) and (0, 1)
- Boundary Position: X = 31
- Result: Biome values and/or blend weights differ significantly at the shared boundary

**Observation**: When comparing the bottom edge of chunk (0, 0) with the top edge of chunk (0, 1), the biome data shows discontinuities. This confirms the bug affects both horizontal and vertical chunk boundaries.

### 3. Corner Boundary Discontinuity

**Test**: Property 1 - Biome blend weights should be continuous at corner boundaries

**Counterexample**:
- Seed: 1000
- Four-way Junction: Chunks (0, 0), (1, 0), (0, 1), (1, 1)
- Result: Blend weights at the corner positions (where 4 chunks meet) are NOT continuous

**Observation**: At the 4-way junction where four chunks meet, the blend weights show discontinuities between adjacent corners. This is particularly problematic as it creates visible artifacts at chunk intersections.

## Root Cause Analysis

Based on the design document and test results, the root cause is:

**Height Sampling Issue in Biome Blending**:
- The `getBiomeWeights()` method uses the same height value for all sampled positions
- Different positions have different heights, but the method uses only the center position's height
- When sampling across chunk boundaries, this causes incorrect biome classification
- The incorrect classification manifests as visible seams at chunk edges

**Example**:
```typescript
// Current (incorrect) behavior:
getBiomeWeights(x, y, height) {
  for (let dy = -radius; dy <= radius; dy += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      const sampleX = x + dx;
      const sampleY = y + dy;
      const biome = this.getBiome(sampleX, sampleY, height); // Uses same height for all samples!
      // ...
    }
  }
}
```

The height at position (x, y) is different from the height at position (x+dx, y+dy), but the current implementation uses the same height value for all samples. This causes incorrect biome classification, especially at chunk boundaries where height variations are more pronounced.

## Expected Behavior After Fix

After implementing the fix (Tasks 3.1-3.4), these same tests should PASS, confirming:
- Biome values are continuous across horizontal chunk boundaries
- Biome values are continuous across vertical chunk boundaries
- Blend weights are continuous at corner boundaries (4-way junctions)
- No visible seams in rendered terrain

## Next Steps

1. ✅ Task 1 Complete: Bug condition exploration test written and run on unfixed code
2. ⏭️ Task 2: Write preservation property tests (before implementing fix)
3. ⏭️ Task 3: Implement the fix (3.1-3.4)
4. ⏭️ Task 3.5: Re-run this test to verify it now passes
5. ⏭️ Task 3.6: Verify preservation tests still pass

## Test Implementation Details

The property-based tests use fast-check to generate random test cases:
- 50 test runs for horizontal and vertical boundary tests
- 30 test runs for corner boundary tests (more expensive)
- Tests generate random seeds, chunk coordinates, and boundary positions
- Tests compare biome values and blend weights at shared boundary positions
- Tolerance: 15% for edge boundaries, 20% for corners

The tests are scoped to positions near chunk boundaries (within blendRadius distance) as specified in the bug condition definition.
