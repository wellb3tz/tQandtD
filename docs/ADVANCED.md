# 🚀 Advanced Topics

Advanced features and techniques for Procedural World Engine.

## Table of Contents

- [Multi-Threading](#multi-threading)
- [World Serialization](#world-serialization)
- [Custom Biomes](#custom-biomes)
- [Performance Profiling](#performance-profiling)
- [Custom Generators](#custom-generators)

---

## Multi-Threading

Use Web Workers to generate chunks in parallel without blocking the main thread.

### Setup

#### 1. Create Worker Script

```typescript
// worker.ts
import { installWorkerHandler } from 'procedural-world-engine/worker';

// Install message handler
installWorkerHandler();

// Worker is now ready to receive generation tasks
```

#### 2. Build Worker

```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        worker: 'worker.ts',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
};
```

#### 3. Configure ChunkManager

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  workerPoolConfig: {
    maxWorkers: navigator.hardwareConcurrency || 4,
    workerScriptUrl: '/worker.js',
    taskTimeout: 30000,
  },
});

// Chunks now generate in workers
const chunk = await manager.getChunk(0, 0);
```

---

### Worker Pool Architecture

```
Main Thread                    Worker Pool
    │                              │
    ├─ getChunk(0, 0) ────────────>│
    │                              ├─ Worker 1: Generate (0, 0)
    ├─ getChunk(1, 0) ────────────>│
    │                              ├─ Worker 2: Generate (1, 0)
    ├─ getChunk(0, 1) ────────────>│
    │                              ├─ Worker 3: Generate (0, 1)
    ├─ getChunk(1, 1) ────────────>│
    │                              ├─ Worker 4: Generate (1, 1)
    │                              │
    │<──────────── Chunk (0, 0) ───┤
    │<──────────── Chunk (1, 0) ───┤
    │<──────────── Chunk (0, 1) ───┤
    │<──────────── Chunk (1, 1) ───┤
```

---

### Parallel Generation

```typescript
// Generate 16 chunks in parallel
const promises = [];
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    promises.push(manager.getChunk(x, y));
  }
}

const chunks = await Promise.all(promises);
console.log(`Generated ${chunks.length} chunks in parallel`);
```

**Performance:**
- Without workers: 16 × 30ms = 480ms
- With 4 workers: ~120ms (4x faster)

---

### Error Handling

Workers automatically fall back to main thread on failure:

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  workerPoolConfig: {
    maxWorkers: 4,
    workerScriptUrl: '/worker.js',
    taskTimeout: 30000,
  },
  errorRecovery: {
    retryOnFailure: true,
    maxRetries: 3,
    onError: (error) => {
      console.error('Worker failed, falling back to main thread:', error);
    },
  },
});
```

---

### Worker Configuration

```typescript
interface WorkerPoolConfig {
  maxWorkers: number;        // Number of workers
  workerScriptUrl: string;   // Worker script URL
  taskTimeout: number;       // Task timeout (ms)
  worldConfig?: any;         // Config to send to workers
}
```

**Best Practices:**
- Use `navigator.hardwareConcurrency` for worker count
- Set timeout to 2-3x expected generation time
- Monitor worker failures and adjust configuration

---

## World Serialization

Save and load worlds with JSON or binary format.

### Basic Serialization

```typescript
import { WorldSerializer, SerializationFormat } from 'procedural-world-engine';

const serializer = new WorldSerializer();

// Generate some chunks
await manager.getChunk(0, 0);
await manager.getChunk(1, 0);
await manager.getChunk(0, 1);

// Serialize to JSON
const data = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  includeModifications: true,
});

// Save to localStorage
localStorage.setItem('world', JSON.stringify(data));
```

---

### Binary Serialization

Binary format is smaller and faster:

```typescript
// Serialize to binary
const data = serializer.serialize(manager, {
  format: SerializationFormat.BINARY,
  compression: true,  // Use zlib compression
});

// Size comparison (1000 chunks):
// JSON: ~7 MB
// Binary: ~3 MB
// Binary + compression: ~1 MB
```

---

### Region Export

Export only a specific region:

```typescript
const data = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  regionFilter: {
    minX: -10,
    maxX: 10,
    minY: -10,
    maxY: 10,
  },
});

console.log(`Exported ${data.chunks.length} chunks`);
```

---

### Deserialization

```typescript
// Load from localStorage
const savedData = localStorage.getItem('world');
if (savedData) {
  const data = JSON.parse(savedData);
  
  // Create manager with same seed
  const manager = new ChunkManager({
    seed: data.seed,
    chunkSize: data.chunkSize,
  });
  
  // Deserialize
  serializer.deserialize(data, manager);
  
  console.log('World loaded');
}
```

---

### Structure Delta Tracking

Track structure changes to chunks for delta saves:

```typescript
// Record structure addition
manager.recordStructureAddition(chunkX, chunkY, {
  x: 5,
  y: 10,
  type: StructureType.TOWER,
});

// Record structure removal
manager.recordStructureRemoval(chunkX, chunkY, structureIndex);

// Save only chunks with recorded system deltas
const delta = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  modifiedOnly: true,
});

console.log(`Saved ${delta.chunks.length} delta chunks`);
```

---

### File Download

```typescript
function downloadWorld(manager: ChunkManager, filename: string) {
  const serializer = new WorldSerializer();
  
  const data = serializer.serialize(manager, {
    format: SerializationFormat.BINARY,
    compression: true,
  });
  
  const blob = new Blob([JSON.stringify(data)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Download world
downloadWorld(manager, 'my-world.json');
```

---

## Custom Biomes

Create custom biome classification systems.

### Custom Biome Classifier

```typescript
import { BiomeType, ChunkData } from 'procedural-world-engine';

class CustomBiomeClassifier {
  classify(
    height: number,
    temperature: number,
    moisture: number
  ): BiomeType {
    // Custom classification logic
    if (height < 0.3) return BiomeType.OCEAN;
    if (height < 0.35) return BiomeType.BEACH;
    
    if (temperature > 0.8) {
      if (moisture < 0.3) return BiomeType.DESERT;
      if (moisture < 0.6) return BiomeType.SAVANNA;
      return BiomeType.RAINFOREST;
    }
    
    if (temperature > 0.5) {
      if (moisture < 0.4) return BiomeType.PLAINS;
      return BiomeType.FOREST;
    }
    
    if (temperature > 0.2) {
      return BiomeType.TAIGA;
    }
    
    if (height > 0.7) return BiomeType.MOUNTAIN;
    return BiomeType.TUNDRA;
  }
}
```

---

### Custom Biome Colors

```typescript
const BIOME_COLORS = {
  [BiomeType.OCEAN]: { r: 0.1, g: 0.3, b: 0.8 },
  [BiomeType.BEACH]: { r: 0.9, g: 0.8, b: 0.6 },
  [BiomeType.DESERT]: { r: 0.9, g: 0.7, b: 0.4 },
  [BiomeType.PLAINS]: { r: 0.5, g: 0.7, b: 0.3 },
  [BiomeType.FOREST]: { r: 0.2, g: 0.5, b: 0.2 },
  [BiomeType.TAIGA]: { r: 0.3, g: 0.4, b: 0.3 },
  [BiomeType.TUNDRA]: { r: 0.7, g: 0.7, b: 0.7 },
  [BiomeType.MOUNTAIN]: { r: 0.5, g: 0.5, b: 0.5 },
  [BiomeType.SAVANNA]: { r: 0.7, g: 0.6, b: 0.3 },
  [BiomeType.SWAMP]: { r: 0.3, g: 0.4, b: 0.3 },
  [BiomeType.RAINFOREST]: { r: 0.1, g: 0.4, b: 0.1 },
  [BiomeType.VOLCANIC]: { r: 0.3, g: 0.1, b: 0.1 },
  [BiomeType.GLACIER]: { r: 0.9, g: 0.9, b: 1.0 },
};

function getBiomeColor(biome: BiomeType) {
  return BIOME_COLORS[biome];
}
```

---

### Blended Biome Colors

```typescript
import { getBiomeWeightsForTile } from 'procedural-world-engine';

function calculateBlendedColor(
  chunk: ChunkData,
  tileIndex: number
): { r: number; g: number; b: number } {
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

## Performance Profiling

Monitor and optimize generation performance.

### Enable Metrics

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  enablePerformanceMetrics: true,
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
  },
});
```

---

### Measure Generation Time

```typescript
async function profileGeneration(
  manager: ChunkManager,
  chunkX: number,
  chunkY: number
): Promise<void> {
  const start = performance.now();
  const chunk = await manager.getChunk(chunkX, chunkY);
  const end = performance.now();
  
  console.log(`Generation time: ${(end - start).toFixed(2)}ms`);
  console.log(`Chunk size: ${chunk.size}×${chunk.size}`);
  console.log(`Resources: ${chunk.resources.length}`);
  console.log(`Structures: ${chunk.structures.length}`);
  console.log(`Lakes: ${chunk.lakes?.length || 0}`);
}
```

---

### Cache Statistics

```typescript
function logCacheStats(manager: ChunkManager): void {
  const stats = manager.getCacheStats();
  
  console.log('Cache Statistics:');
  console.log(`  Size: ${stats.size}/${stats.maxSize}`);
  console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Memory: ${(stats.size * 7).toFixed(1)} KB`);
}

// Log every 5 seconds
setInterval(() => logCacheStats(manager), 5000);
```

---

### Performance Monitor

```typescript
class PerformanceMonitor {
  private samples: number[] = [];
  private maxSamples = 100;
  
  record(time: number): void {
    this.samples.push(time);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }
  
  getStats() {
    if (this.samples.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0 };
    }
    
    const sorted = [...this.samples].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    return { min, max, avg, p95 };
  }
}

const monitor = new PerformanceMonitor();

async function generateWithMonitoring(x: number, y: number) {
  const start = performance.now();
  const chunk = await manager.getChunk(x, y);
  const end = performance.now();
  
  monitor.record(end - start);
  
  const stats = monitor.getStats();
  console.log(`Generation stats (last 100 chunks):`);
  console.log(`  Min: ${stats.min.toFixed(2)}ms`);
  console.log(`  Max: ${stats.max.toFixed(2)}ms`);
  console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
  console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
  
  return chunk;
}
```

---

## Custom Generators

Extend the engine with custom generation logic.

### Custom Resource Generator

```typescript
import { Resource, ResourceType, ChunkData } from 'procedural-world-engine';

class CustomResourceGenerator {
  generate(
    chunk: ChunkData,
    rng: SeededRNG
  ): Resource[] {
    const resources: Resource[] = [];
    
    // Custom logic: place resources near water
    for (const lake of chunk.lakes || []) {
      for (const tileIndex of lake.tiles) {
        const localX = tileIndex % chunk.size;
        const localY = Math.floor(tileIndex / chunk.size);
        
        // Check neighbors
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = localX + dx;
            const y = localY + dy;
            
            if (x >= 0 && x < chunk.size && y >= 0 && y < chunk.size) {
              if (rng.nextFloat() < 0.1) {
                resources.push({
                  x,
                  y,
                  type: ResourceType.GOLD,
                  amount: rng.nextInt(5, 20),
                });
              }
            }
          }
        }
      }
    }
    
    return resources;
  }
}
```

---

### Custom Structure Generator

```typescript
import { Structure, StructureType, ChunkData } from 'procedural-world-engine';

class CustomStructureGenerator {
  generate(
    chunk: ChunkData,
    rng: SeededRNG
  ): Structure[] {
    const structures: Structure[] = [];
    
    // Custom logic: place towers on mountain peaks
    const vertexSize = chunk.size + 1;
    
    for (let y = 1; y < chunk.size - 1; y++) {
      for (let x = 1; x < chunk.size - 1; x++) {
        const index = y * vertexSize + x;
        const height = chunk.heightmap[index];
        
        // Check if this is a local maximum
        let isPeak = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const nIndex = (y + dy) * vertexSize + (x + dx);
            if (chunk.heightmap[nIndex] >= height) {
              isPeak = false;
              break;
            }
          }
          if (!isPeak) break;
        }
        
        if (isPeak && height > 0.7 && rng.nextFloat() < 0.3) {
          structures.push({
            x,
            y,
            type: StructureType.TOWER,
          });
        }
      }
    }
    
    return structures;
  }
}
```

---

**[← Back to Documentation](README.md)**
