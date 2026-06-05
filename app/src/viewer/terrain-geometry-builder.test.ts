import { describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '@engine/index';
import { buildTerrainGeometryBuffers } from './terrain-geometry-builder';

describe('terrain geometry builder', () => {
  it('keeps glacier ice vertex colors cold instead of yellow-green', () => {
    const data = {
      size: 1,
      heightmap: new Float32Array([0.5, 0.5, 0.5, 0.5]),
      biomeMap: new Uint8Array([BiomeType.GLACIER]),
      resources: [],
      structures: [],
    } as unknown as ChunkData;

    const buffers = buildTerrainGeometryBuffers(data, {
      chunkX: 0,
      chunkY: 0,
      heightScale: 50,
      seaLevel: 0.3,
      underwaterDarkenFactor: 0.55,
      underwaterDesaturationFactor: 0.3,
      enableDepthGradient: true,
    });

    for (let i = 0; i < buffers.vertexCount; i++) {
      const r = buffers.colors[i * 3];
      const g = buffers.colors[i * 3 + 1];
      const b = buffers.colors[i * 3 + 2];

      expect(r).toBeLessThan(g);
      expect(g).toBeLessThanOrEqual(b + 0.04);
      expect(buffers.surfaceBlendC[i * 4 + 1]).toBeGreaterThan(0);
    }
  });

  it('keeps desert vertex colors warm instead of cyan', () => {
    const data = {
      size: 1,
      heightmap: new Float32Array([0.5, 0.5, 0.5, 0.5]),
      biomeMap: new Uint8Array([BiomeType.DESERT]),
      resources: [],
      structures: [],
    } as unknown as ChunkData;

    const buffers = buildTerrainGeometryBuffers(data, {
      chunkX: 0,
      chunkY: 0,
      heightScale: 50,
      seaLevel: 0.3,
      underwaterDarkenFactor: 0.55,
      underwaterDesaturationFactor: 0.3,
      enableDepthGradient: true,
    });

    for (let i = 0; i < buffers.vertexCount; i++) {
      const r = buffers.colors[i * 3];
      const g = buffers.colors[i * 3 + 1];
      const b = buffers.colors[i * 3 + 2];

      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
      expect(buffers.surfaceBlendA[i * 4 + 1]).toBeGreaterThan(0);
    }
  });

  it('keeps beach vertex colors sandy instead of muddy green', () => {
    const data = {
      size: 1,
      heightmap: new Float32Array([0.5, 0.52, 0.5, 0.52]),
      biomeMap: new Uint8Array([BiomeType.BEACH]),
      resources: [],
      structures: [],
    } as unknown as ChunkData;

    const buffers = buildTerrainGeometryBuffers(data, {
      chunkX: 0,
      chunkY: 0,
      heightScale: 50,
      seaLevel: 0.3,
      underwaterDarkenFactor: 0.55,
      underwaterDesaturationFactor: 0.3,
      enableDepthGradient: true,
    });

    for (let i = 0; i < buffers.vertexCount; i++) {
      const r = buffers.colors[i * 3];
      const g = buffers.colors[i * 3 + 1];
      const b = buffers.colors[i * 3 + 2];

      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
      expect(buffers.surfaceBlendA[i * 4 + 2]).toBeGreaterThan(0);
    }
  });

});
