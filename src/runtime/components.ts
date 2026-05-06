import type { ComponentKey } from './entity';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TransformComponent {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface CameraComponent {
  active: boolean;
  fov: number;
  near: number;
  far: number;
  streamingRadius?: number;
}

export interface ChunkStreamingTargetComponent {
  enabled: boolean;
  radius: number;
  chunkSize?: number;
}

export interface MovementComponent {
  enabled: boolean;
  speed: number;
  sprintMultiplier: number;
  velocity: Vector3;
}

export const TRANSFORM_COMPONENT: ComponentKey<TransformComponent> = 'runtime.transform';
export const CAMERA_COMPONENT: ComponentKey<CameraComponent> = 'runtime.camera';
export const CHUNK_STREAMING_TARGET_COMPONENT: ComponentKey<ChunkStreamingTargetComponent> = 'runtime.chunkStreamingTarget';
export const MOVEMENT_COMPONENT: ComponentKey<MovementComponent> = 'runtime.movement';

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

export function createTransformComponent(values: Partial<TransformComponent> = {}): TransformComponent {
  return {
    position: values.position ?? createVector3(),
    rotation: values.rotation ?? createVector3(),
    scale: values.scale ?? createVector3(1, 1, 1),
  };
}

export function createCameraComponent(values: Partial<CameraComponent> = {}): CameraComponent {
  return {
    active: values.active ?? true,
    fov: values.fov ?? 60,
    near: values.near ?? 0.1,
    far: values.far ?? 1000,
    streamingRadius: values.streamingRadius,
  };
}

export function createChunkStreamingTargetComponent(
  values: Partial<ChunkStreamingTargetComponent> = {}
): ChunkStreamingTargetComponent {
  return {
    enabled: values.enabled ?? true,
    radius: values.radius ?? 1,
    chunkSize: values.chunkSize,
  };
}

export function createMovementComponent(values: Partial<MovementComponent> = {}): MovementComponent {
  return {
    enabled: values.enabled ?? true,
    speed: values.speed ?? 8,
    sprintMultiplier: values.sprintMultiplier ?? 2,
    velocity: values.velocity ?? createVector3(),
  };
}
