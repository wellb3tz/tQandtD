const { StructurePlacer } = require('./dist/gen/structures.js');
const { BiomeType, StructureType } = require('./dist/world/chunk.js');

const config = {
  types: [
    {
      type: StructureType.VILLAGE,
      rarity: 1.0,
      rules: [],
    },
  ],
  minDistance: 3,
  maxAttempts: 30,
};

const placer = new StructurePlacer(config);
const chunkSize = 16;

const chunkData = {
  x: 0,
  y: 0,
  size: chunkSize,
  heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
  biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
  biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
  resources: [],
  structures: [],
  rivers: new Set(),
};

const structures = placer.generateStructures(chunkData, 0);

console.log('Structures:', structures);

for (let i = 0; i < structures.length; i++) {
  for (let j = i + 1; j < structures.length; j++) {
    const s1 = structures[i];
    const s2 = structures[j];
    const dx = s1.x - s2.x;
    const dy = s1.y - s2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    console.log(`Distance between structure ${i} (${s1.x}, ${s1.y}) and ${j} (${s2.x}, ${s2.y}): ${distance}`);
    if (distance < 3) {
      console.log('  ^^^ TOO CLOSE!');
    }
  }
}
