---
inclusion: auto
description: Performance optimization patterns and techniques used in the project. Includes memory optimizations (sparse biome weights, pre-allocated configs), algorithm optimizations (circular buffer, swap-and-pop, LRU cache), benchmarks, and best practices for performance-critical code.
---

# Performance Optimizations

This file documents all performance optimizations implemented in the project. Always consider these patterns when working on performance-critical code.

## Memory Optimizations

### 1. Sparse Biome Weights (v2.0)

**Problem**: Dense biome weight arrays used 13KB per chunk (81% of total memory), but ~85% of values were zero.

**Solution**: Sparse representation using three parallel arrays.

**Implementation**:
```typescript
interface ChunkData {
  sparseBiomeTypes: Uint8Array;      // Non-zero biome types
  sparseBiomeWeights: Float32Array;  // Corresponding weights
  sparseBiomeOffsets: Uint16Array;   // Tile offsets
}
```

**Results**:
- Memory: 13KB → 3.96KB (70% reduction)
- Total chunk memory: 16KB → 7KB (56% reduction)
- Access time: +13ns per tile (negligible)

**Usage**:
```typescript
import { getBiomeWeightsForTile, getBiomeWeightForTile } from 'procedural-world-engine';

// Get all weights for a tile
const weights = getBiomeWeightsForTile(chunk, tileIndex);

// Get specific biome weight
const weight = getBiomeWeightForTile(chunk, tileIndex, BiomeType.FOREST);
```

**When to use**: Always use sparse representation for data with >50% zero values.

---

### 2. Pre-allocated Noise Configs

**Problem**: Creating noise config objects on every call allocated 1000+ objects per chunk.

**Solution**: Pre-allocate and reuse config objects.

**Implementation**:
```typescript
class TerrainGenerator {
  private noiseConfig: NoiseConfig;
  
  constructor(config: TerrainConfig) {
    // Pre-allocate once
    this.noiseConfig = {
      octaves: config.octaves,
      persistence: config.persistence,
      lacunarity: config.lacunarity,
      scale: config.baseScale,
    };
  }
  
  generate(x: number, y: number): number {
    // Reuse pre-allocated config
    return this.noise.fbm(x, y, this.noiseConfig);
  }
}
```

**Results**:
- Eliminated 1089 allocations per chunk
- Reduced GC pressure
- Faster generation

**When to use**: Pre-allocate any objects used in hot loops.

---

### 3. Typed Arrays

**Problem**: Regular JavaScript arrays are slow and memory-inefficient.

**Solution**: Use typed arrays for numeric data.

**Implementation**:
```typescript
// ❌ Bad
const heightmap = new Array(size * size);

// ✅ Good
const heightmap = new Float32Array(size * size);
const biomeMap = new Uint8Array(size * size);
```

**Benefits**:
- 4x less memory (Float32Array vs Array)
- Faster access
- Better cache locality

**When to use**: Always use typed arrays for numeric data.

---

## Algorithm Optimizations

### 1. Circular Buffer for Flood-Fill

**Problem**: Array shift() is O(n), called thousands of times per lake.

**Solution**: Circular buffer with O(1) operations.

**Implementation**:
```typescript
class CircularBuffer {
  private buffer: number[];
  private head = 0;
  private tail = 0;
  private size = 0;
  
  constructor(capacity: number) {
    this.buffer = new Array(capacity);
  }
  
  push(value: number): void {
    this.buffer[this.tail] = value;
    this.tail = (this.tail + 1) % this.buffer.length;
    this.size++;
  }
  
  shift(): number {
    const value = this.buffer[this.head];
    this.head = (this.head + 1) % this.buffer.length;
    this.size--;
    return value;
  }
  
  isEmpty(): boolean {
    return this.size === 0;
  }
}
```

**Results**:
- Lake generation: 150ms → 115ms (23% faster)
- O(1) operations instead of O(n)

**When to use**: Use circular buffers for queue operations in hot loops.

---

### 2. Swap-and-Pop for Random Removal

**Problem**: Array splice() is O(n) for removing random elements.

**Solution**: Swap with last element, then pop.

**Implementation**:
```typescript
// ❌ Bad - O(n)
function removeRandom(array: any[], index: number): void {
  array.splice(index, 1);
}

// ✅ Good - O(1)
function removeRandom(array: any[], index: number): void {
  array[index] = array[array.length - 1];
  array.pop();
}
```

**Results**:
- O(1) removal instead of O(n)
- Faster Poisson sampling

**When to use**: Use swap-and-pop when order doesn't matter.

---

### 3. LRU Cache

**Problem**: Regenerating chunks is expensive (~30-50ms per chunk).

**Solution**: LRU cache with O(1) operations.

**Implementation**:
```typescript
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private accessOrder = new Map<K, number>();
  
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      this.accessOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }
  
  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(key, value);
    this.accessOrder.set(key, Date.now());
  }
  
  private evictLRU(): void {
    let oldestKey: K | undefined;
    let oldestTime = Infinity;
    
    for (const [key, time] of this.accessOrder) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }
}
```

**Results**:
- Cache hit rate: 50-70%
- Cached access: <0.01ms
- Cache miss: ~30-50ms (regeneration)

**When to use**: Cache expensive computations with spatial/temporal locality.

---

## Performance Benchmarks

### Chunk Generation Time (32×32)

| Configuration | Time | Notes |
|--------------|------|-------|
| Minimal (no features) | ~8ms | Terrain only |
| Terrain + biomes | ~15ms | No lakes/resources |
| Full (no lakes) | ~20ms | All features except lakes |
| Full (with lakes) | ~115ms | All features |

### Memory Usage (32×32 chunk)

| Component | Size | Percentage |
|-----------|------|------------|
| Heightmap | 1.13 KB | 16% |
| Biome map | 0.25 KB | 4% |
| Sparse biome weights | 3.96 KB | 56% |
| Resources | 1.59 KB | 23% |
| Structures | 0.09 KB | 1% |
| **Total** | **7.03 KB** | **100%** |

### Cache Performance

| Metric | Value |
|--------|-------|
| Hit rate | 50-70% |
| Cached access | <0.01ms |
| Cache miss | ~30-50ms |
| Eviction time | <0.1ms |

---

## Optimization Checklist

When optimizing code, follow this checklist:

### Memory
- [ ] Use typed arrays for numeric data
- [ ] Use sparse representations for sparse data (>50% zeros)
- [ ] Pre-allocate objects used in hot loops
- [ ] Avoid creating temporary objects in loops
- [ ] Use object pooling for frequently created/destroyed objects

### Algorithms
- [ ] Use O(1) data structures where possible (Map, Set)
- [ ] Avoid O(n) operations in hot loops (shift, splice, indexOf)
- [ ] Use circular buffers for queue operations
- [ ] Use swap-and-pop for random removal
- [ ] Cache expensive computations

### Profiling
- [ ] Measure before optimizing
- [ ] Use performance.now() for timing
- [ ] Profile with Chrome DevTools
- [ ] Check memory usage with heap snapshots
- [ ] Validate improvements with benchmarks

### Testing
- [ ] Add performance tests for critical paths
- [ ] Set performance targets (<100ms per chunk)
- [ ] Monitor memory usage in tests
- [ ] Test with different chunk sizes
- [ ] Test with different configurations

---

## Anti-Patterns to Avoid

### 1. Premature Optimization
❌ Don't optimize before measuring
✅ Profile first, then optimize hot paths

### 2. Micro-Optimizations
❌ Don't optimize code that runs once
✅ Focus on hot loops and frequently called functions

### 3. Sacrificing Readability
❌ Don't make code unreadable for 1% speedup
✅ Balance performance and maintainability

### 4. Ignoring Memory
❌ Don't focus only on speed
✅ Consider memory usage and GC pressure

### 5. Not Testing
❌ Don't assume optimizations work
✅ Measure and validate improvements

---

## Future Optimization Ideas

### Potential Improvements
1. **WebAssembly for noise generation** - 2-3x faster noise
2. **Incremental generation** - Generate chunks over multiple frames
3. **LOD (Level of Detail)** - Lower detail for distant chunks
4. **Chunk compression** - Compress cached chunks
5. **GPU compute (WebGPU)** - Massively parallel generation

### Trade-offs
- WebAssembly: Faster but requires build pipeline
- Incremental: Smoother but more complex
- LOD: Less memory but more complexity
- Compression: Less memory but more CPU
- GPU: Much faster but limited browser support

---

## References

- [Performance Guide](../docs/PERFORMANCE.md) - User-facing performance documentation
- [Architecture](../docs/ARCHITECTURE.md) - Internal architecture details
- Performance tests: `tests/performance.test.ts`
