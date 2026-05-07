# Frequently Asked Questions

Common questions and answers about Procedural World Engine.

## Table of Contents

- [General](#general)
- [Performance](#performance)
- [Configuration](#configuration)
- [Biomes](#biomes)
- [Lakes](#lakes)
- [Serialization](#serialization)
- [Troubleshooting](#troubleshooting)

---

## General

### What is Procedural World Engine?

A TypeScript library for generating infinite, deterministic procedural worlds in the browser. It uses seed-based random number generation to create terrain, biomes, lakes, resources, and structures.

---

### Is it deterministic?

Yes! The same seed always produces the same world, on any device. This is guaranteed by:
- Seeded random number generator (RNG)
- Platform-independent hash functions
- No floating-point precision issues
- Order-independent chunk generation

---

### Can I use it in production?

Yes! The library is:
- Well-tested (151 tests, 100% pass rate)
- Memory efficient (~7 KB per 32x32 chunk)
- Performance optimized (<100ms per chunk)
- Actively maintained

---

### What browsers are supported?

All modern browsers with ES2020 support:
- Chrome 80+
- Firefox 74+
- Safari 13.1+
- Edge 80+

Web Workers require additional browser support (all modern browsers).

---

### Is it open source?

Yes! MIT license. See the repository for details.

---

## Performance

### How fast is chunk generation?

Typical generation times (32x32 chunk):
- Terrain only: ~8ms
- Terrain + biomes: ~15ms
- Full generation (no lakes): ~20ms
- Full generation (with lakes): ~115ms

Target: <100ms per chunk OK

---

### Why are lakes so slow?

Lakes use flood-fill algorithm which is computationally expensive:
- BFS traversal of terrain
- Multi-chunk coordination
- Water level calculation

**Optimization tips:**
1. Disable lakes if not needed: `lakeConfig.enabled = false`
2. Reduce max lake size: `maxLakeTiles: 40`
3. Increase noise threshold: `noiseThreshold: 0.7` (fewer lakes)

---

### How much memory does it use?

Memory per chunk (32x32):
- Heightmap: 1.13 KB
- Biome map: 0.25 KB
- Sparse biome weights: 3.96 KB
- Resources: 1.59 KB
- Structures: 0.09 KB
- **Total: ~7 KB**

Cache memory:
- 100 chunks: ~700 KB
- 500 chunks: ~3.5 MB
- 1000 chunks: ~7 MB

---

### How can I improve performance?

1. **Use smaller chunks**: `chunkSize: 16` instead of `32`
2. **Disable features**: Turn off lakes, resources, structures
3. **Reduce octaves**: `terrainConfig.octaves: 2` instead of `4`
4. **Enable workers**: Use `workerPoolConfig` for parallel generation
5. **Reduce cache size**: `maxCacheSize: 100` instead of `1000`
6. **Preload chunks**: Load chunks before they're needed

See [Performance Guide](PERFORMANCE.md) for details.

---

### What's the cache hit rate?

Typically 50-70% depending on:
- Movement patterns (linear = higher hit rate)
- Cache size (larger = higher hit rate)
- View distance (smaller = higher hit rate)

---

## Configuration

### What's a good starting configuration?

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
    heightMultiplier: 1.0,
  },
  lakeConfig: {
    enabled: true,
    useMultiChunk: true,
  },
  maxCacheSize: 500,
});
```

This provides balanced performance and quality.

---

### How do I make flat terrain?

```typescript
terrainConfig: {
  baseScale: 0.001,      // Very large features
  octaves: 1,            // No detail
  persistence: 0,        // No amplitude decay
  lacunarity: 1,         // No frequency change
  warpStrength: 0,       // No warping
  heightMultiplier: 0.1, // Very flat
}
```

---

### How do I make mountainous terrain?

```typescript
terrainConfig: {
  baseScale: 0.005,      // Medium features
  octaves: 6,            // Lots of detail
  persistence: 0.6,      // Strong detail
  lacunarity: 2.5,       // High frequency
  warpStrength: 50,      // Strong warping
  heightMultiplier: 3.0, // Very tall
}
```

---

### How do I create an island world?

```typescript
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
}
```

---

### What's the valid range for each config value?

See [Configuration Guide](CONFIGURATION.md) for complete validation rules.

Common ranges:
- `chunkSize`: 4-256
- `baseScale`: 0.001-0.1
- `octaves`: 1-16
- `persistence`: 0-1
- `lacunarity`: 1-4
- `warpStrength`: 0-100
- `heightMultiplier`: 0.1-10

---

## Biomes

### How many biome types are there?

13 biome types:
- OCEAN
- BEACH
- DESERT
- PLAINS
- FOREST
- TAIGA
- TUNDRA
- MOUNTAIN
- SAVANNA
- SWAMP
- RAINFOREST
- VOLCANIC
- GLACIER

---

### How do I access biome weights?

```typescript
import { getBiomeWeightsForTile } from 'procedural-world-engine';

const chunk = await manager.getChunk(0, 0);
const tileIndex = 16 * 32 + 16; // Center tile
const weights = getBiomeWeightsForTile(chunk, tileIndex);

for (const [biome, weight] of weights) {
  console.log(`${BiomeType[biome]}: ${(weight * 100).toFixed(1)}%`);
}
```

---

### What are elevation bands?

Mountain zones based on elevation:
- **FOOTHILLS**: Below tree line
- **SLOPES**: Tree line to snow line
- **PEAKS**: Above snow line

Enable with:
```typescript
enhancedBiomeConfig: {
  enableElevationBands: true,
  snowLineElevation: 0.8,
  treeLineElevation: 0.75,
}
```

---

### Why did biome weights change in v2.0?

v2.0 introduced sparse biome weights to reduce memory usage:
- Before: 13 KB per chunk (dense array)
- After: 3.96 KB per chunk (sparse array)
- Savings: 70% less memory

See [Migration Guide](MIGRATION_GUIDE.md) for upgrade instructions.

---

## Lakes

### How do lakes work?

Lakes use flood-fill algorithm:
1. Find seed tiles (depressions in allowed biomes)
2. BFS flood-fill from seed
3. Track water level and depth
4. Stop at max tiles or max depth
5. Cache results for multi-chunk lakes

---

### Can lakes span multiple chunks?

Yes! Enable with:
```typescript
lakeConfig: {
  enabled: true,
  useMultiChunk: true,
}
```

Multi-chunk lakes are cached and shared across chunks.

---

### Why don't I see any lakes?

Common reasons:
1. **Lakes disabled**: Check `lakeConfig.enabled`
2. **Threshold too high**: Lower `noiseThreshold` (try 0.5)
3. **Wrong biomes**: Check `allowedBiomes` includes your terrain
4. **Elevation range**: Adjust `minElevation` and `maxElevation`
5. **Terrain too flat**: Lakes need depressions

---

### How do I disable lakes?

```typescript
lakeConfig: {
  enabled: false,
}
```

This saves ~80-100ms per chunk.

---

### Can I have ocean and lakes?

Yes! Ocean is a biome (height < 0.3), lakes are separate features placed on land.

---

## Serialization

### How do I save a world?

```typescript
import { WorldSerializer, SerializationFormat } from 'procedural-world-engine';

const serializer = new WorldSerializer();

const data = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  modifiedOnly: false,
});

localStorage.setItem('world', JSON.stringify(data));
```

---

### What's the difference between JSON and binary format?

| Format | Size | Speed | Human-readable |
|--------|------|-------|----------------|
| JSON | Large | Slow | Yes |
| Binary | Small | Fast | No |
| Binary + compression | Smallest | Medium | No |

**Recommendation:** Use binary with compression for production.

---

### Can I save only chunks with recorded system deltas?

Yes!

```typescript
const delta = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  modifiedOnly: true,
});
```

This only saves chunks that have recorded system deltas, such as generated-content changes tracked by the runtime.

---

### How do I load a saved world?

```typescript
const savedData = localStorage.getItem('world');
if (savedData) {
  const data = JSON.parse(savedData);
  
  const manager = new ChunkManager({
    seed: data.seed,
    chunkSize: data.chunkSize,
  });
  
  serializer.deserialize(data, manager);
}
```

---

### Are saved worlds compatible across versions?

Generally yes, but:
- v1.x -> v2.0: Biome weights automatically converted to sparse format
- Major version changes may require migration

See [Migration Guide](MIGRATION_GUIDE.md) for details.

---

## Troubleshooting

### I get "ValidationError: chunkSize must be between 4 and 256"

Your `chunkSize` is outside the valid range. Use a value between 4 and 256:

```typescript
chunkSize: 32  // Valid
```

---

### I get "ChunkGenerationError: Terrain generation failed"

Terrain generation failed. Check:
1. **Config values**: Ensure all values are finite numbers
2. **Error recovery**: Enable error recovery for graceful degradation
3. **Logs**: Check console for detailed error messages

```typescript
errorRecovery: {
  retryOnFailure: true,
  maxRetries: 3,
  allowPartialChunks: true,
}
```

---

### Chunks are generating very slowly

See [Performance](#performance) section above.

Quick fixes:
1. Disable lakes: `lakeConfig.enabled = false`
2. Reduce octaves: `terrainConfig.octaves = 2`
3. Use smaller chunks: `chunkSize: 16`
4. Enable workers: Add `workerPoolConfig`

---

### Memory usage is too high

Reduce cache size:

```typescript
maxCacheSize: 100  // Instead of 1000
```

Or clear cache periodically:

```typescript
setInterval(() => {
  manager.clearCache();
}, 60000); // Every minute
```

---

### Worker pool isn't working

Check:
1. **Worker script exists**: Verify `workerScriptUrl` is correct
2. **Worker script built**: Ensure worker is included in build
3. **CORS**: Worker must be same-origin or CORS-enabled
4. **Console errors**: Check for worker initialization errors

---

### Biome weights are all zero

You're using the old dense array access pattern. Use helper functions:

```typescript
// вќЊ Old way (doesn't work in v2.0)
const weight = chunk.biomeWeights[tileIndex * 13 + biome];

// OK New way
import { getBiomeWeightForTile } from 'procedural-world-engine';
const weight = getBiomeWeightForTile(chunk, tileIndex, biome);
```

See [Migration Guide](MIGRATION_GUIDE.md) for details.

---

### How do I enable debug logging?

```typescript
import { configureLogger, LogLevel } from 'procedural-world-engine';

configureLogger({
  level: LogLevel.DEBUG,
  timestamps: true,
});
```

This shows all internal logs including:
- Chunk generation
- Cache operations
- Lake generation
- Worker pool activity

---

### Where can I get help?

1. Check this FAQ
2. Read the [documentation](README.md)
3. Search [existing issues](https://github.com/your-repo/issues)
4. Ask in [Discussions](https://github.com/your-repo/discussions)
5. Open a [new issue](https://github.com/your-repo/issues/new)

---

## Still Have Questions?

If your question isn't answered here:

1. Check the [Getting Started Guide](GETTING_STARTED.md)
2. Read the [API Reference](API.md)
3. Browse [Examples](EXAMPLES.md)
4. Review [Configuration Guide](CONFIGURATION.md)
5. Ask in [GitHub Discussions](https://github.com/your-repo/discussions)

---

**[Back to Documentation](README.md)**


