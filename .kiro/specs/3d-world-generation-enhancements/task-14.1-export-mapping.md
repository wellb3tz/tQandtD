# Task 14.1: Export Mapping Analysis

This document identifies the location of all types and classes that need to be exported according to task 14.1.

## Export Requirements

Task 14.1 requires exporting the following new types and classes:

### 1. 3D Noise Generation (from task 1)
- **NoiseEngine3D**: ❌ Does NOT exist as a separate class
  - The `NoiseEngine` class in `src/core/noise.ts` already has 3D methods (`noise3D`, `fbm3D`, `domainWarp3D`)
  - **Already exported** in `src/index.ts` as `NoiseEngine`
- **Noise3DConfig**: ✅ Defined in `src/world/chunk-manager.ts` (lines 10-15)
  - Extends `NoiseConfig` with `enable3D` and `zScale` properties
  - **NOT yet exported** in `src/index.ts`

### 2. Enhanced Biome System (from task 3)
- **EnhancedBiomeSystem**: ✅ Defined in `src/world/enhanced-biome.ts`
  - **Already exported** in `src/index.ts`
- **EnhancedBiomeConfig**: ✅ Defined in `src/world/enhanced-biome.ts`
  - **Already exported** in `src/index.ts`
- **MicroBiomeType**: ✅ Defined in `src/world/enhanced-biome.ts` (enum)
  - **Already exported** in `src/index.ts`
- **ElevationBand**: ✅ Defined in `src/world/enhanced-biome.ts` (enum)
  - **Already exported** in `src/index.ts`

### 3. River Network Generation (from task 5)
- **RiverNetworkGenerator**: ❌ Does NOT exist
  - The design document specifies this class, but it was NOT implemented
  - Only data structures exist: `RiverNetworkConfig`, `RiverSegment`, `Lake`, `RiverNetwork`
  - The existing `RiverGenerator` class is still used
- **RiverNetworkConfig**: ✅ Defined in `src/gen/rivers.ts`
  - **Already exported** in `src/index.ts`
- **RiverSegment**: ✅ Defined in `src/gen/rivers.ts`
  - **Already exported** in `src/index.ts`
- **Lake**: ✅ Defined in `src/gen/rivers.ts`
  - **Already exported** in `src/index.ts`
- **RiverNetwork**: ✅ Defined in `src/gen/rivers.ts`
  - **Already exported** in `src/index.ts`

### 4. Worker Pool System (from task 7)
- **WorkerPool**: ✅ Defined in `src/world/worker-pool.ts`
  - **NOT yet exported** in `src/index.ts`
- **WorkerPoolConfig**: ✅ Defined in `src/world/worker-pool.ts`
  - **NOT yet exported** in `src/index.ts`

### 5. LOD System (from task 8)
- **LODManager**: ✅ Defined in `src/world/lod.ts`
  - **Already exported** in `src/index.ts`
- **LODConfig**: ✅ Defined in `src/world/lod.ts`
  - **Already exported** in `src/index.ts`
- **LODLevel**: ✅ Defined in `src/world/lod.ts` (enum)
  - **Already exported** in `src/index.ts`

### 6. Incremental Generation (from task 9)
- **IncrementalGenerator**: ✅ Defined in `src/world/incremental-generator.ts`
  - **Already exported** in `src/index.ts`
- **IncrementalConfig**: ✅ Defined in `src/world/chunk.ts`
  - **Already exported** in `src/index.ts`
- **GenerationStage**: ✅ Defined in `src/world/chunk.ts` (enum)
  - **Already exported** in `src/index.ts`
- **PartialChunkData**: ✅ Defined in `src/world/chunk.ts`
  - **Already exported** in `src/index.ts`

### 7. Serialization System (from task 11)
- **WorldSerializer**: ✅ Defined in `src/world/serialization.ts`
  - **NOT yet exported** in `src/index.ts`
- **SerializationFormat**: ✅ Defined in `src/world/serialization.ts` (enum)
  - **NOT yet exported** in `src/index.ts`
- **SerializationOptions**: ✅ Defined in `src/world/serialization.ts`
  - **NOT yet exported** in `src/index.ts`
- **SerializedWorld**: ✅ Defined in `src/world/serialization.ts`
  - **NOT yet exported** in `src/index.ts`

### 8. Modification Tracking (from task 12)
- **ChunkModification**: ✅ Defined in `src/world/serialization.ts`
  - **NOT yet exported** in `src/index.ts`

## Summary

### Items that need to be added to src/index.ts:

1. **Noise3DConfig** (from `src/world/chunk-manager.ts`)
2. **WorkerPool** (from `src/world/worker-pool.ts`)
3. **WorkerPoolConfig** (from `src/world/worker-pool.ts`)
4. **WorldSerializer** (from `src/world/serialization.ts`)
5. **SerializationFormat** (from `src/world/serialization.ts`)
6. **SerializationOptions** (from `src/world/serialization.ts`)
7. **SerializedWorld** (from `src/world/serialization.ts`)
8. **ChunkModification** (from `src/world/serialization.ts`)

### Items already exported:
- NoiseEngine (already has 3D methods)
- EnhancedBiomeSystem, EnhancedBiomeConfig, MicroBiomeType, ElevationBand
- RiverNetworkConfig, RiverSegment, Lake, RiverNetwork
- LODManager, LODConfig, LODLevel
- IncrementalGenerator, IncrementalConfig, GenerationStage, PartialChunkData

### Items that don't exist:
- NoiseEngine3D (not needed - NoiseEngine already has 3D methods)
- RiverNetworkGenerator (not implemented - only data structures exist)

## Additional Exports to Consider

The following types are also defined in serialization.ts and may be useful to export:

- **SerializedChunk** (from `src/world/serialization.ts`)
- **WorkerTask** (from `src/world/worker-pool.ts`)
- **WorkerState** (from `src/world/worker-pool.ts`)

However, these are internal implementation details and may not need to be part of the public API.
