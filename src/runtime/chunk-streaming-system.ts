import type { ChunkData } from '../world/chunk';
import type { ChunkManager } from '../world/chunk-manager';
import { generateSpiralCoordinates } from '../utils/chunk-priority';
import type { ComponentKey, Entity } from './entity';
import type { RuntimeSystem, RuntimeUpdateContext } from './system';
import {
  CAMERA_COMPONENT,
  CHUNK_STREAMING_TARGET_COMPONENT,
  TRANSFORM_COMPONENT,
  type CameraComponent,
  type ChunkStreamingTargetComponent,
  type TransformComponent,
} from './components';

export interface ChunkCoordinate {
  x: number;
  y: number;
}

export interface ChunkStreamingSystemOptions {
  priority?: number;
  defaultRadius?: number;
  maxLoadsPerUpdate?: number;
  transformComponent?: ComponentKey<TransformComponent>;
  cameraComponent?: ComponentKey<CameraComponent>;
  targetComponent?: ComponentKey<ChunkStreamingTargetComponent>;
  onChunkLoaded?: (chunk: ChunkData, coordinate: ChunkCoordinate, entity: Entity) => void;
  onChunkError?: (error: Error, coordinate: ChunkCoordinate, entity: Entity) => void;
}

interface StreamingTarget {
  entity: Entity;
  transform: TransformComponent;
  radius: number;
  chunkSize?: number;
}

const DEFAULT_RADIUS = 1;
const DEFAULT_MAX_LOADS_PER_UPDATE = 8;

export class ChunkStreamingSystem implements RuntimeSystem {
  readonly name = 'ChunkStreamingSystem';
  readonly priority: number;

  private readonly defaultRadius: number;
  private readonly maxLoadsPerUpdate: number;
  private readonly transformComponent: ComponentKey<TransformComponent>;
  private readonly cameraComponent: ComponentKey<CameraComponent>;
  private readonly targetComponent: ComponentKey<ChunkStreamingTargetComponent>;
  private readonly onChunkLoaded?: (chunk: ChunkData, coordinate: ChunkCoordinate, entity: Entity) => void;
  private readonly onChunkError?: (error: Error, coordinate: ChunkCoordinate, entity: Entity) => void;
  private readonly loadedChunks: Map<string, ChunkData>;
  private readonly pendingChunks: Set<string>;

  constructor(options: ChunkStreamingSystemOptions = {}) {
    this.priority = options.priority ?? -100;
    this.defaultRadius = options.defaultRadius ?? DEFAULT_RADIUS;
    this.maxLoadsPerUpdate = options.maxLoadsPerUpdate ?? DEFAULT_MAX_LOADS_PER_UPDATE;
    this.transformComponent = options.transformComponent ?? TRANSFORM_COMPONENT;
    this.cameraComponent = options.cameraComponent ?? CAMERA_COMPONENT;
    this.targetComponent = options.targetComponent ?? CHUNK_STREAMING_TARGET_COMPONENT;
    this.onChunkLoaded = options.onChunkLoaded;
    this.onChunkError = options.onChunkError;
    this.loadedChunks = new Map();
    this.pendingChunks = new Set();
  }

  update(context: RuntimeUpdateContext): void {
    if (!context.world) {
      return;
    }

    let loadBudget = this.maxLoadsPerUpdate;

    for (const target of this.getStreamingTargets(context)) {
      if (loadBudget <= 0) {
        return;
      }

      loadBudget = this.scheduleTargetChunks(context.world, target, loadBudget);
    }
  }

  getLoadedChunks(): readonly ChunkData[] {
    return Array.from(this.loadedChunks.values());
  }

  hasChunk(chunkX: number, chunkY: number): boolean {
    return this.loadedChunks.has(this.getChunkKey(chunkX, chunkY));
  }

  clear(): void {
    this.loadedChunks.clear();
    this.pendingChunks.clear();
  }

  private getStreamingTargets(context: RuntimeUpdateContext): StreamingTarget[] {
    const targets: StreamingTarget[] = [];
    const seen = new Set<string>();

    for (const entity of context.entities.query([this.transformComponent, this.targetComponent])) {
      const target = entity.requireComponent<ChunkStreamingTargetComponent>(this.targetComponent);
      if (!target.enabled) {
        continue;
      }

      targets.push({
        entity,
        transform: entity.requireComponent<TransformComponent>(this.transformComponent),
        radius: target.radius,
        chunkSize: target.chunkSize,
      });
      seen.add(entity.id);
    }

    for (const entity of context.entities.query([this.transformComponent, this.cameraComponent])) {
      if (seen.has(entity.id)) {
        continue;
      }

      const camera = entity.requireComponent<CameraComponent>(this.cameraComponent);
      if (!camera.active) {
        continue;
      }

      targets.push({
        entity,
        transform: entity.requireComponent<TransformComponent>(this.transformComponent),
        radius: camera.streamingRadius ?? this.defaultRadius,
      });
    }

    return targets;
  }

  private scheduleTargetChunks(world: ChunkManager, target: StreamingTarget, loadBudget: number): number {
    const chunkSize = target.chunkSize ?? world.config.chunkSize;
    const centerX = Math.floor(target.transform.position.x / chunkSize);
    const centerY = Math.floor(target.transform.position.z / chunkSize);

    for (const coord of generateSpiralCoordinates(centerX, centerY, target.radius)) {
      if (loadBudget <= 0) {
        return loadBudget;
      }

      if (this.scheduleChunk(world, coord.x, coord.y, target.entity)) {
        loadBudget -= 1;
      }
    }

    return loadBudget;
  }

  private scheduleChunk(world: ChunkManager, chunkX: number, chunkY: number, entity: Entity): boolean {
    const key = this.getChunkKey(chunkX, chunkY);

    if (this.loadedChunks.has(key) || this.pendingChunks.has(key)) {
      return false;
    }

    this.pendingChunks.add(key);

    world.getChunk(chunkX, chunkY)
      .then(chunk => {
        this.pendingChunks.delete(key);
        this.loadedChunks.set(key, chunk);
        this.onChunkLoaded?.(chunk, { x: chunkX, y: chunkY }, entity);
      })
      .catch(error => {
        this.pendingChunks.delete(key);
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.onChunkError?.(normalizedError, { x: chunkX, y: chunkY }, entity);
      });

    return true;
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }
}
