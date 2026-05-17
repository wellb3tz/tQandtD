import type { ChunkData } from '@engine/index';
import {
  buildTerrainGeometryBuffers,
  type TerrainGeometryBuffers,
  type TerrainGeometryOptions,
} from './terrain-geometry-builder';
import GeometryWorkerUrl from './geometry-worker?worker&url';

export class GeometryWorkerManager {
  private worker: Worker | null = null;
  private initialized = false;
  private messageId = 0;
  private pending = new Map<number, {
    resolve: (value: TerrainGeometryBuffers) => void;
    reject: (reason: Error) => void;
  }>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(GeometryWorkerUrl, { type: 'module' });
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
      } catch {
        this.worker = null;
      }
    }
  }

  buildGeometry(data: ChunkData, options: TerrainGeometryOptions): Promise<TerrainGeometryBuffers> {
    if (!this.worker) {
      // Fallback to synchronous build on main thread
      return Promise.resolve(buildTerrainGeometryBuffers(data, options));
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });

      if (!this.initialized) {
        this.worker!.postMessage({ type: 'init', id });
        this.initialized = true;
      }

      this.worker!.postMessage({ type: 'buildGeometry', id, data, options });
    });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const { reject } of this.pending.values()) {
      reject(new Error('GeometryWorkerManager disposed'));
    }
    this.pending.clear();
  }

  private handleMessage = (event: MessageEvent) => {
    const { type, id, buffers, message: errorMessage } = event.data;

    // Init handshake response must not steal the pending build promise.
    if (type === 'ready') {
      return;
    }

    const pending = this.pending.get(id);
    if (!pending) return;

    this.pending.delete(id);

    if (type === 'geometryReady') {
      const result: TerrainGeometryBuffers = {
        positions: new Float32Array(buffers.positions),
        colors: new Float32Array(buffers.colors),
        uvs: new Float32Array(buffers.uvs),
        normals: new Float32Array(buffers.normals),
        indices: new Uint32Array(buffers.indices),
        surfaceBlendA: new Float32Array(buffers.surfaceBlendA),
        surfaceBlendB: new Float32Array(buffers.surfaceBlendB),
        surfaceBlendC: new Float32Array(buffers.surfaceBlendC),
        terrainDetailBlend: new Float32Array(buffers.terrainDetailBlend),
        chunkData: buffers.chunkData,
        chunkSize: buffers.chunkSize,
        verticesPerSide: buffers.verticesPerSide,
        vertexCount: buffers.vertexCount,
        worldXBase: buffers.worldXBase,
        worldZBase: buffers.worldZBase,
        expectedHeightmapSize: buffers.expectedHeightmapSize,
        originalHeightmapSize: buffers.originalHeightmapSize,
        heightmapSizeMismatch: buffers.heightmapSizeMismatch,
      };
      pending.resolve(result);
    } else if (type === 'error') {
      pending.reject(new Error(errorMessage ?? 'Geometry worker error'));
    }
  };

  private handleError = (event: ErrorEvent) => {
    // Reject all pending promises on catastrophic worker error
    for (const { reject } of this.pending.values()) {
      reject(new Error(event.message ?? 'Geometry worker failed'));
    }
    this.pending.clear();
    this.worker = null;
  };
}

let sharedManager: GeometryWorkerManager | null = null;

export function getGeometryWorkerManager(): GeometryWorkerManager {
  if (!sharedManager) {
    sharedManager = new GeometryWorkerManager();
  }
  return sharedManager;
}

export function disposeGeometryWorkerManager(): void {
  sharedManager?.dispose();
  sharedManager = null;
}
