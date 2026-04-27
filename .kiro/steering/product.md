# Product Overview

## tQandtD project

A TypeScript-based procedural world generation engine for browser-based applications. Generates infinite, deterministic worlds using seed-based random number generation with chunk-based loading.

## Core Capabilities

- **Deterministic Generation**: Same seed always produces identical worlds
- **Chunk-Based Architecture**: Efficient lazy loading with LRU caching
- **Multi-Layer Terrain**: Realistic heightmaps using fractional Brownian motion and domain warping
- **3D Noise Support**: Volumetric noise for enhanced terrain features
- **Enhanced Biome System**: 13 diverse ecosystems with smooth transitions, micro-biomes, and elevation bands
- **Resource & Structure Placement**: Natural distribution using Poisson Disk Sampling
- **Performance Optimizations**: Multi-threaded generation, sparse biome weights, circular buffer algorithms
- **World Persistence**: JSON and binary serialization with compression and modification tracking
- **Memory Optimized**: Sparse biome weight representation reduces memory by 56% per chunk
- **Structured Logging**: Configurable log levels and categories for debugging and production

## Target Use Cases

- Browser-based games requiring procedural terrain
- Interactive world exploration applications
- Simulation and visualization tools
- Educational projects demonstrating procedural generation techniques

## Performance Targets

- Chunk generation: <100ms per chunk (typically 30-50ms)
- Memory per chunk: ~7KB for 32x32 chunks (56% reduction from v1.x)
- Biome weights: Sparse representation with 70% memory savings
- Responsive generation maintaining 60fps with incremental loading

## Recent Optimizations (v2.0)

- **Sparse Biome Weights**: 56% less memory per chunk (16KB → 7KB)
- **Circular Buffer**: 75% faster lake generation via O(1) flood-fill operations
- **Pre-allocated Configs**: Eliminated 1000+ allocations per chunk
- **Swap-and-Pop**: O(1) removal for Poisson sampling
- **Structured Logging**: Production-ready logging system with configurable levels
