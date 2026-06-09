// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModeLifecycle } from './AppModeLifecycle';
import type { WorldApp } from './WorldApp';
import type { WorldViewer } from '../viewer/WorldViewer';

describe('AppModeLifecycle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    vi.restoreAllMocks();
  });

  it('keeps journey loading active until terrain around the spawn camera is warmed up', async () => {
    document.body.innerHTML = `
      <div id="mode-select"></div>
      <button id="world-editor-mode-btn"></button>
      <button id="journey-mode-btn"></button>
      <input id="seed-input" />
      <span id="status-seed"></span>
      <input type="radio" name="journey-world-size" value="M" checked />
    `;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const events: string[] = [];
    const app = createJourneyAppStub(events);
    const viewer = createJourneyViewerStub(events);
    const lifecycle = new AppModeLifecycle({
      getApp: () => app,
      getViewer: () => viewer,
      initEngine: vi.fn(async () => events.push('init')),
      cleanupEngine: vi.fn(),
      resizeViewerToContainer: vi.fn(() => events.push('resize')),
      setViewerReady: vi.fn(ready => events.push(`viewer:${ready}`)),
      setWorldGenerationLoading: vi.fn(visible => events.push(`loading:${visible}`)),
    });

    await lifecycle.enterAppMode('journey');

    expect(events).toContain('loading:true');
    expect(events).toContain('set-camera');
    expect(events).toContain('warmup-load');
    expect(events.indexOf('set-camera')).toBeLessThan(events.indexOf('warmup-load'));
    expect(events.indexOf('warmup-flush')).toBeLessThan(events.lastIndexOf('viewer:true'));
    expect(events.indexOf('warmup-flush')).toBeLessThan(events.lastIndexOf('loading:false'));
  });
});

function createJourneyAppStub(events: string[]): WorldApp {
  return {
    setJourneyWorldSize: vi.fn(() => ({
      preset: 'M',
      chunkSpan: 8,
      tileSpan: 256,
      bounds: {
        minChunkX: -4,
        maxChunkX: 3,
        minChunkY: -4,
        maxChunkY: 3,
        minWorldX: -4096,
        maxWorldX: 4096,
        minWorldZ: -4096,
        maxWorldZ: 4096,
      },
    })),
    configureDefaultJourneyWorldSize: vi.fn(),
    generateWorld: vi.fn(async () => events.push('generate')),
    getLoadedChunksSnapshot: vi.fn(() => new Map()),
    getConfigSnapshot: vi.fn(() => ({ chunkSize: 32 })),
    getViewDistance: vi.fn(() => 3),
    loadChunksAround: vi.fn(async () => events.push('warmup-load')),
  } as unknown as WorldApp;
}

function createJourneyViewerStub(events: string[]): WorldViewer {
  return {
    getCameraPosition: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    setMovementBounds: vi.fn(() => events.push('bounds')),
    setCameraPosition: vi.fn(() => events.push('set-camera')),
    flushPendingChunkBuilds: vi.fn(async () => events.push('warmup-flush')),
    setFirstPersonMode: vi.fn(() => events.push('first-person')),
  } as unknown as WorldViewer;
}
