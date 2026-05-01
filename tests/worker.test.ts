import { afterEach, describe, expect, it } from 'vitest';
import {
  deserializeChunkData,
  handleWorkerMessage,
  resetWorkerState,
  serializeChunkData,
  setMessagePoster,
  type WorkerResponse,
} from '../src/worker';
import { BiomeType, type ChunkData } from '../src/world/chunk';
import { makeMinimalConfig } from './helpers';

function makeChunk(): ChunkData {
  return {
    x: 1,
    y: -2,
    size: 2,
    heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
    biomeMap: new Uint8Array([BiomeType.PLAINS, BiomeType.FOREST, BiomeType.DESERT, BiomeType.MOUNTAIN]),
    sparseBiomeTypes: new Uint8Array([BiomeType.PLAINS, BiomeType.FOREST]),
    sparseBiomeWeights: new Float32Array([0.75, 0.25]),
    sparseBiomeOffsets: new Uint16Array([0, 1, 1, 2, 2]),
    lakes: [{ waterLevel: 0.42, tiles: new Set([0, 3]), maxDepth: 0.12, minTerrainHeight: 0.3 }],
    resources: [{ x: 1, y: 1, type: 0, amount: 4 }],
    structures: [{ x: 0, y: 1, type: 0 }],
  };
}

describe('worker serialization', () => {
  it('round-trips typed arrays, sparse biome data, and lakes', () => {
    const chunk = makeChunk();
    const restored = deserializeChunkData(serializeChunkData(chunk));

    expect(restored).toMatchObject({ x: 1, y: -2, size: 2 });
    expect(Array.from(restored.heightmap)).toEqual(Array.from(chunk.heightmap));
    expect(Array.from(restored.biomeMap)).toEqual(Array.from(chunk.biomeMap));
    expect(Array.from(restored.sparseBiomeTypes)).toEqual(Array.from(chunk.sparseBiomeTypes));
    expect(Array.from(restored.sparseBiomeWeights)).toEqual(Array.from(chunk.sparseBiomeWeights));
    expect(Array.from(restored.sparseBiomeOffsets)).toEqual(Array.from(chunk.sparseBiomeOffsets));
    expect(restored.lakes?.[0].tiles).toEqual(new Set([0, 3]));
  });

  it('copies subarray views into transferable buffers with the correct byte range', () => {
    const chunk = makeChunk();
    const source = new Float32Array([99, 0.2, 0.4, 77]);
    chunk.heightmap = source.subarray(1, 3);

    const serialized = serializeChunkData(chunk);
    const restored = deserializeChunkData(serialized);

    expect(Array.from(restored.heightmap)).toEqual(Array.from(new Float32Array([0.2, 0.4])));
  });
});

describe('worker message handling', () => {
  const posted: WorkerResponse[] = [];

  afterEach(() => {
    resetWorkerState();
    posted.length = 0;
    setMessagePoster({ postMessage: message => posted.push(message) });
  });

  it('returns an error if generation is requested before init', () => {
    setMessagePoster({ postMessage: message => posted.push(message) });

    handleWorkerMessage({ data: { type: 'generateChunk', chunkX: 0, chunkY: 0 } });

    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      type: 'error',
      message: 'Worker not initialized. Send "init" message first.',
    });
  });

  it('initializes, generates a chunk, and clears cache through messages', () => {
    setMessagePoster({ postMessage: message => posted.push(message) });

    handleWorkerMessage({ data: { type: 'init', config: makeMinimalConfig(123) } });
    handleWorkerMessage({ data: { type: 'generateChunk', chunkX: 0, chunkY: 0 } });
    handleWorkerMessage({ data: { type: 'clearCache' } });

    expect(posted[0]).toEqual({ type: 'ready' });
    expect(posted[1]).toMatchObject({ type: 'chunkReady', chunkX: 0, chunkY: 0 });
    expect(posted[2]).toEqual({ type: 'cacheCleared' });
  });
});
