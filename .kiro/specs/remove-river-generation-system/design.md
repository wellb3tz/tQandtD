# Design Document: Remove River Generation System

## Overview

This design document describes the technical approach for completely removing the river generation system from the Procedural World Engine. The river generation system was originally planned but never fully implemented—only data structures and placeholder references exist in the codebase. This removal will clean up unused code, reduce API surface area, simplify the codebase, and eliminate confusion for library users.

The removal is a **breaking change** that affects:
- Core data structures (ChunkData interface)
- Public API exports (type definitions)
- Serialization formats (JSON and binary)
- Generation workflow (GenerationStage enumeration)
- Documentation (README, product overview, structure guide)
- Demo application (water rendering system)

The design prioritizes **backward compatibility** for deserialization—existing save files containing river data will load successfully with river data gracefully ignored.

## Architecture

### Affected Components

The river generation system touches 6 core library files and multiple documentation files:

**Core Library Files:**
1. `src/world/chunk.ts` - ChunkData interface, GenerationStage enum
2. `src/world/serialization.ts` - Serialization/deserialization logic
3. `src/world/incremental-generator.ts` - Incremental generation workflow
4. `src/world/worker-pool.ts` - Worker message serialization
5. `src/worker.ts` - Worker message types and serialization
6. `src/gen/structures.ts` - Structure placement rules (nearWater rule)
7. `src/index.ts` - Public API exports

**Documentation Files:**
1. `README.md` - Feature lists, API documentation, examples
2. `.kiro/steering/product.md` - Product capabilities
3. `.kiro/steering/structure.md` - Project structure guide

**Demo Application:**
1. `demo/src/viewer/water/` - Water rendering system (river-specific code)

### Removal Strategy

The removal follows a **layered approach** from bottom to top:

1. **Data Layer**: Remove `rivers` field from ChunkData interface
2. **Generation Layer**: Remove RIVERS stage from GenerationStage enum
3. **Serialization Layer**: Remove river handling from serialization/deserialization
4. **Worker Layer**: Remove river data from worker message types
5. **API Layer**: Remove river-related type exports from public API
6. **Documentation Layer**: Remove river references from all documentation
7. **Demo Layer**: Remove river-specific rendering code

### Backward Compatibility Strategy

To maintain backward compatibility for existing save files:

1. **Deserialization**: Gracefully ignore river data in legacy save files
2. **Validation**: Skip river field validation during deserialization
3. **No Errors**: Never throw errors when encountering river data
4. **Optional Logging**: Log warnings when legacy river data is detected (optional)

This ensures users can load old save files without data loss or errors.

## Components and Interfaces

### Modified Interfaces

#### ChunkData (src/world/chunk.ts)

**Before:**
```typescript
export interface ChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
  biomeWeights: Float32Array;
  resources: Resource[];
  structures: Structure[];
  rivers: Set<number>;  // ← REMOVE THIS
}
```

**After:**
```typescript
export interface ChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
  biomeWeights: Float32Array;
  resources: Resource[];
  structures: Structure[];
  // rivers field removed
}
```

#### GenerationStage (src/world/chunk.ts)

**Before:**
```typescript
export enum GenerationStage {
  TERRAIN = 0,
  BIOMES = 1,
  RIVERS = 2,     // ← REMOVE THIS
  RESOURCES = 3,  // ← RENUMBER TO 2
  STRUCTURES = 4, // ← RENUMBER TO 3
  COMPLETE = 5,   // ← RENUMBER TO 4
}
```

**After:**
```typescript
export enum GenerationStage {
  TERRAIN = 0,
  BIOMES = 1,
  RESOURCES = 2,   // Renumbered from 3
  STRUCTURES = 3,  // Renumbered from 4
  COMPLETE = 4,    // Renumbered from 5
}
```

**Impact**: All code referencing GenerationStage values must be updated. The incremental generator workflow will skip directly from BIOMES to RESOURCES.

#### SerializedChunk (src/world/serialization.ts)

**Before:**
```typescript
export interface SerializedChunk {
  x: number;
  y: number;
  heightmap: ArrayBuffer | string;
  biomeMap: ArrayBuffer | string;
  resources: Resource[];
  structures: Structure[];
  rivers: number[];  // ← REMOVE THIS
}
```

**After:**
```typescript
export interface SerializedChunk {
  x: number;
  y: number;
  heightmap: ArrayBuffer | string;
  biomeMap: ArrayBuffer | string;
  resources: Resource[];
  structures: Structure[];
  // rivers field removed
}
```

#### SerializedChunkData (src/worker.ts)

**Before:**
```typescript
export interface SerializedChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: number[];
  biomeMap: number[];
  biomeWeights: number[];
  resources: Array<{
    x: number;
    y: number;
    type: number;
    amount: number;
  }>;
  structures: Array<{
    x: number;
    y: number;
    type: number;
  }>;
  rivers: number[];  // ← REMOVE THIS
}
```

**After:**
```typescript
export interface SerializedChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: number[];
  biomeMap: number[];
  biomeWeights: number[];
  resources: Array<{
    x: number;
    y: number;
    type: number;
    amount: number;
  }>;
  structures: Array<{
    x: number;
    y: number;
    type: number;
  }>;
  // rivers field removed
}
```

### Modified Functions

#### serializeChunkJSON (src/world/serialization.ts)

**Changes:**
- Remove line: `const rivers = Array.from(chunk.rivers);`
- Remove `rivers` field from returned SerializedChunk object

#### serializeChunkBinary (src/world/serialization.ts)

**Changes:**
- Remove line: `const rivers = Array.from(chunk.rivers);`
- Remove `rivers` field from returned SerializedChunk object

#### deserializeChunkJSON (src/world/serialization.ts)

**Changes:**
- Remove line: `const rivers = new Set<number>(serializedChunk.rivers);`
- Remove `rivers` field from returned ChunkData object
- **Add backward compatibility**: Check if `serializedChunk.rivers` exists before attempting to access it (graceful handling)

#### deserializeChunkBinary (src/world/serialization.ts)

**Changes:**
- Remove line: `const rivers = new Set<number>(serializedChunk.rivers);`
- Remove `rivers` field from returned ChunkData object
- **Add backward compatibility**: Check if `serializedChunk.rivers` exists before attempting to access it (graceful handling)

#### serializeWorldToBinary (src/world/serialization.ts)

**Changes:**
- Remove river count and data from chunk data size calculation
- Remove river writing loop in chunk serialization

#### deserializeWorldFromBinary (src/world/serialization.ts)

**Changes:**
- **Add backward compatibility**: Check if river data exists in binary format
- If river data exists, read and discard it (skip over the bytes)
- Do not include rivers in reconstructed ChunkData

#### validateSerializedWorld (src/world/serialization.ts)

**Changes:**
- Remove validation: `!Array.isArray(chunk.rivers)`
- **Add backward compatibility**: Make rivers field optional in validation (don't fail if present)

#### serializeChunkData (src/worker.ts)

**Changes:**
- Remove line: `rivers: Array.from(chunk.rivers),`

#### deserializeChunkData (src/worker.ts)

**Changes:**
- Remove line: `rivers: new Set(serialized.rivers),`

#### executeResourcesStage (src/world/incremental-generator.ts)

**Changes:**
- Remove line: `rivers: partial.data.rivers || new Set<number>(),`

#### executeStructuresStage (src/world/incremental-generator.ts)

**Changes:**
- Remove line: `rivers: partial.data.rivers || new Set<number>(),`

#### getChunk (src/world/chunk-manager.ts)

**Changes:**
- Remove line: `rivers: new Set<number>(),`

#### deserializeChunkData (src/world/worker-pool.ts)

**Changes:**
- Remove line: `rivers: new Set(serialized.rivers),`

### Removed Exports (src/index.ts)

The following river-related types will be removed from public API exports:
- `RiverConfig` (if exists)
- `RiverNetworkConfig` (if exists)
- `RiverSegment` (if exists)
- `Lake` (if exists)
- `RiverNetwork` (if exists)

**Note**: Based on the current codebase analysis, these types may not exist yet (river generation was never fully implemented). If they don't exist, no action is needed for this step.

## Data Models

### ChunkData Structure

The ChunkData interface is the core data structure for chunk information. After removal:

**Size Impact:**
- Before: ~46KB per 32x32 chunk (with empty rivers Set)
- After: ~46KB per 32x32 chunk (negligible change, Set overhead removed)

**Memory Layout:**
```
ChunkData {
  x: number (8 bytes)
  y: number (8 bytes)
  size: number (8 bytes)
  heightmap: Float32Array ((size+1)*(size+1)*4 bytes)
  biomeMap: Uint8Array (size*size bytes)
  biomeWeights: Float32Array (size*size*8*4 bytes)
  resources: Resource[] (variable)
  structures: Structure[] (variable)
  // rivers: Set<number> REMOVED
}
```

### Serialization Format Changes

#### JSON Format

**Before:**
```json
{
  "x": 0,
  "y": 0,
  "heightmap": "base64...",
  "biomeMap": "base64...",
  "resources": [...],
  "structures": [...],
  "rivers": [10, 25, 42]
}
```

**After:**
```json
{
  "x": 0,
  "y": 0,
  "heightmap": "base64...",
  "biomeMap": "base64...",
  "resources": [...],
  "structures": [...]
}
```

#### Binary Format

**Before:**
```
Chunk Data:
  x (4 bytes)
  y (4 bytes)
  heightmap size (4 bytes) + heightmap data
  biomeMap size (4 bytes) + biomeMap data
  resources length (4 bytes) + resources JSON
  structures length (4 bytes) + structures JSON
  rivers count (4 bytes) + rivers data (count * 4 bytes)
```

**After:**
```
Chunk Data:
  x (4 bytes)
  y (4 bytes)
  heightmap size (4 bytes) + heightmap data
  biomeMap size (4 bytes) + biomeMap data
  resources length (4 bytes) + resources JSON
  structures length (4 bytes) + structures JSON
  // rivers section removed
```

**Backward Compatibility**: When deserializing legacy binary data, detect if rivers section exists by checking remaining bytes. If present, read and discard the rivers count and data.

## Error Handling

### Deserialization Error Handling

The deserialization process must handle legacy save files gracefully:

#### JSON Deserialization

```typescript
private deserializeChunkJSON(serializedChunk: SerializedChunk, chunkSize: number): ChunkData {
  // Decode heightmap and biomeMap...
  
  // Backward compatibility: Ignore rivers if present
  // No need to read serializedChunk.rivers - just don't include it in output
  
  // Reconstruct biomeWeights...
  
  return {
    x: serializedChunk.x,
    y: serializedChunk.y,
    size: chunkSize,
    heightmap,
    biomeMap,
    biomeWeights,
    resources: serializedChunk.resources,
    structures: serializedChunk.structures,
    // rivers field omitted - legacy data ignored
  };
}
```

#### Binary Deserialization

```typescript
private deserializeWorldFromBinary(buffer: ArrayBuffer): SerializedWorld {
  // ... read chunk coordinates, heightmap, biomeMap, resources, structures ...
  
  // Backward compatibility: Check if rivers data exists
  // If we haven't reached the end of chunk data, rivers may be present
  if (offset < expectedChunkEndOffset) {
    // Read rivers count
    const riversCount = view.getUint32(offset, true);
    offset += 4;
    
    // Skip rivers data (don't store it)
    offset += riversCount * 4;
  }
  
  // Continue with next chunk or modifications...
}
```

#### Validation

```typescript
private validateSerializedWorld(data: any): void {
  // ... validate version, seed, config, chunks, modifications, checksum ...
  
  // Validate each chunk
  for (let i = 0; i < data.chunks.length; i++) {
    const chunk = data.chunks[i];
    
    // ... validate x, y, heightmap, biomeMap ...
    
    // Backward compatibility: Make rivers optional
    if (!Array.isArray(chunk.resources) || !Array.isArray(chunk.structures)) {
      throw new Error(`Invalid chunk at index ${i}: resources and structures must be arrays`);
    }
    
    // Don't validate rivers - it's optional for backward compatibility
  }
}
```

### Error Scenarios

| Scenario | Handling | User Impact |
|----------|----------|-------------|
| Legacy JSON with rivers field | Ignore rivers field, load other data | None - seamless |
| Legacy binary with rivers data | Read and discard rivers data | None - seamless |
| New save without rivers | Normal deserialization | None - expected |
| Corrupted rivers data in legacy file | Skip rivers, load other data | Minimal - only rivers lost |

## Testing Strategy

### Unit Tests

**Test Coverage Areas:**

1. **ChunkData Creation** (src/world/chunk-manager.ts)
   - Verify ChunkData objects don't have rivers field
   - Verify all other fields are present and correct

2. **GenerationStage Enumeration** (src/world/chunk.ts)
   - Verify RIVERS stage is removed
   - Verify stage numbering is sequential (0, 1, 2, 3, 4)
   - Verify RESOURCES = 2, STRUCTURES = 3, COMPLETE = 4

3. **Serialization - JSON Format** (src/world/serialization.ts)
   - Verify serializeChunkJSON doesn't include rivers field
   - Verify deserializeChunkJSON handles missing rivers field
   - Verify deserializeChunkJSON ignores rivers field if present (backward compatibility)

4. **Serialization - Binary Format** (src/world/serialization.ts)
   - Verify serializeChunkBinary doesn't include rivers data
   - Verify deserializeChunkBinary handles missing rivers data
   - Verify deserializeChunkBinary skips rivers data if present (backward compatibility)

5. **Worker Serialization** (src/worker.ts)
   - Verify serializeChunkData doesn't include rivers field
   - Verify deserializeChunkData doesn't expect rivers field

6. **Worker Pool Serialization** (src/world/worker-pool.ts)
   - Verify deserializeChunkData doesn't include rivers field

7. **Incremental Generation** (src/world/incremental-generator.ts)
   - Verify RIVERS stage is skipped in generation workflow
   - Verify generation progresses from BIOMES → RESOURCES
   - Verify temporary ChunkData objects don't include rivers field

8. **Structure Placement** (src/gen/structures.ts)
   - Verify nearWater rule doesn't reference rivers parameter
   - Verify distanceToWater function signature is updated or removed

### Integration Tests

**Test Scenarios:**

1. **Complete Generation Workflow**
   - Generate a chunk from scratch
   - Verify no rivers field in resulting ChunkData
   - Verify all other fields are populated correctly

2. **Serialization Round-Trip**
   - Generate chunk → serialize (JSON) → deserialize → verify
   - Generate chunk → serialize (binary) → deserialize → verify
   - Verify no rivers data in serialized output
   - Verify deserialized chunk matches original (minus rivers)

3. **Backward Compatibility - JSON**
   - Create legacy JSON with rivers field
   - Deserialize and verify no errors
   - Verify rivers data is ignored
   - Verify all other data is preserved

4. **Backward Compatibility - Binary**
   - Create legacy binary with rivers data
   - Deserialize and verify no errors
   - Verify rivers data is skipped
   - Verify all other data is preserved

5. **Worker Pool Generation**
   - Generate chunks using worker pool
   - Verify worker messages don't include rivers
   - Verify generated chunks don't have rivers field

6. **Incremental Generation**
   - Start incremental generation
   - Verify RIVERS stage is not in workflow
   - Verify generation completes successfully
   - Verify final chunk doesn't have rivers field

### Property-Based Tests

**Not applicable** for this feature removal. Property-based testing is designed for validating universal properties across inputs. Feature removal is a structural change that doesn't involve algorithmic correctness properties.

The removal will be validated through:
- **Unit tests**: Verify specific behaviors (no rivers field, correct enum values)
- **Integration tests**: Verify complete workflows (generation, serialization, deserialization)
- **Regression tests**: Verify backward compatibility (legacy save files load correctly)

### Test Implementation Notes

1. **Existing Tests**: Update all existing tests that reference rivers
   - Remove rivers assertions from chunk generation tests
   - Update serialization tests to not expect rivers field
   - Update worker tests to not include rivers in messages

2. **New Tests**: Add backward compatibility tests
   - Create test fixtures with legacy save data (JSON and binary)
   - Verify deserialization succeeds without errors
   - Verify rivers data is ignored but other data is preserved

3. **Test Data**: Create test fixtures
   - Legacy JSON save file with rivers field
   - Legacy binary save file with rivers data
   - Store in `tests/fixtures/legacy-saves/`

## Implementation Plan

### Phase 1: Core Data Structures

**Files to modify:**
- `src/world/chunk.ts`

**Changes:**
1. Remove `rivers: Set<number>` field from ChunkData interface
2. Update ChunkData JSDoc comment to remove rivers reference
3. Remove RIVERS stage from GenerationStage enum
4. Renumber subsequent stages (RESOURCES=2, STRUCTURES=3, COMPLETE=4)
5. Update GenerationStage JSDoc comment

**Verification:**
- TypeScript compilation succeeds (expect errors in other files - will fix in next phases)
- Run `npm run build` to identify all files that need updates

### Phase 2: Serialization Layer

**Files to modify:**
- `src/world/serialization.ts`

**Changes:**
1. Update SerializedChunk interface - remove `rivers: number[]` field
2. Update serializeChunkJSON - remove rivers serialization
3. Update serializeChunkBinary - remove rivers serialization
4. Update deserializeChunkJSON - remove rivers deserialization, add backward compatibility
5. Update deserializeChunkBinary - remove rivers deserialization, add backward compatibility
6. Update serializeWorldToBinary - remove rivers from size calculation and writing
7. Update deserializeWorldFromBinary - add backward compatibility for rivers data
8. Update validateSerializedWorld - make rivers field optional in validation
9. Update JSDoc comments to remove rivers references

**Verification:**
- TypeScript compilation succeeds for serialization.ts
- Run serialization unit tests (expect failures - will update tests)

### Phase 3: Worker Layer

**Files to modify:**
- `src/worker.ts`
- `src/world/worker-pool.ts`

**Changes:**
1. Update SerializedChunkData interface in worker.ts - remove `rivers: number[]` field
2. Update serializeChunkData in worker.ts - remove rivers serialization
3. Update deserializeChunkData in worker.ts - remove rivers deserialization
4. Update deserializeChunkData in worker-pool.ts - remove rivers deserialization
5. Update JSDoc comments to remove rivers references

**Verification:**
- TypeScript compilation succeeds for worker files
- Run worker unit tests (expect failures - will update tests)

### Phase 4: Generation Layer

**Files to modify:**
- `src/world/chunk-manager.ts`
- `src/world/incremental-generator.ts`
- `src/gen/structures.ts`

**Changes:**
1. Update getChunk in chunk-manager.ts - remove rivers initialization
2. Update executeResourcesStage in incremental-generator.ts - remove rivers from temp chunk
3. Update executeStructuresStage in incremental-generator.ts - remove rivers from temp chunk
4. Update evaluatePlacementRule in structures.ts - remove rivers parameter
5. Update distanceToWater in structures.ts - remove rivers parameter or remove function if unused
6. Update JSDoc comments to remove rivers references

**Verification:**
- TypeScript compilation succeeds for all library files
- Run `npm run build` - should succeed
- Run all unit tests (expect failures - will update tests)

### Phase 5: Public API

**Files to modify:**
- `src/index.ts`

**Changes:**
1. Remove river-related type exports (if they exist):
   - RiverConfig
   - RiverNetworkConfig
   - RiverSegment
   - Lake
   - RiverNetwork

**Verification:**
- TypeScript compilation succeeds
- Run `npm run build` - should succeed
- Verify dist/ output doesn't include river types

### Phase 6: Documentation

**Files to modify:**
- `README.md`
- `.kiro/steering/product.md`
- `.kiro/steering/structure.md`

**Changes (README.md):**
1. Remove "Advanced River Networks" from Features section
2. Remove "River Networks" configuration section
3. Remove River Network Configuration table
4. Remove river-related examples from Quick Start
5. Remove river-related examples from Advanced Features
6. Remove RiverSegment, Lake, RiverNetwork from API Documentation
7. Remove river configuration from Complete Configuration Example
8. Update GenerationStage description to remove RIVERS stage
9. Remove "rivers" from ChunkData description
10. Update Project Structure to remove src/gen/rivers.ts reference
11. Update LOD Feature Culling description to remove river references

**Changes (product.md):**
1. Remove "River Networks: Advanced river generation..." from Core Capabilities

**Changes (structure.md):**
1. Remove "rivers.ts: River network generation..." from Generation Systems section

**Verification:**
- Read through all documentation
- Verify no river references remain
- Verify documentation is coherent and accurate

### Phase 7: Demo Application

**Files to modify:**
- `demo/src/viewer/water/` (multiple files)

**Changes:**
1. Identify river-specific rendering code in water system
2. Remove river mesh creation and management
3. Remove river configuration from WaterConfig interface
4. Update water rendering to only handle oceans and lakes
5. Update demo UI to remove river controls

**Note**: This phase requires careful analysis of the demo application code to identify river-specific rendering logic. The water system should continue to render oceans and lakes.

**Verification:**
- Run `npm run demo` - demo should start without errors
- Verify water rendering works (oceans and lakes)
- Verify no river-related UI controls

### Phase 8: Test Updates

**Files to modify:**
- All test files that reference rivers

**Changes:**
1. Update existing tests to remove rivers assertions
2. Add backward compatibility tests for legacy save files
3. Create test fixtures with legacy save data
4. Update test documentation

**Verification:**
- Run `npm test` - all tests should pass
- Run `npm run test:coverage` - verify coverage is maintained

### Phase 9: Final Verification

**Verification steps:**
1. Run `npm run build` - should succeed
2. Run `npm run build:demo` - should succeed
3. Run `npm test` - all tests should pass
4. Run `npm run demo` - demo should work correctly
5. Manual testing:
   - Generate chunks and verify no rivers field
   - Save and load world (JSON format)
   - Save and load world (binary format)
   - Load legacy save file with rivers data
   - Verify incremental generation works
   - Verify worker pool generation works

## Migration Guide for Users

### Breaking Changes

**ChunkData Interface:**
- The `rivers` field has been removed from ChunkData
- Code accessing `chunk.rivers` will cause TypeScript errors
- **Migration**: Remove all references to `chunk.rivers`

**GenerationStage Enum:**
- The `RIVERS` stage has been removed
- Stage values have been renumbered:
  - `RESOURCES`: 3 → 2
  - `STRUCTURES`: 4 → 3
  - `COMPLETE`: 5 → 4
- **Migration**: Update any code that uses numeric stage values

**Public API:**
- River-related types removed (if they existed):
  - RiverConfig
  - RiverNetworkConfig
  - RiverSegment
  - Lake
  - RiverNetwork
- **Migration**: Remove imports and usage of these types

### Backward Compatibility

**Save Files:**
- Existing save files with river data will load successfully
- River data will be ignored during deserialization
- All other data (terrain, biomes, resources, structures) will be preserved
- **No migration needed** for save files

### Code Examples

**Before:**
```typescript
const chunk = manager.getChunk(0, 0);
console.log(chunk.rivers); // Set<number>

if (chunk.stage === GenerationStage.RIVERS) {
  // Handle rivers stage
}
```

**After:**
```typescript
const chunk = manager.getChunk(0, 0);
// chunk.rivers no longer exists

// GenerationStage.RIVERS no longer exists
// Generation goes: TERRAIN → BIOMES → RESOURCES → STRUCTURES → COMPLETE
```

## Risks and Mitigation

### Risk 1: Breaking User Code

**Risk**: Users with code that accesses `chunk.rivers` will experience TypeScript errors and runtime failures.

**Mitigation**:
- Document breaking changes clearly in migration guide
- Provide clear error messages in TypeScript
- Include migration examples in documentation
- Consider this a major version bump (e.g., 2.0.0)

### Risk 2: Legacy Save File Corruption

**Risk**: Deserialization bugs could corrupt user save files or cause data loss.

**Mitigation**:
- Implement comprehensive backward compatibility tests
- Test with real legacy save files
- Gracefully handle all legacy data formats
- Never throw errors on legacy river data
- Preserve all non-river data during deserialization

### Risk 3: Incomplete Removal

**Risk**: Missing river references could cause runtime errors or confusing behavior.

**Mitigation**:
- Use TypeScript compiler to find all references
- Search codebase for "river" string (case-insensitive)
- Review all modified files carefully
- Run comprehensive test suite
- Manual testing of all features

### Risk 4: Demo Application Breakage

**Risk**: Removing river rendering could break the demo application.

**Mitigation**:
- Carefully analyze water rendering system
- Test demo application thoroughly
- Ensure ocean and lake rendering still works
- Update demo UI to remove river controls

### Risk 5: Documentation Inconsistencies

**Risk**: Missing documentation updates could confuse users.

**Mitigation**:
- Search all documentation for "river" references
- Review all modified documentation files
- Verify documentation is coherent after changes
- Update all code examples

## Success Criteria

The removal is considered successful when:

1. **Compilation**: `npm run build` succeeds without errors
2. **Tests**: `npm test` passes all tests
3. **Demo**: `npm run demo` runs without errors
4. **Backward Compatibility**: Legacy save files load successfully
5. **Documentation**: No river references remain in documentation
6. **API**: No river-related types in public API
7. **Code Quality**: No unused code or dead references
8. **User Experience**: Clear migration guide for breaking changes

## Timeline Estimate

- Phase 1 (Core Data Structures): 1 hour
- Phase 2 (Serialization Layer): 2 hours
- Phase 3 (Worker Layer): 1 hour
- Phase 4 (Generation Layer): 1 hour
- Phase 5 (Public API): 0.5 hours
- Phase 6 (Documentation): 2 hours
- Phase 7 (Demo Application): 2 hours
- Phase 8 (Test Updates): 2 hours
- Phase 9 (Final Verification): 1 hour

**Total Estimated Time**: 12.5 hours

## Conclusion

This design provides a comprehensive plan for removing the river generation system from the Procedural World Engine. The removal is straightforward but requires careful attention to:

1. **Backward compatibility** for existing save files
2. **Complete removal** of all river references
3. **Documentation updates** to reflect the changes
4. **Test coverage** to prevent regressions

The layered approach ensures each component is updated systematically, with verification at each step. The backward compatibility strategy ensures users can continue using existing save files without data loss.
