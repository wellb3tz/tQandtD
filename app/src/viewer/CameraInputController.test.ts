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
