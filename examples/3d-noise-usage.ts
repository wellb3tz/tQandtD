/**
 * 3D Noise Usage Example
 * 
 * Demonstrates how to use 3D noise generation for more realistic terrain features.
 * 3D noise adds vertical variation and can create features like overhangs, caves,
 * and more organic terrain shapes.
 */

import { ChunkManager, BiomeType, ResourceType, StructureType } from '../src/index';

console.log('=== 3D Noise Usage Example ===\n');

// Example 1: Basic 3D Noise Configuration
console.log('Example 1: Basic 3D Noise Configuration');
console.log('========================================\n');

const manager3D = new ChunkManager({
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
  // Enable 3D noise generation
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5, // Z-axis scale factor (smaller = more vertical variation)
  },
});

const chunk3D = manager3D.getChunk(0, 0);
console.log(`Generated chunk with 3D noise at (${chunk3D.x}, ${chunk3D.y})`);
console.log(`Heightmap size: ${chunk3D.heightmap.length}`);
console.log(`Height range: ${Math.min(...chunk3D.heightmap).toFixed(3)} to ${Math.max(...chunk3D.heightmap).toFixed(3)}`);

// Calculate average height
const avgHeight3D = chunk3D.heightmap.reduce((sum, h) => sum + h, 0) / chunk3D.heightmap.length;
console.log(`Average height: ${avgHeight3D.toFixed(3)}`);

// Example 2: Comparing 2D vs 3D Noise
console.log('\n\nExample 2: Comparing 2D vs 3D Noise');
console.log('====================================\n');

// Generate with 2D noise (default)
const manager2D = new ChunkManager({
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
  // 3D noise disabled (default)
});

const chunk2D = manager2D.getChunk(0, 0);

// Calculate height variation (standard deviation)
const calculateStdDev = (values: Float32Array): number => {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const stdDev2D = calculateStdDev(chunk2D.heightmap);
const stdDev3D = calculateStdDev(chunk3D.heightmap);

console.log('2D Noise:');
console.log(`  Height variation (std dev): ${stdDev2D.toFixed(4)}`);
console.log(`  Min height: ${Math.min(...chunk2D.heightmap).toFixed(3)}`);
console.log(`  Max height: ${Math.max(...chunk2D.heightmap).toFixed(3)}`);

console.log('\n3D Noise:');
console.log(`  Height variation (std dev): ${stdDev3D.toFixed(4)}`);
console.log(`  Min height: ${Math.min(...chunk3D.heightmap).toFixed(3)}`);
console.log(`  Max height: ${Math.max(...chunk3D.heightmap).toFixed(3)}`);

console.log(`\nVariation increase: ${((stdDev3D / stdDev2D - 1) * 100).toFixed(1)}%`);

// Example 3: Adjusting Z-Scale for Different Effects
console.log('\n\nExample 3: Adjusting Z-Scale for Different Effects');
console.log('==================================================\n');

const zScales = [0.1, 0.5, 1.0, 2.0];

for (const zScale of zScales) {
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
    noise3DConfig: {
      enable3D: true,
      zScale,
    },
  });

  const chunk = manager.getChunk(0, 0);
  const stdDev = calculateStdDev(chunk.heightmap);
  
  console.log(`Z-Scale ${zScale}:`);
  console.log(`  Height variation: ${stdDev.toFixed(4)}`);
  console.log(`  Range: ${Math.min(...chunk.heightmap).toFixed(3)} to ${Math.max(...chunk.heightmap).toFixed(3)}`);
}

console.log('\nNote: Lower z-scale values create more vertical variation');
console.log('      Higher z-scale values create smoother, more gradual terrain');

// Example 4: 3D Noise with Domain Warping
console.log('\n\nExample 4: 3D Noise with Domain Warping');
console.log('========================================\n');

const managerWarped = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 50, // Increased warp strength for more organic shapes
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
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5,
  },
});

const chunkWarped = managerWarped.getChunk(0, 0);
const stdDevWarped = calculateStdDev(chunkWarped.heightmap);

console.log('3D Noise with Strong Domain Warping:');
console.log(`  Height variation: ${stdDevWarped.toFixed(4)}`);
console.log(`  Range: ${Math.min(...chunkWarped.heightmap).toFixed(3)} to ${Math.max(...chunkWarped.heightmap).toFixed(3)}`);
console.log('\nDomain warping creates more organic, irregular terrain features');

// Example 5: Practical Use Case - Cave/Overhang Detection
console.log('\n\nExample 5: Practical Use Case - Detecting Terrain Features');
console.log('==========================================================\n');

// In a real 3D voxel-based system, you would sample 3D noise at multiple heights
// to determine solid vs empty space. This example shows the concept.

console.log('Concept: Using 3D noise for volumetric terrain');
console.log('In a voxel-based system, you would:');
console.log('  1. Sample 3D noise at each (x, y, z) position');
console.log('  2. If noise value > threshold, place solid block');
console.log('  3. If noise value <= threshold, leave empty (air/cave)');
console.log('\nThis allows for:');
console.log('  - Natural cave systems');
console.log('  - Overhanging cliffs');
console.log('  - Arches and tunnels');
console.log('  - More realistic mountain shapes');

console.log('\n✓ 3D noise examples complete!');
console.log('\nKey Takeaways:');
console.log('  - Enable 3D noise with noise3DConfig.enable3D = true');
console.log('  - Adjust zScale to control vertical variation (lower = more variation)');
console.log('  - Combine with domain warping for organic shapes');
console.log('  - Use for volumetric terrain in voxel-based systems');
