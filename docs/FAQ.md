# Frequently Asked Questions

Common questions and answers about tQandtD project.

## Table of Contents

- [General](#general)
- [Performance](#performance)
- [Configuration](#configuration)
- [Biomes](#biomes)
- [Lakes](#lakes)
- [Rivers](#rivers)
- [Serialization](#serialization)
- [Troubleshooting](#troubleshooting)

---

## General

### What is tQandtD project?

A TypeScript library for generating infinite, deterministic procedural worlds in the browser. It uses seed-based random number generation to create terrain, biomes, rivers, lakes, resources, and structures.

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
- Well-tested (416 tests)
- Memory efficient (~6.2 KB per 32x32 chunk)
- Performance optimized (<100ms per chunk in most configurations)
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
- Terrain only: ~0.3ms
- Terrain + biomes: ~20ms
- Full generation (no rivers): ~20ms
- Full generation (with rivers): ~60ms

Target: <100ms per chunk.

---

### Why are rivers relatively slow?

Rivers use A* pathfinding with elevation constraints, which is more expensive than noise-based generation:
- Source point discovery across neighboring chunks
- Pathfinding with elevation budgets
- Terrain carving and corridor smoothing
- Tributary generation

**Optimization tips:**
1. Disable rivers if not needed: `riverConfig.enabled = false`
2. Reduce `maxRiversPerRegion` (default is low already)
3. Lower `maxLength` for shorter rivers

---

### How much memory does it use?

Memory per chunk (32x32):
- Heightmap: 1.13 KB
- Biome map: 0.25 KB
- Sparse biome weights: 4.75 KB
- Resources: ~0 KB (depends on density)
- Structures: 0.09 KB
- **Total: ~6.2 KB**

Cache memory:
- 100 chunks: ~620 KB
- 500 chunks: ~3.1 MB
- 1000 chunks: ~6.2 MB

---

### How can I improve performance?

1. **Use smaller chunks**: `chunkSize: 16` instead of `32`
2. **Disable rivers**: `riverConfig.enabled = false` (biggest saving)
3. **Disable features**: Turn off lakes, resources, structures
4. **Reduce octaves**: `terrainConfig.octaves: 2` instead of `4`
5. **Enable workers**: Use `workerPoolConfig` for parallel generation
6. **Reduce cache size**: `maxCacheSize: 100` instead of `1000`
7. **Preload chunks**: Load chunks before they're needed

See [Performance Guide](PERFORMANCE.md) for details.

---

### What's the cache hit rate?

Typically ~50% depending on:
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
  lakeConfig: { enabled: true },
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

15 biome types:
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
- POLAR
- STEPPE
- DRY_FOREST

---

### How do I access biome weights?

```typescript
import { getBiomeWeightsForTile } from 'tqandtd-project';

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

## Lakes

### How do lakes work?

Lakes use a noise-guided fill-to-spill algorithm:
1. Find candidate regions using low-frequency noise
2. Run flood-fill from seed inside each candidate
3. Compute water level from the lowest escape point (spill point)
4. Cache results for multi-chunk lakes

---

### Can lakes span multiple chunks?

Yes. The lake manager automatically handles multi-chunk lakes and shares cached state across chunk boundaries.

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

This saves ~3ms per chunk.

---

### Can I have ocean and lakes?

Yes! Ocean is a biome (height < 0.3), lakes are separate features placed on land.

---

## Rivers

### How do rivers work?

Rivers are generated using A* pathfinding:
1. Find source points in suitable biomes and elevations
2. Build downhill paths respecting elevation budgets
3. Smooth and create corridor geometry
4. Carve terrain depression into the heightmap

---

### Can rivers span multiple chunks?

Yes. Rivers are generated in world space and clipped to each chunk.

---

### Why don't I see any rivers?

Common reasons:
1. **Rivers disabled**: Check `riverConfig.enabled`
2. **Threshold too high**: Lower `sourceThreshold`
3. **Wrong biomes**: Check `allowedSourceBiomes`
4. **Elevation range**: Adjust `minSourceElevation` and `maxSourceElevation`

---

### How do I disable rivers?

```typescript
riverConfig: {
  enabled: false,
}
```

This can save ~40-60ms per chunk.

---

## Serialization

### How do I save a world?

```typescript
import { WorldSerializer, SerializationFormat } from 'tqandtd-project';

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

### Can I save only modified chunks?

Yes!

```typescript
const delta = serializer.serialize(manager, {
  format: SerializationFormat.JSON,
  modifiedOnly: true,
});
```

This only saves chunks that have recorded modifications, such as structure additions/removals.

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
1. Disable rivers: `riverConfig.enabled = false`
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

### How do I enable debug logging?

```typescript
import { configureLogger, LogLevel } from 'tqandtd-project';

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
3. Review the test suite for usage examples
4. Open an issue in the project repository

---

## Still Have Questions?

If your question isn't answered here:

1. Check the [Getting Started Guide](GETTING_STARTED.md)
2. Read the [API Reference](API.md)
3. Browse [Examples](EXAMPLES.md)
4. Review [Configuration Guide](CONFIGURATION.md)

---

**[Back to Documentation](README.md)**
