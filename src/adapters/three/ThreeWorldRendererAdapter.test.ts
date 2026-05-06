import { describe, expect, it, vi } from 'vitest';
import {
  CAMERA_COMPONENT,
  TRANSFORM_COMPONENT,
  Entity,
  createCameraComponent,
  createTransformComponent,
  type RuntimeUpdateContext,
} from '../../runtime';
import type { ChunkData } from '../../world/chunk';
import {
  ThreeWorldRendererAdapter,
  type ThreeWorldRendererTarget,
} from './ThreeWorldRendererAdapter';

function makeChunk(x: number, y: number): ChunkData {
  return {
    x,
    y,
    size: 1,
    heightmap: new Float32Array(4),
    biomeMap: new Uint8Array(1),
    sparseBiomeTypes: new Uint8Array([0]),
    sparseBiomeWeights: new Float32Array([1]),
    sparseBiomeOffsets: new Uint16Array([0, 1]),
    resources: [],
    structures: [],
  };
}

function makeTarget(): ThreeWorldRendererTarget {
  return {
    addChunk: vi.fn(),
    updateChunk: vi.fn(),
    removeChunk: vi.fn(),
    setCameraPosition: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('ThreeWorldRendererAdapter', () => {
  it('forwards chunk operations to the renderer target', () => {
    const target = makeTarget();
    const adapter = new ThreeWorldRendererAdapter({ target });
    const chunk = makeChunk(2, -1);

    adapter.addChunk(chunk, { x: 2, y: -1 }, { partial: true, stage: 3 });
    adapter.updateChunk(chunk, { x: 2, y: -1 });
    adapter.removeChunk({ x: 2, y: -1 }, { keepFogOfWar: true });

    expect(target.addChunk).toHaveBeenCalledWith(2, -1, chunk, true, 3);
    expect(target.updateChunk).toHaveBeenCalledWith(2, -1, chunk);
    expect(target.removeChunk).toHaveBeenCalledWith(2, -1, true);
  });

  it('syncs active camera entity position to the renderer target camera', () => {
    const target = makeTarget();
    const adapter = new ThreeWorldRendererAdapter({ target });
    const transform = createTransformComponent({ position: { x: 4, y: 8, z: 12 } });
    const camera = new Entity('camera')
      .addComponent(TRANSFORM_COMPONENT, transform)
      .addComponent(CAMERA_COMPONENT, createCameraComponent({ active: true }));

    adapter.updateEntity(camera, transform, {} as RuntimeUpdateContext);

    expect(target.setCameraPosition).toHaveBeenCalledWith({ x: 4, y: 8, z: 12 });
  });

  it('ignores non-camera entities and inactive cameras', () => {
    const target = makeTarget();
    const adapter = new ThreeWorldRendererAdapter({ target });
    const transform = createTransformComponent();

    adapter.updateEntity(new Entity('crate'), transform, {} as RuntimeUpdateContext);
    adapter.updateEntity(
      new Entity('camera').addComponent(CAMERA_COMPONENT, createCameraComponent({ active: false })),
      transform,
      {} as RuntimeUpdateContext
    );

    expect(target.setCameraPosition).not.toHaveBeenCalled();
  });

  it('disposes the renderer target only when requested', () => {
    const retainedTarget = makeTarget();
    new ThreeWorldRendererAdapter({ target: retainedTarget }).dispose();
    expect(retainedTarget.dispose).not.toHaveBeenCalled();

    const ownedTarget = makeTarget();
    new ThreeWorldRendererAdapter({ target: ownedTarget, disposeTarget: true }).dispose();
    expect(ownedTarget.dispose).toHaveBeenCalled();
  });
});
