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
          lakes: [],
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
    expect(pool.getStats().completedTasks).toBe(1);

    pool.shutdown();
    expect(workers[0].terminated).toBe(true);
  });
});
