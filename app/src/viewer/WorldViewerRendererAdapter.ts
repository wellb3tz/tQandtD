import {
  CAMERA_COMPONENT,
  type CameraComponent,
  type ChunkCoordinate,
  type ChunkData,
  type Entity,
  type RendererAdapter,
  type RuntimeUpdateContext,
  type TransformComponent,
} from '../../../src';
import type { WorldViewer } from './WorldViewer';

export interface WorldViewerRendererAdapterOptions {
  viewer: WorldViewer;
  syncActiveCamera?: boolean;
  disposeViewer?: boolean;
}

export interface WorldViewerChunkRenderOptions {
  partial?: boolean;
  stage?: number;
}

export interface WorldViewerChunkRemoveOptions {
  keepFogOfWar?: boolean;
}

/**
 * Bridges the engine runtime renderer boundary to the existing Three.js WorldViewer.
 */
export class WorldViewerRendererAdapter implements RendererAdapter {
  private readonly viewer: WorldViewer;
  private readonly syncActiveCamera: boolean;
  private readonly disposeViewer: boolean;

  constructor(options: WorldViewerRendererAdapterOptions) {
    this.viewer = options.viewer;
    this.syncActiveCamera = options.syncActiveCamera ?? true;
    this.disposeViewer = options.disposeViewer ?? false;
  }

  addChunk(chunk: ChunkData, coordinate: ChunkCoordinate, options: WorldViewerChunkRenderOptions = {}): void {
    this.viewer.addChunk(coordinate.x, coordinate.y, chunk, options.partial, options.stage);
  }

  updateChunk(chunk: ChunkData, coordinate: ChunkCoordinate): void {
    this.viewer.updateChunk(coordinate.x, coordinate.y, chunk);
  }

  removeChunk(coordinate: ChunkCoordinate, options: WorldViewerChunkRemoveOptions = {}): void {
    this.viewer.removeChunk(coordinate.x, coordinate.y, options.keepFogOfWar);
  }

  updateEntity(entity: Entity, transform: TransformComponent, _context: RuntimeUpdateContext): void {
    if (!this.syncActiveCamera || !entity.hasComponent(CAMERA_COMPONENT)) {
      return;
    }

    const camera = entity.getComponent<CameraComponent>(CAMERA_COMPONENT);
    if (camera?.active === false) {
      return;
    }

    this.viewer.setCameraPosition(transform.position);
  }

  dispose(): void {
    if (this.disposeViewer) {
      this.viewer.dispose();
    }
  }
}
