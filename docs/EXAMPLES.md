# 💡 Examples

Practical code examples for common use cases.

Repository examples are available in `examples/`:

- `examples/basic-world.ts` - generate one chunk and inspect biome weights
- `examples/world-session.ts` - manage loading and regeneration through `WorldSession`
- `examples/rendering-data.ts` - build renderer-neutral terrain, water, foliage, and overlay data
- `examples/three-adapter.ts` - connect runtime renderer calls to a Three.js-facing target

## Table of Contents

- [Basic World Generation](#basic-world-generation)
- [Custom Terrain](#custom-terrain)
- [Biome Configuration](#biome-configuration)
- [Resource Placement](#resource-placement)
- [Multi-Threading](#multi-threading)
- [Serialization](#serialization)
- [Coordinate Conversion](#coordinate-conversion)
- [Performance Optimization](#performance-optimization)

---

## Basic World Generation

### Simple World

```typescript
import { ChunkManager } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
});

// Generate a single chunk
const chunk = await manager.getChunk(0, 0);

console.log('Chunk generated:', {
  size: chunk.size,
  heightRange: [
    Math.min(...chunk.heightmap),
    Math.max(...chunk.heightmap),
  ],
  resources: chunk.resources.length,
  structures: chunk.structures.length,
});
```

---

### Generate Multiple Chunks

```typescript
// Generate a 5x5 grid of chunks
async function generateGrid(centerX: number, centerY: number, radius: number) {
  const chunks = [];
  
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      const chunk = await manager.getChunk(x, y);
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

const chunks = await generateGrid(0, 0, 2);
console.log(`Generated ${chunks.length} chunks`);
```

---

### Load Chunks Around Player

```typescript
import { worldToChunk } from 'procedural-world-engine';

async function loadChunksAroundPlayer(
  playerX: number,
  playerY: number,
  viewDistance: number
) {
  const chunkSize = 32;
  const [centerChunkX, centerChunkY] = worldToChunk(playerX, playerY, chunkSize);
  
  const loadedChunks = new Map();
  
  for (let dy = -viewDistance; dy <= viewDistance; dy++) {
    for (let dx = -viewDistance; dx <= viewDistance; dx++) {
      const chunkX = centerChunkX + dx;
      const chunkY = centerChunkY + dy;
      const key = `${chunkX},${chunkY}`;
      
      const chunk = await manager.getChunk(chunkX, chunkY);
      loadedChunks.set(key, chunk);
    }
  }
  
  return loadedChunks;
}

// Load 3x3 chunks around player at (100, 200)
const chunks = await loadChunksAroundPlayer(100, 200, 1);
```

---

## Custom Terrain

### Flat World

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.001,      // Very large features
    octaves: 1,            // No detail
    persistence: 0,        // No amplitude decay
    lacunarity: 1,         // No frequency change
    warpStrength: 0,       // No warping
    heightMultiplier: 0.1, // Very flat
  },
});
```

---

### Mountainous World

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.005,      // Medium features
    octaves: 6,            // Lots of detail
    persistence: 0.6,      // Strong detail
    lacunarity: 2.5,       // High frequency
    warpStrength: 50,      // Strong warping
    heightMultiplier: 3.0, // Very tall
  },
});
```

---

### Island World

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 20,
    heightMultiplier: 1.5,
    enableContinentalness: true,
    continentalScale: 0.002,
    continentalStrength: 0.6,  // Strong island effect
  },
});
```

---

### 3D Volumetric Terrain

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 2.0,
    enable3D: true,        // Enable 3D noise
    zScale: 0.5,           // Z-axis scale
  },
});
```

---

## Biome Configuration

### Enhanced Biomes with Transitions

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  enhancedBiomeConfig: {
    temperatureScale: 0.001,
    moistureScale: 0.001,
    blendRadius: 0.5,
    
    // Transitions
    enableTransitions: true,
    transitionWidth: 10,
    
    
    // Elevation bands
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75,
    
    // Climate system
    enableClimateSystem: true,
    enableCompatibilityMatrix: true,
  },
});
```

---

### Access Biome Weights

```typescript
import { getBiomeWeightsForTile, BiomeType } from 'procedural-world-engine';

const chunk = await manager.getChunk(0, 0);

// Get weights for center tile
const centerIndex = 16 * 32 + 16;
const weights = getBiomeWeightsForTile(chunk, centerIndex);

console.log('Biome composition:');
for (const [biome, weight] of weights) {
  if (weight > 0.01) {  // Only show significant weights
    console.log(`  ${BiomeType[biome]}: ${(weight * 100).toFixed(1)}%`);
  }
}
```

---

### Find Specific Biome

```typescript
function findBiomeTiles(chunk: ChunkData, targetBiome: BiomeType): number[] {
  const tiles = [];
  
  for (let i = 0; i < chunk.biomeMap.length; i++) {
    if (chunk.biomeMap[i] === targetBiome) {
      tiles.push(i);
    }
  }
  
  return tiles;
}

const chunk = await manager.getChunk(0, 0);
const forestTiles = findBiomeTiles(chunk, BiomeType.FOREST);
console.log(`Found ${forestTiles.length} forest tiles`);
```

---

## Resource Placement

### Custom Resources

```typescript
import { ResourceType, BiomeType } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  resourceConfig: {
    types: [
      // Iron in mountains
      {
        type: ResourceType.IRON,
        rarity: 0.3,
        biomes: [BiomeType.MOUNTAIN, BiomeType.TUNDRA],
        minAmount: 10,
        maxAmount: 50,
      },
      // Gold (rare) in mountains
      {
        type: ResourceType.GOLD,
        rarity: 0.1,
        biomes: [BiomeType.MOUNTAIN],
        minAmount: 5,
        maxAmount: 20,
      },
      // Wood in forests
      {
        type: ResourceType.WOOD,
        rarity: 0.5,
        biomes: [BiomeType.FOREST, BiomeType.TAIGA],
        minAmount: 20,
        maxAmount: 100,
      },
    ],
    clusterScale: 20,
    densityThreshold: 0.6,
  },
});
```

---

### Find Resources

```typescript
function findResourcesInArea(
  manager: ChunkManager,
  worldX: number,
  worldY: number,
  radius: number,
  resourceType: ResourceType
): Resource[] {
  const chunkSize = 32;
  const [centerChunkX, centerChunkY] = worldToChunk(worldX, worldY, chunkSize);
  const chunkRadius = Math.ceil(radius / chunkSize);
  
  const resources = [];
  
  for (let dy = -chunkRadius; dy <= chunkRadius; dy++) {
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      const chunk = manager.generateChunk(
        centerChunkX + dx,
        centerChunkY + dy
      );
      
      for (const resource of chunk.resources) {
        if (resource.type === resourceType) {
          const worldResourceX = chunk.x * chunkSize + resource.x;
          const worldResourceY = chunk.y * chunkSize + resource.y;
          const distance = Math.sqrt(
            (worldResourceX - worldX) ** 2 +
            (worldResourceY - worldY) ** 2
          );
          
          if (distance <= radius) {
            resources.push({
              ...resource,
              worldX: worldResourceX,
              worldY: worldResourceY,
            });
          }
        }
      }
    }
  }
  
  return resources;
}

// Find all iron within 100 units of (500, 500)
const iron = findResourcesInArea(manager, 500, 500, 100, ResourceType.IRON);
console.log(`Found ${iron.length} iron deposits`);
```

---

## Multi-Threading

### Enable Worker Pool

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

// Chunks will now generate in parallel
const chunks = await Promise.all([
  manager.getChunk(0, 0),
  manager.getChunk(1, 0),
  manager.getChunk(0, 1),
  manager.getChunk(1, 1),
]);
```

---

### Worker Script (worker.js)

```typescript
// worker.js
import { installWorkerHandler } from 'procedural-world-engine';

// Install message handler
installWorkerHandler();

// Worker is now ready to generate chunks
```

---

## Serialization

### Save World (JSON)

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

// Save to file or localStorage
localStorage.setItem('world', JSON.stringify(data));
console.log('World saved');
```

---

### Save World (Binary)

```typescript
// Serialize to binary (smaller, faster)
const data = serializer.serialize(manager, {
  format: SerializationFormat.BINARY,
  compression: true,
});

// Convert to Blob for download
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
const url = URL.createObjectURL(blob);

// Trigger download
const a = document.createElement('a');
a.href = url;
a.download = 'world.json';
a.click();
```

---

### Load World

```typescript
// Load from localStorage
const savedData = localStorage.getItem('world');
if (savedData) {
  const data = JSON.parse(savedData);
  
  // Create new manager with same seed
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

### Export Region

```typescript
// Export only chunks in a specific region
const data = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  regionFilter: {
    minX: 0,
    maxX: 10,
    minY: 0,
    maxY: 10,
  },
});

console.log(`Exported ${data.chunks.length} chunks`);
```

---

## Coordinate Conversion

### World to Chunk

```typescript
import { worldToChunk, worldToLocal } from 'procedural-world-engine';

const worldX = 100;
const worldY = 200;
const chunkSize = 32;

// Get chunk coordinates
const [chunkX, chunkY] = worldToChunk(worldX, worldY, chunkSize);
console.log(`World (${worldX}, ${worldY}) is in chunk (${chunkX}, ${chunkY})`);

// Get local coordinates within chunk
const [localX, localY] = worldToLocal(worldX, worldY, chunkSize);
console.log(`Local coordinates: (${localX}, ${localY})`);
```

---

### Get Height at World Position

```typescript
import { worldToChunk, worldToLocal, localToIndex } from 'procedural-world-engine';

async function getHeightAt(worldX: number, worldY: number): Promise<number> {
  const chunkSize = 32;
  const [chunkX, chunkY] = worldToChunk(worldX, worldY, chunkSize);
  const [localX, localY] = worldToLocal(worldX, worldY, chunkSize);
  
  const chunk = await manager.getChunk(chunkX, chunkY);
  
  // Heightmap is (size+1) x (size+1)
  const index = localY * (chunkSize + 1) + localX;
  return chunk.heightmap[index];
}

const height = await getHeightAt(100, 200);
console.log(`Height at (100, 200): ${height}`);
```

---

## Performance Optimization

### Minimal Configuration

```typescript
// Fastest generation (minimal features)
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 16,  // Smaller chunks
  terrainConfig: {
    octaves: 2,   // Fewer octaves
  },
  lakeConfig: {
    enabled: false,  // Disable lakes
  },
  resourceConfig: {
    types: [],  // No resources
  },
  structureConfig: {
    types: [],  // No structures
  },
});

// ~5ms per chunk
```

---

### Balanced Configuration

```typescript
// Good balance of features and performance
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    octaves: 4,
  },
  lakeConfig: {
    enabled: true,
    useMultiChunk: true,
  },
  maxCacheSize: 500,
});

// ~30ms per chunk
```

---

### Preload Chunks

```typescript
// Preload chunks in background
async function preloadChunks(centerX: number, centerY: number, radius: number) {
  const promises = [];
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      promises.push(manager.getChunk(centerX + dx, centerY + dy));
    }
  }
  
  await Promise.all(promises);
  console.log(`Preloaded ${promises.length} chunks`);
}

// Preload 5x5 grid
await preloadChunks(0, 0, 2);
```

---

### Monitor Performance

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  enablePerformanceMetrics: true,
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
  },
});

// Generate chunk and log metrics
const start = performance.now();
const chunk = await manager.getChunk(0, 0);
const end = performance.now();

console.log(`Generation time: ${(end - start).toFixed(2)}ms`);

const stats = manager.getCacheStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

---

**[← Back to Documentation](README.md)**
