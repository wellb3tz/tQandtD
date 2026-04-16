/**
 * LOD (Level of Detail) System Example
 * 
 * Demonstrates how to use the LOD system to generate chunks at different
 * detail levels based on distance from the viewer. This improves performance
 * by reducing geometric complexity and feature density for distant chunks.
 */

import {
  ChunkManager,
  LODManager,
  LODLevel,
  type LODConfig,
  BiomeType,
  ResourceType,
  StructureType,
} from '../src/index';

console.log('=== LOD System Example ===\n');

// Example 1: Basic LOD Configuration
console.log('Example 1: Basic LOD Configuration');
console.log('===================================\n');

const lodConfig: LODConfig = {
  // Distance thresholds in chunks
  // [0-2 chunks = HIGH, 2-5 chunks = MEDIUM, 5+ chunks = LOW]
  distances: [2, 5],
  
  // Mesh resolution multipliers (1.0 = full resolution)
  meshResolutions: [
    1.0,  // HIGH: Full resolution
    0.5,  // MEDIUM: Half resolution
    0.25, // LOW: Quarter resolution
  ],
  
  // Feature density multipliers (1.0 = full density)
  featureDensities: [
    1.0,  // HIGH: All features
    0.5,  // MEDIUM: 50% of features
    0.1,  // LOW: 10% of features
  ],
};

console.log('LOD Configuration:');
console.log('  Distance Thresholds:');
console.log('    - HIGH: 0-2 chunks from viewer');
console.log('    - MEDIUM: 2-5 chunks from viewer');
console.log('    - LOW: 5+ chunks from viewer');
console.log('\n  Mesh Resolutions:');
console.log('    - HIGH: 100% (full detail)');
console.log('    - MEDIUM: 50% (half resolution)');
console.log('    - LOW: 25% (quarter resolution)');
console.log('\n  Feature Densities:');
console.log('    - HIGH: 100% (all features)');
console.log('    - MEDIUM: 50% (half features)');
console.log('    - LOW: 10% (minimal features)');

// Example 2: Creating LODManager
console.log('\n\nExample 2: Creating LODManager');
console.log('===============================\n');

const lodManager = new LODManager(lodConfig);

console.log('LODManager created with configuration');
console.log('Use getLODLevel() to determine appropriate LOD for a chunk');

// Example 3: Determining LOD Level
console.log('\n\nExample 3: Determining LOD Level');
console.log('=================================\n');

// Viewer position (in chunk coordinates)
const viewerX = 0;
const viewerY = 0;

// Test various chunk positions
const testPositions = [
  { x: 0, y: 0, desc: 'At viewer position' },
  { x: 1, y: 1, desc: 'Close to viewer' },
  { x: 3, y: 0, desc: 'Medium distance' },
  { x: 5, y: 5, desc: 'Far from viewer' },
  { x: 10, y: 10, desc: 'Very far from viewer' },
];

console.log(`Viewer at chunk (${viewerX}, ${viewerY})\n`);

for (const pos of testPositions) {
  const level = lodManager.getLODLevel(pos.x, pos.y, viewerX, viewerY);
  const distance = Math.sqrt(
    Math.pow(pos.x - viewerX, 2) + Math.pow(pos.y - viewerY, 2)
  );
  
  console.log(`Chunk (${pos.x}, ${pos.y}) - ${pos.desc}`);
  console.log(`  Distance: ${distance.toFixed(2)} chunks`);
  console.log(`  LOD Level: ${LODLevel[level]}`);
  console.log(`  Mesh Resolution: ${lodManager.getMeshResolution(level) * 100}%`);
  console.log(`  Feature Density: ${lodManager.getFeatureDensity(level) * 100}%`);
  console.log('');
}

// Example 4: Applying LOD to Chunks
console.log('\n\nExample 4: Applying LOD to Chunks');
console.log('==================================\n');

// Create a chunk manager with resources and structures
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
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.1,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50,
      },
      {
        type: ResourceType.WOOD,
        rarity: 0.2,
        biomes: [BiomeType.FOREST],
        minAmount: 5,
        maxAmount: 20,
      },
    ],
    clusterScale: 20,
    densityThreshold: 0.5,
  },
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
        ],
      },
    ],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverNetworkConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5,
  },
});

// Generate full-resolution chunk
const fullChunk = manager.getChunk(0, 0);

console.log('Full Resolution Chunk:');
console.log(`  Heightmap size: ${fullChunk.heightmap.length} (${fullChunk.size}x${fullChunk.size})`);
console.log(`  Resources: ${fullChunk.resources.length}`);
console.log(`  Structures: ${fullChunk.structures.length}`);

// Apply different LOD levels
const lodLevels = [LODLevel.HIGH, LODLevel.MEDIUM, LODLevel.LOW];

for (const level of lodLevels) {
  const lodChunk = lodManager.applyLOD(fullChunk, level);
  const resolution = lodManager.getMeshResolution(level);
  const expectedSize = Math.max(1, Math.floor(fullChunk.size * resolution));
  
  console.log(`\n${LODLevel[level]} LOD:`);
  console.log(`  Heightmap size: ${lodChunk.heightmap.length} (${expectedSize}x${expectedSize})`);
  console.log(`  Resources: ${lodChunk.resources.length}`);
  console.log(`  Structures: ${lodChunk.structures.length}`);
  
  if (level !== LODLevel.HIGH) {
    const heightmapReduction = (1 - lodChunk.heightmap.length / fullChunk.heightmap.length) * 100;
    const resourceReduction = (1 - lodChunk.resources.length / fullChunk.resources.length) * 100;
    console.log(`  Heightmap reduction: ${heightmapReduction.toFixed(1)}%`);
    console.log(`  Resource reduction: ${resourceReduction.toFixed(1)}%`);
  }
}

// Example 5: LOD Integration with ChunkManager
console.log('\n\nExample 5: LOD Integration with ChunkManager');
console.log('=============================================\n');

// Create manager with LOD configuration
const managerWithLOD = new ChunkManager({
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
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.1,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50,
      },
    ],
    clusterScale: 20,
    densityThreshold: 0.5,
  },
  structureConfig: {
    types: [],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverNetworkConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5,
  },
  // Enable LOD system
  lodConfig: {
    distances: [2, 5],
    meshResolutions: [1.0, 0.5, 0.25],
    featureDensities: [1.0, 0.5, 0.1],
  },
});

console.log('ChunkManager with LOD enabled');
console.log('Chunks will be generated at appropriate LOD based on viewer distance');

// Example 6: Dynamic LOD Updates
console.log('\n\nExample 6: Dynamic LOD Updates');
console.log('===============================\n');

console.log('Simulating player movement and LOD updates:\n');

// Simulate player positions
const playerPositions = [
  { x: 0, y: 0, desc: 'Starting position' },
  { x: 64, y: 0, desc: 'Moved 2 chunks east' },
  { x: 160, y: 0, desc: 'Moved 5 chunks east' },
];

for (const playerPos of playerPositions) {
  const playerChunkX = Math.floor(playerPos.x / 32);
  const playerChunkY = Math.floor(playerPos.y / 32);
  
  console.log(`Player at world (${playerPos.x}, ${playerPos.y}) - ${playerPos.desc}`);
  console.log(`Player chunk: (${playerChunkX}, ${playerChunkY})\n`);
  
  // Check LOD for chunks around player
  const checkChunks = [
    { x: playerChunkX, y: playerChunkY, desc: 'Current chunk' },
    { x: playerChunkX + 1, y: playerChunkY, desc: 'Adjacent chunk' },
    { x: playerChunkX + 3, y: playerChunkY, desc: '3 chunks away' },
    { x: playerChunkX + 6, y: playerChunkY, desc: '6 chunks away' },
  ];
  
  for (const chunk of checkChunks) {
    const level = lodManager.getLODLevel(chunk.x, chunk.y, playerChunkX, playerChunkY);
    console.log(`  ${chunk.desc} (${chunk.x}, ${chunk.y}): ${LODLevel[level]}`);
  }
  
  console.log('');
}

// Example 7: Performance Benefits
console.log('\n\nExample 7: Performance Benefits');
console.log('================================\n');

// Calculate memory savings with LOD
const chunkSize = 32;
const fullHeightmapSize = chunkSize * chunkSize * 4; // Float32Array = 4 bytes per value
const mediumHeightmapSize = Math.floor(chunkSize * 0.5) ** 2 * 4;
const lowHeightmapSize = Math.floor(chunkSize * 0.25) ** 2 * 4;

console.log('Memory usage per chunk (heightmap only):');
console.log(`  HIGH LOD: ${fullHeightmapSize} bytes (${(fullHeightmapSize / 1024).toFixed(2)} KB)`);
console.log(`  MEDIUM LOD: ${mediumHeightmapSize} bytes (${(mediumHeightmapSize / 1024).toFixed(2)} KB)`);
console.log(`  LOW LOD: ${lowHeightmapSize} bytes (${(lowHeightmapSize / 1024).toFixed(2)} KB)`);

const mediumSavings = ((1 - mediumHeightmapSize / fullHeightmapSize) * 100).toFixed(1);
const lowSavings = ((1 - lowHeightmapSize / fullHeightmapSize) * 100).toFixed(1);

console.log(`\nMemory savings:`);
console.log(`  MEDIUM LOD: ${mediumSavings}% reduction`);
console.log(`  LOW LOD: ${lowSavings}% reduction`);

console.log('\nAdditional benefits:');
console.log('  - Faster chunk generation (less data to process)');
console.log('  - Reduced rendering overhead (fewer vertices)');
console.log('  - Better frame rates with large view distances');
console.log('  - Scalable to very large worlds');

// Example 8: LOD Best Practices
console.log('\n\nExample 8: LOD Best Practices');
console.log('==============================\n');

console.log('1. Distance Thresholds:');
console.log('   - Tune based on your view distance and performance needs');
console.log('   - Typical values: [2, 5] or [3, 8] chunks');
console.log('   - Larger thresholds = more high-detail chunks');

console.log('\n2. Mesh Resolution:');
console.log('   - Use powers of 2 for clean downsampling (1.0, 0.5, 0.25)');
console.log('   - Bilinear interpolation ensures smooth transitions');
console.log('   - Very low resolutions (< 0.25) may look blocky');

console.log('\n3. Feature Density:');
console.log('   - Reduce features more aggressively than mesh (0.5, 0.1)');
console.log('   - Distant features are less visible anyway');
console.log('   - Deterministic filtering ensures consistency');

console.log('\n4. Dynamic Updates:');
console.log('   - Regenerate chunks when player moves significantly');
console.log('   - Use hysteresis to avoid constant regeneration');
console.log('   - Cache chunks at multiple LOD levels if memory allows');

console.log('\n5. Visual Quality:');
console.log('   - Test LOD transitions in your renderer');
console.log('   - Consider fade-in/fade-out for LOD switches');
console.log('   - Balance quality vs performance for your target hardware');

console.log('\n✓ LOD system examples complete!');
console.log('\nKey Takeaways:');
console.log('  - LOD reduces detail for distant chunks');
console.log('  - Configure distance thresholds, mesh resolution, and feature density');
console.log('  - Significant memory and performance savings');
console.log('  - Integrate with ChunkManager via lodConfig');
console.log('  - Update LOD dynamically as player moves');
console.log('  - Essential for large view distances and open worlds');
