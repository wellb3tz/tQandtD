import { buildTerrainGeometryBuffers, type TerrainGeometryOptions } from './terrain-geometry-builder';
import type { ChunkData } from '@engine/index';

type WorkerRequest =
  | { type: 'init'; id: number }
  | { type: 'buildGeometry'; id: number; data: ChunkData; options: TerrainGeometryOptions };

type WorkerResponse =
  | { type: 'ready'; id: number }
  | { type: 'geometryReady'; id: number; buffers: TransferableGeometryBuffers }
  | { type: 'error'; id: number; message: string };

interface TransferableGeometryBuffers {
  positions: ArrayBufferLike;
  colors: ArrayBufferLike;
  uvs: ArrayBufferLike;
  normals: ArrayBufferLike;
  indices: ArrayBufferLike;
  surfaceBlendA: ArrayBufferLike;
  surfaceBlendB: ArrayBufferLike;
  surfaceBlendC: ArrayBufferLike;
  terrainDetailBlend: ArrayBufferLike;
  chunkData: ChunkData;
  chunkSize: number;
  verticesPerSide: number;
  vertexCount: number;
  worldXBase: number;
  worldZBase: number;
  expectedHeightmapSize: number;
  originalHeightmapSize: number;
  heightmapSizeMismatch: boolean;
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  try {
    const message = event.data;
    switch (message.type) {
      case 'init': {
        const response: WorkerResponse = { type: 'ready', id: message.id };
        self.postMessage(response);
        break;
      }
      case 'buildGeometry': {
        const result = buildTerrainGeometryBuffers(message.data, message.options);
        const response: WorkerResponse = {
          type: 'geometryReady',
          id: message.id,
          buffers: {
            positions: result.positions.buffer,
            colors: result.colors.buffer,
            uvs: result.uvs.buffer,
            normals: result.normals.buffer,
            indices: result.indices.buffer,
            surfaceBlendA: result.surfaceBlendA.buffer,
            surfaceBlendB: result.surfaceBlendB.buffer,
            surfaceBlendC: result.surfaceBlendC.buffer,
            terrainDetailBlend: result.terrainDetailBlend.buffer,
            chunkData: result.chunkData,
            chunkSize: result.chunkSize,
            verticesPerSide: result.verticesPerSide,
            vertexCount: result.vertexCount,
            worldXBase: result.worldXBase,
            worldZBase: result.worldZBase,
            expectedHeightmapSize: result.expectedHeightmapSize,
            originalHeightmapSize: result.originalHeightmapSize,
            heightmapSizeMismatch: result.heightmapSizeMismatch,
          },
        };
        const transfer: Transferable[] = [
          result.positions.buffer,
          result.colors.buffer,
          result.uvs.buffer,
          result.normals.buffer,
          result.indices.buffer,
          result.surfaceBlendA.buffer,
          result.surfaceBlendB.buffer,
          result.surfaceBlendC.buffer,
          result.terrainDetailBlend.buffer,
        ];
        (self as any).postMessage(response, transfer);
        break;
      }
      default: {
        throw new Error(`Unknown message type: ${(message as any).type}`);
      }
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      id: (event.data as any).id ?? -1,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
});
