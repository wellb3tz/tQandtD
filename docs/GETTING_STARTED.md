# 🚀 Getting Started

Get up and running with Procedural World Engine in 5 minutes!

## Installation

### NPM

```bash
npm install procedural-world-engine
```

### Yarn

```bash
yarn add procedural-world-engine
```

### CDN (Browser)

```html
<script type="module">
  import { ChunkManager } from 'https://unpkg.com/procedural-world-engine';
</script>
```

## Basic Usage

### 1. Create a World Generator

```typescript
import { ChunkManager } from 'procedural-world-engine';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
});
```

### 2. Generate Your First Chunk

```typescript
// Async (recommended)
const chunk = await manager.getChunk(0, 0);

// Sync
const chunk = manager.generateChunk(0, 0);
```

### 3. Access Chunk Data

```typescript
// Heightmap (terrain elevation)
console.log('Height at (0,0):', chunk.heightmap[0]);

// Biomes
console.log('Biome at (0,0):', chunk.biomeMap[0]);

// Resources
console.log('Resources:', chunk.resources);

// Structures
console.log('Structures:', chunk.structures);

// Lakes
console.log('Lakes:', chunk.lakes);
```

## Complete Example

```typescript
import { 
  ChunkManager, 
  BiomeType, 
  ResourceType,
  getBiomeWeightsForTile 
} from 'procedural-world-engine';

// Create world generator
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    heightMultiplier: 2.0,
  },
  
  lakeConfig: {
    enabled: true,
    useMultiChunk: true,
  },
});

// Generate a 3x3 grid of chunks
for (let y = -1; y <= 1; y++) {
  for (let x = -1; x <= 1; x++) {
    const chunk = await manager.getChunk(x, y);
    console.log(`Chunk (${x}, ${y}):`, {
      resources: chunk.resources.length,
      structures: chunk.structures.length,
      lakes: chunk.lakes.length,
    });
  }
}

// Access biome weights (sparse representation)
const centerChunk = await manager.getChunk(0, 0);
const tileIndex = 16 * 32 + 16; // Center tile
const weights = getBiomeWeightsForTile(centerChunk, tileIndex);

console.log('Biome weights at center:');
for (const [biome, weight] of weights) {
  console.log(`  ${BiomeType[biome]}: ${(weight * 100).toFixed(1)}%`);
}

// Cache statistics
const stats = manager.getCacheStats();
console.log('Cache stats:', {
  size: stats.size,
  maxSize: stats.maxSize,
  hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
});
```

## Next Steps

- 📖 Read the [API Reference](API.md) for detailed documentation
- 🎨 Check out [Examples](EXAMPLES.md) for more use cases
- ⚙️ Learn about [Configuration](CONFIGURATION.md) options
- ⚡ Optimize with the [Performance Guide](PERFORMANCE.md)

## Common Patterns

### Loading Chunks Around a Position

```typescript
async function loadChunksAround(worldX: number, worldY: number, radius: number) {
  const chunkSize = 32;
  const centerChunkX = Math.floor(worldX / chunkSize);
  const centerChunkY = Math.floor(worldY / chunkSize);
  
  const chunks = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const chunk = await manager.getChunk(
        centerChunkX + dx,
        centerChunkY + dy
      );
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

// Load 5x5 grid around position (100, 200)
const chunks = await loadChunksAround(100, 200, 2);
```

### Converting Coordinates

```typescript
import { worldToChunk, chunkToWorld, localToIndex } from 'procedural-world-engine';

// World position → Chunk coordinates
const worldX = 100, worldY = 200;
const [chunkX, chunkY] = worldToChunk(worldX, worldY, 32);
console.log(`Position (${worldX}, ${worldY}) is in chunk (${chunkX}, ${chunkY})`);

// Chunk coordinates → World position (top-left corner)
const [wx, wy] = chunkToWorld(chunkX, chunkY, 32);

// Local tile → Array index
const localX = 5, localY = 10;
const index = localToIndex(localX, localY, 32);
console.log(`Tile (${localX}, ${localY}) is at index ${index}`);
```

### Error Handling

```typescript
import { ChunkGenerationError } from 'procedural-world-engine';

try {
  const chunk = manager.generateChunk(0, 0);
} catch (error) {
  if (error instanceof ChunkGenerationError) {
    console.error('Generation failed at stage:', error.stage);
    console.error('Chunk coordinates:', error.chunkX, error.chunkY);
    console.error('Original error:', error.cause);
  }
}
```

### Logging Configuration

```typescript
import { configureLogger, LogLevel, LogCategory } from 'procedural-world-engine';

// Development: show all logs
configureLogger({
  level: LogLevel.DEBUG,
  timestamps: true,
});

// Production: only warnings and errors
configureLogger({
  level: LogLevel.WARN,
});

// Filter by category
configureLogger({
  level: LogLevel.INFO,
  categories: new Set([LogCategory.CHUNK, LogCategory.PERFORMANCE]),
});

// Disable all logging
configureLogger({
  level: LogLevel.NONE,
});
```

## Troubleshooting

### Slow Generation

If chunk generation is slow:

1. **Reduce chunk size**: Try 16 instead of 32
2. **Disable features**: Turn off lakes, resources, or structures
3. **Use Web Workers**: Enable `workerPoolConfig`
4. **Reduce octaves**: Lower `terrainConfig.octaves` to 2-3

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 16,  // Smaller chunks
  terrainConfig: {
    octaves: 3,   // Fewer octaves
  },
  lakeConfig: {
    enabled: false,  // Disable lakes
  },
});
```

### High Memory Usage

If memory usage is too high:

1. **Reduce cache size**: Lower `maxCacheSize`
2. **Clear cache periodically**: Call `manager.clearCache()`
3. **Use smaller chunks**: Reduce `chunkSize`

```typescript
const manager = new ChunkManager({
  seed: 12345,
  maxCacheSize: 100,  // Smaller cache
});

// Clear cache when needed
setInterval(() => {
  manager.clearCache();
}, 60000); // Every minute
```

### Validation Errors

If you get `ValidationError`:

```typescript
import { ValidationError } from 'procedural-world-engine';

try {
  const manager = new ChunkManager({
    seed: 12345,
    chunkSize: 1000,  // Too large!
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid config:', error.field);
    console.error('Constraint:', error.constraint);
    console.error('Value:', error.value);
  }
}
```

Check the [Configuration Guide](CONFIGURATION.md) for valid ranges.

## What's Next?

Now that you have the basics, explore:

- 🎨 [Examples](EXAMPLES.md) - More code examples
- 📖 [API Reference](API.md) - Complete API docs
- ⚙️ [Configuration](CONFIGURATION.md) - All config options
- ⚡ [Performance](PERFORMANCE.md) - Optimization tips
- 🏗️ [Architecture](ARCHITECTURE.md) - How it works

---

**[← Back to Documentation](README.md)**
