import type { EngineRuntime } from './engine-runtime';
import type { RuntimeSystem, RuntimeUpdateContext } from './system';

export type InputAction = string;
export type InputAxis = string;

export interface KeyBinding {
  key: string;
  action: InputAction;
  preventDefault?: boolean;
}

export interface InputEventTarget {
  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void): void;
}

export interface InputSystemOptions {
  priority?: number;
  input?: InputState;
  target?: InputEventTarget | null;
  bindings?: KeyBinding[];
}

export const INPUT_ACTION_FORWARD = 'move.forward';
export const INPUT_ACTION_BACKWARD = 'move.backward';
export const INPUT_ACTION_LEFT = 'move.left';
export const INPUT_ACTION_RIGHT = 'move.right';
export const INPUT_ACTION_UP = 'move.up';
export const INPUT_ACTION_DOWN = 'move.down';
export const INPUT_ACTION_SPRINT = 'move.sprint';

export const DEFAULT_KEY_BINDINGS: readonly KeyBinding[] = [
  { key: 'KeyW', action: INPUT_ACTION_FORWARD, preventDefault: true },
  { key: 'ArrowUp', action: INPUT_ACTION_FORWARD, preventDefault: true },
  { key: 'KeyS', action: INPUT_ACTION_BACKWARD, preventDefault: true },
  { key: 'ArrowDown', action: INPUT_ACTION_BACKWARD, preventDefault: true },
  { key: 'KeyA', action: INPUT_ACTION_LEFT, preventDefault: true },
  { key: 'ArrowLeft', action: INPUT_ACTION_LEFT, preventDefault: true },
  { key: 'KeyD', action: INPUT_ACTION_RIGHT, preventDefault: true },
  { key: 'ArrowRight', action: INPUT_ACTION_RIGHT, preventDefault: true },
  { key: 'Space', action: INPUT_ACTION_UP, preventDefault: true },
  { key: 'ShiftLeft', action: INPUT_ACTION_DOWN, preventDefault: true },
  { key: 'ShiftRight', action: INPUT_ACTION_DOWN, preventDefault: true },
];

export class InputState {
  private readonly actions: Map<InputAction, boolean>;
  private readonly axes: Map<InputAxis, number>;

  constructor() {
    this.actions = new Map();
    this.axes = new Map();
  }

  setAction(action: InputAction, active: boolean): void {
    this.actions.set(action, active);
  }

  isActionActive(action: InputAction): boolean {
    return this.actions.get(action) === true;
  }

  setAxis(axis: InputAxis, value: number): void {
    this.axes.set(axis, Math.max(-1, Math.min(1, value)));
  }

  getAxis(axis: InputAxis): number {
    return this.axes.get(axis) ?? 0;
  }

  clear(): void {
    this.actions.clear();
    this.axes.clear();
  }
}

export class InputSystem implements RuntimeSystem {
  readonly name = 'InputSystem';
  readonly priority: number;

  private readonly input: InputState;
  private readonly target: InputEventTarget | null;
  private readonly bindings: KeyBinding[];
  private attached = false;

  constructor(options: InputSystemOptions = {}) {
    this.priority = options.priority ?? -1000;
    this.input = options.input ?? new InputState();
    this.target = options.target ?? null;
    this.bindings = [...(options.bindings ?? DEFAULT_KEY_BINDINGS)];
  }

  onAdd(runtime: EngineRuntime): void {
    runtime.input = this.input;
    this.attach();
  }

  onRemove(): void {
    this.detach();
  }

  update(_context: RuntimeUpdateContext): void {
    // Keyboard events update InputState as they arrive.
  }

  getInputState(): InputState {
    return this.input;
  }

  attach(): void {
    if (!this.target || this.attached) {
      return;
    }

    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.target || !this.attached) {
      return;
    }

    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.attached = false;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.handleKeyboardEvent(event, true);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.handleKeyboardEvent(event, false);
  };

  private handleKeyboardEvent(event: KeyboardEvent, active: boolean): void {
    for (const binding of this.bindings) {
      if (!matchesBinding(event, binding.key)) {
        continue;
      }

      this.input.setAction(binding.action, active);
      if (binding.preventDefault) {
        event.preventDefault();
      }
    }
  }
}

function matchesBinding(event: KeyboardEvent, key: string): boolean {
  const normalizedBinding = key.toLowerCase();
  return event.code.toLowerCase() === normalizedBinding || event.key.toLowerCase() === normalizedBinding;
}
