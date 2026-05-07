import { ChunkManager, type WorldConfig } from '../world/chunk-manager';
import { ChunkStreamingSystem, type ChunkStreamingSystemOptions } from './chunk-streaming-system';
import {
  CAMERA_COMPONENT,
  CHUNK_STREAMING_TARGET_COMPONENT,
  MOVEMENT_COMPONENT,
  TRANSFORM_COMPONENT,
  createCameraComponent,
  createChunkStreamingTargetComponent,
  createMovementComponent,
  createTransformComponent,
  type CameraComponent,
  type ChunkStreamingTargetComponent,
  type MovementComponent,
  type TransformComponent,
  type Vector3,
} from './components';
import { type Entity } from './entity';
import { EngineRuntime, type EngineRuntimeOptions } from './engine-runtime';
import { InputSystem, type InputEventTarget, type InputSystemOptions } from './input';
import { MovementSystem, type MovementSystemOptions } from './movement-system';
import { RenderSyncSystem, type RendererAdapter, type RenderSyncSystemOptions } from './renderer';
import type { RuntimeSystem } from './system';

export interface WorldScenePlayerOptions {
  id?: string;
  transform?: Partial<TransformComponent>;
  position?: Vector3;
  camera?: Partial<CameraComponent> | false;
  movement?: Partial<MovementComponent> | false;
  streamingTarget?: Partial<ChunkStreamingTargetComponent> | false;
}

export interface WorldSceneOptions {
  world?: ChunkManager;
  worldConfig?: WorldConfig;
  runtime?: EngineRuntimeOptions;
  inputTarget?: InputEventTarget | null;
  input?: Omit<InputSystemOptions, 'target' | 'input'> | false;
  movement?: MovementSystemOptions | false;
  streaming?: ChunkStreamingSystemOptions | false;
  renderer?: RendererAdapter | RenderSyncSystemOptions | false;
  player?: WorldScenePlayerOptions | false;
  systems?: RuntimeSystem[];
}

export class WorldScene {
  readonly runtime: EngineRuntime;
  world: ChunkManager;
  readonly player: Entity | null;
  readonly inputSystem: InputSystem | null;
  readonly movementSystem: MovementSystem | null;
  readonly streamingSystem: ChunkStreamingSystem | null;
  renderSystem: RenderSyncSystem | null;

  constructor(options: WorldSceneOptions) {
    this.world = options.world ?? this.createWorld(options.worldConfig);
    this.runtime = new EngineRuntime({
      ...options.runtime,
      world: this.world,
    });

    this.player = options.player === false ? null : this.createPlayer(options.player ?? {});

    this.inputSystem = options.input === false
      ? null
      : new InputSystem({
          ...options.input,
          target: options.inputTarget ?? null,
          input: this.runtime.input,
        });

    this.movementSystem = options.movement === false
      ? null
      : new MovementSystem(options.movement);

    this.renderSystem = options.renderer === false || options.renderer === undefined
      ? null
      : new RenderSyncSystem(this.normalizeRenderOptions(options.renderer));

    this.streamingSystem = options.streaming === false
      ? null
      : new ChunkStreamingSystem({
          ...options.streaming,
          onChunkLoaded: (chunk, coordinate, entity) => {
            this.renderSystem?.onChunkLoaded(chunk, coordinate);
            options.streaming && options.streaming.onChunkLoaded?.(chunk, coordinate, entity);
          },
        });

    this.installStandardSystems();

    for (const system of options.systems ?? []) {
      this.runtime.addSystem(system);
    }
  }

  start(): void {
    this.runtime.start();
  }

  stop(): void {
    this.runtime.stop();
  }

  tick(deltaTime: number): void {
    this.runtime.tick(deltaTime);
  }

  setWorld(world: ChunkManager): void {
    this.world = world;
    this.runtime.world = world;
    this.streamingSystem?.clear();
    this.renderSystem?.clearChunks();
  }

  setRenderer(renderer: RendererAdapter | RenderSyncSystemOptions): RenderSyncSystem {
    this.clearRenderer();
    this.renderSystem = new RenderSyncSystem(this.normalizeRenderOptions(renderer));
    this.runtime.addSystem(this.renderSystem);
    return this.renderSystem;
  }

  clearRenderer(): void {
    if (!this.renderSystem) {
      return;
    }

    this.runtime.removeSystem(this.renderSystem);
    this.renderSystem = null;
  }

  dispose(): void {
    this.runtime.dispose();
  }

  private createWorld(config?: WorldConfig): ChunkManager {
    if (!config) {
      throw new Error('WorldScene requires either world or worldConfig');
    }

    return new ChunkManager(config);
  }

  private createPlayer(options: WorldScenePlayerOptions): Entity {
    const transform = createTransformComponent({
      ...options.transform,
      position: options.position ?? options.transform?.position,
    });

    const player = this.runtime.entities
      .createEntity(options.id ?? 'player')
      .addComponent(TRANSFORM_COMPONENT, transform);

    if (options.camera !== false) {
      player.addComponent(CAMERA_COMPONENT, createCameraComponent(options.camera));
    }

    if (options.movement !== false) {
      player.addComponent(MOVEMENT_COMPONENT, createMovementComponent(options.movement));
    }

    if (options.streamingTarget !== false) {
      player.addComponent(
        CHUNK_STREAMING_TARGET_COMPONENT,
        createChunkStreamingTargetComponent(options.streamingTarget)
      );
    }

    return player;
  }

  private installStandardSystems(): void {
    if (this.inputSystem) {
      this.runtime.addSystem(this.inputSystem);
    }

    if (this.movementSystem) {
      this.runtime.addSystem(this.movementSystem);
    }

    if (this.streamingSystem) {
      this.runtime.addSystem(this.streamingSystem);
    }

    if (this.renderSystem) {
      this.runtime.addSystem(this.renderSystem);
    }
  }

  private normalizeRenderOptions(renderer: RendererAdapter | RenderSyncSystemOptions): RenderSyncSystemOptions {
    if ('adapter' in renderer) {
      return renderer;
    }

    return { adapter: renderer };
  }
}
