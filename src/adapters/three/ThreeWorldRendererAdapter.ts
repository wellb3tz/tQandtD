import {
  CAMERA_COMPONENT,
  type CameraComponent,
  type ChunkCoordinate,
  type Entity,
  type RendererAdapter,
  type RuntimeUpdateContext,
  type TransformComponent,
  type Vector3,
} from '../../runtime';
import type { ChunkData } from '../../world/chunk';

export interface ThreeWorldRendererTarget {
  addChunk(chunkX: number, chunkY: number, chunk: ChunkData, partial?: boolean, stage?: number): void;
  updateChunk(chunkX: number, chunkY: number, chunk: ChunkData): void;
  removeChunk(chunkX: number, chunkY: number, keepFogOfWar?: boolean): void;
  setCameraPosition(position: Vector3): void;
  dispose?(): void;
}

export interface ThreeWorldRendererAdapterOptions {
  target: ThreeWorldRendererTarget;
  syncActiveCamera?: boolean;
  disposeTarget?: boolean;
}

export interface ThreeWorldChunkRenderOptions {
  partial?: boolean;
  stage?: number;
}

export interface ThreeWorldChunkRemoveOptions {
  keepFogOfWar?: boolean;
}

/**
 * Adapts the runtime renderer boundary to a Three.js-backed world renderer.
 */
export class ThreeWorldRendererAdapter implements RendererAdapter {
  private readonly target: ThreeWorldRendererTarget;
  private readonly syncActiveCamera: boolean;
  private readonly disposeTarget: boolean;

  constructor(options: ThreeWorldRendererAdapterOptions) {
    this.target = options.target;
    this.syncActiveCamera = options.syncActiveCamera ?? true;
    this.disposeTarget = options.disposeTarget ?? false;
  }

  addChunk(chunk: ChunkData, coordinate: ChunkCoordinate, options: ThreeWorldChunkRenderOptions = {}): void {
    this.target.addChunk(coordinate.x, coordinate.y, chunk, options.partial, options.stage);
  }

  updateChunk(chunk: ChunkData, coordinate: ChunkCoordinate): void {
    this.target.updateChunk(coordinate.x, coordinate.y, chunk);
  }

  removeChunk(coordinate: ChunkCoordinate, options: ThreeWorldChunkRemoveOptions = {}): void {
    this.target.removeChunk(coordinate.x, coordinate.y, options.keepFogOfWar);
  }

  updateEntity(entity: Entity, transform: TransformComponent, _context: RuntimeUpdateContext): void {
    if (!this.syncActiveCamera || !entity.hasComponent(CAMERA_COMPONENT)) {
      return;
    }

    const camera = entity.getComponent<CameraComponent>(CAMERA_COMPONENT);
    if (camera?.active === false) {
      return;
    }

    this.target.setCameraPosition(transform.position);
  }

  dispose(): void {
    if (this.disposeTarget) {
      this.target.dispose?.();
    }
  }
}
