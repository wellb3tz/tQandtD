/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { FIRST_PERSON_EYE_HEIGHT_METERS } from '@engine/index';
import { CameraInputController } from './CameraInputController';
import type { ChunkMesh } from './ChunkMesh';

describe('CameraInputController', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves the perspective camera with layout-independent keyboard codes', () => {
    const camera = new THREE.PerspectiveCamera();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const controller = createController(camera, container);
    controller.resetRotation();
    controller.attach();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    controller.updateMovement();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    expect(camera.position.z).toBeLessThan(0);
    controller.detach();
  });

  it('uses a faster camera stride for the expanded meter-scale world', () => {
    const camera = new THREE.PerspectiveCamera();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const controller = createController(camera, container);
    controller.resetRotation();
    controller.attach();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    controller.updateMovement();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    expect(Math.abs(camera.position.z)).toBeGreaterThan(1);
    controller.detach();
  });

  it('rotates with mouse drag when pointer lock is unavailable', () => {
    const camera = new THREE.PerspectiveCamera();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const controller = createController(camera, container);
    controller.resetRotation();
    controller.attach();

    container.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(controller.getHeadingDegrees()).toBeGreaterThan(0);
    controller.detach();
  });

  it('rotates with right-side touch drag for mobile camera look', () => {
    const camera = new THREE.PerspectiveCamera();
    const container = createContainer();
    const controller = createController(camera, container);
    controller.resetRotation();
    controller.attach();

    container.dispatchEvent(createTouchEvent('touchstart', [{ identifier: 1, clientX: 280, clientY: 100 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ identifier: 1, clientX: 330, clientY: 100 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ identifier: 1, clientX: 330, clientY: 100 }]));

    expect(controller.getHeadingDegrees()).toBeGreaterThan(0);
    controller.detach();
  });

  it('moves with a left-side touch joystick and stops after release', () => {
    const camera = new THREE.PerspectiveCamera();
    const container = createContainer();
    const controller = createController(camera, container);
    controller.resetRotation();
    controller.attach();

    container.dispatchEvent(createTouchEvent('touchstart', [{ identifier: 1, clientX: 40, clientY: 180 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ identifier: 1, clientX: 40, clientY: 90 }]));
    controller.updateMovement();

    const movedZ = camera.position.z;
    container.dispatchEvent(createTouchEvent('touchend', [{ identifier: 1, clientX: 40, clientY: 90 }]));
    controller.updateMovement();

    expect(movedZ).toBeLessThan(0);
    expect(camera.position.z).toBeCloseTo(movedZ);
    controller.detach();
  });

  it('clamps camera movement to configured world bounds', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, -3.5);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const controller = createController(camera, container);
    controller.resetRotation();
    controller.setMovementBounds({ minX: -5, maxX: 5, minZ: -4, maxZ: 4 });
    controller.attach();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    controller.updateMovement();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    expect(camera.position.z).toBe(-4);
    controller.detach();
  });

  it('clamps immediately when bounds are applied', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(12, 0, -9);
    const container = document.createElement('div');
    const controller = createController(camera, container);

    controller.setMovementBounds({ minX: -5, maxX: 5, minZ: -4, maxZ: 4 });

    expect(camera.position.x).toBe(5);
    expect(camera.position.z).toBe(-4);
  });

  it('pulls a falling first-person camera down firmly in the meter-scale world', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 10, 0);
    const container = document.createElement('div');
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(100, 100));
    terrain.rotateX(-Math.PI / 2);
    terrain.updateMatrixWorld(true);
    const controller = createController(camera, container, [terrain]);
    controller.setFirstPersonMode(true);

    controller.updateFirstPersonPhysics();
    const firstDrop = 10 - camera.position.y;
    controller.updateFirstPersonPhysics();
    const secondDrop = 10 - camera.position.y;

    expect(firstDrop).toBeCloseTo(0.012);
    expect(secondDrop).toBeGreaterThan(firstDrop * 2);
  });

  it('keeps the first-person camera clear of nearby steep terrain', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1, 0);
    const container = document.createElement('div');
    const terrain = createRampTerrain();
    const controller = createController(camera, container, [terrain]);
    controller.setFirstPersonMode(true);

    controller.updateFirstPersonPhysics();

    expect(camera.position.y).toBeGreaterThan(FIRST_PERSON_EYE_HEIGHT_METERS + 2);
  });
});

function createController(camera: THREE.PerspectiveCamera, container: HTMLElement, terrains: THREE.Mesh[] = []): CameraInputController {
  return new CameraInputController({
    camera,
    getContainer: () => container,
    getActiveCamera: () => camera,
    isOrthographic: () => false,
    getOrthographicCamera: () => null,
    getChunkMeshes: terrains.length > 0
      ? () => terrains.map(terrain => ({ terrain } as ChunkMesh))
      : undefined,
  });
}

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 400 });
  Object.defineProperty(container, 'clientHeight', { value: 300 });
  container.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 400,
    bottom: 300,
    width: 400,
    height: 300,
    toJSON: () => undefined,
  });
  document.body.appendChild(container);
  return container;
}

function createRampTerrain(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  const size = 6;
  const steps = 6;

  for (let z = 0; z <= steps; z++) {
    for (let x = 0; x <= steps; x++) {
      const worldX = -size / 2 + (x / steps) * size;
      const worldZ = -size / 2 + (z / steps) * size;
      const height = Math.max(0, worldZ) * 3;
      positions.push(worldX, height, worldZ);
    }
  }

  for (let z = 0; z < steps; z++) {
    for (let x = 0; x < steps; x++) {
      const a = z * (steps + 1) + x;
      const b = a + 1;
      const c = a + steps + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  terrain.updateMatrixWorld(true);
  return terrain;
}

function createTouchEvent(
  type: string,
  touches: Array<{ identifier: number; clientX: number; clientY: number }>,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const changedTouches = touches.map(touch => ({
    identifier: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
  }));

  Object.defineProperty(event, 'changedTouches', { value: changedTouches });
  return event;
}
