import type { WorldApp } from './WorldApp';
import { getGeometryWorkerManagerStatus, type GeometryWorkerManagerStatus } from '../viewer/GeometryWorkerManager';

export interface WorkerPoolRuntimeStatus {
  state: 'off' | 'starting' | 'running' | 'error';
  totalWorkers: number;
}

export interface WorkerSystemRuntimeStatus {
  workerPool: WorkerPoolRuntimeStatus;
  geometryWorker: GeometryWorkerManagerStatus;
}

export function buildWorkerSystemStatus(app: WorldApp): WorkerSystemRuntimeStatus {
  const workerPoolStats = app.getWorkerPoolStats();
  const initializationError = app.getWorldSession()?.getWorld().getWorkerPoolInitializationError();

  let poolState: WorkerPoolRuntimeStatus['state'] = 'off';
  if (initializationError) {
    poolState = 'error';
  } else if (workerPoolStats.totalWorkers > 0) {
    poolState = 'running';
  } else if (app.isWorkerPoolEnabled()) {
    poolState = 'starting';
  }

  return {
    workerPool: {
      state: poolState,
      totalWorkers: workerPoolStats.totalWorkers,
    },
    geometryWorker: getGeometryWorkerManagerStatus(),
  };
}
