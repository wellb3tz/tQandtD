import * as THREE from 'three';
import { FIRST_PERSON_EYE_HEIGHT_METERS } from '@engine/index';
import type { ChunkMesh } from './ChunkMesh';

const KEYBOARD_CODE_MAP: Record<string, string> = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  Space: 'space',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
};
const FIRST_PERSON_EYE_HEIGHT = FIRST_PERSON_EYE_HEIGHT_METERS;
const FREE_CAMERA_MOVE_SPEED = 8;
const FIRST_PERSON_MOVE_SPEED = 0.18;
const FREE_CAMERA_SPRINT_MULTIPLIER = 4;
const FIRST_PERSON_SPRINT_MULTIPLIER = 3.5;
const TOUCH_JOYSTICK_RADIUS_PX = 72;
const FIRST_PERSON_TERRAIN_CLEARANCE_RADIUS_METERS = 0.8;
const FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS =
  FIRST_PERSON_TERRAIN_CLEARANCE_RADIUS_METERS * Math.SQRT1_2;

export interface CameraInputControllerOptions {
  camera: THREE.PerspectiveCamera;
  getContainer: () => HTMLElement | null;
  getActiveCamera: () => THREE.Camera;
  isOrthographic: () => boolean;
  getOrthographicCamera: () => THREE.OrthographicCamera | null;
  getChunkMeshes?: () => Iterable<ChunkMesh>;
}

export class CameraInputController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly getContainer: () => HTMLElement | null;
  private readonly getActiveCamera: () => THREE.Camera;
  private readonly isOrthographic: () => boolean;
  private readonly getOrthographicCamera: () => THREE.OrthographicCamera | null;
  private readonly getChunkMeshes: (() => Iterable<ChunkMesh>) | undefined;
  private readonly keyboardState = new Map<string, boolean>();
  private readonly mouseSensitivity = 0.002;
  private useFreeCamera = true;
  private isPointerLocked = false;
  private isMouseDragRotating = false;
  private lastMouseDragPosition: { x: number; y: number } | null = null;
  private moveTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private moveTouchStart: { x: number; y: number } | null = null;
  private lastLookTouchPosition: { x: number; y: number } | null = null;
  private touchMoveVector = { x: 0, y: 0 };
  private cameraRotation = { pitch: 0, yaw: 0 };
  private firstPersonMode = false;
  private orbitMode = false;
  private eyeHeight = FIRST_PERSON_EYE_HEIGHT;
  private velocityY = 0;
  private isOnGround = false;
  private readonly gravity = 0.012;
  private readonly jumpForce = 0.10;
  private readonly terrainRaycaster = new THREE.Raycaster();
  private readonly terrainRayOrigin = new THREE.Vector3();
  private readonly terrainRayDirection = new THREE.Vector3(0, -1, 0);
  private readonly terrainSampleOffsets = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(FIRST_PERSON_TERRAIN_CLEARANCE_RADIUS_METERS, 0),
    new THREE.Vector2(-FIRST_PERSON_TERRAIN_CLEARANCE_RADIUS_METERS, 0),
    new THREE.Vector2(0, FIRST_PERSON_TERRAIN_CLEARANCE_RADIUS_METERS),
    new THREE.Vector2(0, -FIRST_PERSON_TERRAIN_CLEARANCE_RADIUS_METERS),
    new THREE.Vector2(FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS, FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS),
    new THREE.Vector2(FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS, -FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS),
    new THREE.Vector2(-FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS, FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS),
    new THREE.Vector2(-FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS, -FIRST_PERSON_TERRAIN_CLEARANCE_DIAGONAL_METERS),
  ];

  /** Callback for orbit drag + scroll, set by OrbitalTransitionController. */
  private onOrbitInput: ((deltaX: number, deltaY: number, scrollDelta: number) => void) | null = null;

  constructor(options: CameraInputControllerOptions) {
    this.camera = options.camera;
    this.getContainer = options.getContainer;
    this.getActiveCamera = options.getActiveCamera;
    this.isOrthographic = options.isOrthographic;
    this.getOrthographicCamera = options.getOrthographicCamera;
    this.getChunkMeshes = options.getChunkMeshes;
  }

  attach(): void {
    const container = this.getContainer();
    if (!container) return;

    container.addEventListener('click', this.handleContainerClick);
    container.addEventListener('mousedown', this.handleCameraDragStart);
    container.addEventListener('mouseleave', this.handleCameraDragEnd);
    container.addEventListener('wheel', this.handleWheel, { passive: false });
    container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    container.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handlePointerLockedMouseMove);
    document.addEventListener('mousemove', this.handleCameraDragMove);
    document.addEventListener('mouseup', this.handleCameraDragEnd);
    document.addEventListener('keydown', this.handlePointerLockEscape);
    window.addEventListener('keydown', this.handleKeyboardDown);
    window.addEventListener('keyup', this.handleKeyboardUp);
  }

  detach(): void {
    const container = this.getContainer();
    if (container) {
      container.removeEventListener('click', this.handleContainerClick);
      container.removeEventListener('mousedown', this.handleCameraDragStart);
      container.removeEventListener('mouseleave', this.handleCameraDragEnd);
      container.removeEventListener('wheel', this.handleWheel);
      container.removeEventListener('touchstart', this.handleTouchStart);
      container.removeEventListener('touchmove', this.handleTouchMove);
      container.removeEventListener('touchend', this.handleTouchEnd);
      container.removeEventListener('touchcancel', this.handleTouchEnd);
    }

    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handlePointerLockedMouseMove);
    document.removeEventListener('mousemove', this.handleCameraDragMove);
    document.removeEventListener('mouseup', this.handleCameraDragEnd);
    document.removeEventListener('keydown', this.handlePointerLockEscape);
    window.removeEventListener('keydown', this.handleKeyboardDown);
    window.removeEventListener('keyup', this.handleKeyboardUp);
  }

  resetRotation(yaw: number = 0, pitch: number = -0.3): void {
    this.cameraRotation.yaw = yaw;
    this.cameraRotation.pitch = pitch;
    this.updateCameraRotation();
  }

  updateMovement(): void {
    if (!this.useFreeCamera) return;

    let moveSpeed = this.firstPersonMode ? FIRST_PERSON_MOVE_SPEED : FREE_CAMERA_MOVE_SPEED;
    if (this.keyboardState.get('shift')) {
      moveSpeed *= this.firstPersonMode ? FIRST_PERSON_SPRINT_MULTIPLIER : FREE_CAMERA_SPRINT_MULTIPLIER;
    }
    if (this.hasTouchMovement()) {
      moveSpeed *= 0.75;
    }

    const activeCamera = this.getActiveCamera();
    const movement = new THREE.Vector3();

    if (this.isOrthographic()) {
      this.applyOrthographicMovement(movement, moveSpeed);
    } else if (this.firstPersonMode) {
      this.applyFirstPersonMovement(movement);
    } else {
      this.applyPerspectiveMovement(movement);
    }

    if (movement.length() > 0) {
      movement.normalize().multiplyScalar(moveSpeed);
      activeCamera.position.add(movement);
    }
  }

  updateFirstPersonPhysics(): void {
    if (!this.firstPersonMode || !this.getChunkMeshes) return;

    const terrainMeshes: THREE.Mesh[] = [];
    for (const chunkMesh of this.getChunkMeshes()) {
      terrainMeshes.push(chunkMesh.terrain);
    }

    if (terrainMeshes.length === 0) return;

    const terrainHeight = this.sampleFirstPersonTerrainHeight(terrainMeshes);
    if (terrainHeight === null) return;

    const groundLevel = terrainHeight + this.eyeHeight;

    if (this.isOnGround) {
      // Snap to terrain while walking so downhill movement stays smooth
      this.camera.position.y = groundLevel;
    } else {
      // Apply gravity while airborne
      this.velocityY -= this.gravity;
      this.camera.position.y += this.velocityY;

      // Ground collision
      if (this.camera.position.y <= groundLevel) {
        this.camera.position.y = groundLevel;
        this.velocityY = 0;
        this.isOnGround = true;
      }
    }
  }

  getHeadingDegrees(): number {
    const deg = ((-this.cameraRotation.yaw) * 180 / Math.PI) % 360;
    return (deg + 360) % 360;
  }

  setFirstPersonMode(enabled: boolean): void {
    this.firstPersonMode = enabled;
    if (enabled) {
      // Lock pitch to reasonable walking view
      this.cameraRotation.pitch = Math.max(-0.5, Math.min(0.5, this.cameraRotation.pitch));
      this.updateCameraRotation();
    }
  }

  isFirstPersonMode(): boolean {
    return this.firstPersonMode;
  }

  setOrbitMode(enabled: boolean): void {
    this.orbitMode = enabled;
    if (enabled) {
      this.firstPersonMode = false;
      this.unlockPointer();
    }
  }

  isOrbitMode(): boolean {
    return this.orbitMode;
  }

  setOrbitInputCallback(
    callback: (deltaX: number, deltaY: number, scrollDelta: number) => void
  ): void {
    this.onOrbitInput = callback;
  }

  setEyeHeight(height: number): void {
    this.eyeHeight = height;
  }

  lockPointer(): void {
    const container = this.getContainer();
    if (!container) return;
    if (document.pointerLockElement === container) return;
    try {
      const req = container.requestPointerLock?.();
      if (req && typeof (req as Promise<void>).catch === 'function') {
        (req as Promise<void>).catch(() => undefined);
      }
    } catch {
      // ignore
    }
  }

  unlockPointer(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private updateCameraRotation(): void {
    this.cameraRotation.pitch = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, this.cameraRotation.pitch),
    );
    const euler = new THREE.Euler(this.cameraRotation.pitch, this.cameraRotation.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  private applyOrthographicMovement(movement: THREE.Vector3, moveSpeed: number): void {
    if (this.keyboardState.get('w')) movement.z -= 1;
    if (this.keyboardState.get('s')) movement.z += 1;
    if (this.keyboardState.get('a')) movement.x -= 1;
    if (this.keyboardState.get('d')) movement.x += 1;
    movement.x += this.touchMoveVector.x;
    movement.z -= this.touchMoveVector.y;

    const camera = this.getOrthographicCamera();
    if (!camera) return;

    if (this.keyboardState.get('space')) {
      this.scaleOrthographicFrustum(camera, 1 - 0.02);
    }
    if (this.keyboardState.get('shift')) {
      this.scaleOrthographicFrustum(camera, 1 + 0.02);
    }
  }

  private applyPerspectiveMovement(movement: THREE.Vector3): void {
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    this.camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();

    if (this.keyboardState.get('w')) movement.add(forward);
    if (this.keyboardState.get('s')) movement.sub(forward);
    if (this.keyboardState.get('a')) movement.sub(right);
    if (this.keyboardState.get('d')) movement.add(right);
    movement.addScaledVector(forward, this.touchMoveVector.y);
    movement.addScaledVector(right, this.touchMoveVector.x);
    if (this.keyboardState.get('space')) {
      movement.add(up);
    }
  }

  private applyFirstPersonMovement(movement: THREE.Vector3): void {
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    this.camera.getWorldDirection(forward);
    // Flatten forward to XZ plane for ground movement
    forward.y = 0;
    if (forward.length() > 0) {
      forward.normalize();
    }
    right.crossVectors(forward, up).normalize();

    if (this.keyboardState.get('w')) movement.add(forward);
    if (this.keyboardState.get('s')) movement.sub(forward);
    if (this.keyboardState.get('a')) movement.sub(right);
    if (this.keyboardState.get('d')) movement.add(right);
    movement.addScaledVector(forward, this.touchMoveVector.y);
    movement.addScaledVector(right, this.touchMoveVector.x);

    if (this.keyboardState.get('space')) {
      if (this.isOnGround) {
        this.velocityY = this.jumpForce;
        this.isOnGround = false;
      }
    }
  }

  private scaleOrthographicFrustum(camera: THREE.OrthographicCamera, scale: number): void {
    camera.left *= scale;
    camera.right *= scale;
    camera.top *= scale;
    camera.bottom *= scale;
    camera.updateProjectionMatrix();
  }

  private sampleFirstPersonTerrainHeight(terrainMeshes: THREE.Mesh[]): number | null {
    let highestTerrainHeight: number | null = null;

    for (const offset of this.terrainSampleOffsets) {
      this.terrainRayOrigin.set(
        this.camera.position.x + offset.x,
        2000,
        this.camera.position.z + offset.y,
      );
      this.terrainRaycaster.set(this.terrainRayOrigin, this.terrainRayDirection);
      const intersects = this.terrainRaycaster.intersectObjects(terrainMeshes);

      if (intersects.length === 0) {
        continue;
      }

      const terrainHeight = intersects[0].point.y;
      highestTerrainHeight = highestTerrainHeight === null
        ? terrainHeight
        : Math.max(highestTerrainHeight, terrainHeight);
    }

    return highestTerrainHeight;
  }

  private hasTouchMovement(): boolean {
    return Math.abs(this.touchMoveVector.x) > 0.01 || Math.abs(this.touchMoveVector.y) > 0.01;
  }

  private updateTouchMoveVector(touch: Touch): void {
    if (!this.moveTouchStart) return;

    const dx = touch.clientX - this.moveTouchStart.x;
    const dy = touch.clientY - this.moveTouchStart.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > TOUCH_JOYSTICK_RADIUS_PX
      ? TOUCH_JOYSTICK_RADIUS_PX / distance
      : 1;

    this.touchMoveVector = {
      x: (dx * scale) / TOUCH_JOYSTICK_RADIUS_PX,
      y: (-dy * scale) / TOUCH_JOYSTICK_RADIUS_PX,
    };
  }

  private isLeftSideTouch(touch: Touch): boolean {
    const container = this.getContainer();
    if (!container) return false;

    const rect = container.getBoundingClientRect();
    const width = rect.width || container.clientWidth || window.innerWidth;
    return touch.clientX < rect.left + width * 0.5;
  }

  private readonly handleContainerClick = (): void => {
    if (this.orbitMode) {
      // In orbit mode, click is handled by OrbitalTransitionController for planet raycasting
      return;
    }
    if (!this.isPointerLocked && (this.useFreeCamera || this.firstPersonMode)) {
      try {
        const pointerLockRequest = this.getContainer()?.requestPointerLock?.();
        if (pointerLockRequest && typeof (pointerLockRequest as Promise<void>).catch === 'function') {
          (pointerLockRequest as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Embedded browsers can deny pointer lock; drag rotation remains available.
      }
    }
  };

  private readonly handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.getContainer();
  };

  private readonly handlePointerLockedMouseMove = (e: MouseEvent): void => {
    if (this.orbitMode) return;
    if (this.isPointerLocked && this.useFreeCamera) {
      this.cameraRotation.yaw -= e.movementX * this.mouseSensitivity;
      this.cameraRotation.pitch -= e.movementY * this.mouseSensitivity;
      this.updateCameraRotation();
    }
  };

  private readonly handleCameraDragStart = (e: MouseEvent): void => {
    if (!this.useFreeCamera || this.isPointerLocked || e.button !== 0) return;

    this.isMouseDragRotating = true;
    this.lastMouseDragPosition = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  private readonly handleCameraDragMove = (e: MouseEvent): void => {
    if (this.orbitMode && this.onOrbitInput && this.isMouseDragRotating) {
      const deltaX = e.clientX - (this.lastMouseDragPosition?.x ?? e.clientX);
      const deltaY = e.clientY - (this.lastMouseDragPosition?.y ?? e.clientY);
      this.onOrbitInput(deltaX, deltaY, 0);
      this.lastMouseDragPosition = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (!this.isMouseDragRotating || this.isPointerLocked || !this.lastMouseDragPosition) return;

    const deltaX = e.clientX - this.lastMouseDragPosition.x;
    const deltaY = e.clientY - this.lastMouseDragPosition.y;
    this.cameraRotation.yaw -= deltaX * this.mouseSensitivity;
    this.cameraRotation.pitch -= deltaY * this.mouseSensitivity;
    this.updateCameraRotation();
    this.lastMouseDragPosition = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  private readonly handleCameraDragEnd = (): void => {
    this.isMouseDragRotating = false;
    this.lastMouseDragPosition = null;
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    if (this.orbitMode && this.onOrbitInput) {
      e.preventDefault();
      this.onOrbitInput(0, 0, e.deltaY > 0 ? 1 : -1);
    }
  };

  private readonly handleTouchStart = (e: TouchEvent): void => {
    if (!this.useFreeCamera && !this.orbitMode) return;

    for (const touch of Array.from(e.changedTouches)) {
      if (this.moveTouchId === null && this.isLeftSideTouch(touch) && !this.orbitMode) {
        this.moveTouchId = touch.identifier;
        this.moveTouchStart = { x: touch.clientX, y: touch.clientY };
        this.touchMoveVector = { x: 0, y: 0 };
        continue;
      }

      if (this.lookTouchId === null) {
        this.lookTouchId = touch.identifier;
        this.lastLookTouchPosition = { x: touch.clientX, y: touch.clientY };
      }
    }

    if (this.moveTouchId !== null || this.lookTouchId !== null) {
      e.preventDefault();
    }
  };

  private readonly handleTouchMove = (e: TouchEvent): void => {
    if (!this.useFreeCamera && !this.orbitMode) return;

    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.moveTouchId) {
        this.updateTouchMoveVector(touch);
        e.preventDefault();
        continue;
      }

      if (touch.identifier === this.lookTouchId && this.lastLookTouchPosition) {
        const deltaX = touch.clientX - this.lastLookTouchPosition.x;
        const deltaY = touch.clientY - this.lastLookTouchPosition.y;

        if (this.orbitMode && this.onOrbitInput) {
          this.onOrbitInput(deltaX, deltaY, 0);
        } else if (!this.isPointerLocked) {
          this.cameraRotation.yaw -= deltaX * this.mouseSensitivity;
          this.cameraRotation.pitch -= deltaY * this.mouseSensitivity;
          this.updateCameraRotation();
        }

        this.lastLookTouchPosition = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      }
    }
  };

  private readonly handleTouchEnd = (e: TouchEvent): void => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.moveTouchStart = null;
        this.touchMoveVector = { x: 0, y: 0 };
      }

      if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
        this.lastLookTouchPosition = null;
      }
    }
  };

  private readonly handlePointerLockEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isPointerLocked) {
      document.exitPointerLock();
    }
  };

  private readonly handleKeyboardDown = (e: KeyboardEvent): void => {
    const key = KEYBOARD_CODE_MAP[e.code];
    if (key) {
      this.keyboardState.set(key, true);
      e.preventDefault();
    }
  };

  private readonly handleKeyboardUp = (e: KeyboardEvent): void => {
    const key = KEYBOARD_CODE_MAP[e.code];
    if (key) {
      this.keyboardState.set(key, false);
      e.preventDefault();
    }
  };
}
