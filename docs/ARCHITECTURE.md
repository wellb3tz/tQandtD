# Architecture

Internal architecture and design decisions of Procedural World Engine.

## Table of Contents

- [Overview](#overview)
- [Core Systems](#core-systems)
- [Generation Pipeline](#generation-pipeline)
- [Memory Management](#memory-management)
- [Determinism](#determinism)
- [Performance Optimizations](#performance-optimizations)
- [Design Decisions](#design-decisions)

---

## Overview

Procedural World Engine is built around a **chunk-based architecture** with **deterministic generation**. The core principle: same seed + same coordinates = same output, always.

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                     ChunkManager                            │
│  - Entry point for all generation                           │
│  - LRU cache management                                     │
│  - Orchestrates generation pipeline                         │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   Terrain      │  │    Biomes      │  │    Rivers      │
│  Generator     │  │  Classifier    │  │   Manager      │
└────────────────┘  └────────────────┘  └────────────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ▼
                  ┌────────────────┐
                  │  ChunkData     │
                  │  - heightmap   │
                  │  - biomeMap    │
                  │  - resources   │
                  │  - structures  │
                  │  - lakes       │
                  │  - rivers      │
                  └────────────────┘
```

---

## Core Systems

### 1. Seeded Random Number Generator (RNG)

**Location:** `src/core/rng.ts`

**Purpose:** Deterministic randomness for reproducible worlds.

**Implementation:**
- Linear Congruential Generator (LCG) algorithm
- 32-bit state for fast operations
- Derivation support for independent streams

**Key Methods:**
```typescript
class SeededRNG {
  nextFloat(): number;      // [0, 1)
  nextInt(min, max): number; // [min, max]
  derive(offset): SeededRNG; // Independent stream
}
```

**Usage Pattern:**
```typescript
// Each chunk gets its own RNG derived from world seed
const chunkRNG = worldRNG.derive(chunkSeed(chunkX, chunkY));

// Each system gets its own RNG
const terrainRNG = chunkRNG.derive(1);
const biomeRNG = chunkRNG.derive(2);
const resourceRNG = chunkRNG.derive(3);
```

**Why LCG?**
- Fast: ~2ns per call
- Deterministic: same seed = same sequence
- Lightweight: 4 bytes of state
- Good enough for procedural generation

---

### 2. Noise Engine

**Location:** `src/core/noise.ts`

**Purpose:** Generate smooth, natural-looking terrain.

**Implementation:**
- Simplex noise (2D and 3D)
- Fractional Brownian Motion (fBM)
- Ridge noise for mountains
- Domain warping for organic shapes

**Key Methods:**
```typescript
class NoiseEngine {
  noise2D(x, y): number;           // [-1, 1]
  noise3D(x, y, z): number;        // [-1, 1]
  fbm(x, y, config): number;       // Layered noise
  ridgeFbm(x, y, config): number;  // Sharp ridges
  domainWarp(x, y, strength): [number, number];
}
```

**fBM Algorithm:**
```typescript
let value = 0;
let amplitude = 1;
let frequency = config.scale;

for (let i = 0; i < config.octaves; i++) {
  value += noise2D(x * frequency, y * frequency) * amplitude;
  amplitude *= config.persistence;
  frequency *= config.lacunarity;
}
```

**Performance Optimization:**
- Pre-allocated noise configs (no allocations per call)
- Gradient table lookup (no trig functions)
- Inline permutation table

---

### 3. Chunk Manager

**Location:** `src/world/chunk-manager.ts`

**Purpose:** Orchestrate chunk generation and caching.

**Responsibilities:**
1. Validate configuration
2. Manage LRU cache
3. Coordinate generation pipeline
4. Handle errors and recovery
5. Track modifications

**Cache Strategy:**
- LRU (Least Recently Used) eviction
- O(1) access via Map
- O(1) eviction via insertion-order tracking
- Configurable size limit

**Cache Implementation:**
```typescript
class ChunkCache {
  private cache = new Map<string, ChunkData>();

  get(key: string): ChunkData | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end to mark as most-recently-used
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry;
    }
    return undefined;
  }

  set(key: string, chunk: ChunkData): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, chunk);
  }
}
```

---

### 4. Lake Manager

**Location:** `src/world/lake-manager.ts`

**Purpose:** Generate lakes using noise-guided flood-fill algorithm.

**Algorithm:**
1. Find candidate regions using low-frequency noise
2. For each candidate, run fill-to-spill flood-fill
3. Compute water level from the lowest escape point
4. Cache results for multi-chunk lakes

**Performance Impact:**
- Modern implementation: ~3ms per chunk with lakes
- Heavily optimized via grid-based lookups and deferred invalidation

---

### 5. River Manager

**Location:** `src/world/river-manager.ts`

**Purpose:** Generate river corridors with tributaries and terrain carving.

**Algorithm:**
1. Identify source points in suitable biomes and elevations
2. Build downhill paths using A* with elevation constraints
3. Smooth and widen paths into corridors
4. Carve terrain depression into the heightmap

**Performance Impact:**
- River generation: ~40-60ms per 32x32 chunk when rivers are dense
- The most expensive optional feature after biome blending

---

## Generation Pipeline

### Stage 1: Terrain Generation

**Input:** Chunk coordinates, terrain config, RNG

**Output:** Heightmap (Float32Array)

**Process:**
1. Generate base noise (fBM)
2. Apply domain warping
3. Add continental layer (optional)
4. Add ridge noise for mountains (optional)
5. Apply 3D noise slice (optional)
6. Normalize to [0, 1]

**Memory:** `(chunkSize + 1)² x 4 bytes`

**Time:** ~0.3ms (32x32 chunk)

---

### Stage 2: Biome Classification

**Input:** Heightmap, biome config, RNG

**Output:** Biome map (Uint8Array), sparse biome weights

**Process:**
1. Generate temperature noise
2. Generate moisture noise
3. Classify each tile based on height/temp/moisture
4. Calculate blend weights for smooth transitions
5. Convert to sparse representation

**Memory:**
- Biome map: `chunkSize² x 1 byte`
- Sparse weights: ~4.75 KB (32x32 chunk)

**Time:** ~48ms (32x32 chunk); blending dominates (~90% of biome time)

---

### Stage 3: River Generation

**Input:** Heightmap, biome map, river config, RNG

**Output:** River data (RiverData[])

**Process:**
1. Find source points in allowed biomes
2. Build downhill paths with A*
3. Smooth and create corridor geometry
4. Carve terrain depression
5. Share boundary state with LakeManager

**Memory:** ~0.5 KB per river path

**Time:** ~0-60ms (32x32 chunk, varies by river density)

---

### Stage 4: Lake Generation

**Input:** Heightmap, biome map, lake config, RNG

**Output:** Lake data (LakeData[])

**Process:**
1. Find candidate regions using noise
2. Run fill-to-spill flood-fill
3. Compute water level from lowest escape point
4. Cache multi-chunk lakes
5. Share boundary state with RiverManager

**Memory:** ~1-2 KB per lake

**Time:** ~3ms (32x32 chunk with lakes)

---

### Stage 5: Resource Placement

**Input:** Biome map, resource config, RNG

**Output:** Resources (Resource[])

**Process:**
1. Generate cluster noise
2. For each resource type:
   - Check biome compatibility
   - Check cluster density
   - Place resource with random amount
3. Store as array of Resource objects

**Memory:** ~1.5 KB (32x32 chunk)

**Time:** ~0.04ms (32x32 chunk)

---

### Stage 6: Structure Placement

**Input:** Heightmap, biome map, structure config, RNG

**Output:** Structures (Structure[])

**Process:**
1. Run Poisson Disk Sampling
2. For each candidate position:
   - Check placement rules (biome, slope, elevation)
   - Accept or reject
3. Store as array of Structure objects

**Memory:** ~0.1 KB (32x32 chunk)

**Time:** ~0.1ms (32x32 chunk)

---

## Memory Management

### Chunk Memory Breakdown (32x32)

| Component | Size | Percentage |
|-----------|------|------------|
| Heightmap | 1.13 KB | 18% |
| Biome map | 0.25 KB | 4% |
| **Sparse biome weights** | **4.75 KB** | **76%** |
| Resources | ~0 KB | 0% |
| Structures | 0.09 KB | 1% |
| **Total** | **~6.2 KB** | **100%** |

### Sparse Biome Weights

**Problem:** Dense biome weights used ~13 KB per chunk, but ~85% of values were zero.

**Solution:** Sparse representation using three parallel arrays:

```typescript
interface ChunkData {
  sparseBiomeTypes: Uint8Array;      // Non-zero biome types
  sparseBiomeWeights: Float32Array;  // Corresponding weights
  sparseBiomeOffsets: Uint16Array;   // Tile offsets
}
```

**Encoding:**
```
Tile 0: [FOREST: 0.7, PLAINS: 0.3]
Tile 1: [PLAINS: 1.0]
Tile 2: [FOREST: 0.5, MOUNTAIN: 0.5]

  -> sparseBiomeTypes:   [FOREST, PLAINS, PLAINS, FOREST, MOUNTAIN]
  -> sparseBiomeWeights: [0.7,    0.3,    1.0,    0.5,    0.5]
  -> sparseBiomeOffsets: [0,      2,      3]
```

**Access Pattern:**
```typescript
function getBiomeWeightsForTile(chunk: ChunkData, tileIndex: number) {
  const start = chunk.sparseBiomeOffsets[tileIndex];
  const end = tileIndex < chunk.sparseBiomeOffsets.length - 1
    ? chunk.sparseBiomeOffsets[tileIndex + 1]
    : chunk.sparseBiomeTypes.length;

  const weights = new Map();
  for (let i = start; i < end; i++) {
    weights.set(chunk.sparseBiomeTypes[i], chunk.sparseBiomeWeights[i]);
  }
  return weights;
}
```

**Results:**
- Memory: ~13 KB -> ~4.75 KB for biome weights
- Access time: negligible (+<1ms per chunk)
- Total chunk memory: ~16 KB -> ~6.2 KB

---

### Cache Memory

With LRU cache of 500 chunks (32x32):
- Memory: 500 x 6.2 KB = ~3.1 MB
- Cache hit rate: ~50%
- Eviction time: <0.1ms

---

## Determinism

### Seed Derivation

Every random operation uses a derived seed:

```typescript
// World seed
const worldSeed = 12345;

// Chunk seed
const chunkSeed = hash(worldSeed, chunkX, chunkY);

// System seeds
const terrainSeed = hash(chunkSeed, 1);
const biomeSeed = hash(chunkSeed, 2);
const lakeSeed = hash(chunkSeed, 3);
const resourceSeed = hash(chunkSeed, 4);
const structureSeed = hash(chunkSeed, 5);
```

### Hash Function

**Location:** `src/core/hash.ts`

**Implementation:** MurmurHash3 variant

```typescript
function hash(...values: number[]): number {
  let h = 0x9e3779b9;
  for (const value of values) {
    h ^= value;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
```

### Guarantees

1. **Same seed -> same world**
2. **Same chunk coordinates -> same chunk**
3. **Platform independent** (no floating-point precision issues)
4. **Order independent** (chunks can be generated in any order)

---

## Performance Optimizations

### 1. Pre-allocated Noise Configs

**Problem:** Creating noise config objects on every call allocated 1000+ objects per chunk.

**Solution:** Pre-allocate and reuse:

```typescript
class TerrainGenerator {
  private noiseConfig: NoiseConfig;

  constructor(config: TerrainConfig) {
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

**Result:** Eliminated 1000+ allocations per chunk

---

### 2. Grid-Based Fast Lookup for Biome Blending

**Problem:** `getBiomeWeights` samples many floating-point positions; repeated string-key hashing in Maps was expensive.

**Solution:** Pre-compute height and biome values on a dense grid and use O(1) array indexing instead of Map lookups.

**Result:** Biome blending time reduced significantly; still the largest single cost but now manageable.

---

### 3. Swap-and-Pop for Poisson Sampling

**Problem:** Array splice() is O(n) for removing random elements.

**Solution:** Swap with last element, then pop:

```typescript
function removeRandom(array: any[], index: number): void {
  array[index] = array[array.length - 1];
  array.pop();
}
```

**Result:** O(1) removal instead of O(n)

---

### 4. Sparse Biome Weights

**Problem:** ~85% of biome weights were zero, wasting memory.

**Solution:** Store only non-zero weights.

**Result:** ~65% less memory for biome weights

---

### 5. LRU Cache

**Problem:** Regenerating chunks is expensive.

**Solution:** Cache recently used chunks.

**Result:** ~50% cache hit rate, <0.01ms for cached access

---

### 6. Boundary Height Reconciliation

**Problem:** Lake and river carving can create height mismatches at chunk boundaries.

**Solution:** When a chunk is cached, reconcile shared boundary vertices with already-cached neighbors (using `Math.min` so carved depressions win). Neighbors are lazily invalidated rather than mutated directly.

**Result:** Seamless terrain without gaps or cliffs at chunk edges.

---

## Design Decisions

### Why Chunk-Based?

**Alternatives considered:**
1. Generate entire world upfront
2. Generate on-demand without chunks

**Chosen:** Chunk-based lazy generation

**Reasons:**
- Infinite worlds (can't generate everything)
- Memory efficient (only load visible chunks)
- Parallelizable (chunks are independent)
- Cache-friendly (spatial locality)

---

### Why Simplex Noise?

**Alternatives considered:**
1. Perlin noise
2. Worley noise
3. Value noise

**Chosen:** Simplex noise

**Reasons:**
- Faster than Perlin (fewer gradient lookups)
- No directional artifacts
- Scales to 3D/4D efficiently
- Good visual quality

---

### Why LRU Cache?

**Alternatives considered:**
1. LFU (Least Frequently Used)
2. FIFO (First In First Out)
3. Random eviction

**Chosen:** LRU (Least Recently Used)

**Reasons:**
- Spatial locality (nearby chunks accessed together)
- Simple implementation
- Good hit rate (~50%)
- O(1) operations

---

### Why Sparse Biome Weights?

**Alternatives considered:**
1. Dense array (original)
2. Compressed dense array
3. Run-length encoding

**Chosen:** Sparse representation

**Reasons:**
- ~85% of weights are zero
- Simple access pattern
- ~65% memory savings for biome weights
- Minimal performance cost

---

### Why Flood-Fill for Lakes?

**Alternatives considered:**
1. Noise-based water placement
2. Hydraulic erosion simulation
3. Watershed analysis

**Chosen:** Noise-guided fill-to-spill flood-fill

**Reasons:**
- Physically correct water levels (spill-point based)
- Natural lake shapes
- Deterministic
- Reasonable performance (~3ms per chunk)

---

### Why A* for Rivers?

**Alternatives considered:**
1. Simple downhill walk
2. Hydraulic erosion
3. Pre-computed flow fields

**Chosen:** A* pathfinding with elevation constraints

**Reasons:**
- Rivers find natural downhill routes
- Respects elevation budgets (can flow around small hills)
- Supports tributaries and branching
- Deterministic and controllable

---

### Why Web Workers?

**Alternatives considered:**
1. Main thread only
2. WebAssembly
3. GPU compute (WebGPU)

**Chosen:** Web Workers

**Reasons:**
- Non-blocking generation
- Good browser support
- Easy to implement
- Scales with CPU cores

---

## Future Improvements

### Potential Optimizations

1. **Incremental generation**
   - Generate chunks over multiple frames
   - Better for 60fps target

2. **Chunk compression**
   - Compress cached chunks
   - Trade CPU for memory

3. **GPU compute (WebGPU)**
   - Massively parallel generation
   - Requires WebGPU support

---

**[Back to Documentation](README.md)**
