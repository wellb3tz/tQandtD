# Performance Guide

Optimization tips and benchmarks for Procedural World Engine.

## Table of Contents

- [Benchmarks](#benchmarks)
- [Memory Usage](#memory-usage)
- [Optimization Strategies](#optimization-strategies)
- [Configuration Tuning](#configuration-tuning)
- [Profiling](#profiling)
- [Best Practices](#best-practices)

---

## Benchmarks

Measured on modern desktop hardware (Intel i7 class, Node.js / Vitest environment). Browser times may vary slightly.

### Generation Time

| Chunk Size | No Lakes | With Lakes | With Rivers |
|------------|----------|------------|-------------|
| 16x16      | ~5ms     | ~5ms       | ~15ms       |
| 32x32      | ~20ms    | ~20ms      | ~63ms       |
| 64x64      | ~244ms   | ~250ms     | ~350ms      |

**Target**: <100ms per 32x32 chunk

> **Note**: Lake generation is heavily optimized and adds only a few milliseconds in most cases. The largest cost for feature-rich chunks comes from **river generation** and **biome blending**.

---

### Cache Performance

| Metric | Value |
|--------|-------|
| Cache hit rate | ~50% |
| Cached access | ~0.01ms |
| Cache miss | ~20ms (regeneration, 32x32) |

---

### Memory Usage

#### Per Chunk (32x32)

| Component | Size | Percentage |
|-----------|------|------------|
| Heightmap | 1.13 KB | 18% |
| Biome map | 0.25 KB | 4% |
| **Biome weights** | **4.75 KB** | **76%** |
| Resources | ~0 KB | 0% |
| Structures | 0.09 KB | 1% |
| **Total** | **~6.2 KB** | **100%** |

#### Cache Memory

| Cache Size | Memory (32x32) |
|------------|----------------|
| 100 chunks | ~620 KB |
| 500 chunks | ~3.1 MB |
| 1000 chunks | ~6.2 MB |

---

## Optimization Strategies

### 1. Chunk Size Selection

Choose chunk size based on your use case:

#### Small Chunks (16x16)
```typescript
chunkSize: 16
```

**Pros:**
- Very fast generation (~5ms)
- Low memory per chunk
- Quick loading

**Cons:**
- More chunks to manage
- More cache misses
- More chunk boundaries

**Best for:** Fast-paced games, mobile devices

---

#### Medium Chunks (32x32) - Recommended
```typescript
chunkSize: 32
```

**Pros:**
- Balanced performance (~20ms without rivers)
- Good cache efficiency
- Reasonable memory usage

**Cons:**
- Moderate generation time

**Best for:** Most use cases, desktop games

---

#### Large Chunks (64x64)
```typescript
chunkSize: 64
```

**Pros:**
- Fewer chunks to manage
- Fewer cache misses
- Fewer boundaries

**Cons:**
- Slow generation (~250ms)
- High memory per chunk
- Noticeable loading

**Best for:** Static worlds, pre-generation

---

### 2. Feature Optimization

Disable features you don't need:

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,

  // Disable rivers (-~40ms per chunk)
  riverConfig: {
    enabled: false,
  },

  // Disable resources (-<1ms per chunk)
  resourceConfig: {
    types: [],
  },

  // Disable structures (-<1ms per chunk)
  structureConfig: {
    types: [],
  },

});
```

---

### 3. Terrain Simplification

Reduce terrain complexity:

```typescript
terrainConfig: {
  baseScale: 0.01,
  octaves: 2,        // Fewer octaves
  persistence: 0.5,
  lacunarity: 2.0,
  warpStrength: 0,   // Disable warping
  heightMultiplier: 1.0,
}
```

> Terrain generation itself is very fast (~0.3ms). The main bottleneck is **biome blending**, not terrain octaves.

---

### 4. Cache Tuning

Optimize cache size for your use case:

```typescript
// Small cache (low memory, more regenerations)
maxCacheSize: 100  // ~620 KB

// Medium cache (balanced)
maxCacheSize: 500  // ~3.1 MB

// Large cache (high memory, fewer regenerations)
maxCacheSize: 1000 // ~6.2 MB
```

**Formula:**
```
Memory = cacheSize x 6.2 KB (for 32x32 chunks)
```

---

### 5. Multi-Threading

Use Web Workers for parallel generation:

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

// Generate multiple chunks in parallel
const chunks = await Promise.all([
  manager.getChunk(0, 0),
  manager.getChunk(1, 0),
  manager.getChunk(0, 1),
  manager.getChunk(1, 1),
]);
```

---

### 6. Preloading

Preload chunks before they're needed:

```typescript
async function preloadChunksAhead(
  playerX: number,
  playerY: number,
  direction: { x: number; y: number },
  distance: number
) {
  const chunkSize = 32;
  const [chunkX, chunkY] = worldToChunk(playerX, playerY, chunkSize);

  // Preload chunks in movement direction
  const promises = [];
  for (let i = 1; i <= distance; i++) {
    const targetX = chunkX + direction.x * i;
    const targetY = chunkY + direction.y * i;
    promises.push(manager.getChunk(targetX, targetY));
  }

  await Promise.all(promises);
}

// Preload 3 chunks ahead
await preloadChunksAhead(100, 200, { x: 1, y: 0 }, 3);
```

---

## Configuration Tuning

### Fastest Configuration

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 16,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 2,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 0,
    heightMultiplier: 1.0,
  },
  lakeConfig: { enabled: false },
  riverConfig: { enabled: false },
  resourceConfig: { types: [] },
  structureConfig: { types: [] },
  maxCacheSize: 100,
});

// Result: ~5ms per chunk
```

---

### Balanced Configuration

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
  },
  lakeConfig: { enabled: true },
  riverConfig: { enabled: false },
  maxCacheSize: 500,
});

// Result: ~20ms per chunk
```

---

### Quality Configuration

```typescript
const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 6,
    persistence: 0.6,
    lacunarity: 2.5,
    warpStrength: 50,
    heightMultiplier: 3.0,
    enable3D: true,
    zScale: 0.5,
  },
  lakeConfig: { enabled: true },
  riverConfig: { enabled: true },
  enhancedBiomeConfig: {
    enableTransitions: true,
    enableElevationBands: true,
  },
  maxCacheSize: 1000,
});

// Result: ~60-100ms per chunk (depending on river density)
```

---

## Profiling

### Enable Performance Metrics

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
const start = performance.now();
const chunk = await manager.getChunk(0, 0);
const end = performance.now();

console.log(`Generation time: ${(end - start).toFixed(2)}ms`);
```

---

### Monitor Cache Performance

```typescript
setInterval(() => {
  const stats = manager.getCacheStats();
  console.log('Cache stats:', {
    size: `${stats.size}/${stats.maxSize}`,
    hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
    memory: `${(stats.size * 6.2).toFixed(1)} KB`,
  });
}, 5000);
```

---

### Profile with DevTools

```typescript
// Start profiling
console.profile('Chunk Generation');

// Generate chunks
for (let i = 0; i < 10; i++) {
  await manager.getChunk(i, 0);
}

// Stop profiling
console.profileEnd('Chunk Generation');

// Check Performance tab in DevTools
```

---

## Best Practices

### 1. Use Async Generation

```typescript
// Good - non-blocking
const chunk = await manager.getChunk(0, 0);

// Bad - blocks main thread
const chunk = manager.generateChunk(0, 0);
```

---

### 2. Batch Chunk Loading

```typescript
// Good - parallel loading
const chunks = await Promise.all([
  manager.getChunk(0, 0),
  manager.getChunk(1, 0),
  manager.getChunk(0, 1),
]);

// Bad - sequential loading
const chunk1 = await manager.getChunk(0, 0);
const chunk2 = await manager.getChunk(1, 0);
const chunk3 = await manager.getChunk(0, 1);
```

---

### 3. Unload Distant Chunks

```typescript
function unloadDistantChunks(
  playerChunkX: number,
  playerChunkY: number,
  maxDistance: number
) {
  // Get all cached chunks
  const cacheSize = manager.getCacheSize();

  if (cacheSize > maxDistance * maxDistance * 4) {
    // Cache is too large, clear it
    manager.clearCache();
  }
}

// Call periodically
setInterval(() => {
  const [chunkX, chunkY] = worldToChunk(playerX, playerY, 32);
  unloadDistantChunks(chunkX, chunkY, 5);
}, 10000);
```

---

### 4. Reuse ChunkManager

```typescript
// Good - reuse manager
const manager = new ChunkManager({ seed: 12345 });
const chunk1 = await manager.getChunk(0, 0);
const chunk2 = await manager.getChunk(1, 0);

// Bad - create new manager each time
const manager1 = new ChunkManager({ seed: 12345 });
const chunk1 = await manager1.getChunk(0, 0);
const manager2 = new ChunkManager({ seed: 12345 });
const chunk2 = await manager2.getChunk(1, 0);
```

---

### 5. Optimize Rendering

```typescript
// Only render visible chunks
function updateVisibleChunks(camera, chunks) {
  for (const [key, mesh] of chunks) {
    const inFrustum = isInCameraFrustum(camera, mesh);
    mesh.visible = inFrustum;
  }
}

// Call every frame
function animate() {
  updateVisibleChunks(camera, chunkMeshes);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

---

## Performance Checklist

Before deploying, check:

- [ ] Chunk size appropriate for use case (16-32 recommended)
- [ ] Unnecessary features disabled (rivers are the most expensive)
- [ ] Cache size tuned for memory budget
- [ ] Worker pool enabled for parallel generation
- [ ] Chunks preloaded in movement direction
- [ ] Distant chunks unloaded periodically
- [ ] Rendering optimized (frustum culling, LOD)
- [ ] Performance metrics monitored
- [ ] Target <100ms per chunk achieved

---

## Troubleshooting

### Problem: Slow Generation

**Symptoms:** Chunks take >100ms to generate

**Solutions:**
1. Reduce chunk size (32 -> 16)
2. Disable rivers (`riverConfig.enabled = false`)
3. Reduce octaves (`terrainConfig.octaves = 2`)
4. Enable worker pool
5. Disable 3D noise

---

### Problem: High Memory Usage

**Symptoms:** Browser uses >500MB RAM

**Solutions:**
1. Reduce cache size (`maxCacheSize = 100`)
2. Clear cache periodically (`manager.clearCache()`)
3. Use smaller chunks (32 -> 16)
4. Unload distant chunks

---

### Problem: Stuttering/Freezing

**Symptoms:** Game freezes during chunk loading

**Solutions:**
1. Use async generation (`getChunk` not `generateChunk`)
2. Enable worker pool
3. Preload chunks ahead of time
4. Reduce generation time (see "Slow Generation")

---

**[Back to Documentation](README.md)**
