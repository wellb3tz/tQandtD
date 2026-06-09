import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  disposeGeometryWorkerManager,
  getGeometryWorkerManager,
  getGeometryWorkerManagerStatus,
} from './GeometryWorkerManager';

describe('GeometryWorkerManager', () => {
  afterEach(() => {
    disposeGeometryWorkerManager();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports waiting before the shared manager is created', () => {
    expect(getGeometryWorkerManagerStatus()).toMatchObject({
      mode: 'waiting',
      workerCount: 0,
      pendingTasks: 0,
    });
  });

  it('reports a running worker after instantiation', () => {
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      addEventListener(): void {}
      postMessage(): void {}
      terminate(): void {}
    }

    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);

    getGeometryWorkerManager();

    expect(getGeometryWorkerManagerStatus()).toMatchObject({
      mode: 'worker',
      workerCount: 1,
      pendingTasks: 0,
    });
  });
});
