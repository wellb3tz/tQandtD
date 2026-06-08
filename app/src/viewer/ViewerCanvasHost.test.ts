/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ViewerCanvasHost } from './ViewerCanvasHost';

describe('ViewerCanvasHost', () => {
  it('sizes the camera and renderer when attached to a container', () => {
    const camera = createCamera();
    const renderer = createRenderer();
    const container = createContainer(800, 600);
    const host = new ViewerCanvasHost({
      camera,
      renderer,
      getPixelRatio: () => 2,
    });

    host.attachToContainer(container);

    expect(camera.aspect).toBeCloseTo(800 / 600);
    expect(camera.updateProjectionMatrix).toHaveBeenCalled();
    expect(renderer.setSize).toHaveBeenCalledWith(800, 600);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.domElement.parentElement).toBe(container);
  });

  it('updates the renderer pixel ratio when changed', () => {
    const camera = createCamera();
    const renderer = createRenderer();
    const host = new ViewerCanvasHost({
      camera,
      renderer,
      getPixelRatio: () => 1,
    });

    host.setPixelRatio(0.85);

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(0.85);
  });

  it('resizes without appending the canvas again', () => {
    const camera = createCamera();
    const renderer = createRenderer();
    const container = createContainer(800, 600);
    const host = new ViewerCanvasHost({ camera, renderer });
    host.attachToContainer(container);

    host.resize(1024, 512);

    expect(camera.aspect).toBeCloseTo(2);
    expect(renderer.setSize).toHaveBeenLastCalledWith(1024, 512);
    expect(container.children).toHaveLength(1);
  });

  it('removes the canvas only from the active container', () => {
    const camera = createCamera();
    const renderer = createRenderer();
    const container = createContainer(800, 600);
    const otherContainer = createContainer(800, 600);
    const host = new ViewerCanvasHost({ camera, renderer });

    host.attachToContainer(container);
    host.detachFromContainer(otherContainer);
    expect(renderer.domElement.parentElement).toBe(container);

    host.detachFromContainer(container);
    expect(renderer.domElement.parentElement).toBeNull();
  });
});

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.updateProjectionMatrix = vi.fn();
  return camera;
}

function createRenderer(): THREE.WebGLRenderer {
  return {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
}

function createContainer(width: number, height: number): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width });
  Object.defineProperty(container, 'clientHeight', { value: height });
  return container;
}
