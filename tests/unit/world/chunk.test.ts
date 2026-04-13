import { describe, test, expect } from 'vitest';
import {
  BiomeType,
  ResourceType,
  StructureType,
  ChunkData,
  Resource,
  Structure,
  worldToChunk,
  chunkToWorld,
  worldToLocal,
  localToIndex,
  indexToLocal,
  getBoundaryVertex,
  getWorldCoordinate,
  type ChunkEdge,
} from '../../../src/world/chunk';

describe('Chunk Data Structures', () => {
  describe('ChunkData creation', () => {
    test('creates ChunkData with correct heightmap array size', () => {
      const size = 32;
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap: new Float32Array(size * size),
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8), // 8 biome types
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.heightmap.length).toBe(size * size);
      expect(chunkData.heightmap.length).toBe(1024);
    });

    test('creates ChunkData with correct biomeMap array size', () => {
      const size = 32;
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap: new Float32Array(size * size),
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.biomeMap.length).toBe(size * size);
      expect(chunkData.biomeMap.length).toBe(1024);
    });

    test('creates ChunkData with correct biomeWeights array size', () => {
      const size = 32;
      const numBiomes = 8;
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap: new Float32Array(size * size),
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * numBiomes),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.biomeWeights.length).toBe(size * size * numBiomes);
      expect(chunkData.biomeWeights.length).toBe(8192);
    });

    test('creates ChunkData with different chunk sizes', () => {
      const size = 16;
      const chunkData: ChunkData = {
        x: 5,
        y: -3,
        size,
        heightmap: new Float32Array(size * size),
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.size).toBe(16);
      expect(chunkData.heightmap.length).toBe(256);
      expect(chunkData.biomeMap.length).toBe(256);
      expect(chunkData.biomeWeights.length).toBe(2048);
    });

    test('creates ChunkData with correct coordinate values', () => {
      const chunkData: ChunkData = {
        x: 10,
        y: -5,
        size: 32,
        heightmap: new Float32Array(1024),
        biomeMap: new Uint8Array(1024),
        biomeWeights: new Float32Array(8192),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.x).toBe(10);
      expect(chunkData.y).toBe(-5);
    });

    test('creates ChunkData with empty resource array', () => {
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size: 32,
        heightmap: new Float32Array(1024),
        biomeMap: new Uint8Array(1024),
        biomeWeights: new Float32Array(8192),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.resources).toEqual([]);
      expect(Array.isArray(chunkData.resources)).toBe(true);
    });

    test('creates ChunkData with empty structure array', () => {
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size: 32,
        heightmap: new Float32Array(1024),
        biomeMap: new Uint8Array(1024),
        biomeWeights: new Float32Array(8192),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.structures).toEqual([]);
      expect(Array.isArray(chunkData.structures)).toBe(true);
    });

    test('creates ChunkData with empty rivers set', () => {
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size: 32,
        heightmap: new Float32Array(1024),
        biomeMap: new Uint8Array(1024),
        biomeWeights: new Float32Array(8192),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      };

      expect(chunkData.rivers.size).toBe(0);
      expect(chunkData.rivers).toBeInstanceOf(Set);
    });
  });

  describe('BiomeType enum', () => {
    test('has all expected biome types', () => {
      expect(BiomeType.OCEAN).toBe(0);
      expect(BiomeType.BEACH).toBe(1);
      expect(BiomeType.DESERT).toBe(2);
      expect(BiomeType.PLAINS).toBe(3);
      expect(BiomeType.FOREST).toBe(4);
      expect(BiomeType.TAIGA).toBe(5);
      expect(BiomeType.TUNDRA).toBe(6);
      expect(BiomeType.MOUNTAIN).toBe(7);
    });

    test('enum values are accessible', () => {
      expect(BiomeType.OCEAN).toBeDefined();
      expect(BiomeType.BEACH).toBeDefined();
      expect(BiomeType.DESERT).toBeDefined();
      expect(BiomeType.PLAINS).toBeDefined();
      expect(BiomeType.FOREST).toBeDefined();
      expect(BiomeType.TAIGA).toBeDefined();
      expect(BiomeType.TUNDRA).toBeDefined();
      expect(BiomeType.MOUNTAIN).toBeDefined();
    });

    test('enum values are numeric', () => {
      expect(typeof BiomeType.OCEAN).toBe('number');
      expect(typeof BiomeType.BEACH).toBe('number');
      expect(typeof BiomeType.DESERT).toBe('number');
      expect(typeof BiomeType.PLAINS).toBe('number');
      expect(typeof BiomeType.FOREST).toBe('number');
      expect(typeof BiomeType.TAIGA).toBe('number');
      expect(typeof BiomeType.TUNDRA).toBe('number');
      expect(typeof BiomeType.MOUNTAIN).toBe('number');
    });
  });

  describe('ResourceType enum', () => {
    test('has all expected resource types', () => {
      expect(ResourceType.IRON).toBe(0);
      expect(ResourceType.GOLD).toBe(1);
      expect(ResourceType.COAL).toBe(2);
      expect(ResourceType.STONE).toBe(3);
      expect(ResourceType.WOOD).toBe(4);
    });

    test('enum values are accessible', () => {
      expect(ResourceType.IRON).toBeDefined();
      expect(ResourceType.GOLD).toBeDefined();
      expect(ResourceType.COAL).toBeDefined();
      expect(ResourceType.STONE).toBeDefined();
      expect(ResourceType.WOOD).toBeDefined();
    });

    test('enum values are numeric', () => {
      expect(typeof ResourceType.IRON).toBe('number');
      expect(typeof ResourceType.GOLD).toBe('number');
      expect(typeof ResourceType.COAL).toBe('number');
      expect(typeof ResourceType.STONE).toBe('number');
      expect(typeof ResourceType.WOOD).toBe('number');
    });
  });

  describe('StructureType enum', () => {
    test('has all expected structure types', () => {
      expect(StructureType.VILLAGE).toBe(0);
      expect(StructureType.RUINS).toBe(1);
      expect(StructureType.TOWER).toBe(2);
    });

    test('enum values are accessible', () => {
      expect(StructureType.VILLAGE).toBeDefined();
      expect(StructureType.RUINS).toBeDefined();
      expect(StructureType.TOWER).toBeDefined();
    });

    test('enum values are numeric', () => {
      expect(typeof StructureType.VILLAGE).toBe('number');
      expect(typeof StructureType.RUINS).toBe('number');
      expect(typeof StructureType.TOWER).toBe('number');
    });
  });

  describe('Resource interface', () => {
    test('creates valid resource object', () => {
      const resource: Resource = {
        x: 10,
        y: 15,
        type: ResourceType.IRON,
        amount: 50,
      };

      expect(resource.x).toBe(10);
      expect(resource.y).toBe(15);
      expect(resource.type).toBe(ResourceType.IRON);
      expect(resource.amount).toBe(50);
    });

    test('supports all resource types', () => {
      const resources: Resource[] = [
        { x: 0, y: 0, type: ResourceType.IRON, amount: 10 },
        { x: 1, y: 1, type: ResourceType.GOLD, amount: 20 },
        { x: 2, y: 2, type: ResourceType.COAL, amount: 30 },
        { x: 3, y: 3, type: ResourceType.STONE, amount: 40 },
        { x: 4, y: 4, type: ResourceType.WOOD, amount: 50 },
      ];

      expect(resources.length).toBe(5);
      expect(resources[0].type).toBe(ResourceType.IRON);
      expect(resources[1].type).toBe(ResourceType.GOLD);
      expect(resources[2].type).toBe(ResourceType.COAL);
      expect(resources[3].type).toBe(ResourceType.STONE);
      expect(resources[4].type).toBe(ResourceType.WOOD);
    });
  });

  describe('Structure interface', () => {
    test('creates valid structure object', () => {
      const structure: Structure = {
        x: 20,
        y: 25,
        type: StructureType.VILLAGE,
      };

      expect(structure.x).toBe(20);
      expect(structure.y).toBe(25);
      expect(structure.type).toBe(StructureType.VILLAGE);
    });

    test('supports all structure types', () => {
      const structures: Structure[] = [
        { x: 0, y: 0, type: StructureType.VILLAGE },
        { x: 1, y: 1, type: StructureType.RUINS },
        { x: 2, y: 2, type: StructureType.TOWER },
      ];

      expect(structures.length).toBe(3);
      expect(structures[0].type).toBe(StructureType.VILLAGE);
      expect(structures[1].type).toBe(StructureType.RUINS);
      expect(structures[2].type).toBe(StructureType.TOWER);
    });
  });
});


describe('Coordinate Conversion Utilities', () => {
  describe('worldToChunk', () => {
    test('converts positive world coordinates to chunk coordinates', () => {
      expect(worldToChunk(0, 0, 32)).toEqual([0, 0]);
      expect(worldToChunk(31, 31, 32)).toEqual([0, 0]);
      expect(worldToChunk(32, 32, 32)).toEqual([1, 1]);
      expect(worldToChunk(64, 96, 32)).toEqual([2, 3]);
    });

    test('converts negative world coordinates to chunk coordinates', () => {
      expect(worldToChunk(-1, -1, 32)).toEqual([-1, -1]);
      expect(worldToChunk(-32, -32, 32)).toEqual([-1, -1]);
      expect(worldToChunk(-33, -33, 32)).toEqual([-2, -2]);
      expect(worldToChunk(-64, -96, 32)).toEqual([-2, -3]);
    });

    test('handles mixed positive and negative coordinates', () => {
      expect(worldToChunk(16, -16, 32)).toEqual([0, -1]);
      expect(worldToChunk(-16, 16, 32)).toEqual([-1, 0]);
    });

    test('works with different chunk sizes', () => {
      expect(worldToChunk(50, 50, 16)).toEqual([3, 3]);
      expect(worldToChunk(50, 50, 64)).toEqual([0, 0]);
    });
  });

  describe('chunkToWorld', () => {
    test('converts chunk coordinates to world coordinates', () => {
      expect(chunkToWorld(0, 0, 32)).toEqual([0, 0]);
      expect(chunkToWorld(1, 1, 32)).toEqual([32, 32]);
      expect(chunkToWorld(2, 3, 32)).toEqual([64, 96]);
    });

    test('handles negative chunk coordinates', () => {
      expect(chunkToWorld(-1, -1, 32)).toEqual([-32, -32]);
      expect(chunkToWorld(-2, -3, 32)).toEqual([-64, -96]);
    });

    test('works with different chunk sizes', () => {
      expect(chunkToWorld(3, 3, 16)).toEqual([48, 48]);
      expect(chunkToWorld(1, 1, 64)).toEqual([64, 64]);
    });
  });

  describe('worldToLocal', () => {
    test('converts world coordinates to local chunk coordinates', () => {
      expect(worldToLocal(0, 0, 32)).toEqual([0, 0]);
      expect(worldToLocal(15, 20, 32)).toEqual([15, 20]);
      expect(worldToLocal(31, 31, 32)).toEqual([31, 31]);
    });

    test('wraps coordinates at chunk boundaries', () => {
      expect(worldToLocal(32, 32, 32)).toEqual([0, 0]);
      expect(worldToLocal(33, 34, 32)).toEqual([1, 2]);
      expect(worldToLocal(64, 96, 32)).toEqual([0, 0]);
    });

    test('handles negative world coordinates correctly', () => {
      expect(worldToLocal(-1, -1, 32)).toEqual([31, 31]);
      expect(worldToLocal(-2, -3, 32)).toEqual([30, 29]);
      expect(worldToLocal(-32, -32, 32)).toEqual([0, 0]);
      expect(worldToLocal(-33, -33, 32)).toEqual([31, 31]);
    });

    test('works with different chunk sizes', () => {
      expect(worldToLocal(50, 50, 16)).toEqual([2, 2]);
      expect(worldToLocal(50, 50, 64)).toEqual([50, 50]);
    });
  });

  describe('localToIndex', () => {
    test('converts local coordinates to flat array index', () => {
      expect(localToIndex(0, 0, 32)).toBe(0);
      expect(localToIndex(1, 0, 32)).toBe(1);
      expect(localToIndex(0, 1, 32)).toBe(32);
      expect(localToIndex(31, 31, 32)).toBe(1023);
    });

    test('works with different chunk sizes', () => {
      expect(localToIndex(15, 15, 16)).toBe(255);
      expect(localToIndex(63, 63, 64)).toBe(4095);
    });
  });

  describe('indexToLocal', () => {
    test('converts flat array index to local coordinates', () => {
      expect(indexToLocal(0, 32)).toEqual([0, 0]);
      expect(indexToLocal(1, 32)).toEqual([1, 0]);
      expect(indexToLocal(32, 32)).toEqual([0, 1]);
      expect(indexToLocal(1023, 32)).toEqual([31, 31]);
    });

    test('works with different chunk sizes', () => {
      expect(indexToLocal(255, 16)).toEqual([15, 15]);
      expect(indexToLocal(4095, 64)).toEqual([63, 63]);
    });
  });

  describe('round-trip conversions', () => {
    test('worldToChunk and chunkToWorld are inverse operations', () => {
      const chunkCoords = worldToChunk(100, 200, 32);
      const worldCoords = chunkToWorld(chunkCoords[0], chunkCoords[1], 32);
      
      // Should get back to the chunk's origin
      expect(worldCoords[0]).toBeLessThanOrEqual(100);
      expect(worldCoords[1]).toBeLessThanOrEqual(200);
      expect(worldCoords[0] + 32).toBeGreaterThan(100);
      expect(worldCoords[1] + 32).toBeGreaterThan(200);
    });

    test('localToIndex and indexToLocal are inverse operations', () => {
      const index = localToIndex(15, 20, 32);
      const local = indexToLocal(index, 32);
      expect(local).toEqual([15, 20]);
    });

    test('worldToLocal preserves position within chunk', () => {
      const worldX = 100;
      const worldY = 200;
      const chunkSize = 32;
      
      const [chunkX, chunkY] = worldToChunk(worldX, worldY, chunkSize);
      const [localX, localY] = worldToLocal(worldX, worldY, chunkSize);
      const [worldOriginX, worldOriginY] = chunkToWorld(chunkX, chunkY, chunkSize);
      
      expect(worldOriginX + localX).toBe(worldX);
      expect(worldOriginY + localY).toBe(worldY);
    });
  });
});

describe('Boundary Vertex Helper Functions', () => {
  // Helper to create a test chunk with seamless heightmap (size+1)^2
  function createTestChunk(chunkX: number, chunkY: number, size: number): ChunkData {
    const vertexSize = size + 1;
    const heightmap = new Float32Array(vertexSize * vertexSize);
    
    // Fill with test data: height = localX + localY * 100
    for (let y = 0; y <= size; y++) {
      for (let x = 0; x <= size; x++) {
        const index = y * vertexSize + x;
        heightmap[index] = x + y * 100;
      }
    }
    
    return {
      x: chunkX,
      y: chunkY,
      size,
      heightmap,
      biomeMap: new Uint8Array(size * size),
      biomeWeights: new Float32Array(size * size * 8),
      resources: [],
      structures: [],
      rivers: new Set<number>(),
    };
  }

  describe('getBoundaryVertex', () => {
    test('gets vertices from top edge', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      // Top edge has y=0, so height = x + 0*100 = x
      expect(getBoundaryVertex(chunk, 'top', 0)).toBe(0);
      expect(getBoundaryVertex(chunk, 'top', 1)).toBe(1);
      expect(getBoundaryVertex(chunk, 'top', 16)).toBe(16);
      expect(getBoundaryVertex(chunk, 'top', 32)).toBe(32);
    });

    test('gets vertices from bottom edge', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      // Bottom edge has y=32, so height = x + 32*100 = x + 3200
      expect(getBoundaryVertex(chunk, 'bottom', 0)).toBe(0 + 3200);
      expect(getBoundaryVertex(chunk, 'bottom', 1)).toBe(1 + 3200);
      expect(getBoundaryVertex(chunk, 'bottom', 16)).toBe(16 + 3200);
      expect(getBoundaryVertex(chunk, 'bottom', 32)).toBe(32 + 3200);
    });

    test('gets vertices from left edge', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      // Left edge has x=0, so height = 0 + y*100 = y*100
      expect(getBoundaryVertex(chunk, 'left', 0)).toBe(0);
      expect(getBoundaryVertex(chunk, 'left', 1)).toBe(100);
      expect(getBoundaryVertex(chunk, 'left', 16)).toBe(1600);
      expect(getBoundaryVertex(chunk, 'left', 32)).toBe(3200);
    });

    test('gets vertices from right edge', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      // Right edge has x=32, so height = 32 + y*100
      expect(getBoundaryVertex(chunk, 'right', 0)).toBe(32);
      expect(getBoundaryVertex(chunk, 'right', 1)).toBe(32 + 100);
      expect(getBoundaryVertex(chunk, 'right', 16)).toBe(32 + 1600);
      expect(getBoundaryVertex(chunk, 'right', 32)).toBe(32 + 3200);
    });

    test('throws error for out-of-range index', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      expect(() => getBoundaryVertex(chunk, 'top', -1)).toThrow();
      expect(() => getBoundaryVertex(chunk, 'top', 33)).toThrow();
      expect(() => getBoundaryVertex(chunk, 'left', -1)).toThrow();
      expect(() => getBoundaryVertex(chunk, 'left', 33)).toThrow();
    });

    test('works with different chunk sizes', () => {
      const chunk16 = createTestChunk(0, 0, 16);
      const chunk64 = createTestChunk(0, 0, 64);
      
      expect(getBoundaryVertex(chunk16, 'top', 16)).toBe(16);
      expect(getBoundaryVertex(chunk64, 'top', 64)).toBe(64);
    });
  });

  describe('getWorldCoordinate', () => {
    test('converts local coordinates to world coordinates for chunk (0,0)', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      expect(getWorldCoordinate(chunk, 0, 0)).toEqual([0, 0]);
      expect(getWorldCoordinate(chunk, 16, 16)).toEqual([16, 16]);
      expect(getWorldCoordinate(chunk, 32, 32)).toEqual([32, 32]);
    });

    test('converts local coordinates to world coordinates for positive chunk coords', () => {
      const chunk = createTestChunk(2, 3, 32);
      
      // World = chunk * size + local
      expect(getWorldCoordinate(chunk, 0, 0)).toEqual([64, 96]);
      expect(getWorldCoordinate(chunk, 16, 16)).toEqual([80, 112]);
      expect(getWorldCoordinate(chunk, 32, 32)).toEqual([96, 128]);
    });

    test('converts local coordinates to world coordinates for negative chunk coords', () => {
      const chunk = createTestChunk(-1, -2, 32);
      
      expect(getWorldCoordinate(chunk, 0, 0)).toEqual([-32, -64]);
      expect(getWorldCoordinate(chunk, 16, 16)).toEqual([-16, -48]);
      expect(getWorldCoordinate(chunk, 32, 32)).toEqual([0, -32]);
    });

    test('boundary vertices of adjacent chunks share world coordinates', () => {
      const chunk1 = createTestChunk(0, 0, 32);
      const chunk2 = createTestChunk(1, 0, 32);
      
      // Right edge of chunk1 at local (32, y) should match left edge of chunk2 at local (0, y)
      const [worldX1, worldY1] = getWorldCoordinate(chunk1, 32, 16);
      const [worldX2, worldY2] = getWorldCoordinate(chunk2, 0, 16);
      
      expect(worldX1).toBe(32);
      expect(worldX2).toBe(32);
      expect(worldY1).toBe(16);
      expect(worldY2).toBe(16);
    });

    test('throws error for out-of-range coordinates', () => {
      const chunk = createTestChunk(0, 0, 32);
      
      expect(() => getWorldCoordinate(chunk, -1, 0)).toThrow();
      expect(() => getWorldCoordinate(chunk, 33, 0)).toThrow();
      expect(() => getWorldCoordinate(chunk, 0, -1)).toThrow();
      expect(() => getWorldCoordinate(chunk, 0, 33)).toThrow();
    });

    test('works with different chunk sizes', () => {
      const chunk16 = createTestChunk(1, 1, 16);
      const chunk64 = createTestChunk(1, 1, 64);
      
      expect(getWorldCoordinate(chunk16, 16, 16)).toEqual([32, 32]);
      expect(getWorldCoordinate(chunk64, 64, 64)).toEqual([128, 128]);
    });
  });

  describe('integration: boundary vertex matching between adjacent chunks', () => {
    test('horizontal adjacency: right edge of chunk1 matches left edge of chunk2', () => {
      const chunk1 = createTestChunk(0, 0, 32);
      const chunk2 = createTestChunk(1, 0, 32);
      
      // Check all vertices along the shared boundary
      for (let i = 0; i <= 32; i++) {
        const [worldX1, worldY1] = getWorldCoordinate(chunk1, 32, i);
        const [worldX2, worldY2] = getWorldCoordinate(chunk2, 0, i);
        
        expect(worldX1).toBe(worldX2);
        expect(worldY1).toBe(worldY2);
      }
    });

    test('vertical adjacency: bottom edge of chunk1 matches top edge of chunk2', () => {
      const chunk1 = createTestChunk(0, 0, 32);
      const chunk2 = createTestChunk(0, 1, 32);
      
      // Check all vertices along the shared boundary
      for (let i = 0; i <= 32; i++) {
        const [worldX1, worldY1] = getWorldCoordinate(chunk1, i, 32);
        const [worldX2, worldY2] = getWorldCoordinate(chunk2, i, 0);
        
        expect(worldX1).toBe(worldX2);
        expect(worldY1).toBe(worldY2);
      }
    });

    test('corner meeting point: four chunks share the same world coordinate', () => {
      const chunk00 = createTestChunk(0, 0, 32);
      const chunk10 = createTestChunk(1, 0, 32);
      const chunk01 = createTestChunk(0, 1, 32);
      const chunk11 = createTestChunk(1, 1, 32);
      
      // All four chunks should have a vertex at world (32, 32)
      const [worldX00, worldY00] = getWorldCoordinate(chunk00, 32, 32);
      const [worldX10, worldY10] = getWorldCoordinate(chunk10, 0, 32);
      const [worldX01, worldY01] = getWorldCoordinate(chunk01, 32, 0);
      const [worldX11, worldY11] = getWorldCoordinate(chunk11, 0, 0);
      
      expect(worldX00).toBe(32);
      expect(worldX10).toBe(32);
      expect(worldX01).toBe(32);
      expect(worldX11).toBe(32);
      
      expect(worldY00).toBe(32);
      expect(worldY10).toBe(32);
      expect(worldY01).toBe(32);
      expect(worldY11).toBe(32);
    });
  });
});
