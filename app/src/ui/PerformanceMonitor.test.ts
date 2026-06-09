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

  it('renders worker pool and geometry worker status text', () => {
    document.body.innerHTML = `
      <canvas id="fps-graph"></canvas>
      <span id="worker-pool-status-value"></span>
      <span id="worker-manager-status-value"></span>
      <span id="worker-manager-pending-value"></span>
    `;
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    vi.spyOn(window, 'setInterval').mockReturnValue(11);

    const monitor = new PerformanceMonitor();
    monitor.initialize(document.body);
    monitor.updateWorkerSystemStatus({
      workerPool: { state: 'running', totalWorkers: 4 },
      geometryWorker: { mode: 'worker', workerCount: 1, pendingTasks: 2 },
    });

    expect(document.getElementById('worker-pool-status-value')?.textContent).toBe('running (4)');
    expect(document.getElementById('worker-manager-status-value')?.textContent).toBe('running (1)');
    expect(document.getElementById('worker-manager-pending-value')?.textContent).toBe('2');

    monitor.dispose();
  });
});
