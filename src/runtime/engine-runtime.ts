import type { ChunkManager } from '../world/chunk-manager';
import { EntityManager } from './entity';
import { InputState } from './input';
import type { RuntimeSystem, RuntimeUpdateContext } from './system';

export interface RuntimeClock {
  now(): number;
  schedule(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface EngineRuntimeOptions {
  world?: ChunkManager | null;
  clock?: RuntimeClock;
  input?: InputState;
  maxDeltaTime?: number;
}

export enum EngineRuntimeState {
  CREATED = 'created',
  RUNNING = 'running',
  STOPPED = 'stopped',
  DISPOSED = 'disposed',
}

const DEFAULT_MAX_DELTA_TIME = 0.25;

function createDefaultClock(): RuntimeClock {
  return {
    now: () => performance.now(),
    schedule: callback => requestAnimationFrame(callback),
    cancel: handle => cancelAnimationFrame(handle),
  };
}

/**
 * Small engine runtime shell: owns entities, systems, world access and update loop.
 */
export class EngineRuntime {
  readonly entities: EntityManager;
  input: InputState;
  world: ChunkManager | null;

  private readonly systems: RuntimeSystem[];
  private readonly clock: RuntimeClock;
  private readonly maxDeltaTime: number;
  private state: EngineRuntimeState;
  private frameHandle: number | null;
  private lastTime: number | null;
  private elapsedTime: number;
  private frame: number;

  constructor(options: EngineRuntimeOptions = {}) {
    this.entities = new EntityManager();
    this.input = options.input ?? new InputState();
    this.systems = [];
    this.world = options.world ?? null;
    this.clock = options.clock ?? createDefaultClock();
    this.maxDeltaTime = options.maxDeltaTime ?? DEFAULT_MAX_DELTA_TIME;
    this.state = EngineRuntimeState.CREATED;
    this.frameHandle = null;
    this.lastTime = null;
    this.elapsedTime = 0;
    this.frame = 0;
  }

  getState(): EngineRuntimeState {
    return this.state;
  }

  getFrame(): number {
    return this.frame;
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  addSystem(system: RuntimeSystem): this {
    this.assertNotDisposed();
    this.systems.push(system);
    this.systems.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    system.onAdd?.(this);
    return this;
  }

  removeSystem(system: RuntimeSystem): boolean {
    const index = this.systems.indexOf(system);
    if (index === -1) {
      return false;
    }

    this.systems.splice(index, 1);
    system.onRemove?.(this);
    return true;
  }

  getSystems(): readonly RuntimeSystem[] {
    return this.systems;
  }

  start(): void {
    this.assertNotDisposed();

    if (this.state === EngineRuntimeState.RUNNING) {
      return;
    }

    this.state = EngineRuntimeState.RUNNING;
    this.lastTime = this.clock.now();
    this.frameHandle = this.clock.schedule(this.runFrame);
  }

  stop(): void {
    if (this.frameHandle !== null) {
      this.clock.cancel(this.frameHandle);
      this.frameHandle = null;
    }

    if (this.state !== EngineRuntimeState.DISPOSED) {
      this.state = EngineRuntimeState.STOPPED;
    }
  }

  tick(deltaTime: number): void {
    this.assertNotDisposed();
    this.update(Math.min(Math.max(deltaTime, 0), this.maxDeltaTime));
  }

  dispose(): void {
    this.stop();

    for (const system of [...this.systems]) {
      system.onRemove?.(this);
    }

    this.systems.length = 0;
    this.entities.clear();
    this.world = null;
    this.state = EngineRuntimeState.DISPOSED;
  }

  private readonly runFrame = (time: number): void => {
    if (this.state !== EngineRuntimeState.RUNNING) {
      return;
    }

    const previousTime = this.lastTime ?? time;
    this.lastTime = time;
    this.update(Math.min(Math.max((time - previousTime) / 1000, 0), this.maxDeltaTime));
    this.frameHandle = this.clock.schedule(this.runFrame);
  };

  private update(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    this.frame += 1;

    const context: RuntimeUpdateContext = {
      runtime: this,
      entities: this.entities,
      input: this.input,
      world: this.world,
      deltaTime,
      elapsedTime: this.elapsedTime,
      frame: this.frame,
    };

    for (const system of this.systems) {
      system.update(context);
    }
  }

  private assertNotDisposed(): void {
    if (this.state === EngineRuntimeState.DISPOSED) {
      throw new Error('EngineRuntime has been disposed');
    }
  }
}
