# Migration Guide: 3D World Generation Enhancements

This guide helps you upgrade from the basic 2D world generation system to the enhanced version with 3D noise, advanced biomes, river networks, performance optimizations, and world persistence features.

## Overview

The enhanced version maintains **full backward compatibility** with the existing 2D generation system. All new features are **opt-in** via configuration flags, so your existing code will continue to work without modifications.

## Breaking Changes

**Good news: There are NO breaking changes!** 

All existing APIs remain unchanged, and the enhanced features are additive. Your current code will work exactly as before without any modifications.

## New Features Summary

The enhancements add five major feature areas:

1. **3D Noise Generation** - Volumetric noise for enhanced terrain features
2. **Enhanced Biome System** - Transitions, micro-biomes, and elevation bands
3. **River Networks** - Tributaries, lakes, deltas, and flow-based width (data structures implemented)
4. **Performance Optimizations** - Worker pool, LOD system, and incremental generation
5. **World Persistence** - Serialization, deserialization, and modification tracking

## Migration Path

### Option 1: No Changes Required (Recommended for Existing Projects)

If you're happy with your current world generation, **you don't need to change anything**. The library will continue to use 2D noise and basic biome generation by default.

```typescript
// This code continues to work exactly as before
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: { /* ... */ },
  biomeConfig: { /* ... */ },
  // ... other config
});

const chunk = manager.getChunk(0, 0);
// Works exactly as before!
```

### Option 2: Gradual Feature Adoption (Recommended for New Projects)

Enable new features incrementally by adding optional configuration sections. You can enable features one at a time and test each addition.

## Feature-by-Feature Migration

### 1. Enabling 3D Noise Generation

**What it does:** Adds volumetric noise for more realistic and varied terrain features with vertical variation.

**Migration steps:**

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // ADD THIS: Enable 3D noise
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5  // Optional: Z-coordinate scale factor (default: 1.0)
  },
  
  // Your existing config remains unchanged
  terrainConfig: { /* ... */ },
  biomeConfig: { /* ... */ },
  // ...
});
```

**What changes:**
- Terrain generation now uses 3D Simplex noise instead of 2D
- More organic and varied terrain features
- Slightly increased generation time (~10-20%)

**Backward compatibility:**
- Set `enable3D: false` or omit `noise3DConfig` entirely to use 2D noise
- Same seed produces different terrain when switching between 2D and 3D (expected behavior)

### 2. Enabling Enhanced Biome System

**What it does:** Adds smooth transitions between biomes, localized micro-biomes, and elevation-based zones in mountains.

**Migration steps:**

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // REPLACE biomeConfig with enhancedBiomeConfig
  // Old: biomeConfig: { temperatureScale: 0.005, moistureScale: 0.005, blendRadius: 5 }
  
  // New: enhancedBiomeConfig (includes all biomeConfig fields)
  enhancedBiomeConfig: {
    // Keep your existing biome settings
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    
    // ADD: Transition zones (optional, default: true)
    enableTransitions: true,
    transitionWidth: 10,  // Width in world units
    
    // ADD: Micro-biomes (optional, default: true)
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,  // 0-1, controls rarity
    microBiomeMaxSize: 20,     // Maximum size in tiles
    
    // ADD: Elevation bands for mountains (optional, default: true)
    enableElevationBands: true,
    snowLineElevation: 0.8,    // Snow above this height
    treeLineElevation: 0.75    // Trees below this height
  },
  
  // ... other config
});
```

**What changes:**
- Biome boundaries are now smooth instead of abrupt
- Small localized variations appear within biomes (oasis in desert, clearings in forest, etc.)
- Mountains have distinct zones: forested foothills, rocky slopes, snowy peaks

**Backward compatibility:**
- You can still use `biomeConfig` instead of `enhancedBiomeConfig` for basic biome generation
- Set all `enable*` flags to `false` to disable enhancements
- Enhanced features don't affect existing biome classification logic

**New types available:**
```typescript
import { MicroBiomeType, ElevationBand, EnhancedBiomeData } from 'procedural-world-engine';

// MicroBiomeType enum: OASIS, CLEARING, POND, GROVE
// ElevationBand enum: FOOTHILLS, SLOPES, PEAKS
// EnhancedBiomeData interface: includes biome, weights, microBiome, elevationBand, transitionFactor
```

### 3. Enabling River Networks

**What it does:** Adds data structures for tributaries, lakes, deltas, and flow-based width calculation.

**Note:** Full RiverNetworkGenerator implementation is planned for future release. Currently, the data structures are available, and basic river generation continues to work.

**Migration steps:**

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // REPLACE riverConfig with riverNetworkConfig
  // Old: riverConfig: { sourceElevation: 0.7, minFlowLength: 10, flowWidth: 2 }
  
  // New: riverNetworkConfig (includes all riverConfig fields)
  riverNetworkConfig: {
    // Keep your existing river settings
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    
    // ADD: Tributary settings (optional, default: true)
    enableTributaries: true,
    maxTributaryOrder: 2,      // 1 = no tributaries
    tributaryProbability: 0.3,
    
    // ADD: Lake settings (optional, default: true)
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    
    // ADD: Delta settings (optional, default: true)
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    
    // ADD: Flow-based width (optional)
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5
  },
  
  // ... other config
});
```

**What changes:**
- River data structures now support flow, width, and order information
- Data structures ready for future tributary, lake, and delta generation

**Backward compatibility:**
- You can still use `riverConfig` instead of `riverNetworkConfig` for basic river generation
- Basic river generation continues to work as before
- New data structures are available but not yet fully utilized

**New types available:**
```typescript
import { RiverSegment, Lake, RiverNetwork } from 'procedural-world-engine';

// RiverSegment: index, flow, width, order, next
// Lake: tiles, elevation, outlet
// RiverNetwork: segments, lakes, tileToSegment
```

### 4. Enabling Performance Optimizations

#### 4a. Worker Pool (Multi-Threading)

**What it does:** Generates chunks in parallel across multiple CPU cores for improved performance.

**Migration steps:**

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // ADD THIS: Enable worker pool
  workerPoolConfig: {
    maxWorkers: navigator.hardwareConcurrency,  // Use all CPU cores
    workerScriptUrl: '/worker.js',              // Path to your worker script
    taskTimeout: 30000  // 30 second timeout
  },
  
  // ... other config
});
```

**Worker script setup:**

Create a `worker.js` file:

```typescript
// worker.ts
import { installWorkerHandler } from 'procedural-world-engine';

installWorkerHandler();
```

Build and serve the worker script at the configured URL.

**What changes:**
- Chunks are generated in parallel across multiple threads
- Significantly faster generation for multiple chunks
- No changes to your chunk generation code

**Backward compatibility:**
- Omit `workerPoolConfig` to use single-threaded generation
- Worker pool is completely optional

#### 4b. Level of Detail (LOD)

**What it does:** Reduces detail for distant chunks to improve rendering performance.

**Migration steps:**

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // ADD THIS: Enable LOD system
  lodConfig: {
    distances: [2, 5],           // LOD distance thresholds in chunks
    meshResolutions: [1.0, 0.5, 0.25],  // Resolution multipliers
    featureDensities: [1.0, 0.5, 0.1]   // Feature density multipliers
  },
  
  // ... other config
});

// LOD is automatically applied based on distance
// No changes needed to your chunk generation code
const chunk = manager.getChunk(5, 5);  // Automatically uses appropriate LOD
```

**What changes:**
- Distant chunks have reduced mesh resolution and fewer features
- Improved rendering performance for large view distances
- LOD levels: HIGH (0-2 chunks), MEDIUM (2-5 chunks), LOW (5+ chunks)

**Backward compatibility:**
- Omit `lodConfig` to disable LOD (all chunks at full detail)
- LOD is completely optional

**New types available:**
```typescript
import { LODLevel } from 'procedural-world-engine';

// LODLevel enum: HIGH, MEDIUM, LOW
```

#### 4c. Incremental Generation

**What it does:** Generates chunks progressively in stages to maintain responsiveness.

**Migration steps:**

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // ADD THIS: Enable incremental generation
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16  // 16ms for 60fps
  },
  
  // ... other config
});

// Option 1: Use standard getChunk() - works as before
const chunk = manager.getChunk(0, 0);  // Blocks until complete

// Option 2: Use incremental generation for responsiveness
const partial = manager.getChunkIncremental(0, 0);

// Continue generation in your game loop
function gameLoop() {
  const complete = manager.continueGeneration(0, 0);
  if (complete) {
    console.log('Chunk generation complete!');
  }
  requestAnimationFrame(gameLoop);
}
```

**What changes:**
- Chunks can be generated progressively across multiple frames
- Main thread remains responsive during generation
- Access partial data before completion

**Backward compatibility:**
- Set `enabled: false` or omit `incrementalConfig` to disable
- Standard `getChunk()` continues to work (blocks until complete)
- Incremental generation is completely optional

**New types available:**
```typescript
import { GenerationStage, PartialChunkData } from 'procedural-world-engine';

// GenerationStage enum: TERRAIN, BIOMES, RIVERS, RESOURCES, STRUCTURES, COMPLETE
// PartialChunkData: x, y, stage, data (partial ChunkData)
```

### 5. Enabling World Persistence

**What it does:** Save and load worlds with full modification tracking.

**Migration steps:**

```typescript
import { ChunkManager, SerializationFormat } from 'procedural-world-engine';

const manager = new ChunkManager({ /* config */ });

// Generate some chunks
manager.getChunk(0, 0);
manager.getChunk(1, 0);

// SAVE: Serialize world to JSON
const savedWorld = manager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: false  // Save all chunks
});

// SAVE: Serialize world to binary (more efficient)
const savedWorldBinary = manager.saveWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false
});

// EXPORT: Export to file
const blob = manager.exportWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  region: {
    minX: 0, minY: 0,
    maxX: 10, maxY: 10  // Optional: export specific region
  }
});

// Save blob to file
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'world.bin';
a.click();

// LOAD: Deserialize world
const newManager = new ChunkManager({ /* same config */ });
newManager.loadWorld(savedWorld);

// MODIFICATIONS: Track changes
manager.recordModification(0, 0, {
  chunkX: 0,
  chunkY: 0,
  timestamp: Date.now(),
  modifiedTiles: new Set([0, 1, 2]),
  heightChanges: new Map([
    [0, 0.5],  // Set tile 0 to height 0.5
    [1, 0.6],
    [2, 0.7]
  ]),
  addedStructures: [],
  removedStructures: []
});

// Modifications are automatically included in serialization
const savedWithMods = manager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: true  // Only save modified chunks
});
```

**What changes:**
- New methods: `saveWorld()`, `loadWorld()`, `exportWorld()`, `recordModification()`
- Worlds can be saved to JSON or binary format
- Modifications are tracked and persisted

**Backward compatibility:**
- These are new methods, no existing code is affected
- Serialization is completely optional

**New types available:**
```typescript
import {
  SerializationFormat,
  SerializationOptions,
  SerializedWorld,
  ChunkModification,
  WorldSerializer
} from 'procedural-world-engine';

// SerializationFormat enum: JSON, BINARY
// SerializationOptions: format, compress, modifiedOnly, region
// SerializedWorld: version, seed, config, chunks, modifications, checksum
// ChunkModification: chunkX, chunkY, timestamp, modifiedTiles, heightChanges, addedStructures, removedStructures
```

## Complete Migration Example

Here's a complete example showing how to migrate from basic to enhanced configuration:

### Before (Basic 2D Generation)

```typescript
import { ChunkManager, BiomeType, ResourceType, StructureType } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5
  },
  resourceConfig: {
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.3,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50
      }
    ],
    clusterScale: 20,
    densityThreshold: 0.6
  },
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } }
        ]
      }
    ],
    minDistance: 10,
    maxAttempts: 30
  },
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2
  }
});

const chunk = manager.getChunk(0, 0);
```

### After (Enhanced with All Features)

```typescript
import {
  ChunkManager,
  BiomeType,
  ResourceType,
  StructureType,
  SerializationFormat
} from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // NEW: 3D noise generation
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5
  },
  
  // Existing terrain config (unchanged)
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  },
  
  // ENHANCED: Replace biomeConfig with enhancedBiomeConfig
  enhancedBiomeConfig: {
    // Keep existing settings
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    // Add enhancements
    enableTransitions: true,
    transitionWidth: 10,
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,
    microBiomeMaxSize: 20,
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75
  },
  
  // Existing resource config (unchanged)
  resourceConfig: {
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.3,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50
      }
    ],
    clusterScale: 20,
    densityThreshold: 0.6
  },
  
  // Existing structure config (unchanged)
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } }
        ]
      }
    ],
    minDistance: 10,
    maxAttempts: 30
  },
  
  // ENHANCED: Replace riverConfig with riverNetworkConfig
  riverNetworkConfig: {
    // Keep existing settings
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    // Add enhancements (data structures ready)
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5
  },
  
  // NEW: Worker pool for multi-threading
  workerPoolConfig: {
    maxWorkers: navigator.hardwareConcurrency,
    workerScriptUrl: '/worker.js',
    taskTimeout: 30000
  },
  
  // NEW: LOD system
  lodConfig: {
    distances: [2, 5],
    meshResolutions: [1.0, 0.5, 0.25],
    featureDensities: [1.0, 0.5, 0.1]
  },
  
  // NEW: Incremental generation
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16
  }
});

// Standard chunk generation (works as before)
const chunk = manager.getChunk(0, 0);

// NEW: Incremental generation
const partial = manager.getChunkIncremental(1, 0);
while (!manager.continueGeneration(1, 0)) {
  // Continue in game loop
}

// NEW: Save/load world
const savedWorld = manager.saveWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false
});

// NEW: Export to file
const blob = manager.exportWorld({
  format: SerializationFormat.BINARY,
  compress: true
});
```

## Troubleshooting

### Issue: Terrain looks different after enabling 3D noise

**Cause:** 3D noise generates different terrain than 2D noise, even with the same seed.

**Solution:** This is expected behavior. 3D noise produces more varied and organic terrain. If you need to preserve existing terrain:
- Keep `enable3D: false` or omit `noise3DConfig`
- Use a different seed for 3D worlds

### Issue: Performance degradation after enabling enhancements

**Cause:** Enhanced features add computational complexity.

**Solution:**
- Enable worker pool for multi-threading: `workerPoolConfig: { maxWorkers: navigator.hardwareConcurrency, ... }`
- Enable LOD to reduce detail for distant chunks: `lodConfig: { distances: [2, 5], ... }`
- Use incremental generation to spread work across frames: `incrementalConfig: { enabled: true, timeBudgetMs: 16 }`
- Disable specific enhancements you don't need: `enableTransitions: false`, `enableMicroBiomes: false`, etc.

### Issue: Worker pool not working

**Cause:** Worker script not found or not properly configured.

**Solution:**
- Ensure worker script is built and served at the configured URL
- Check browser console for worker loading errors
- Verify `workerScriptUrl` path is correct
- Make sure worker script calls `installWorkerHandler()`

### Issue: Serialization fails with large worlds

**Cause:** Memory limitations or timeout issues.

**Solution:**
- Use binary format instead of JSON: `format: SerializationFormat.BINARY`
- Enable compression: `compress: true`
- Export specific regions: `region: { minX: 0, minY: 0, maxX: 10, maxY: 10 }`
- Save only modified chunks: `modifiedOnly: true`

### Issue: Incremental generation not yielding

**Cause:** Time budget too large or stages completing too quickly.

**Solution:**
- Reduce time budget: `timeBudgetMs: 8` (for 120fps) or `timeBudgetMs: 16` (for 60fps)
- Check that you're calling `continueGeneration()` in your game loop
- Verify that `enabled: true` in `incrementalConfig`

### Issue: Biome transitions not visible

**Cause:** Transition width too small or transitions disabled.

**Solution:**
- Increase transition width: `transitionWidth: 20` (default: 10)
- Ensure transitions are enabled: `enableTransitions: true`
- Check that you're using `enhancedBiomeConfig` instead of `biomeConfig`

### Issue: Micro-biomes not appearing

**Cause:** Frequency too low or size constraints too restrictive.

**Solution:**
- Increase frequency: `microBiomeFrequency: 0.2` (default: 0.1)
- Increase max size: `microBiomeMaxSize: 40` (default: 20)
- Ensure micro-biomes are enabled: `enableMicroBiomes: true`
- Check that you're using `enhancedBiomeConfig` instead of `biomeConfig`

### Issue: River network features not working

**Cause:** Full RiverNetworkGenerator implementation is planned for future release.

**Solution:**
- Currently, river network data structures are implemented and available
- Basic river generation continues to work as before
- Tributary, lake, and delta generation will be available in a future release
- You can use the data structures now to prepare for future features

## Performance Considerations

### Expected Performance Impact

| Feature | Performance Impact | Mitigation |
|---------|-------------------|------------|
| 3D Noise | +10-20% generation time | Enable worker pool |
| Enhanced Biomes | +5-10% generation time | Disable unused features |
| River Networks | Minimal (data structures only) | N/A |
| Worker Pool | -50% to -80% generation time (parallel) | Use all CPU cores |
| LOD System | -30% to -70% rendering time | Adjust distance thresholds |
| Incremental Generation | No impact (spreads work over time) | Adjust time budget |
| Serialization | Depends on world size | Use binary format + compression |

### Optimization Tips

1. **Enable worker pool** for the biggest performance gain (parallel generation)
2. **Use LOD system** to reduce rendering overhead for distant chunks
3. **Enable incremental generation** to maintain responsiveness
4. **Use binary serialization** with compression for faster save/load
5. **Disable unused enhancements** to reduce computational overhead
6. **Adjust time budgets** based on your target frame rate

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [README.md](README.md) for detailed API documentation
2. Review the [examples/](examples/) directory for usage patterns
3. Check the [design document](.kiro/specs/3d-world-generation-enhancements/design.md) for technical details
4. Open an issue on GitHub with:
   - Your configuration
   - Expected vs actual behavior
   - Browser/environment details
   - Minimal reproduction code

## Summary

The enhanced version is **fully backward compatible** with no breaking changes. All new features are opt-in via configuration flags. You can:

- **Keep using your existing code** without any changes
- **Enable features incrementally** to test each addition
- **Mix and match features** based on your needs
- **Disable features** you don't need for better performance

The migration path is flexible and allows you to adopt enhancements at your own pace!
