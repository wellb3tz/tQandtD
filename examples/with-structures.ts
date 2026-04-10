/**
 * Structure Placement Example
 * 
 * This example demonstrates how to configure structure placement with
 * placement rules, minimum distance constraints, and rarity settings.
 */

import { ChunkManager, BiomeType, StructureType } from '../src/index';

const manager = new ChunkManager({
  seed: 789,
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
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          // Villages spawn in plains or forests
          { type: 'biome', params: { biomes: [BiomeType.PLAINS, BiomeType.FOREST] } },
          // Villages need flat terrain
          { type: 'slope', params: { maxSlope: 0.1 } },
          // Villages spawn at moderate elevations
          { type: 'elevation', params: { minHeight: 0.3, maxHeight: 0.7 } },
        ],
      },
      {
        type: StructureType.TOWER,
        rarity: 0.5,
        rules: [
          // Towers spawn on mountains
          { type: 'biome', params: { biomes: [BiomeType.MOUNTAIN] } },
          // Towers can be on steeper terrain
          { type: 'slope', params: { maxSlope: 0.3 } },
          // Towers spawn at high elevations
          { type: 'elevation', params: { minHeight: 0.6, maxHeight: 1.0 } },
        ],
      },
      {
        type: StructureType.RUINS,
        rarity: 0.8,
        rules: [
          // Ruins can spawn in various biomes
          { type: 'biome', params: { biomes: [BiomeType.DESERT, BiomeType.PLAINS, BiomeType.FOREST] } },
          // Ruins need relatively flat terrain
          { type: 'slope', params: { maxSlope: 0.15 } },
        ],
      },
    ],
    minDistance: 15, // Structures must be at least 15 tiles apart
    maxAttempts: 30,
  },
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
  },
});

// Generate a chunk and examine its structures
const chunk = manager.getChunk(0, 0);

console.log(`Generated ${chunk.structures.length} structures`);

// Display structure information
for (const structure of chunk.structures) {
  const index = structure.y * chunk.size + structure.x;
  const biome = chunk.biomeMap[index];
  const height = chunk.heightmap[index];
  
  console.log(
    `${StructureType[structure.type]} at (${structure.x}, ${structure.y})`,
    `in ${BiomeType[biome]}, height: ${height.toFixed(2)}`
  );
}

// Verify minimum distance constraint
for (let i = 0; i < chunk.structures.length; i++) {
  for (let j = i + 1; j < chunk.structures.length; j++) {
    const s1 = chunk.structures[i];
    const s2 = chunk.structures[j];
    const dx = s1.x - s2.x;
    const dy = s1.y - s2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    console.log(
      `Distance between ${StructureType[s1.type]} and ${StructureType[s2.type]}: ${distance.toFixed(2)}`
    );
  }
}
