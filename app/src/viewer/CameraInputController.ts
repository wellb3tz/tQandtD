import * as THREE from 'three';
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
  private readonly keyboardMoveSpeed = 0.5;
  private readonly mouseSensitivity = 0.002;
  private useFreeCamera = true;
  private isPointerLocked = false;
  private isMouseDragRotating = false;
  private lastMouseDragPosition: { x: number; y: number } | null = null;
  private cameraRotation = { pitch: 0, yaw: 0 };
  private firstPersonMode = false;
  private eyeHeight = 0.5;
  private velocityY = 0;
  private isOnGround = false;
  private readonly gravity = 0.004;
  private readonly jumpForce = 0.10;

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

    let moveSpeed = this.firstPersonMode ? 0.05 : this.keyboardMoveSpeed;
    if (this.keyboardState.get('shift')) {
      moveSpeed *= this.firstPersonMode ? 2.5 : 3;
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

    const raycaster = new THREE.Raycaster();
    const x = this.camera.position.x;
    const z = this.camera.position.z;
    raycaster.set(
      new THREE.Vector3(x, 1000, z),
      new THREE.Vector3(0, -1, 0),
    );

    const terrainMeshes: THREE.Mesh[] = [];
    for (const chunkMesh of this.getChunkMeshes()) {
      terrainMeshes.push(chunkMesh.terrain);
    }

    if (terrainMeshes.length === 0) return;

    const intersects = raycaster.intersectObjects(terrainMeshes);
    if (intersects.length === 0) return;

    const terrainHeight = intersects[0].point.y;
    const groundLevel = terrainHeight + this.eyeHeight;

    // Apply gravity
    this.velocityY -= this.gravity;
    this.camera.position.y += this.velocityY;

    // Ground collision
    if (this.camera.position.y <= groundLevel) {
      this.camera.position.y = groundLevel;
      this.velocityY = 0;
      this.isOnGround = true;
    } else {
      this.isOnGround = false;
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

  private readonly handleContainerClick = (): void => {
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
