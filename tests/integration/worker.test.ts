import { describe, test, expect, beforeEach } from 'vitest';
import {
  serializeChunkData,
  deserializeChunkData,
  handleWorkerMessage,
  resetWorkerState,
  setMessagePoster,
  type WorkerRequest,
  type WorkerResponse,
  type InitMessage,
  type GenerateChunkMessage,
  type ClearCacheMessage,
} from '../../src/worker';
import { ChunkManager } from '../../src/world/chunk-manager';
import { BiomeType, ResourceType, StructureType } from '../../src/world/chunk';

describe('Web Worker Integration', () => {
  const createTestConfig = () => ({
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
      types: [
        {
          type: StructureType.VILLAGE,
          rarity: 1.0,
          rules: [
            { type: 'biome' as const, params: { biomes: [BiomeType.PLAINS] } },
            { type: 'slope' as const, params: { maxSlope: 0.1 } },
          ],
        },
      ],
      minDistance: 10,
      maxAttempts: 30,
    },
    riverNetworkConfig: {
      sourceElevation: 0.6,
      minFlowLength: 5,
      flowWidth: 2,
    },
  });

  describe('Chunk Data Serialization', () => {
    test('should serialize chunk data correctly', () => {
      const manager = new ChunkManager(createTestConfig());
      const chunk = manager.generateChunk(0, 0);

      const serialized = serializeChunkData(chunk);

      // Verify basic properties
      expect(serialized.x).toBe(chunk.x);
      expect(serialized.y).toBe(chunk.y);
      expect(serialized.size).toBe(chunk.size);

      // Verify arrays are converted
      expect(Array.isArray(serialized.heightmap)).toBe(true);
      expect(Array.isArray(serialized.biomeMap)).toBe(true);
      expect(Array.isArray(serialized.biomeWeights)).toBe(true);
      expect(Array.isArray(serialized.rivers)).toBe(true);

      // Verify array lengths
      expect(serialized.heightmap.length).toBe(chunk.heightmap.length);
      expect(serialized.biomeMap.length).toBe(chunk.biomeMap.length);
      expect(serialized.biomeWeights.length).toBe(chunk.biomeWeights.length);
      expect(serialized.rivers.length).toBe(chunk.rivers.size);

      // Verify resources and structures
      expect(serialized.resources.length).toBe(chunk.resources.length);
      expect(serialized.structures.length).toBe(chunk.structures.length);
    });

    test('should deserialize chunk data correctly', () => {
      const manager = new ChunkManager(createTestConfig());
      const original = manager.generateChunk(0, 0);

      const serialized = serializeChunkData(original);
      const deserialized = deserializeChunkData(serialized);

      // Verify basic properties
      expect(deserialized.x).toBe(original.x);
      expect(deserialized.y).toBe(original.y);
      expect(deserialized.size).toBe(original.size);

      // Verify TypedArrays are restored
      expect(deserialized.heightmap).toBeInstanceOf(Float32Array);
      expect(deserialized.biomeMap).toBeInstanceOf(Uint8Array);
      expect(deserialized.biomeWeights).toBeInstanceOf(Float32Array);

      // Verify Set is restored
      expect(deserialized.rivers).toBeInstanceOf(Set);

      // Verify data integrity
      expect(deserialized.heightmap).toEqual(original.heightmap);
      expect(deserialized.biomeMap).toEqual(original.biomeMap);
      expect(deserialized.biomeWeights).toEqual(original.biomeWeights);
      expect(deserialized.resources).toEqual(original.resources);
      expect(deserialized.structures).toEqual(original.structures);
      expect(Array.from(deserialized.rivers).sort()).toEqual(Array.from(original.rivers).sort());
    });

    test('should handle round-trip serialization without data loss', () => {
      const manager = new ChunkManager(createTestConfig());
      const original = manager.generateChunk(5, 5);

      // Perform round-trip serialization
      const serialized = serializeChunkData(original);
      const deserialized = deserializeChunkData(serialized);

      // Verify all data matches exactly
      expect(deserialized.x).toBe(original.x);
      expect(deserialized.y).toBe(original.y);
      expect(deserialized.size).toBe(original.size);

      // Check every element in heightmap
      for (let i = 0; i < original.heightmap.length; i++) {
        expect(deserialized.heightmap[i]).toBe(original.heightmap[i]);
      }

      // Check every element in biomeMap
      for (let i = 0; i < original.biomeMap.length; i++) {
        expect(deserialized.biomeMap[i]).toBe(original.biomeMap[i]);
      }

      // Check every element in biomeWeights
      for (let i = 0; i < original.biomeWeights.length; i++) {
        expect(deserialized.biomeWeights[i]).toBe(original.biomeWeights[i]);
      }

      // Check resources
      expect(deserialized.resources).toEqual(original.resources);

      // Check structures
      expect(deserialized.structures).toEqual(original.structures);

      // Check rivers
      expect(Array.from(deserialized.rivers).sort()).toEqual(Array.from(original.rivers).sort());
    });

    test('should serialize empty chunk correctly', () => {
      const manager = new ChunkManager({
        ...createTestConfig(),
        resourceConfig: { types: [], clusterScale: 20, densityThreshold: 0.5 },
        structureConfig: { types: [], minDistance: 10, maxAttempts: 30 },
        riverNetworkConfig: { sourceElevation: 1.0, minFlowLength: 1000, flowWidth: 2 },
      });
      const chunk = manager.generateChunk(0, 0);

      const serialized = serializeChunkData(chunk);
      const deserialized = deserializeChunkData(serialized);

      // Should have terrain and biomes but no features
      expect(deserialized.heightmap.length).toBe(33 * 33);
      expect(deserialized.biomeMap.length).toBe(32 * 32);
      expect(deserialized.resources.length).toBe(0);
      expect(deserialized.structures.length).toBe(0);
      expect(deserialized.rivers.size).toBe(0);
    });
  });

  describe('Worker Message Handling', () => {
    let messageResponses: WorkerResponse[];

    beforeEach(() => {
      messageResponses = [];
      
      // Reset worker state before each test
      resetWorkerState();
      
      // Set up message poster to capture responses
      setMessagePoster({
        postMessage: (response: WorkerResponse) => {
          messageResponses.push(response);
        },
      });
    });

    test('should handle init message', () => {
      const initMessage: InitMessage = {
        type: 'init',
        config: createTestConfig(),
      };

      const event = new MessageEvent('message', { data: initMessage });
      handleWorkerMessage(event);

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('ready');
    });

    test('should handle generateChunk message after init', () => {
      // First initialize
      const initMessage: InitMessage = {
        type: 'init',
        config: createTestConfig(),
      };
      handleWorkerMessage(new MessageEvent('message', { data: initMessage }));

      // Clear init response
      messageResponses = [];

      // Then generate chunk
      const generateMessage: GenerateChunkMessage = {
        type: 'generateChunk',
        chunkX: 0,
        chunkY: 0,
      };
      handleWorkerMessage(new MessageEvent('message', { data: generateMessage }));

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('chunkReady');
      
      const response = messageResponses[0] as any;
      expect(response.chunkX).toBe(0);
      expect(response.chunkY).toBe(0);
      expect(response.chunk).toBeDefined();
      expect(response.chunk.x).toBe(0);
      expect(response.chunk.y).toBe(0);
      expect(response.chunk.size).toBe(32);
    });

    test('should handle clearCache message after init', () => {
      // First initialize
      const initMessage: InitMessage = {
        type: 'init',
        config: createTestConfig(),
      };
      handleWorkerMessage(new MessageEvent('message', { data: initMessage }));

      // Clear init response
      messageResponses = [];

      // Then clear cache
      const clearMessage: ClearCacheMessage = {
        type: 'clearCache',
      };
      handleWorkerMessage(new MessageEvent('message', { data: clearMessage }));

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('cacheCleared');
    });

    test('should return error when generateChunk called before init', () => {
      const generateMessage: GenerateChunkMessage = {
        type: 'generateChunk',
        chunkX: 0,
        chunkY: 0,
      };
      handleWorkerMessage(new MessageEvent('message', { data: generateMessage }));

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('error');
      
      const errorResponse = messageResponses[0] as any;
      expect(errorResponse.message).toContain('not initialized');
    });

    test('should return error when clearCache called before init', () => {
      const clearMessage: ClearCacheMessage = {
        type: 'clearCache',
      };
      handleWorkerMessage(new MessageEvent('message', { data: clearMessage }));

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('error');
      
      const errorResponse = messageResponses[0] as any;
      expect(errorResponse.message).toContain('not initialized');
    });

    test('should return error for unknown message type', () => {
      const unknownMessage = {
        type: 'unknown',
      } as any;
      handleWorkerMessage(new MessageEvent('message', { data: unknownMessage }));

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('error');
      
      const errorResponse = messageResponses[0] as any;
      expect(errorResponse.message).toContain('Unknown message type');
    });

    test('should generate deterministic chunks through worker', () => {
      // Initialize
      const initMessage: InitMessage = {
        type: 'init',
        config: createTestConfig(),
      };
      handleWorkerMessage(new MessageEvent('message', { data: initMessage }));
      messageResponses = [];

      // Generate same chunk twice
      const generateMessage: GenerateChunkMessage = {
        type: 'generateChunk',
        chunkX: 3,
        chunkY: 3,
      };

      handleWorkerMessage(new MessageEvent('message', { data: generateMessage }));
      const response1 = messageResponses[0] as any;
      messageResponses = [];

      handleWorkerMessage(new MessageEvent('message', { data: generateMessage }));
      const response2 = messageResponses[0] as any;

      // Deserialize both chunks
      const chunk1 = deserializeChunkData(response1.chunk);
      const chunk2 = deserializeChunkData(response2.chunk);

      // Verify they are identical
      expect(chunk1.heightmap).toEqual(chunk2.heightmap);
      expect(chunk1.biomeMap).toEqual(chunk2.biomeMap);
      expect(chunk1.resources).toEqual(chunk2.resources);
      expect(chunk1.structures).toEqual(chunk2.structures);
      expect(Array.from(chunk1.rivers).sort()).toEqual(Array.from(chunk2.rivers).sort());
    });

    test('should include error stack in error response', () => {
      const generateMessage: GenerateChunkMessage = {
        type: 'generateChunk',
        chunkX: 0,
        chunkY: 0,
      };
      handleWorkerMessage(new MessageEvent('message', { data: generateMessage }));

      expect(messageResponses.length).toBe(1);
      expect(messageResponses[0].type).toBe('error');
      
      const errorResponse = messageResponses[0] as any;
      expect(errorResponse.stack).toBeDefined();
      expect(typeof errorResponse.stack).toBe('string');
    });
  });

  describe('Worker Communication Protocol', () => {
    test('should support multiple chunk generation requests', () => {
      const messageResponses: WorkerResponse[] = [];
      setMessagePoster({
        postMessage: (response: WorkerResponse) => {
          messageResponses.push(response);
        },
      });

      resetWorkerState();

      // Initialize
      const initMessage: InitMessage = {
        type: 'init',
        config: createTestConfig(),
      };
      handleWorkerMessage(new MessageEvent('message', { data: initMessage }));
      messageResponses.length = 0;

      // Generate multiple chunks
      const coords = [[0, 0], [1, 0], [0, 1], [1, 1]];
      
      for (const [x, y] of coords) {
        const generateMessage: GenerateChunkMessage = {
          type: 'generateChunk',
          chunkX: x,
          chunkY: y,
        };
        handleWorkerMessage(new MessageEvent('message', { data: generateMessage }));
      }

      // Should have responses for all chunks
      expect(messageResponses.length).toBe(4);
      
      for (let i = 0; i < 4; i++) {
        expect(messageResponses[i].type).toBe('chunkReady');
        const response = messageResponses[i] as any;
        expect(response.chunkX).toBe(coords[i][0]);
        expect(response.chunkY).toBe(coords[i][1]);
      }
    });

    test('should handle re-initialization', () => {
      const messageResponses: WorkerResponse[] = [];
      setMessagePoster({
        postMessage: (response: WorkerResponse) => {
          messageResponses.push(response);
        },
      });

      resetWorkerState();

      // Initialize with first config
      const config1 = createTestConfig();
      config1.seed = 111;
      handleWorkerMessage(new MessageEvent('message', { 
        data: { type: 'init', config: config1 } as InitMessage 
      }));

      // Generate chunk
      handleWorkerMessage(new MessageEvent('message', { 
        data: { type: 'generateChunk', chunkX: 0, chunkY: 0 } as GenerateChunkMessage 
      }));
      const chunk1 = (messageResponses[1] as any).chunk;

      // Re-initialize with different seed
      const config2 = createTestConfig();
      config2.seed = 222;
      handleWorkerMessage(new MessageEvent('message', { 
        data: { type: 'init', config: config2 } as InitMessage 
      }));

      // Generate same chunk coordinates
      handleWorkerMessage(new MessageEvent('message', { 
        data: { type: 'generateChunk', chunkX: 0, chunkY: 0 } as GenerateChunkMessage 
      }));
      const chunk2 = (messageResponses[3] as any).chunk;

      // Chunks should be different due to different seeds
      expect(chunk1.heightmap).not.toEqual(chunk2.heightmap);
    });
  });
});

