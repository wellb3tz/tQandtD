// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceMonitor } from './PerformanceMonitor';

describe('PerformanceMonitor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('cancels fps tracking frame and periodic updates on dispose', () => {
    document.body.innerHTML = '<canvas id="fps-graph"></canvas>';
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    vi.spyOn(window, 'setInterval').mockReturnValue(11);

    const monitor = new PerformanceMonitor();
    monitor.initialize(document.body);
    monitor.dispose();

    expect(requestFrame).toHaveBeenCalledOnce();
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(clearIntervalSpy).toHaveBeenCalledWith(11);
  });
});
