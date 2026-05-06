import { describe, expect, it } from 'vitest';
import {
  CAMERA_COMPONENT,
  CHUNK_STREAMING_TARGET_COMPONENT,
  ChunkStreamingSystem,
  EngineRuntime,
  EngineRuntimeState,
  Entity,
  INPUT_ACTION_FORWARD,
  INPUT_ACTION_RIGHT,
  INPUT_ACTION_SPRINT,
  InputSystem,
  MOVEMENT_COMPONENT,
  MovementSystem,
  RenderSyncSystem,
  TRANSFORM_COMPONENT,
  WorldScene,
  createCameraComponent,
  createChunkStreamingTargetComponent,
  createMovementComponent,
  createTransformComponent,
  type RuntimeSystem,
  type RendererAdapter,
} from '../src';
import type { ChunkData } from '../src/world/chunk';
import type { ChunkManager } from '../src/world/chunk-manager';

function makeChunk(x: number, y: number): ChunkData {
  return {
    x,
    y,
    size: 1,
    heightmap: new Float32Array(4),
    biomeMap: new Uint8Array(1),
    sparseBiomeTypes: new Uint8Array([0]),
    sparseBiomeWeights: new Float32Array([1]),
    sparseBiomeOffsets: new Uint16Array([0, 1]),
    lakes: [],
    rivers: [],
    resources: [],
    structures: [],
  };
}

function makeFakeWorld(chunkSize = 32): ChunkManager & { requests: Array<[number, number]> } {
  const requests: Array<[number, number]> = [];

  return {
    config: { chunkSize },
    requests,
    getChunk: async (x: number, y: number) => {
      requests.push([x, y]);
      return makeChunk(x, y);
    },
  } as unknown as ChunkManager & { requests: Array<[number, number]> };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

class FakeInputTarget {
  private readonly listeners = new Map<string, Array<(event: KeyboardEvent) => void>>();

  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener));
  }

  dispatch(type: 'keydown' | 'keyup', code: string, key = code): { prevented: boolean } {
    const event = {
      code,
      key,
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as unknown as KeyboardEvent);
    }

    return event;
  }
}

class FakeRenderer implements RendererAdapter {
  events: string[] = [];

  initialize(): void {
    this.events.push('initialize');
  }

  addChunk(_chunk: ChunkData, coordinate: { x: number; y: number }): void {
    this.events.push(`chunk:${coordinate.x},${coordinate.y}`);
  }

  removeChunk(coordinate: { x: number; y: number }): void {
    this.events.push(`remove-chunk:${coordinate.x},${coordinate.y}`);
  }

  updateEntity(entity: Entity): void {
    this.events.push(`entity:${entity.id}`);
  }

  removeEntity(entityId: string): void {
    this.events.push(`remove:${entityId}`);
  }

  renderFrame(): void {
    this.events.push('frame');
  }

  dispose(): void {
    this.events.push('dispose');
  }
}

describe('EngineRuntime', () => {
  it('updates systems in priority order with frame context', () => {
    const runtime = new EngineRuntime();
    const calls: string[] = [];

    runtime.addSystem({
      name: 'late',
      priority: 10,
      update: context => calls.push(`late:${context.frame}:${context.deltaTime}`),
    });

    runtime.addSystem({
      name: 'early',
      priority: -10,
      update: context => calls.push(`early:${context.frame}:${context.elapsedTime}`),
    });

    runtime.tick(0.016);

    expect(calls).toEqual(['early:1:0.016', 'late:1:0.016']);
    expect(runtime.getFrame()).toBe(1);
    expect(runtime.getElapsedTime()).toBe(0.016);
  });

  it('stores entities and queries them by component', () => {
    const runtime = new EngineRuntime();

    runtime.entities
      .createEntity('player')
      .addComponent('transform', { x: 1, y: 2, z: 3 })
      .addComponent('controller', { speed: 5 });

    runtime.entities
      .createEntity('tree')
      .addComponent('transform', { x: 4, y: 0, z: 8 });

    expect(runtime.entities.query(['transform']).map(entity => entity.id)).toEqual(['player', 'tree']);
    expect(runtime.entities.query(['transform', 'controller']).map(entity => entity.id)).toEqual(['player']);
    expect(runtime.entities.getEntity('player')?.requireComponent<{ speed: number }>('controller').speed).toBe(5);
  });

  it('accepts externally created entities', () => {
    const runtime = new EngineRuntime();
    const entity = new Entity('campfire').addComponent('light', { intensity: 2 });

    runtime.entities.addEntity(entity);

    expect(runtime.entities.getEntity('campfire')?.getComponent('light')).toEqual({ intensity: 2 });
  });

  it('invokes system lifecycle hooks', () => {
    const runtime = new EngineRuntime();
    const events: string[] = [];
    const system: RuntimeSystem = {
      onAdd: () => events.push('add'),
      onRemove: () => events.push('remove'),
      update: () => events.push('update'),
    };

    runtime.addSystem(system);
    runtime.tick(0.1);
    expect(runtime.removeSystem(system)).toBe(true);

    expect(events).toEqual(['add', 'update', 'remove']);
  });

  it('disposes systems and entities', () => {
    const runtime = new EngineRuntime();
    const events: string[] = [];

    runtime.entities.createEntity('temporary');
    runtime.addSystem({
      onRemove: () => events.push('remove'),
      update: () => undefined,
    });

    runtime.dispose();

    expect(runtime.getState()).toBe(EngineRuntimeState.DISPOSED);
    expect(runtime.entities.size).toBe(0);
    expect(runtime.getSystems()).toEqual([]);
    expect(events).toEqual(['remove']);
    expect(() => runtime.tick(0.1)).toThrow('EngineRuntime has been disposed');
  });

  it('clamps manual ticks to the configured maximum delta', () => {
    const runtime = new EngineRuntime({ maxDeltaTime: 0.05 });
    const deltas: number[] = [];

    runtime.addSystem({
      update: context => deltas.push(context.deltaTime),
    });

    runtime.tick(10);

    expect(deltas).toEqual([0.05]);
  });

  it('creates default runtime components', () => {
    expect(createTransformComponent()).toEqual({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });

    expect(createCameraComponent({ streamingRadius: 2 })).toMatchObject({
      active: true,
      fov: 60,
      near: 0.1,
      far: 1000,
      streamingRadius: 2,
    });

    expect(createChunkStreamingTargetComponent()).toEqual({
      enabled: true,
      radius: 1,
      chunkSize: undefined,
    });

    expect(createMovementComponent({ speed: 12 })).toEqual({
      enabled: true,
      speed: 12,
      sprintMultiplier: 2,
      velocity: { x: 0, y: 0, z: 0 },
    });
  });

  it('maps keyboard events into runtime input state', () => {
    const target = new FakeInputTarget();
    const runtime = new EngineRuntime();
    const inputSystem = new InputSystem({ target });

    runtime.addSystem(inputSystem);

    const keyDown = target.dispatch('keydown', 'KeyW', 'w');
    expect(keyDown.prevented).toBe(true);
    expect(runtime.input.isActionActive(INPUT_ACTION_FORWARD)).toBe(true);

    target.dispatch('keyup', 'KeyW', 'w');
    expect(runtime.input.isActionActive(INPUT_ACTION_FORWARD)).toBe(false);

    runtime.removeSystem(inputSystem);
    target.dispatch('keydown', 'KeyW', 'w');
    expect(runtime.input.isActionActive(INPUT_ACTION_FORWARD)).toBe(false);
  });

  it('moves entities from input actions', () => {
    const runtime = new EngineRuntime({ maxDeltaTime: 1 });
    const entity = runtime.entities
      .createEntity('player')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent())
      .addComponent(MOVEMENT_COMPONENT, createMovementComponent({ speed: 8 }));

    runtime.input.setAction(INPUT_ACTION_FORWARD, true);
    runtime.addSystem(new MovementSystem());

    runtime.tick(0.5);

    expect(entity.requireComponent(TRANSFORM_COMPONENT).position).toEqual({ x: 0, y: 0, z: -4 });
    expect(entity.requireComponent(MOVEMENT_COMPONENT).velocity).toEqual({ x: 0, y: 0, z: -8 });
  });

  it('applies sprint and normalizes diagonal movement', () => {
    const runtime = new EngineRuntime({ maxDeltaTime: 1 });
    const entity = runtime.entities
      .createEntity('player')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent())
      .addComponent(MOVEMENT_COMPONENT, createMovementComponent({ speed: 10, sprintMultiplier: 2 }));

    runtime.input.setAction(INPUT_ACTION_FORWARD, true);
    runtime.input.setAction(INPUT_ACTION_RIGHT, true);
    runtime.input.setAction(INPUT_ACTION_SPRINT, true);
    runtime.addSystem(new MovementSystem());

    runtime.tick(1);

    const position = entity.requireComponent(TRANSFORM_COMPONENT).position;
    expect(position.x).toBeCloseTo(14.142, 3);
    expect(position.z).toBeCloseTo(-14.142, 3);
  });

  it('does not move disabled movement components', () => {
    const runtime = new EngineRuntime({ maxDeltaTime: 1 });
    const entity = runtime.entities
      .createEntity('player')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent())
      .addComponent(MOVEMENT_COMPONENT, createMovementComponent({
        enabled: false,
        velocity: { x: 1, y: 1, z: 1 },
      }));

    runtime.input.setAction(INPUT_ACTION_FORWARD, true);
    runtime.addSystem(new MovementSystem());

    runtime.tick(1);

    expect(entity.requireComponent(TRANSFORM_COMPONENT).position).toEqual({ x: 0, y: 0, z: 0 });
    expect(entity.requireComponent(MOVEMENT_COMPONENT).velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('streams chunks around an active camera entity', async () => {
    const world = makeFakeWorld(32);
    const runtime = new EngineRuntime({ world });
    const loaded: Array<[number, number, string]> = [];

    runtime.entities
      .createEntity('camera')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent({ position: { x: 33, y: 5, z: 65 } }))
      .addComponent(CAMERA_COMPONENT, createCameraComponent({ streamingRadius: 1 }));

    runtime.addSystem(new ChunkStreamingSystem({
      maxLoadsPerUpdate: 32,
      onChunkLoaded: (_chunk, coordinate, entity) => loaded.push([coordinate.x, coordinate.y, entity.id]),
    }));

    runtime.tick(0.016);
    await flushPromises();

    expect(world.requests).toEqual([
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
      [0, 3], [1, 3], [2, 3],
    ]);
    expect(loaded).toHaveLength(9);
    expect(loaded[0]).toEqual([0, 1, 'camera']);
  });

  it('does not request the same streamed chunk twice', async () => {
    const world = makeFakeWorld(16);
    const runtime = new EngineRuntime({ world });
    const streamingSystem = new ChunkStreamingSystem({ maxLoadsPerUpdate: 8 });

    runtime.entities
      .createEntity('camera')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent({ position: { x: 4, y: 0, z: 4 } }))
      .addComponent(CAMERA_COMPONENT, createCameraComponent({ streamingRadius: 0 }));

    runtime.addSystem(streamingSystem);

    runtime.tick(0.016);
    await flushPromises();
    runtime.tick(0.016);
    await flushPromises();

    expect(world.requests).toEqual([[0, 0]]);
    expect(streamingSystem.hasChunk(0, 0)).toBe(true);
    expect(streamingSystem.getLoadedChunks()).toHaveLength(1);
  });

  it('streams from explicit target components before active cameras', async () => {
    const world = makeFakeWorld(32);
    const runtime = new EngineRuntime({ world });

    runtime.entities
      .createEntity('player')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent({ position: { x: -1, y: 0, z: 33 } }))
      .addComponent(CHUNK_STREAMING_TARGET_COMPONENT, createChunkStreamingTargetComponent({ radius: 0 }));

    runtime.entities
      .createEntity('camera')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent({ position: { x: 96, y: 0, z: 96 } }))
      .addComponent(CAMERA_COMPONENT, createCameraComponent({ streamingRadius: 0 }));

    runtime.addSystem(new ChunkStreamingSystem({ maxLoadsPerUpdate: 1 }));

    runtime.tick(0.016);
    await flushPromises();
    runtime.tick(0.016);
    await flushPromises();

    expect(world.requests).toEqual([[-1, 1], [3, 3]]);
  });

  it('syncs transform entities into a renderer adapter', () => {
    const renderer = new FakeRenderer();
    const runtime = new EngineRuntime();
    const entity = runtime.entities
      .createEntity('player')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent());

    const renderSystem = new RenderSyncSystem({ adapter: renderer });
    runtime.addSystem(renderSystem);
    runtime.tick(0.016);

    runtime.entities.removeEntity(entity.id);
    runtime.tick(0.016);
    runtime.dispose();

    expect(renderer.events).toEqual([
      'initialize',
      'entity:player',
      'frame',
      'remove:player',
      'frame',
      'dispose',
    ]);
  });

  it('forwards streamed chunks from WorldScene into the renderer adapter', async () => {
    const renderer = new FakeRenderer();
    const scene = new WorldScene({
      world: makeFakeWorld(16),
      renderer,
      player: {
        position: { x: 0, y: 0, z: 0 },
        streamingTarget: { radius: 0 },
        movement: false,
      },
      streaming: { maxLoadsPerUpdate: 8 },
    });

    scene.tick(0.016);
    await flushPromises();
    scene.tick(0.016);

    expect(renderer.events).toContain('initialize');
    expect(renderer.events).toContain('chunk:0,0');
    expect(renderer.events).toContain('entity:player');
    expect(scene.renderSystem?.hasChunk({ x: 0, y: 0 })).toBe(true);
  });

  it('creates a default world scene with player and standard systems', () => {
    const world = makeFakeWorld(32);
    const scene = new WorldScene({
      world,
      player: {
        id: 'hero',
        position: { x: 10, y: 2, z: 20 },
        movement: { speed: 14 },
        streamingTarget: { radius: 2 },
      },
    });

    expect(scene.world).toBe(world);
    expect(scene.runtime.world).toBe(world);
    expect(scene.player?.id).toBe('hero');
    expect(scene.player?.requireComponent(TRANSFORM_COMPONENT).position).toEqual({ x: 10, y: 2, z: 20 });
    expect(scene.player?.requireComponent(MOVEMENT_COMPONENT).speed).toBe(14);
    expect(scene.player?.requireComponent(CHUNK_STREAMING_TARGET_COMPONENT).radius).toBe(2);
    expect(scene.inputSystem).toBeInstanceOf(InputSystem);
    expect(scene.movementSystem).toBeInstanceOf(MovementSystem);
    expect(scene.streamingSystem).toBeInstanceOf(ChunkStreamingSystem);
    expect(scene.renderSystem).toBeNull();
    expect(scene.runtime.getSystems().map(system => system.name)).toEqual([
      'InputSystem',
      'MovementSystem',
      'ChunkStreamingSystem',
    ]);
  });

  it('can create a world scene without optional player and standard systems', () => {
    const scene = new WorldScene({
      world: makeFakeWorld(32),
      player: false,
      input: false,
      movement: false,
      streaming: false,
      renderer: false,
    });

    expect(scene.player).toBeNull();
    expect(scene.inputSystem).toBeNull();
    expect(scene.movementSystem).toBeNull();
    expect(scene.streamingSystem).toBeNull();
    expect(scene.renderSystem).toBeNull();
    expect(scene.runtime.entities.size).toBe(0);
    expect(scene.runtime.getSystems()).toEqual([]);
  });

  it('runs movement and chunk streaming through the world scene tick', async () => {
    const world = makeFakeWorld(16);
    const scene = new WorldScene({
      world,
      runtime: { maxDeltaTime: 1 },
      player: {
        position: { x: 0, y: 0, z: 0 },
        movement: { speed: 16 },
        streamingTarget: { radius: 0 },
      },
      streaming: { maxLoadsPerUpdate: 8 },
    });

    scene.runtime.input.setAction(INPUT_ACTION_FORWARD, true);
    scene.tick(1);
    await flushPromises();

    expect(scene.player?.requireComponent(TRANSFORM_COMPONENT).position).toEqual({ x: 0, y: 0, z: -16 });
    expect(world.requests).toEqual([[0, -1]]);
    expect(scene.streamingSystem?.hasChunk(0, -1)).toBe(true);
  });

  it('can switch the world used by a world scene', async () => {
    const firstWorld = makeFakeWorld(16);
    const secondWorld = makeFakeWorld(16);
    const renderer = new FakeRenderer();
    const scene = new WorldScene({
      world: firstWorld,
      renderer,
      player: {
        position: { x: 0, y: 0, z: 0 },
        movement: false,
        streamingTarget: { radius: 0 },
      },
      streaming: { maxLoadsPerUpdate: 8 },
    });

    scene.tick(0.016);
    await flushPromises();
    expect(scene.streamingSystem?.hasChunk(0, 0)).toBe(true);
    expect(scene.renderSystem?.hasChunk({ x: 0, y: 0 })).toBe(true);

    scene.setWorld(secondWorld);
    expect(scene.world).toBe(secondWorld);
    expect(scene.runtime.world).toBe(secondWorld);
    expect(scene.streamingSystem?.hasChunk(0, 0)).toBe(false);
    expect(scene.renderSystem?.hasChunk({ x: 0, y: 0 })).toBe(false);
    expect(renderer.events).toContain('remove-chunk:0,0');

    scene.tick(0.016);
    await flushPromises();
    expect(secondWorld.requests).toEqual([[0, 0]]);
    expect(renderer.events.filter(event => event === 'chunk:0,0')).toHaveLength(2);
  });

  it('requires world or worldConfig', () => {
    expect(() => new WorldScene({})).toThrow('WorldScene requires either world or worldConfig');
  });
});
