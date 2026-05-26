/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { CameraInputController } from './CameraInputController';

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
});

function createController(camera: THREE.PerspectiveCamera, container: HTMLElement): CameraInputController {
  return new CameraInputController({
    camera,
    getContainer: () => container,
    getActiveCamera: () => camera,
    isOrthographic: () => false,
    getOrthographicCamera: () => null,
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
