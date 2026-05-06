import type { ChunkData } from '../world/chunk';
import type { ChunkCoordinate } from './chunk-streaming-system';
import {
  TRANSFORM_COMPONENT,
  type TransformComponent,
} from './components';
import type { ComponentKey, Entity, EntityId } from './entity';
import type { EngineRuntime } from './engine-runtime';
import type { RuntimeSystem, RuntimeUpdateContext } from './system';

export interface RendererAdapter {
  initialize?(runtime: EngineRuntime): void;
  addChunk?(chunk: ChunkData, coordinate: ChunkCoordinate): void;
  removeChunk?(coordinate: ChunkCoordinate): void;
  updateEntity?(entity: Entity, transform: TransformComponent, context: RuntimeUpdateContext): void;
  removeEntity?(entityId: EntityId): void;
  renderFrame?(context: RuntimeUpdateContext): void;
  dispose?(): void;
}

export interface RenderSyncSystemOptions {
  adapter: RendererAdapter;
  priority?: number;
  transformComponent?: ComponentKey<TransformComponent>;
}

const DEFAULT_RENDER_PRIORITY = 1000;

export class RenderSyncSystem implements RuntimeSystem {
  readonly name = 'RenderSyncSystem';
  readonly priority: number;

  private readonly adapter: RendererAdapter;
  private readonly transformComponent: ComponentKey<TransformComponent>;
  private readonly renderedEntityIds: Set<EntityId>;
  private readonly renderedChunkKeys: Set<string>;
  private readonly renderedChunkCoordinates: Map<string, ChunkCoordinate>;

  constructor(options: RenderSyncSystemOptions) {
    this.adapter = options.adapter;
    this.priority = options.priority ?? DEFAULT_RENDER_PRIORITY;
    this.transformComponent = options.transformComponent ?? TRANSFORM_COMPONENT;
    this.renderedEntityIds = new Set();
    this.renderedChunkKeys = new Set();
    this.renderedChunkCoordinates = new Map();
  }

  onAdd(runtime: EngineRuntime): void {
    this.adapter.initialize?.(runtime);
  }

  onRemove(): void {
    for (const entityId of this.renderedEntityIds) {
      this.adapter.removeEntity?.(entityId);
    }

    this.renderedEntityIds.clear();
    this.clearChunks();
    this.adapter.dispose?.();
  }

  update(context: RuntimeUpdateContext): void {
    const currentEntityIds = new Set<EntityId>();

    for (const entity of context.entities.query([this.transformComponent])) {
      const transform = entity.requireComponent<TransformComponent>(this.transformComponent);
      currentEntityIds.add(entity.id);
      this.renderedEntityIds.add(entity.id);
      this.adapter.updateEntity?.(entity, transform, context);
    }

    for (const entityId of [...this.renderedEntityIds]) {
      if (currentEntityIds.has(entityId)) {
        continue;
      }

      this.renderedEntityIds.delete(entityId);
      this.adapter.removeEntity?.(entityId);
    }

    this.adapter.renderFrame?.(context);
  }

  onChunkLoaded(chunk: ChunkData, coordinate: ChunkCoordinate): void {
    const key = this.getChunkKey(coordinate);
    if (this.renderedChunkKeys.has(key)) {
      return;
    }

    this.renderedChunkKeys.add(key);
    this.renderedChunkCoordinates.set(key, { ...coordinate });
    this.adapter.addChunk?.(chunk, coordinate);
  }

  onChunkRemoved(coordinate: ChunkCoordinate): void {
    const key = this.getChunkKey(coordinate);
    if (!this.renderedChunkKeys.delete(key)) {
      return;
    }

    const renderedCoordinate = this.renderedChunkCoordinates.get(key) ?? coordinate;
    this.renderedChunkCoordinates.delete(key);
    this.adapter.removeChunk?.(renderedCoordinate);
  }

  forgetChunk(coordinate: ChunkCoordinate): boolean {
    const key = this.getChunkKey(coordinate);
    const removed = this.renderedChunkKeys.delete(key);
    this.renderedChunkCoordinates.delete(key);
    return removed;
  }

  clearChunks(): void {
    for (const coordinate of this.renderedChunkCoordinates.values()) {
      this.adapter.removeChunk?.(coordinate);
    }

    this.renderedChunkKeys.clear();
    this.renderedChunkCoordinates.clear();
  }

  hasChunk(coordinate: ChunkCoordinate): boolean {
    return this.renderedChunkKeys.has(this.getChunkKey(coordinate));
  }

  getRenderedEntityIds(): readonly EntityId[] {
    return Array.from(this.renderedEntityIds);
  }

  private getChunkKey(coordinate: ChunkCoordinate): string {
    return `${coordinate.x},${coordinate.y}`;
  }
}
