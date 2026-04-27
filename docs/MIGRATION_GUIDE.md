# 🔄 Migration Guide

Guide for upgrading to newer versions of Procedural World Engine.

## Migrating to v2.0 (Sparse Biome Weights)

### Breaking Changes

#### 1. ChunkData Structure Changed

**Before (v1.x):**
```typescript
interface ChunkData {
  biomeWeights: Float32Array;  // Dense array
}
```

**After (v2.0):**
```typescript
interface ChunkData {
  sparseBiomeTypes: Uint8Array;
  sparseBiomeWeights: Float32Array;
  sparseBiomeOffsets: Uint16Array;
}
```

---

### Migration Steps

#### Step 1: Update Biome Weight Access

**Before:**
```typescript
// Old way - direct array access
const numBiomes = 13;
const tileIndex = y * chunkSize + x;
const weightOffset = tileIndex * numBiomes;

for (let biome = 0; biome < numBiomes; biome++) {
  const weight = chunk.biomeWeights[weightOffset + biome];
  if (weight > 0) {
    console.log(`Biome ${biome}: ${weight}`);
  }
}
```

**After:**
```typescript
// New way - use helper functions
import { getBiomeWeightsForTile } from 'procedural-world-engine';

const tileIndex = y * chunkSize + x;
const weights = getBiomeWeightsForTile(chunk, tileIndex);

for (const [biome, weight] of weights) {
  console.log(`Biome ${biome}: ${weight}`);
}
```

---

#### Step 2: Update Custom Rendering Code

**Before:**
```typescript
function calculateBlendedColor(
  biomeWeights: Float32Array,
  tileIndex: number,
  numBiomes: number
): Color {
  let r = 0, g = 0, b = 0;
  const offset = tileIndex * numBiomes;
  
  for (let biome = 0; biome < numBiomes; biome++) {
    const weight = biomeWeights[offset + biome];
    if (weight > 0) {
      const color = getBiomeColor(biome);
      r += color.r * weight;
      g += color.g * weight;
      b += color.b * weight;
    }
  }
  
  return { r, g, b };
}
```

**After:**
```typescript
import { getBiomeWeightsForTile } from 'procedural-world-engine';

function calculateBlendedColor(
  chunk: ChunkData,
  tileIndex: number
): Color {
  let r = 0, g = 0, b = 0;
  const weights = getBiomeWeightsForTile(chunk, tileIndex);
  
  for (const [biome, weight] of weights) {
    const color = getBiomeColor(biome);
    r += color.r * weight;
    g += color.g * weight;
    b += color.b * weight;
  }
  
  return { r, g, b };
}
```

---

#### Step 3: Update Serialization

**Before:**
```typescript
// Custom serialization
function serializeChunk(chunk: ChunkData) {
  return {
    heightmap: Array.from(chunk.heightmap),
    biomeMap: Array.from(chunk.biomeMap),
    biomeWeights: Array.from(chunk.biomeWeights),
  };
}
```

**After:**
```typescript
// Use built-in serialization
import { WorldSerializer } from 'procedural-world-engine';

const serializer = new WorldSerializer();
const data = serializer.serialize(manager);

// Or for custom serialization:
function serializeChunk(chunk: ChunkData) {
  return {
    heightmap: Array.from(chunk.heightmap),
    biomeMap: Array.from(chunk.biomeMap),
    sparseBiomeTypes: Array.from(chunk.sparseBiomeTypes),
    sparseBiomeWeights: Array.from(chunk.sparseBiomeWeights),
    sparseBiomeOffsets: Array.from(chunk.sparseBiomeOffsets),
  };
}
```

---

### Benefits of Migration

After migrating to v2.0, you'll get:

- ✅ **56% less memory** per chunk (16 KB → 7 KB)
- ✅ **70% less biome weight memory** (13 KB → 4 KB)
- ✅ **Better cache efficiency** (2.3x more chunks for same memory)
- ✅ **Smoother gameplay** (fewer cache misses)

### Performance Impact

- Generation time: +5ms per chunk (~19% slower)
- Access time: +13ns per weight read (negligible)
- Overall impact: <0.2% of total generation time

**The memory savings far outweigh the minimal performance cost!**

---

## Migrating from v1.0 to v1.5 (Logging System)

### Changes

#### console.log Removed

**Before:**
```typescript
// Library used console.log internally
const chunk = await manager.getChunk(0, 0);
// Console: "[ChunkManager] Generating chunk (0, 0)"
```

**After:**
```typescript
import { configureLogger, LogLevel } from 'procedural-world-engine';

// Configure logging level
configureLogger({ level: LogLevel.WARN });  // Production
configureLogger({ level: LogLevel.DEBUG }); // Development

const chunk = await manager.getChunk(0, 0);
// Console: Only warnings and errors (production)
```

---

### Migration Steps

#### Step 1: Configure Logger

Add logger configuration at app startup:

```typescript
import { configureLogger, LogLevel } from 'procedural-world-engine';

// Development
if (process.env.NODE_ENV === 'development') {
  configureLogger({
    level: LogLevel.DEBUG,
    timestamps: true,
  });
}

// Production
if (process.env.NODE_ENV === 'production') {
  configureLogger({
    level: LogLevel.WARN,
  });
}
```

---

#### Step 2: Custom Log Handler (Optional)

If you want to send logs to an external service:

```typescript
configureLogger({
  level: LogLevel.ERROR,
  handler: (level, category, message, data) => {
    // Send to error tracking service
    if (level === LogLevel.ERROR) {
      errorTracker.captureMessage(message, {
        level: 'error',
        extra: { category, data },
      });
    }
  },
});
```

---

## Migrating from v0.9 to v1.0 (Error Handling)

### Changes

#### Error Recovery Options

**Before:**
```typescript
// Errors would crash the application
const manager = new ChunkManager({ seed: 12345 });
const chunk = await manager.getChunk(0, 0); // Could throw
```

**After:**
```typescript
// Configurable error recovery
const manager = new ChunkManager({
  seed: 12345,
  errorRecovery: {
    retryOnFailure: true,
    maxRetries: 3,
    allowPartialChunks: true,
    onError: (error) => {
      console.error('Generation error:', error);
    },
  },
});

const chunk = await manager.getChunk(0, 0); // Won't crash
```

---

### Migration Steps

#### Step 1: Add Error Recovery

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  errorRecovery: {
    retryOnFailure: true,
    maxRetries: 3,
    allowPartialChunks: true,
  },
});
```

---

#### Step 2: Handle Specific Errors

```typescript
import {
  ChunkGenerationError,
  TerrainGenerationError,
  BiomeGenerationError,
} from 'procedural-world-engine';

try {
  const chunk = manager.generateChunk(0, 0);
} catch (error) {
  if (error instanceof TerrainGenerationError) {
    console.error('Terrain generation failed');
  } else if (error instanceof BiomeGenerationError) {
    console.error('Biome generation failed');
  } else if (error instanceof ChunkGenerationError) {
    console.error('General generation error:', error.stage);
  }
}
```

---

## Migrating from v0.8 to v0.9 (Validation)

### Changes

#### Configuration Validation

**Before:**
```typescript
// Invalid config would cause cryptic runtime errors
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: -10,  // Invalid!
});
```

**After:**
```typescript
import { ValidationError } from 'procedural-world-engine';

try {
  const manager = new ChunkManager({
    seed: 12345,
    chunkSize: -10,  // Throws ValidationError
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Invalid ${error.field}: ${error.constraint}`);
    // "Invalid chunkSize: Must be between 4 and 256"
  }
}
```

---

### Migration Steps

#### Step 1: Wrap Constructor in Try-Catch

```typescript
import { ValidationError } from 'procedural-world-engine';

try {
  const manager = new ChunkManager(config);
} catch (error) {
  if (error instanceof ValidationError) {
    // Show user-friendly error message
    showError(`Configuration error: ${error.message}`);
  }
}
```

---

#### Step 2: Validate Config Before Creating Manager

```typescript
import { validateWorldConfig } from 'procedural-world-engine';

function createManager(config: WorldConfig) {
  try {
    // Validate first
    validateWorldConfig(config);
    
    // Create manager
    return new ChunkManager(config);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Invalid configuration:', error.field);
      return null;
    }
    throw error;
  }
}
```

---

## Common Migration Issues

### Issue 1: TypeScript Errors

**Problem:**
```typescript
// Error: Property 'biomeWeights' does not exist on type 'ChunkData'
const weight = chunk.biomeWeights[index];
```

**Solution:**
```typescript
import { getBiomeWeightForTile } from 'procedural-world-engine';

const weight = getBiomeWeightForTile(chunk, tileIndex, biomeType);
```

---

### Issue 2: Performance Regression

**Problem:**
After upgrading, chunk generation is slower.

**Solution:**
This is expected with sparse biome weights (+5ms per chunk). To optimize:

```typescript
// 1. Use smaller chunks
chunkSize: 16  // Instead of 32

// 2. Disable optional features
lakeConfig: { enabled: false }

// 3. Use worker pool
workerPoolConfig: {
  maxWorkers: 4,
  workerScriptUrl: '/worker.js',
}
```

---

### Issue 3: Saved Worlds Don't Load

**Problem:**
Worlds saved with v1.x don't load in v2.0.

**Solution:**
The serialization format is backward compatible. Sparse weights are reconstructed from biome maps:

```typescript
import { WorldSerializer } from 'procedural-world-engine';

const serializer = new WorldSerializer();

// Load old format
const oldData = JSON.parse(localStorage.getItem('world'));

// Create new manager
const manager = new ChunkManager({
  seed: oldData.seed,
  chunkSize: oldData.chunkSize,
});

// Deserialize (automatically converts to sparse)
serializer.deserialize(oldData, manager);
```

---

## Getting Help

If you encounter issues during migration:

1. Check the [FAQ](FAQ.md)
2. Search [existing issues](https://github.com/your-repo/issues)
3. Ask in [Discussions](https://github.com/your-repo/discussions)
4. Open a [new issue](https://github.com/your-repo/issues/new)

---

**[← Back to Documentation](README.md)**
