import type { ChunkManager } from '../world/chunk-manager';
import type { EntityManager } from './entity';
import type { EngineRuntime } from './engine-runtime';
import type { InputState } from './input';

export interface RuntimeUpdateContext {
  runtime: EngineRuntime;
  entities: EntityManager;
  input: InputState;
  world: ChunkManager | null;
  deltaTime: number;
  elapsedTime: number;
  frame: number;
}

export interface RuntimeSystem {
  readonly name?: string;
  readonly priority?: number;
  onAdd?(runtime: EngineRuntime): void;
  onRemove?(runtime: EngineRuntime): void;
  update(context: RuntimeUpdateContext): void;
}
