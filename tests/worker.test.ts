import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
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
    climateSnowLine: 0.83,
    climateTreeLine: 0.62,
    worldTemperatureOffset: -0.2,
    temperatureMap: new Float32Array([-0.4, -0.3, -0.2, -0.1]),
    lakes: [{ waterLevel: 0.42, tiles: new Set([0, 3]), maxDepth: 0.12, minTerrainHeight: 0.3 }],
    rivers: [{
      riverId: 'river_1',
      pathId: 'river_1:main',
      isTributary: false,
      state: 'frozen',
      points: [{
        x: 0,
        y: 0,
        height: 0.6,
        surfaceLevel: 0.61,
        width: 1.5,
        depth: 0.03,
        flow: 0.5,
        channelWidth: 1.7,
        valleyWidth: 4.5,
        channelDepth: 0.06,
        valleyDepth: 0.03,
        flowX: 1,
        flowY: 0,
      }],
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    }],
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
    expect(restored.climateSnowLine).toBe(chunk.climateSnowLine);
    expect(restored.climateTreeLine).toBe(chunk.climateTreeLine);
    expect(restored.worldTemperatureOffset).toBe(chunk.worldTemperatureOffset);
    expect(Array.from(restored.temperatureMap ?? [])).toEqual(Array.from(chunk.temperatureMap ?? []));
    expect(restored.lakes?.[0].tiles).toEqual(new Set([0, 3]));
    expect(restored.rivers?.[0].riverId).toBe('river_1');
    expect(restored.rivers?.[0].state).toBe('frozen');
    expect(restored.rivers?.[0].points[0].surfaceLevel).toBe(0.61);
  });

  it('round-trips river corridor fields on path points', () => {
    const chunk = makeChunk();
    const serialized = serializeChunkData(chunk);
    const restored = deserializeChunkData(serialized);
    const expected = {
      flow: 0.5,
      channelWidth: 1.7,
      valleyWidth: 4.5,
      channelDepth: 0.06,
      valleyDepth: 0.03,
    };

    expect(serialized.rivers[0].points[0]).toMatchObject(expected);
    expect(restored.rivers?.[0].points[0]).toMatchObject(expected);
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

  it('includes river corridor fields in generated chunk messages when rivers exist', () => {
    setMessagePoster({ postMessage: message => posted.push(message) });

    const config = makeMinimalConfig(123);
    config.riverConfig = {
      ...DEFAULT_RIVER_CONFIG,
      enabled: true,
      sourceThreshold: 0,
      minSourceElevation: 0,
      maxSourceElevation: 1,
      minRiverLength: 2,
      maxLength: 48,
      maxRiversPerRegion: 8,
    };

    handleWorkerMessage({ data: { type: 'init', config } });

    for (let chunkX = -2; chunkX <= 2; chunkX++) {
      for (let chunkY = -2; chunkY <= 2; chunkY++) {
        handleWorkerMessage({ data: { type: 'generateChunk', chunkX, chunkY } });
      }
    }

    const chunks = posted.filter(
      (message): message is Extract<WorkerResponse, { type: 'chunkReady' }> => message.type === 'chunkReady'
    );
    const riverPoint = chunks
      .flatMap(message => message.chunk.rivers)
      .flatMap(river => river.points)
      .find(point => point.flow !== undefined);

    expect(riverPoint).toEqual(expect.objectContaining({
      flow: expect.any(Number),
      channelWidth: expect.any(Number),
      valleyWidth: expect.any(Number),
      channelDepth: expect.any(Number),
      valleyDepth: expect.any(Number),
    }));
  });
});
