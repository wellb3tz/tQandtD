// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRuntimeLoop } from './AppRuntimeLoop';
import type { WorldApp } from './WorldApp';
import type { WorldViewer } from '../viewer/WorldViewer';

describe('AppRuntimeLoop', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not stream chunks while startup loading is active', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const app = createAppStub();
    const viewer = createViewerStub();
    const loop = new AppRuntimeLoop({
      app,
      viewer,
      getPerformanceMonitor: () => null,
      getMinimap: () => null,
    });

    loop.setChunkStreamingPaused(true);
    loop.start();
    await vi.advanceTimersByTimeAsync(250);

    expect(app.loadChunksAround).not.toHaveBeenCalled();

    loop.setChunkStreamingPaused(false);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(0);

    expect(app.loadChunksAround).toHaveBeenCalledOnce();

    loop.stop();
  });
});

function createAppStub(): WorldApp {
  return {
    updateState: vi.fn(),
    updateCameraPosition: vi.fn(),
    refreshEconomyWorldContext: vi.fn(),
    advanceEconomy: vi.fn(),
    getConfigSnapshot: vi.fn(() => ({ chunkSize: 32 })),
    getViewDistance: vi.fn(() => 3),
    getJourneyWorldBounds: vi.fn(() => null),
    loadChunksAround: vi.fn(() => Promise.resolve()),
    unloadDistantChunks: vi.fn(),
    getLoadedChunkCount: vi.fn(() => 0),
    getApproximateMemoryUsage: vi.fn(() => 0),
    getDominantBiomeName: vi.fn(() => null),
    updateWorkerPoolStats: vi.fn(),
  } as unknown as WorldApp;
}

function createViewerStub(): WorldViewer {
  return {
    getCameraPosition: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    getCameraHeading: vi.fn(() => 0),
    getRenderStats: vi.fn(() => ({ vertexCount: 0, drawCalls: 0 })),
  } as unknown as WorldViewer;
}
