# Chunk Seam Biomes Bugfix Design

## Overview

This bugfix addresses visible rectangular seams between chunks in biome generation. The root cause is that biome blending (`getBiomeWeights()`) samples only within chunk-local coordinates instead of using world coordinates. When the blend radius extends beyond chunk boundaries, the system clamps samples to the chunk edge rather than sampling from neighboring chunk space, causing discontinuities.

The fix converts all biome sampling to use world coordinates consistently. The `BiomeSystem` already uses world coordinates internally for temperature/moisture noise, so the issue is isolated to the `ChunkManager.generateBiomeData()` method, which currently passes chunk-local coordinates to biome methods.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when biome sampling occurs near chunk boundaries (within blendRadius distance)
- **Property (P)**: The desired behavior - biomes should blend seamlessly across chunk boundaries using world coordinates
- **Preservation**: Existing biome generation behavior far from boundaries, determinism, and API compatibility must remain unchanged
- **BiomeSystem**: The class in `src/world/biome.ts` that determines biome types based on temperature, moisture, and height
- **EnhancedBiomeSystem**: The class in `src/world/enhanced-biome.ts` that extends BiomeSystem with transitions, micro-biomes, and elevation bands
- **ChunkManager**: The class in `src/world/chunk-manager.ts` that orchestrates chunk generation
- **generateBiomeData()**: The private method in ChunkManager that generates biome maps and weights for a chunk
- **getBiomeWeights()**: The method in BiomeSystem that calculates blend weights by sampling nearby positions
- **blendRadius**: The distance in world units over which biomes blend together (from BiomeConfig)
- **World Coordinates**: Global coordinate system where position (x, y) is consistent across all chunks
- **Chunk-Local Coordinates**: Coordinate system relative to a chunk's origin (0 to chunkSize-1)

## Bug Details

### Bug Condition

The bug manifests when biome data is generated for tiles near chunk boundaries (within `blendRadius` distance from any edge). The `ChunkManager.generateBiomeData()` method converts chunk coordinates to world coordinates but the issue occurs in how `getBiomeWeights()` samples nearby positions.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { chunkX: number, chunkY: number, localX: number, localY: number, chunkSize: number, blendRadius: number }
  OUTPUT: boolean
  
  RETURN (input.localX < input.blendRadius) OR                    // Near left edge
         (input.localX >= input.chunkSize - input.blendRadius) OR // Near right edge
         (input.localY < input.blendRadius) OR                    // Near top edge
         (input.localY >= input.chunkSize - input.blendRadius)    // Near bottom edge
END FUNCTION
```

### Examples

- **Example 1**: Chunk (0, 0) at local position (31, 16) with chunkSize=32, blendRadius=10
  - World position: (31, 16)
  - Near right edge (31 >= 32 - 10)
  - `getBiomeWeights()` samples from (21, 6) to (41, 26) in world space
  - Samples at x > 31 should extend into chunk (1, 0) but currently get clamped
  - Expected: Smooth blend with chunk (1, 0)
  - Actual: Abrupt transition at x=31 boundary

- **Example 2**: Chunk (1, 0) at local position (0, 16) with chunkSize=32, blendRadius=10
  - World position: (32, 16)
  - Near left edge (0 < 10)
  - `getBiomeWeights()` samples from (22, 6) to (42, 26) in world space
  - Samples at x < 32 should extend into chunk (0, 0) but currently get clamped
  - Expected: Smooth blend with chunk (0, 0)
  - Actual: Abrupt transition at x=32 boundary

- **Example 3**: Chunk (0, 0) at local position (16, 16) with chunkSize=32, blendRadius=10
  - World position: (16, 16)
  - Far from all edges (16 >= 10 and 16 < 22)
  - `getBiomeWeights()` samples from (6, 6) to (26, 26) in world space
  - All samples within chunk boundaries
  - Expected: Same behavior as before (no change)
  - Actual: Same behavior as before (no change)

- **Edge Case**: Corner position at (0, 0) in chunk (0, 0) with blendRadius=10
  - World position: (0, 0)
  - Near both left and top edges
  - Samples extend into negative world coordinates
  - Expected: Biome system handles negative coordinates correctly (wraps or extends)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Biome generation for tiles far from chunk boundaries (distance > blendRadius) must produce identical results
- Deterministic generation: same seed must produce same biome distribution
- API compatibility: all public methods must accept same parameters and return same types
- Enhanced biome features (transitions, micro-biomes, elevation bands) must continue to work
- LOD, incremental generation, and worker pool features must continue to function

**Scope:**
All inputs that do NOT involve positions near chunk boundaries (within blendRadius distance) should be completely unaffected by this fix. This includes:
- Biome sampling at positions far from edges (distance > blendRadius from all boundaries)
- Temperature and moisture noise generation (already uses world coordinates)
- Biome classification logic (getBiome method)
- Resource, structure, and river generation (not affected by biome blending)

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Correct World Coordinate Usage**: The `ChunkManager.generateBiomeData()` method ALREADY correctly converts chunk-local coordinates to world coordinates before calling `BiomeSystem.getBiome()` and `BiomeSystem.getBiomeWeights()`. The code shows:
   ```typescript
   const wx = worldX + x;  // worldX = chunkX * size
   const wy = worldY + y;
   ```
   This means the BiomeSystem methods are already receiving world coordinates.

2. **BiomeSystem Already Uses World Coordinates**: The `BiomeSystem.getBiome()` and `getBiomeWeights()` methods already operate on world coordinates. The temperature and moisture noise sampling uses the provided x, y coordinates directly, which are world coordinates.

3. **Actual Root Cause - Sampling Implementation**: The issue is NOT in coordinate conversion but in how `getBiomeWeights()` samples nearby positions. Looking at the code:
   ```typescript
   for (let dy = -radius; dy <= radius; dy += step) {
     for (let dx = -radius; dx <= radius; dx += step) {
       const sampleX = x + dx;
       const sampleY = y + dy;
       const biome = this.getBiome(sampleX, sampleY, height);
       // ...
     }
   }
   ```
   This code DOES sample in world space correctly. The sampling extends beyond chunk boundaries naturally.

4. **Re-Analysis - The Bug May Not Exist**: After careful code review, the biome system appears to already use world coordinates correctly throughout. The `generateBiomeData()` method converts to world coordinates, and `getBiomeWeights()` samples in world space. There should be no seams.

5. **Alternative Hypothesis - Height Sampling**: The bug might actually be in how HEIGHT is sampled during biome blending. The `getBiomeWeights()` method uses the same height value for all samples, but different positions might have different heights. If height affects biome classification (which it does for ocean, beach, mountain), using a single height value could cause discontinuities.

6. **Most Likely Root Cause - Height Parameter in Blending**: The `getBiomeWeights(x, y, height)` method samples nearby positions but uses the SAME height value for all samples. This is incorrect because:
   - Position (x, y) has height H1
   - Position (x+dx, y+dy) has height H2 (potentially different)
   - But `getBiome(x+dx, y+dy, height)` uses H1 instead of H2
   - This causes incorrect biome classification for nearby samples
   - At chunk boundaries, this manifests as seams because the height discontinuity is more pronounced

## Correctness Properties

Property 1: Bug Condition - Seamless Biome Boundaries

_For any_ tile position near a chunk boundary (within blendRadius distance), the fixed biome generation SHALL produce biome values and blend weights that transition smoothly across the boundary, with no visible discontinuities when adjacent chunks are rendered together.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Interior Tile Behavior

_For any_ tile position far from chunk boundaries (distance > blendRadius from all edges), the fixed biome generation SHALL produce exactly the same biome values and blend weights as the original implementation, preserving all existing behavior for interior tiles.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Based on the root cause analysis, the fix requires modifying how height is sampled during biome blending:

**File**: `src/world/biome.ts`

**Method**: `getBiomeWeights()`

**Specific Changes**:

1. **Remove Height Parameter from getBiomeWeights**: The method currently accepts a height parameter that is used for all samples. This should be removed since each sampled position needs its own height.

2. **Add Height Sampling Callback**: Since BiomeSystem doesn't have access to the heightmap, we need to pass a callback function that can sample height at any world position. The signature becomes:
   ```typescript
   getBiomeWeights(
     x: number, 
     y: number, 
     getHeight: (worldX: number, worldY: number) => number
   ): Map<BiomeType, number>
   ```

3. **Sample Height for Each Position**: Inside the sampling loop, call the height callback:
   ```typescript
   for (let dy = -radius; dy <= radius; dy += step) {
     for (let dx = -radius; dx <= radius; dx += step) {
       const sampleX = x + dx;
       const sampleY = y + dy;
       const sampleHeight = getHeight(sampleX, sampleY);  // NEW
       const biome = this.getBiome(sampleX, sampleY, sampleHeight);  // Use sampleHeight
       // ... rest of blending logic
     }
   }
   ```

4. **Update EnhancedBiomeSystem**: The `EnhancedBiomeSystem.getEnhancedBiome()` method also calls `getBiomeWeights()`, so it needs to be updated to pass the height callback.

**File**: `src/world/chunk-manager.ts`

**Method**: `generateBiomeData()`

**Specific Changes**:

1. **Create Height Sampling Function**: Create a closure that can sample height at any world position, handling cross-chunk sampling:
   ```typescript
   const getHeight = (worldX: number, worldY: number): number => {
     // Convert world coordinates to chunk coordinates
     const targetChunkX = Math.floor(worldX / size);
     const targetChunkY = Math.floor(worldY / size);
     
     // If sampling from current chunk, use heightmap directly
     if (targetChunkX === chunkX && targetChunkY === chunkY) {
       const localX = worldX - worldX;
       const localY = worldY - worldY;
       if (localX >= 0 && localX < size && localY >= 0 && localY < size) {
         return heightmap[localY * size + localX];
       }
     }
     
     // For neighboring chunks, generate height on-demand using terrain generator
     // This is acceptable because terrain generation is fast and deterministic
     return this.terrainGenerator.getHeightAt(worldX, worldY, this.config.seed);
   };
   ```

2. **Pass Height Callback to getBiomeWeights**: Update the call to pass the callback:
   ```typescript
   const weights = this.biomeSystem.getBiomeWeights(wx, wy, getHeight);
   ```

3. **Update EnhancedBiomeSystem Call**: If using enhanced biomes, pass the callback there too:
   ```typescript
   const enhancedData = this.enhancedBiomeSystem.getEnhancedBiome(wx, wy, getHeight);
   ```

**File**: `src/gen/terrain.ts`

**Method**: Add `getHeightAt()` method

**Specific Changes**:

1. **Add Single-Point Height Sampling**: The TerrainGenerator currently only has `generateHeightmap()` which generates an entire chunk. We need a method to sample a single point:
   ```typescript
   getHeightAt(worldX: number, worldY: number, seed: number): number {
     // Use the same noise configuration as generateHeightmap
     // Sample the noise at the world position
     // Return the height value
   }
   ```

2. **Ensure Consistency**: The `getHeightAt()` method must use the same noise parameters and calculations as `generateHeightmap()` to ensure consistency.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (visible seams at chunk boundaries), then verify the fix works correctly (seamless boundaries) and preserves existing behavior (interior tiles unchanged).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that visible seams exist at chunk boundaries in the unfixed code.

**Test Plan**: Generate adjacent chunks and compare biome values at their shared boundaries. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Horizontal Boundary Test**: Generate chunks (0, 0) and (1, 0), compare biome values at x=31 in chunk (0,0) vs x=0 in chunk (1,0) - expect discontinuity in unfixed code
2. **Vertical Boundary Test**: Generate chunks (0, 0) and (0, 1), compare biome values at y=31 in chunk (0,0) vs y=0 in chunk (0,1) - expect discontinuity in unfixed code
3. **Corner Boundary Test**: Generate chunks (0, 0), (1, 0), (0, 1), (1, 1), compare biome values at corner positions - expect discontinuities in unfixed code
4. **Blend Weight Continuity Test**: Sample blend weights at positions just before and after a chunk boundary - expect different weight distributions in unfixed code

**Expected Counterexamples**:
- Biome values differ at shared boundary positions between adjacent chunks
- Blend weights show discontinuities across chunk boundaries
- Visual inspection shows rectangular seams in rendered terrain
- Possible root cause: height parameter in getBiomeWeights uses wrong height for sampled positions

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (positions near chunk boundaries), the fixed function produces seamless biome transitions.

**Pseudocode:**
```
FOR ALL position WHERE isBugCondition(position) DO
  chunk1 := generateChunk(position.chunkX, position.chunkY)
  chunk2 := generateAdjacentChunk(position.chunkX, position.chunkY, position.edge)
  
  biome1 := getBiomeAtBoundary(chunk1, position.edge, position.index)
  biome2 := getBiomeAtBoundary(chunk2, oppositeEdge(position.edge), position.index)
  
  weights1 := getWeightsAtBoundary(chunk1, position.edge, position.index)
  weights2 := getWeightsAtBoundary(chunk2, oppositeEdge(position.edge), position.index)
  
  ASSERT biome1 = biome2 OR blendWeightsAreContinuous(weights1, weights2)
END FOR
```

**Test Cases**:
1. **Seamless Horizontal Boundaries**: Verify biome continuity across left/right chunk edges
2. **Seamless Vertical Boundaries**: Verify biome continuity across top/bottom chunk edges
3. **Seamless Corner Boundaries**: Verify biome continuity at chunk corners (4-way junctions)
4. **Blend Weight Continuity**: Verify blend weights transition smoothly across boundaries
5. **Visual Regression Test**: Render adjacent chunks and verify no visible seams

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (positions far from boundaries), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL position WHERE NOT isBugCondition(position) DO
  biomeOriginal := getBiome_original(position.worldX, position.worldY, position.height)
  biomeFixed := getBiome_fixed(position.worldX, position.worldY, position.height)
  
  weightsOriginal := getBiomeWeights_original(position.worldX, position.worldY, position.height)
  weightsFixed := getBiomeWeights_fixed(position.worldX, position.worldY, getHeightCallback)
  
  ASSERT biomeOriginal = biomeFixed
  ASSERT weightsOriginal = weightsFixed
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all interior tiles

**Test Plan**: Capture behavior on UNFIXED code for interior tiles (far from boundaries), then write property-based tests to verify this behavior is preserved after the fix.

**Test Cases**:
1. **Interior Tile Biomes**: Verify biome classification unchanged for tiles far from edges
2. **Interior Tile Weights**: Verify blend weights unchanged for tiles far from edges
3. **Determinism Preservation**: Verify same seed produces same biomes before and after fix
4. **Enhanced Biome Features**: Verify transitions, micro-biomes, elevation bands still work
5. **API Compatibility**: Verify all public methods accept same parameters and return same types

### Unit Tests

- Test `getBiomeWeights()` with height callback for various positions
- Test `getHeightAt()` produces same values as `generateHeightmap()` for same positions
- Test height callback in `generateBiomeData()` correctly samples from heightmap
- Test height callback correctly generates heights for neighboring chunk positions
- Test edge cases: corner positions, negative coordinates, large blend radius

### Property-Based Tests

- Generate random chunk positions and verify boundary continuity across all edges
- Generate random interior positions and verify biome values unchanged from original
- Generate random seeds and verify determinism preserved (same seed = same biomes)
- Generate random blend radii and verify seamless boundaries for all values
- Test that biome transitions are smooth (no abrupt changes in blend weights)

### Integration Tests

- Generate a grid of chunks (3x3) and verify no seams at any boundaries
- Test with enhanced biome system enabled (transitions, micro-biomes, elevation bands)
- Test with LOD system enabled (verify seamless boundaries at all LOD levels)
- Test with incremental generation (verify boundaries seamless during progressive generation)
- Visual regression test: render chunks and compare against reference images
