/**
 * River Networks Example
 * 
 * Demonstrates the river network data structures and concepts.
 * Note: Full river network generation (tributaries, lakes, deltas) is still in development.
 * This example shows the data structures and basic river generation.
 */

import {
  ChunkManager,
  BiomeType,
  type RiverSegment,
  type Lake,
  type RiverNetwork,
} from '../src/index';

console.log('=== River Networks Example ===\n');

// Example 1: Basic River Generation
console.log('Example 1: Basic River Generation');
console.log('==================================\n');

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
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
  },
  resourceConfig: {
    types: [],
    clusterScale: 20,
    densityThreshold: 0.6,
  },
  structureConfig: {
    types: [],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverConfig: {
    sourceElevation: 0.6, // Lower threshold for more rivers
    minFlowLength: 5,
    flowWidth: 2,
  },
});

const chunk = manager.getChunk(0, 0);
console.log(`Generated chunk at (${chunk.x}, ${chunk.y})`);
console.log(`River tiles: ${chunk.rivers.size}`);

if (chunk.rivers.size > 0) {
  console.log('\nRiver tile indices:');
  const riverIndices = Array.from(chunk.rivers).slice(0, 10);
  console.log(`  First 10: ${riverIndices.join(', ')}`);
  
  // Convert indices to coordinates
  console.log('\nRiver coordinates (first 10):');
  for (const idx of riverIndices) {
    const x = idx % chunk.size;
    const y = Math.floor(idx / chunk.size);
    const height = chunk.heightmap[idx];
    console.log(`  (${x}, ${y}) - height: ${height.toFixed(3)}`);
  }
} else {
  console.log('\nNo rivers in this chunk. Try different coordinates or lower sourceElevation!');
}

// Example 2: River Network Data Structures
console.log('\n\nExample 2: River Network Data Structures');
console.log('=========================================\n');

console.log('RiverSegment interface:');
console.log('  - index: Flat index in chunk');
console.log('  - flow: Accumulated flow at this segment');
console.log('  - width: Calculated width based on flow');
console.log('  - order: River order (1 = main, 2+ = tributary)');
console.log('  - next: Next segment index (-1 if terminus)');

console.log('\nLake interface:');
console.log('  - tiles: Set of tile indices forming the lake');
console.log('  - elevation: Lake surface elevation');
console.log('  - outlet: Outlet river segment index (-1 if no outlet)');

console.log('\nRiverNetwork interface:');
console.log('  - segments: All river segments');
console.log('  - lakes: Lakes in this chunk');
console.log('  - tileToSegment: Map from tile index to segment index');

// Example 3: River Configuration Options
console.log('\n\nExample 3: River Configuration Options');
console.log('=======================================\n');

console.log('Basic River Config (currently implemented):');
console.log('  - sourceElevation: Minimum elevation for river sources (0-1)');
console.log('  - minFlowLength: Minimum river length to keep');
console.log('  - flowWidth: Width of river paths (in tiles)');

console.log('\nEnhanced River Network Config (in development):');
console.log('  Tributaries:');
console.log('    - enableTributaries: Enable tributary generation');
console.log('    - maxTributaryOrder: Maximum tributary depth');
console.log('    - tributaryProbability: Spawn probability (0-1)');
console.log('\n  Lakes:');
console.log('    - enableLakes: Enable lake generation');
console.log('    - lakeDepressionThreshold: Min depth for lakes');
console.log('    - maxLakeSize: Maximum lake size in tiles');
console.log('\n  Deltas:');
console.log('    - enableDeltas: Enable delta generation');
console.log('    - deltaBranchCount: Number of delta branches');
console.log('    - deltaSpreadAngle: Delta spread angle (radians)');
console.log('\n  Flow-Based Width:');
console.log('    - minFlow: Minimum flow for width calculation');
console.log('    - maxFlow: Maximum flow for width calculation');
console.log('    - widthScale: Width scaling factor');

// Example 4: Analyzing River Distribution
console.log('\n\nExample 4: Analyzing River Distribution');
console.log('========================================\n');

// Generate multiple chunks and analyze river distribution
const chunkCoords = [
  [0, 0], [1, 0], [2, 0],
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2],
];

let totalRiverTiles = 0;
let chunksWithRivers = 0;

console.log('Analyzing 3x3 chunk region:\n');

for (const [x, y] of chunkCoords) {
  const c = manager.getChunk(x, y);
  const riverCount = c.rivers.size;
  totalRiverTiles += riverCount;
  
  if (riverCount > 0) {
    chunksWithRivers++;
  }
  
  console.log(`Chunk (${x}, ${y}): ${riverCount} river tiles`);
}

console.log(`\nTotal river tiles: ${totalRiverTiles}`);
console.log(`Chunks with rivers: ${chunksWithRivers} / ${chunkCoords.length}`);
console.log(`Average river tiles per chunk: ${(totalRiverTiles / chunkCoords.length).toFixed(1)}`);

// Example 5: River and Biome Interaction
console.log('\n\nExample 5: River and Biome Interaction');
console.log('=======================================\n');

// Analyze which biomes have rivers
const riverBiomes = new Map<BiomeType, number>();

for (const idx of chunk.rivers) {
  const biome = chunk.biomeMap[idx];
  riverBiomes.set(biome, (riverBiomes.get(biome) || 0) + 1);
}

if (riverBiomes.size > 0) {
  console.log('River distribution by biome:');
  for (const [biome, count] of riverBiomes.entries()) {
    console.log(`  ${BiomeType[biome]}: ${count} tiles`);
  }
} else {
  console.log('No rivers in this chunk to analyze.');
}

// Example 6: Future River Network Features
console.log('\n\nExample 6: Future River Network Features');
console.log('=========================================\n');

console.log('Planned enhancements for river networks:\n');

console.log('1. Tributaries:');
console.log('   - Secondary rivers that flow into main rivers');
console.log('   - Hierarchical river systems (order 1, 2, 3...)');
console.log('   - Accumulated flow calculation');
console.log('   - Merge points where tributaries join');

console.log('\n2. Lakes:');
console.log('   - Depression filling algorithm');
console.log('   - Lake formation in low-elevation areas');
console.log('   - Rivers terminating at lakes');
console.log('   - Outlet rivers from lakes');

console.log('\n3. Deltas:');
console.log('   - Branching river formations at ocean boundaries');
console.log('   - Fan-shaped channel distribution');
console.log('   - Terrain modification for delta landforms');
console.log('   - Decreasing channel width as branches split');

console.log('\n4. Flow-Based Width:');
console.log('   - River width varies with accumulated flow');
console.log('   - Wider rivers downstream');
console.log('   - Logarithmic scaling for realistic proportions');
console.log('   - Smooth width transitions');

console.log('\n5. Cross-Chunk Rivers:');
console.log('   - Rivers that span multiple chunks');
console.log('   - Continuous flow across boundaries');
console.log('   - Tributary connections across chunks');

console.log('\n✓ River networks examples complete!');
console.log('\nKey Takeaways:');
console.log('  - Basic river generation is currently implemented');
console.log('  - Rivers flow from high to low elevation');
console.log('  - Configure with riverConfig in WorldConfig');
console.log('  - Enhanced features (tributaries, lakes, deltas) are in development');
console.log('  - River network data structures are defined and ready for use');
