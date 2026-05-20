// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerrainTooltip } from './TerrainTooltip';

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
});
