import type { ChunkData } from './chunk.js';
import { logger, LogCategory } from '../utils/logger';

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Maximum number of worker threads (default: navigator.hardwareConcurrency) */
  maxWorkers: number;
  /** Worker script URL */
  workerScriptUrl: string;
  /** Timeout for worker tasks in ms (default: 30000) */
  taskTimeout: number;
  /** World configuration to send to workers */
  worldConfig?: any;
}

/**
 * Worker task data
 */
export interface WorkerTask {
  /** Unique task ID */
  id: string;
  /** Chunk coordinates */
  chunkX: number;
  chunkY: number;
  /** LOD level */
  lodLevel: number;
  /** Task priority (higher = more urgent) */
  priority: number;
  /** Callback for task completion */
  onComplete: (chunk: ChunkData) => void;
  /** Callback for task error */
  onError: (error: Error) => void;
}

/**
 * Worker state tracking
 */
export interface WorkerState {
  /** Worker instance */
  worker: Worker;
  /** Currently assigned task (null if idle) */
  currentTask: WorkerTask | null;
  /** Number of completed tasks */
  completedTasks: number;
}

/**
 * Worker pool for parallel chunk generation
 */
export class WorkerPool {
  private config: WorkerPoolConfig;
  private workers: WorkerState[];
  private taskQueue: WorkerTask[];
  private activeTasks: Map<string, WorkerTask>;
  private taskIdCounter: number;
  private initialized: boolean;
  private initializationError: Error | null;

  /**
   * Creates a new WorkerPool
   * @param config - Worker pool configuration
   */
  constructor(config: WorkerPoolConfig) {
    this.config = config;
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.taskIdCounter = 0;
    this.initialized = false;
    this.initializationError = null;

    // Initialize workers
    for (let i = 0; i < config.maxWorkers; i++) {
      try {
        const worker = new (globalThis as any).Worker(config.workerScriptUrl, { type: 'module' }) as Worker;
        
        // Set up message handler for this worker
        worker.onmessage = (event: MessageEvent) => {
          this.handleTaskComplete(i, event.data);
        };

        // Set up error handler for this worker
        worker.onerror = (error: ErrorEvent) => {
          logger.error(LogCategory.WORKER, `Worker ${i} error: ${error.message}`, {
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno,
            error: error.error
          });
          
          // Mark initialization as failed
          if (!this.initialized) {
            this.initializationError = new Error(`Worker ${i} failed to load: ${error.message}`);
          }
          
          this.handleTaskError(i, new Error(error.message || 'Worker error'));
        };

        this.workers.push({
          worker,
          currentTask: null,
          completedTasks: 0,
        });
        
        // Initialize worker with world config if provided
        // CRITICAL: Remove workerPoolConfig to prevent recursive WorkerPool creation
        if (config.worldConfig) {
          const { workerPoolConfig, ...configWithoutWorkerPool } = config.worldConfig;
          worker.postMessage({
            type: 'init',
            config: configWithoutWorkerPool,
          });
        }
      } catch (error) {
        logger.error(LogCategory.WORKER, `Failed to create worker ${i}`, error);
        this.initializationError = error as Error;
        throw error;
      }
    }
    
    // Mark as initialized if no errors occurred
    this.initialized = true;
    logger.info(LogCategory.WORKER, `Successfully initialized ${this.workers.length} workers`);
    
    // Wait a bit to see if workers fail to load
    setTimeout(() => {
      if (this.initializationError) {
        logger.error(LogCategory.WORKER, 'Workers failed to load after initialization');
      }
    }, 100);
  }

  /**
   * Submits a chunk generation task to the pool
   * @param task - Worker task data
   * @returns Task ID for tracking
   */
  submitTask(task: WorkerTask): string {
    // Check if pool is initialized
    if (!this.initialized || this.initializationError) {
      logger.error(LogCategory.WORKER, 'Cannot submit task - pool not initialized', this.initializationError);
      // Immediately call error callback
      task.onError(this.initializationError || new Error('Worker pool not initialized'));
      return '';
    }
    // Generate task ID if not provided
    if (!task.id) {
      task.id = `task-${this.taskIdCounter++}`;
    }

    // Add to queue with priority ordering
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    // Track as active task
    this.activeTasks.set(task.id, task);

    // Try to assign immediately if workers are available
    this.assignNextTask();

    return task.id;
  }

  /**
   * Cancels a pending or active task
   * @param taskId - Task ID to cancel
   * @returns True if task was cancelled
   */
  cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    // Remove from queue if pending
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      this.activeTasks.delete(taskId);
      return true;
    }

    // If task is currently executing, we can't cancel it
    // (Worker API doesn't support task cancellation)
    // But we can remove it from active tasks so the result is ignored
    const workerState = this.workers.find(w => w.currentTask?.id === taskId);
    if (workerState) {
      this.activeTasks.delete(taskId);
      return true;
    }

    return false;
  }

  /**
   * Gets pool statistics
   * @returns Object with pool statistics
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    queuedTasks: number;
    completedTasks: number;
  } {
    const activeWorkers = this.workers.filter(w => w.currentTask !== null).length;
    const completedTasks = this.workers.reduce((sum, w) => sum + w.completedTasks, 0);

    return {
      totalWorkers: this.workers.length,
      activeWorkers,
      queuedTasks: this.taskQueue.length,
      completedTasks,
    };
  }

  /**
   * Shuts down all workers
   */
  shutdown(): void {
    for (const workerState of this.workers) {
      workerState.worker.terminate();
    }
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
  }

  /**
   * Assigns next task from queue to an idle worker
   */
  private assignNextTask(): void {
    // Find an idle worker
    const idleWorker = this.workers.find(w => w.currentTask === null);
    if (!idleWorker || this.taskQueue.length === 0) {
      return;
    }

    // Get highest priority task from queue
    const task = this.taskQueue.shift()!;
    idleWorker.currentTask = task;

    // Send task to worker
    idleWorker.worker.postMessage({
      type: 'generateChunk',
      chunkX: task.chunkX,
      chunkY: task.chunkY,
      lodLevel: task.lodLevel,
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.handleTaskError(
        this.workers.indexOf(idleWorker),
        new Error(`Task ${task.id} timed out after ${this.config.taskTimeout}ms`)
      );
    }, this.config.taskTimeout);

    // Store timeout ID on task for cleanup
    (task as any).timeoutId = timeoutId;
  }

  /**
   * Handles task completion from worker
   * @param workerId - Worker index
   * @param result - Worker response message
   */
  private handleTaskComplete(workerId: number, result: any): void {
    const workerState = this.workers[workerId];
    const task = workerState.currentTask;

    if (!task) {
      return;
    }

    // Handle different message types from worker
    if (result.type === 'ready') {
      // Worker initialized successfully
      logger.debug(LogCategory.WORKER, `Worker ${workerId} initialized`);
      return;
    }

    if (result.type === 'error') {
      // Worker reported an error
      this.handleTaskError(workerId, new Error(result.message));
      return;
    }

    if (result.type !== 'chunkReady') {
      // Unknown message type
      logger.warn(LogCategory.WORKER, `Unknown message type from worker ${workerId}: ${result.type}`);
      return;
    }

    // Clear timeout
    if ((task as any).timeoutId) {
      clearTimeout((task as any).timeoutId);
    }

    // Check if task was cancelled
    if (!this.activeTasks.has(task.id)) {
      // Task was cancelled, ignore result
      workerState.currentTask = null;
      this.assignNextTask();
      return;
    }

    // Update worker state
    workerState.currentTask = null;
    workerState.completedTasks++;

    // Remove from active tasks
    this.activeTasks.delete(task.id);

    // Deserialize chunk data from worker
    // The worker sends serialized chunk data that needs to be converted back
    const chunkData = this.deserializeChunkData(result.chunk);

    // Call completion callback
    try {
      task.onComplete(chunkData);
    } catch (error) {
      logger.error(LogCategory.WORKER, `Error in task completion callback: ${error}`);
    }

    // Assign next task if available
    this.assignNextTask();
  }

  /**
   * Deserializes chunk data received from worker
   * @param serialized - Serialized chunk data from worker
   * @returns Deserialized ChunkData
   */
  private deserializeChunkData(serialized: any): ChunkData {
    return {
      x: serialized.x,
      y: serialized.y,
      size: serialized.size,
      heightmap: new Float32Array(serialized.heightmap),
      biomeMap: new Uint8Array(serialized.biomeMap),
      sparseBiomeTypes: new Uint8Array(serialized.sparseBiomeTypes),
      sparseBiomeWeights: new Float32Array(serialized.sparseBiomeWeights),
      sparseBiomeOffsets: new Uint16Array(serialized.sparseBiomeOffsets),
      lakes: (serialized.lakes ?? []).map((lake: any) => ({
        waterLevel: lake.waterLevel,
        tiles: new Set<number>(lake.tiles),
        maxDepth: lake.maxDepth,
        minTerrainHeight: lake.minTerrainHeight,
      })),
      resources: serialized.resources,
      structures: serialized.structures,
    };
  }

  /**
   * Handles task error from worker
   * @param workerId - Worker index
   * @param error - Error object
   */
  private handleTaskError(workerId: number, error: Error): void {
    const workerState = this.workers[workerId];
    const task = workerState.currentTask;

    if (!task) {
      return;
    }

    // Clear timeout
    if ((task as any).timeoutId) {
      clearTimeout((task as any).timeoutId);
    }

    // Check if task was cancelled
    if (!this.activeTasks.has(task.id)) {
      // Task was cancelled, ignore error
      workerState.currentTask = null;
      this.assignNextTask();
      return;
    }

    // Update worker state
    workerState.currentTask = null;

    // Remove from active tasks
    this.activeTasks.delete(task.id);

    // Call error callback
    try {
      task.onError(error);
    } catch (callbackError) {
      logger.error(LogCategory.WORKER, `Error in task error callback: ${callbackError}`);
    }

    // Assign next task if available
    this.assignNextTask();
  }
}
