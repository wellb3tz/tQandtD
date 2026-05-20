import { describe, expect, it } from 'vitest';
import { WorkerPool } from '../src/world/worker-pool';
import type { WorkerResponse } from '../src/worker';
import { makeMinimalConfig } from './helpers';

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: unknown[] = [];
  terminated = false;

  postMessage(message: { type: string; chunkX?: number; chunkY?: number }): void {
    this.messages.push(message);

    if (message.type === 'generateChunk') {
      const size = 1;
      const response: WorkerResponse = {
        type: 'chunkReady',
        chunkX: message.chunkX ?? 0,
        chunkY: message.chunkY ?? 0,
        chunk: {
          x: message.chunkX ?? 0,
          y: message.chunkY ?? 0,
          size,
          heightmap: new Float32Array((size + 1) * (size + 1)).buffer,
          biomeMap: new Uint8Array(size * size).buffer,
          sparseBiomeTypes: new Uint8Array([0]).buffer,
          sparseBiomeWeights: new Float32Array([1]).buffer,
          sparseBiomeOffsets: new Uint16Array([0, 1]).buffer,
          climateSnowLine: 0.84,
          climateTreeLine: 0.61,
          worldTemperatureOffset: -0.25,
          temperatureMap: new Float32Array([-0.45]).buffer,
          lakes: [],
          rivers: [{
            riverId: 'river_1',
            pathId: 'river_1:main',
            isTributary: false,
            state: 'frozen',
            points: [],
            bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
          }],
          resources: [],
          structures: [],
        },
      };

      this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>);
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

class ManualWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: Array<{ type: string; chunkX?: number; chunkY?: number }> = [];
  terminated = false;

  postMessage(message: { type: string; chunkX?: number; chunkY?: number }): void {
    this.messages.push(message);
  }

  sendChunkReady(chunkX: number, chunkY: number): void {
    const size = 1;
    this.onmessage?.({
      data: {
        type: 'chunkReady',
        chunkX,
        chunkY,
        chunk: {
          x: chunkX,
          y: chunkY,
          size,
          heightmap: new Float32Array((size + 1) * (size + 1)).buffer,
          biomeMap: new Uint8Array(size * size).buffer,
          sparseBiomeTypes: new Uint8Array([0]).buffer,
          sparseBiomeWeights: new Float32Array([1]).buffer,
          sparseBiomeOffsets: new Uint16Array([0, 1]).buffer,
          climateSnowLine: 0.84,
          climateTreeLine: 0.61,
          worldTemperatureOffset: -0.25,
          temperatureMap: new Float32Array([-0.45]).buffer,
          lakes: [],
          rivers: [],
          resources: [],
          structures: [],
        },
      },
    } as MessageEvent<WorkerResponse>);
  }

  sendWorkerError(message: string): void {
    this.onmessage?.({ data: { type: 'error', message } } as MessageEvent<WorkerResponse>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('WorkerPool', () => {
  it('uses the provided worker factory and initializes workers', async () => {
    const workers: FakeWorker[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerScriptUrl: 'ignored-by-factory.js',
      taskTimeout: 1000,
      worldConfig: makeMinimalConfig(42),
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });

    expect(workers).toHaveLength(1);
    expect(workers[0].messages[0]).toMatchObject({ type: 'init' });
    expect(pool.getInitializationError()).toBeNull();

    const chunk = await new Promise((resolve, reject) => {
      pool.submitTask({
        id: '',
        chunkX: 2,
        chunkY: 3,
        lodLevel: 0,
        priority: 1,
        onComplete: resolve,
        onError: reject,
      });
    });

    expect(chunk).toMatchObject({ x: 2, y: 3, size: 1 });
    expect(chunk).toMatchObject({
      climateSnowLine: 0.84,
      climateTreeLine: 0.61,
      worldTemperatureOffset: -0.25,
    });
    expect((chunk as any).temperatureMap[0]).toBeCloseTo(-0.45);
    expect((chunk as any).rivers[0].state).toBe('frozen');
    expect(pool.getStats().completedTasks).toBe(1);

    pool.shutdown();
    expect(workers[0].terminated).toBe(true);
  });

  it('reports worker errors and continues with the next queued task', async () => {
    const workers: ManualWorker[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerScriptUrl: 'ignored-by-factory.js',
      taskTimeout: 1000,
      worldConfig: makeMinimalConfig(42),
      createWorker: () => {
        const worker = new ManualWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });

    const first = new Promise((resolve, reject) => {
      pool.submitTask({
        id: '',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: resolve,
        onError: reject,
      });
    });

    const second = new Promise((resolve, reject) => {
      pool.submitTask({
        id: '',
        chunkX: 1,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: resolve,
        onError: reject,
      });
    });

    workers[0].sendWorkerError('boom');
    await expect(first).rejects.toThrow('boom');

    expect(workers[0].messages.at(-1)).toMatchObject({ type: 'generateChunk', chunkX: 1, chunkY: 0 });
    workers[0].sendChunkReady(1, 0);

    await expect(second).resolves.toMatchObject({ x: 1, y: 0 });
    expect(pool.getStats().completedTasks).toBe(1);

    pool.shutdown();
  });

  it('can cancel a queued task before it is assigned', () => {
    const workers: ManualWorker[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerScriptUrl: 'ignored-by-factory.js',
      taskTimeout: 1000,
      worldConfig: makeMinimalConfig(42),
      createWorker: () => {
        const worker = new ManualWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });

    pool.submitTask({
      id: '',
      chunkX: 0,
      chunkY: 0,
      lodLevel: 0,
      priority: 1,
      onComplete: () => undefined,
      onError: () => undefined,
    });

    const taskId = pool.submitTask({
      id: '',
      chunkX: 2,
      chunkY: 0,
      lodLevel: 0,
      priority: 1,
      onComplete: () => undefined,
      onError: () => undefined,
    });

    expect(pool.cancelTask(taskId)).toBe(true);
    expect(pool.getStats().queuedTasks).toBe(0);

    workers[0].sendChunkReady(0, 0);
    expect(workers[0].messages.filter(message => message.type === 'generateChunk')).toHaveLength(1);

    pool.shutdown();
  });
});
