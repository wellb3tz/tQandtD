// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSurfaceSummary, TerrainTooltip } from './TerrainTooltip';

describe('TerrainTooltip', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('removes viewer listeners and animation frame on dispose', () => {
    document.body.innerHTML = '<div id="viewer"></div>';
    const viewerEl = document.getElementById('viewer')!;
    const addListener = vi.spyOn(viewerEl, 'addEventListener');
    const removeListener = vi.spyOn(viewerEl, 'removeEventListener');
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);

    const tooltip = new TerrainTooltip();
    tooltip.initialize({} as never, { raycastTerrain: vi.fn() });
    tooltip.dispose();

    expect(addListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    expect(cancelFrame).toHaveBeenCalledWith(42);
    expect(document.getElementById('terrain-tooltip')).toBeNull();
  });

  it('formats dominant terrain surfaces for display', () => {
    expect(formatSurfaceSummary({
      plains: 0,
      desert: 0,
      beach: 0,
      mountainRock: 0.5,
      snow: 0.5,
      forestFloor: 0,
      dryGrass: 0,
      swampMud: 0,
      volcanicRock: 0,
      ice: 0,
      riverbed: 0,
    })).toBe('Mountain Rock 50% / Snow 50%');

    expect(formatSurfaceSummary({
      plains: 0,
      desert: 0,
      beach: 0,
      mountainRock: 0,
      snow: 1,
      forestFloor: 0,
      dryGrass: 0,
      swampMud: 0,
      volcanicRock: 0,
      ice: 0,
      riverbed: 0,
    })).toBe('Snow');
  });

  it('shows terrain basics and temperature without raw debug attributes', () => {
    document.body.innerHTML = '<div id="viewer"></div>';
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);

    const viewerEl = document.getElementById('viewer')!;
    vi.spyOn(viewerEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const tooltip = new TerrainTooltip();
    tooltip.initialize({ getState: () => ({ loadedChunks: new Map() }) } as never, {
      raycastTerrain: vi.fn(() => ({
        chunkX: 0,
        chunkY: 0,
        localX: 0,
        localY: 0,
        height: 0.5,
        point: { x: 12, z: 34 },
        chunkData: {
          size: 1,
          heightmap: new Float32Array([0.5, 0.5, 0.5, 0.5]),
          biomeMap: new Uint8Array([0]),
          temperatureMap: new Float32Array([-0.35]),
          resources: [],
          structures: [],
        },
      })),
    });

    const el = document.getElementById('terrain-tooltip')!;
    (tooltip as unknown as { update: (clientX: number, clientY: number) => void }).update(10, 10);

    expect(el.innerHTML).toContain('Height');
    expect(el.innerHTML).toContain('Temperature');
    expect(el.innerHTML).toContain('-0.35');
    expect(el.innerHTML).toContain('Moisture');
    expect(el.innerHTML).toContain('Position');
    expect(el.innerHTML).not.toContain('Surface weights');
    expect(el.innerHTML).not.toContain('Samples');
    expect(el.innerHTML).not.toContain('surfaceBlendA');
    expect(el.innerHTML).not.toContain('terrainDetailBlend');
    expect(el.innerHTML).not.toContain('Vertex color');

    tooltip.dispose();
  });

  it('toggles enabled state and hides the tooltip when disabled', () => {
    document.body.innerHTML = '<div id="viewer"></div>';
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);

    const tooltip = new TerrainTooltip();
    tooltip.initialize({} as never, { raycastTerrain: vi.fn() });

    const el = document.getElementById('terrain-tooltip')!;
    el.style.display = 'block';

    expect(tooltip.isEnabled()).toBe(true);
    expect(tooltip.toggleEnabled()).toBe(false);
    expect(tooltip.isEnabled()).toBe(false);
    expect(el.style.display).toBe('none');
    expect(tooltip.toggleEnabled()).toBe(true);

    tooltip.dispose();
  });

  it('updates from the viewer center when re-enabled in journey mode', () => {
    document.body.innerHTML = '<div id="viewer"></div>';
    document.body.classList.add('journey-mode');
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);

    const viewerEl = document.getElementById('viewer')!;
    vi.spyOn(viewerEl, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 800,
      height: 600,
      right: 810,
      bottom: 620,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });

    const raycastTerrain = vi.fn();
    const tooltip = new TerrainTooltip();
    tooltip.initialize({} as never, { raycastTerrain });

    tooltip.setEnabled(false);
    tooltip.setEnabled(true);

    expect(raycastTerrain).toHaveBeenCalledWith(400, 300);

    tooltip.dispose();
  });

  it('positions next to the left side of the minimap', () => {
    document.body.innerHTML = '<div id="viewer"></div><div class="minimap-container"></div>';
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });

    const viewerEl = document.getElementById('viewer')!;
    vi.spyOn(viewerEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1024,
      height: 720,
      right: 1024,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const minimapEl = document.querySelector('.minimap-container') as HTMLElement;
    vi.spyOn(minimapEl, 'getBoundingClientRect').mockReturnValue({
      left: 760,
      top: 520,
      width: 224,
      height: 170,
      right: 984,
      bottom: 690,
      x: 760,
      y: 520,
      toJSON: () => ({}),
    });

    const chunk = {
      size: 1,
      heightmap: new Float32Array([0.5, 0.5, 0.5, 0.5]),
      biomeMap: new Uint8Array([0]),
    };
    const tooltip = new TerrainTooltip();
    tooltip.initialize(
      { getState: () => ({ loadedChunks: new Map() }) } as never,
      {
        raycastTerrain: vi.fn(() => ({
          chunkX: 0,
          chunkY: 0,
          localX: 0,
          localY: 0,
          height: 0.5,
          point: { x: 12, z: 34 },
          chunkData: chunk,
        })),
      }
    );

    const el = document.getElementById('terrain-tooltip')!;
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 180 });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 100 });

    (tooltip as unknown as { update: (clientX: number, clientY: number) => void }).update(400, 300);

    expect(el.style.left).toBe('570px');
    expect(el.style.top).toBe('520px');
    expect(el.style.transform).toBe('none');

    tooltip.dispose();
  });

  it('waits for the minimap to be visible before showing in journey mode', () => {
    document.body.innerHTML = '<div id="viewer"></div><div class="minimap-container" style="visibility:hidden"></div>';
    document.body.classList.add('journey-mode');
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);

    const viewerEl = document.getElementById('viewer')!;
    vi.spyOn(viewerEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1024,
      height: 720,
      right: 1024,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const minimapEl = document.querySelector('.minimap-container') as HTMLElement;
    vi.spyOn(minimapEl, 'getBoundingClientRect').mockReturnValue({
      left: 760,
      top: 520,
      width: 224,
      height: 170,
      right: 984,
      bottom: 690,
      x: 760,
      y: 520,
      toJSON: () => ({}),
    });

    const tooltip = new TerrainTooltip();
    tooltip.initialize(
      { getState: () => ({ loadedChunks: new Map() }) } as never,
      {
        raycastTerrain: vi.fn(() => ({
          chunkX: 0,
          chunkY: 0,
          localX: 0,
          localY: 0,
          height: 0.5,
          point: { x: 12, z: 34 },
          chunkData: {
            size: 1,
            heightmap: new Float32Array([0.5, 0.5, 0.5, 0.5]),
            biomeMap: new Uint8Array([0]),
          },
        })),
      }
    );

    (tooltip as unknown as { update: (clientX: number, clientY: number) => void }).update(400, 300);

    expect(document.getElementById('terrain-tooltip')!.style.display).toBe('none');

    tooltip.dispose();
  });
});
