import { describe, expect, it, vi } from 'vitest';
import {
  CAMERA_COMPONENT,
  TRANSFORM_COMPONENT,
  createCameraComponent,
  createTransformComponent,
  Entity,
  type ChunkData,
  type RuntimeUpdateContext,
} from '../../../src';
import { WorldViewerRendererAdapter } from './WorldViewerRendererAdapter';
import type { WorldViewer } from './WorldViewer';

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

function makeViewer(): WorldViewer {
  return {
    addChunk: vi.fn(),
    updateChunk: vi.fn(),
    removeChunk: vi.fn(),
    setCameraPosition: vi.fn(),
    dispose: vi.fn(),
  } as unknown as WorldViewer;
}

describe('WorldViewerRendererAdapter', () => {
  it('forwards chunk operations to WorldViewer', () => {
    const viewer = makeViewer();
    const adapter = new WorldViewerRendererAdapter({ viewer });
    const chunk = makeChunk(2, -1);

    adapter.addChunk(chunk, { x: 2, y: -1 }, { partial: true, stage: 3 });
    adapter.updateChunk(chunk, { x: 2, y: -1 });
    adapter.removeChunk({ x: 2, y: -1 }, { keepFogOfWar: true });

    expect(viewer.addChunk).toHaveBeenCalledWith(2, -1, chunk, true, 3);
    expect(viewer.updateChunk).toHaveBeenCalledWith(2, -1, chunk);
    expect(viewer.removeChunk).toHaveBeenCalledWith(2, -1, true);
  });

  it('syncs active camera entity position to WorldViewer camera', () => {
    const viewer = makeViewer();
    const adapter = new WorldViewerRendererAdapter({ viewer });
    const transform = createTransformComponent({ position: { x: 4, y: 8, z: 12 } });
    const camera = new Entity('camera')
      .addComponent(TRANSFORM_COMPONENT, transform)
      .addComponent(CAMERA_COMPONENT, createCameraComponent({ active: true }));

    adapter.updateEntity(camera, transform, {} as RuntimeUpdateContext);

    expect(viewer.setCameraPosition).toHaveBeenCalledWith({ x: 4, y: 8, z: 12 });
  });

  it('ignores non-camera entities and inactive cameras', () => {
    const viewer = makeViewer();
    const adapter = new WorldViewerRendererAdapter({ viewer });
    const transform = createTransformComponent();

    adapter.updateEntity(new Entity('crate'), transform, {} as RuntimeUpdateContext);
    adapter.updateEntity(
      new Entity('camera').addComponent(CAMERA_COMPONENT, createCameraComponent({ active: false })),
      transform,
      {} as RuntimeUpdateContext
    );

    expect(viewer.setCameraPosition).not.toHaveBeenCalled();
  });

  it('disposes the viewer only when requested', () => {
    const retainedViewer = makeViewer();
    new WorldViewerRendererAdapter({ viewer: retainedViewer }).dispose();
    expect(retainedViewer.dispose).not.toHaveBeenCalled();

    const ownedViewer = makeViewer();
    new WorldViewerRendererAdapter({ viewer: ownedViewer, disposeViewer: true }).dispose();
    expect(ownedViewer.dispose).toHaveBeenCalled();
  });
});
