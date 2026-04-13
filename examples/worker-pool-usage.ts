/**
 * Worker Pool Usage Example
 * 
 * Demonstrates how to use the WorkerPool for parallel chunk generation.
 * The worker pool manages multiple Web Workers to generate chunks concurrently,
 * improving performance on multi-core systems.
 * 
 * Note: This example shows the API usage. Actual worker implementation
 * requires a separate worker script file.
 */

import {
  WorkerPool,
  type WorkerPoolConfig,
  type WorkerTask,
  type ChunkData,
} from '../src/index';

console.log('=== Worker Pool Usage Example ===\n');

// Example 1: Basic Worker Pool Setup
console.log('Example 1: Basic Worker Pool Setup');
console.log('===================================\n');

// Note: In a real application, you would provide a valid worker script URL
const workerScriptUrl = './worker.js'; // Path to your worker script

const poolConfig: WorkerPoolConfig = {
  maxWorkers: 4, // Use 4 worker threads
  workerScriptUrl,
  taskTimeout: 30000, // 30 second timeout
};

console.log('Worker Pool Configuration:');
console.log(`  Max Workers: ${poolConfig.maxWorkers}`);
console.log(`  Worker Script: ${poolConfig.workerScriptUrl}`);
console.log(`  Task Timeout: ${poolConfig.taskTimeout}ms`);

// Create worker pool (commented out as it requires actual worker script)
// const pool = new WorkerPool(poolConfig);

console.log('\nWorker pool created successfully!');
console.log('Note: Actual initialization requires a valid worker script.');

// Example 2: Submitting Tasks
console.log('\n\nExample 2: Submitting Tasks');
console.log('============================\n');

console.log('Task submission example:');
console.log(`
const task: WorkerTask = {
  id: 'chunk-0-0',
  chunkX: 0,
  chunkY: 0,
  lodLevel: 0, // LODLevel.HIGH
  priority: 1,
  onComplete: (chunk: ChunkData) => {
    console.log(\`Chunk (\${chunk.x}, \${chunk.y}) generated\`);
    console.log(\`  Heightmap size: \${chunk.heightmap.length}\`);
    console.log(\`  Resources: \${chunk.resources.length}\`);
    console.log(\`  Structures: \${chunk.structures.length}\`);
  },
  onError: (error: Error) => {
    console.error(\`Task failed: \${error.message}\`);
  },
};

const taskId = pool.submitTask(task);
console.log(\`Task submitted with ID: \${taskId}\`);
`);

// Example 3: Priority-Based Task Queue
console.log('\n\nExample 3: Priority-Based Task Queue');
console.log('=====================================\n');

console.log('Tasks are processed based on priority (higher = more urgent):');
console.log(`
// High priority - chunks near player
pool.submitTask({
  id: 'chunk-near-1',
  chunkX: 0,
  chunkY: 0,
  lodLevel: 0,
  priority: 10, // High priority
  onComplete: (chunk) => { /* ... */ },
  onError: (error) => { /* ... */ },
});

// Medium priority - chunks at medium distance
pool.submitTask({
  id: 'chunk-medium-1',
  chunkX: 5,
  chunkY: 5,
  lodLevel: 1,
  priority: 5, // Medium priority
  onComplete: (chunk) => { /* ... */ },
  onError: (error) => { /* ... */ },
});

// Low priority - chunks far from player
pool.submitTask({
  id: 'chunk-far-1',
  chunkX: 10,
  chunkY: 10,
  lodLevel: 2,
  priority: 1, // Low priority
  onComplete: (chunk) => { /* ... */ },
  onError: (error) => { /* ... */ },
});
`);

console.log('High priority tasks are processed first!');

// Example 4: Task Cancellation
console.log('\n\nExample 4: Task Cancellation');
console.log('=============================\n');

console.log('Cancel tasks that are no longer needed:');
console.log(`
// Submit a task
const taskId = pool.submitTask({
  id: 'chunk-to-cancel',
  chunkX: 20,
  chunkY: 20,
  lodLevel: 0,
  priority: 1,
  onComplete: (chunk) => { /* ... */ },
  onError: (error) => { /* ... */ },
});

// Later, if the chunk is no longer needed (e.g., player moved away)
const cancelled = pool.cancelTask(taskId);
if (cancelled) {
  console.log('Task cancelled successfully');
} else {
  console.log('Task already completed or not found');
}
`);

console.log('Cancellation is useful for:');
console.log('  - Player movement (cancel distant chunks)');
console.log('  - Scene changes (cancel all pending tasks)');
console.log('  - Resource management (limit active tasks)');

// Example 5: Pool Statistics
console.log('\n\nExample 5: Pool Statistics');
console.log('==========================\n');

console.log('Monitor worker pool performance:');
console.log(`
const stats = pool.getStats();
console.log('Worker Pool Statistics:');
console.log(\`  Total Workers: \${stats.totalWorkers}\`);
console.log(\`  Active Workers: \${stats.activeWorkers}\`);
console.log(\`  Queued Tasks: \${stats.queuedTasks}\`);
console.log(\`  Completed Tasks: \${stats.completedTasks}\`);

// Calculate utilization
const utilization = (stats.activeWorkers / stats.totalWorkers) * 100;
console.log(\`  Worker Utilization: \${utilization.toFixed(1)}%\`);
`);

console.log('\nUse statistics for:');
console.log('  - Performance monitoring');
console.log('  - Load balancing decisions');
console.log('  - Debugging task bottlenecks');

// Example 6: Graceful Shutdown
console.log('\n\nExample 6: Graceful Shutdown');
console.log('=============================\n');

console.log('Shut down the worker pool when done:');
console.log(`
// Terminate all workers and clean up resources
pool.shutdown();
console.log('Worker pool shut down');
`);

console.log('\nShutdown:');
console.log('  - Terminates all worker threads');
console.log('  - Clears task queue');
console.log('  - Releases resources');
console.log('  - Should be called when application closes');

// Example 7: Practical Usage Pattern
console.log('\n\nExample 7: Practical Usage Pattern');
console.log('===================================\n');

console.log('Complete example for chunk loading system:');
console.log(`
class ChunkLoader {
  private pool: WorkerPool;
  private loadedChunks: Map<string, ChunkData>;
  
  constructor() {
    this.pool = new WorkerPool({
      maxWorkers: navigator.hardwareConcurrency || 4,
      workerScriptUrl: './chunk-worker.js',
      taskTimeout: 30000,
    });
    this.loadedChunks = new Map();
  }
  
  loadChunk(x: number, y: number, priority: number = 1): void {
    const key = \`\${x},\${y}\`;
    
    // Skip if already loaded
    if (this.loadedChunks.has(key)) {
      return;
    }
    
    // Submit generation task
    this.pool.submitTask({
      id: \`chunk-\${key}\`,
      chunkX: x,
      chunkY: y,
      lodLevel: this.calculateLOD(x, y),
      priority,
      onComplete: (chunk) => {
        this.loadedChunks.set(key, chunk);
        this.onChunkLoaded(chunk);
      },
      onError: (error) => {
        console.error(\`Failed to load chunk \${key}: \${error.message}\`);
      },
    });
  }
  
  unloadChunk(x: number, y: number): void {
    const key = \`\${x},\${y}\`;
    this.loadedChunks.delete(key);
    
    // Cancel if still in queue
    this.pool.cancelTask(\`chunk-\${key}\`);
  }
  
  updatePlayerPosition(playerX: number, playerY: number): void {
    const chunkX = Math.floor(playerX / 32);
    const chunkY = Math.floor(playerY / 32);
    const loadRadius = 3;
    
    // Load chunks around player
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      for (let dy = -loadRadius; dy <= loadRadius; dy++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        const priority = Math.max(1, 10 - Math.floor(distance));
        this.loadChunk(chunkX + dx, chunkY + dy, priority);
      }
    }
    
    // Unload distant chunks
    for (const [key, chunk] of this.loadedChunks.entries()) {
      const dx = chunk.x - chunkX;
      const dy = chunk.y - chunkY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > loadRadius + 1) {
        this.unloadChunk(chunk.x, chunk.y);
      }
    }
  }
  
  private calculateLOD(x: number, y: number): number {
    // Calculate LOD based on distance from player
    // Implementation depends on your LOD system
    return 0; // LODLevel.HIGH
  }
  
  private onChunkLoaded(chunk: ChunkData): void {
    // Handle chunk loaded event (e.g., update rendering)
    console.log(\`Chunk (\${chunk.x}, \${chunk.y}) loaded\`);
  }
  
  shutdown(): void {
    this.pool.shutdown();
  }
}

// Usage
const loader = new ChunkLoader();
loader.updatePlayerPosition(100, 100);
`);

// Example 8: Worker Pool Best Practices
console.log('\n\nExample 8: Worker Pool Best Practices');
console.log('======================================\n');

console.log('1. Worker Count:');
console.log('   - Use navigator.hardwareConcurrency for optimal performance');
console.log('   - Typical values: 4-16 workers on modern systems');
console.log('   - More workers = better parallelism, but more memory');

console.log('\n2. Task Priority:');
console.log('   - Assign higher priority to chunks near the player');
console.log('   - Use distance-based priority calculation');
console.log('   - Update priorities as player moves');

console.log('\n3. Task Timeout:');
console.log('   - Set reasonable timeout (30-60 seconds)');
console.log('   - Prevents hung workers from blocking the pool');
console.log('   - Log timeout errors for debugging');

console.log('\n4. Error Handling:');
console.log('   - Always provide onError callback');
console.log('   - Log errors for debugging');
console.log('   - Consider retry logic for transient failures');

console.log('\n5. Resource Management:');
console.log('   - Shut down pool when application closes');
console.log('   - Cancel unnecessary tasks to free workers');
console.log('   - Monitor pool statistics for bottlenecks');

console.log('\n6. LOD Integration:');
console.log('   - Generate distant chunks at lower LOD');
console.log('   - Reduces generation time and memory usage');
console.log('   - Improves overall responsiveness');

console.log('\n✓ Worker pool examples complete!');
console.log('\nKey Takeaways:');
console.log('  - WorkerPool manages parallel chunk generation');
console.log('  - Priority-based task queue ensures important chunks load first');
console.log('  - Task cancellation prevents wasted work');
console.log('  - Statistics help monitor performance');
console.log('  - Integrate with LOD system for optimal performance');
console.log('  - Always shut down pool when done');
