/**
 * Enhanced Biomes Example
 * 
 * Demonstrates the enhanced biome system with:
 * - Smooth transition zones between biomes
 * - Micro-biomes (oasis, clearings, ponds, groves)
 * - Elevation bands in mountains (foothills, slopes, peaks)
 */

import {
  ChunkManager,
  BiomeType,
  MicroBiomeType,
  ElevationBand,
  type EnhancedBiomeData,
} from '../src/index';

console.log('=== Enhanced Biomes Example ===\n');

// Example 1: Basic Enhanced Biome Configuration
console.log('Example 1: Basic Enhanced Biome Configuration');
console.log('==============================================\n');

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
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
  },
  // Enable enhanced biome features
  enhancedBiomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    enableTransitions: true,
    transitionWidth: 10,
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,
    microBiomeMaxSize: 20,
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75,
  },
});

const chunk = manager.getChunk(0, 0);
console.log(`Generated chunk with enhanced biomes at (${chunk.x}, ${chunk.y})`);
console.log(`Chunk size: ${chunk.size}x${chunk.size}`);

// Example 2: Analyzing Biome Transitions
console.log('\n\nExample 2: Analyzing Biome Transitions');
console.log('=======================================\n');

// Sample biome data at various points
const samplePoints = [
  { x: 0, y: 0 },
  { x: 16, y: 16 },
  { x: 31, y: 31 },
  { x: 8, y: 24 },
];

console.log('Sampling biome data at different locations:\n');

for (const point of samplePoints) {
  const idx = point.y * chunk.size + point.x;
  const height = chunk.heightmap[idx];
  const biome = chunk.biomeMap[idx];
  
  // Get enhanced biome data if available
  const worldX = chunk.x * chunk.size + point.x;
  const worldY = chunk.y * chunk.size + point.y;
  
  console.log(`Position (${point.x}, ${point.y}) - World (${worldX}, ${worldY}):`);
  console.log(`  Height: ${height.toFixed(3)}`);
  console.log(`  Biome: ${BiomeType[biome]}`);
  
  // Note: Enhanced biome data would be accessed through EnhancedBiomeSystem
  // if integrated into chunk generation
}

// Example 3: Detecting Micro-Biomes
console.log('\n\nExample 3: Micro-Biome Concepts');
console.log('================================\n');

console.log('Micro-biomes are small localized variations within larger biomes:');
console.log('\nMicro-Biome Types:');
console.log(`  ${MicroBiomeType[MicroBiomeType.OASIS]} - Found in ${BiomeType[BiomeType.DESERT]} biomes`);
console.log(`  ${MicroBiomeType[MicroBiomeType.CLEARING]} - Found in ${BiomeType[BiomeType.FOREST]} biomes`);
console.log(`  ${MicroBiomeType[MicroBiomeType.POND]} - Found in ${BiomeType[BiomeType.PLAINS]} biomes`);
console.log(`  ${MicroBiomeType[MicroBiomeType.GROVE]} - Found in ${BiomeType[BiomeType.TUNDRA]} biomes`);

console.log('\nConfiguration:');
console.log(`  Frequency: 0.1 (10% of suitable locations)`);
console.log(`  Max Size: 20 tiles`);
console.log('\nMicro-biomes add visual interest and gameplay variety!');

// Example 4: Elevation Bands in Mountains
console.log('\n\nExample 4: Elevation Bands in Mountains');
console.log('========================================\n');

console.log('Mountain biomes are divided into elevation bands:\n');
console.log(`${ElevationBand[ElevationBand.FOOTHILLS]} (< 0.75 elevation):`);
console.log('  - Forested lower slopes');
console.log('  - Moderate vegetation');
console.log('  - Gradual inclines');

console.log(`\n${ElevationBand[ElevationBand.SLOPES]} (0.75 - 0.80 elevation):`);
console.log('  - Above tree line');
console.log('  - Rocky terrain');
console.log('  - Sparse vegetation');

console.log(`\n${ElevationBand[ElevationBand.PEAKS]} (> 0.80 elevation):`);
console.log('  - Snow-covered peaks');
console.log('  - Minimal vegetation');
console.log('  - Steep slopes');

// Count mountain tiles and their elevation bands
let mountainCount = 0;
let foothillsCount = 0;
let slopesCount = 0;
let peaksCount = 0;

for (let i = 0; i < chunk.biomeMap.length; i++) {
  if (chunk.biomeMap[i] === BiomeType.MOUNTAIN) {
    mountainCount++;
    const height = chunk.heightmap[i];
    
    if (height >= 0.8) {
      peaksCount++;
    } else if (height >= 0.75) {
      slopesCount++;
    } else {
      foothillsCount++;
    }
  }
}

if (mountainCount > 0) {
  console.log(`\nMountain tiles in this chunk: ${mountainCount}`);
  console.log(`  Foothills: ${foothillsCount} (${(foothillsCount / mountainCount * 100).toFixed(1)}%)`);
  console.log(`  Slopes: ${slopesCount} (${(slopesCount / mountainCount * 100).toFixed(1)}%)`);
  console.log(`  Peaks: ${peaksCount} (${(peaksCount / mountainCount * 100).toFixed(1)}%)`);
} else {
  console.log('\nNo mountain tiles in this chunk. Try different coordinates or seeds!');
}

// Example 5: Biome Transition Zones
console.log('\n\nExample 5: Biome Transition Zones');
console.log('==================================\n');

console.log('Transition zones create smooth blending between biomes:');
console.log('\nConfiguration:');
console.log('  Transition Width: 10 tiles');
console.log('  Blending: Distance-based interpolation');
console.log('\nBenefits:');
console.log('  - Natural-looking biome boundaries');
console.log('  - Gradual vegetation changes');
console.log('  - Smooth temperature/moisture transitions');
console.log('  - More realistic world appearance');

// Analyze biome diversity
const biomeCount = new Map<BiomeType, number>();
for (const biome of chunk.biomeMap) {
  biomeCount.set(biome, (biomeCount.get(biome) || 0) + 1);
}

console.log('\nBiome distribution in this chunk:');
for (const [biome, count] of biomeCount.entries()) {
  const percentage = (count / chunk.biomeMap.length * 100).toFixed(1);
  console.log(`  ${BiomeType[biome]}: ${count} tiles (${percentage}%)`);
}

// Example 6: Comparing Standard vs Enhanced Biomes
console.log('\n\nExample 6: Standard vs Enhanced Biomes');
console.log('=======================================\n');

// Create manager without enhanced biomes
const standardManager = new ChunkManager({
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
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
  },
  // No enhanced biome config
});

const standardChunk = standardManager.getChunk(0, 0);

console.log('Standard Biomes:');
console.log('  - Basic biome classification');
console.log('  - Simple blending at boundaries');
console.log('  - Uniform biome characteristics');

console.log('\nEnhanced Biomes:');
console.log('  - Smooth transition zones');
console.log('  - Micro-biome variations');
console.log('  - Elevation-based mountain bands');
console.log('  - More realistic and varied terrain');

console.log('\n✓ Enhanced biomes examples complete!');
console.log('\nKey Takeaways:');
console.log('  - Enable with enhancedBiomeConfig in WorldConfig');
console.log('  - Transition zones create natural biome boundaries');
console.log('  - Micro-biomes add localized variety');
console.log('  - Elevation bands make mountains more realistic');
console.log('  - All features are configurable and can be toggled independently');
