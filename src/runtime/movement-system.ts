import type { ComponentKey } from './entity';
import type { RuntimeSystem, RuntimeUpdateContext } from './system';
import {
  MOVEMENT_COMPONENT,
  TRANSFORM_COMPONENT,
  type MovementComponent,
  type TransformComponent,
  type Vector3,
} from './components';
import {
  INPUT_ACTION_BACKWARD,
  INPUT_ACTION_DOWN,
  INPUT_ACTION_FORWARD,
  INPUT_ACTION_LEFT,
  INPUT_ACTION_RIGHT,
  INPUT_ACTION_SPRINT,
  INPUT_ACTION_UP,
  type InputAction,
} from './input';

export interface MovementActionMap {
  forward: InputAction;
  backward: InputAction;
  left: InputAction;
  right: InputAction;
  up: InputAction;
  down: InputAction;
  sprint: InputAction;
}

export interface MovementSystemOptions {
  priority?: number;
  transformComponent?: ComponentKey<TransformComponent>;
  movementComponent?: ComponentKey<MovementComponent>;
  actions?: Partial<MovementActionMap>;
}

export const DEFAULT_MOVEMENT_ACTIONS: MovementActionMap = {
  forward: INPUT_ACTION_FORWARD,
  backward: INPUT_ACTION_BACKWARD,
  left: INPUT_ACTION_LEFT,
  right: INPUT_ACTION_RIGHT,
  up: INPUT_ACTION_UP,
  down: INPUT_ACTION_DOWN,
  sprint: INPUT_ACTION_SPRINT,
};

export class MovementSystem implements RuntimeSystem {
  readonly name = 'MovementSystem';
  readonly priority: number;

  private readonly transformComponent: ComponentKey<TransformComponent>;
  private readonly movementComponent: ComponentKey<MovementComponent>;
  private readonly actions: MovementActionMap;

  constructor(options: MovementSystemOptions = {}) {
    this.priority = options.priority ?? -900;
    this.transformComponent = options.transformComponent ?? TRANSFORM_COMPONENT;
    this.movementComponent = options.movementComponent ?? MOVEMENT_COMPONENT;
    this.actions = { ...DEFAULT_MOVEMENT_ACTIONS, ...options.actions };
  }

  update(context: RuntimeUpdateContext): void {
    const direction = this.getInputDirection(context);

    for (const entity of context.entities.query([this.transformComponent, this.movementComponent])) {
      const transform = entity.requireComponent<TransformComponent>(this.transformComponent);
      const movement = entity.requireComponent<MovementComponent>(this.movementComponent);

      if (!movement.enabled) {
        movement.velocity = { x: 0, y: 0, z: 0 };
        continue;
      }

      const speed = context.input.isActionActive(this.actions.sprint)
        ? movement.speed * movement.sprintMultiplier
        : movement.speed;

      movement.velocity = {
        x: direction.x * speed,
        y: direction.y * speed,
        z: direction.z * speed,
      };

      transform.position.x += movement.velocity.x * context.deltaTime;
      transform.position.y += movement.velocity.y * context.deltaTime;
      transform.position.z += movement.velocity.z * context.deltaTime;
    }
  }

  private getInputDirection(context: RuntimeUpdateContext): Vector3 {
    const x =
      (context.input.isActionActive(this.actions.right) ? 1 : 0) -
      (context.input.isActionActive(this.actions.left) ? 1 : 0);
    const y =
      (context.input.isActionActive(this.actions.up) ? 1 : 0) -
      (context.input.isActionActive(this.actions.down) ? 1 : 0);
    const z =
      (context.input.isActionActive(this.actions.backward) ? 1 : 0) -
      (context.input.isActionActive(this.actions.forward) ? 1 : 0);

    return normalize({ x, y, z });
  }
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}
