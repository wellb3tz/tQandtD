/**
 * Example: Using the Procedural World Engine with Web Workers
 * 
 * This example demonstrates how to use the engine in a Web Worker
 * for non-blocking chunk generation in browser environments.
 */

import {
  deserializeChunkData,
  type WorldConfig,
  BiomeType,
  ResourceType,
  StructureType,
} from '../src/index';

// ============================================================================
// WORKER SCRIPT (worker.js)
// ============================================================================
// 
// Create a separate file for your worker:
//
// ```typescript
// // worker.ts
// import { installWorkerHandler } from 'procedural-world-engine';
// 
// // This automatically sets up message handling
// installWorkerHandler();
// ```
//
// Or manually handle messages:
//
// ```typescript
// // worker.ts
// import { handleWorkerMessage } from 'procedural-world-engine';
// 
// self.addEventListener('message', handleWorkerMessage);
// ```

// ============================================================================
// MAIN THREAD
// ============================================================================

// Configuration for world generation
const worldConfig: WorldConfig = {
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0,
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
  },
  resourceConfig: {
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.1,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50,
      },
      {
        type: ResourceType.WOOD,
        rarity: 0.2,
        biomes: [BiomeType.FOREST, BiomeType.TAIGA],
        minAmount: 5,
        maxAmount: 20,
      },
    ],
    clusterScale: 20,
    densityThreshold: 0.5,
  },
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } },
        ],
      },
    ],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverNetworkConfig: {
    sourceElevation: 0.6,
    minFlowLength: 5,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5,
  },
};

// Example 1: Basic Worker Usage
function basicWorkerExample() {
  console.log('=== Basic Worker Usage ===\n');

  // Create a new worker
  const worker = new Worker('worker.js');

  // Initialize the worker with configuration
  worker.postMessage({
    type: 'init',
    config: worldConfig,
  });

  // Handle messages from worker
  worker.onmessage = (e) => {
    const message = e.data;

    switch (message.type) {
      case 'ready':
        console.log('Worker initialized and ready');
        
        // Request chunk generation
        worker.postMessage({
          type: 'generateChunk',
          chunkX: 0,
          chunkY: 0,
        });
        break;

      case 'chunkReady':
        console.log(`Chunk (${message.chunkX}, ${message.chunkY}) generated`);
        
        // Deserialize the chunk data
        const chunk = deserializeChunkData(message.chunk);
        
        console.log(`  Size: ${chunk.size}x${chunk.size}`);
        console.log(`  Resources: ${chunk.resources.length}`);
        console.log(`  Structures: ${chunk.structures.length}`);
        console.log(`  River tiles: ${chunk.rivers.size}`);
        
        // Use the chunk data...
        break;

      case 'error':
        console.error('Worker error:', message.message);
        if (message.stack) {
          console.error(message.stack);
        }
        break;
    }
  };

  // Handle worker errors
  worker.onerror = (error) => {
    console.error('Worker error:', error);
  };
}

// Example 2: Generating Multiple Chunks
function multipleChunksExample() {
  console.log('\n=== Generating Multiple Chunks ===\n');

  const worker = new Worker('worker.js');
  const chunks = new Map();

  worker.postMessage({
    type: 'init',
    config: worldConfig,
  });

  worker.onmessage = (e) => {
    const message = e.data;

    if (message.type === 'ready') {
      console.log('Worker ready, requesting chunks...');
      
      // Request multiple chunks
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          worker.postMessage({
            type: 'generateChunk',
            chunkX: x,
            chunkY: y,
          });
        }
      }
    } else if (message.type === 'chunkReady') {
      const chunk = deserializeChunkData(message.chunk);
      const key = `${message.chunkX},${message.chunkY}`;
      chunks.set(key, chunk);
      
      console.log(`Received chunk (${message.chunkX}, ${message.chunkY})`);
      
      // Check if all chunks are loaded
      if (chunks.size === 9) {
        console.log('\nAll chunks loaded!');
        console.log(`Total chunks: ${chunks.size}`);
        
        // Calculate total resources across all chunks
        let totalResources = 0;
        for (const chunk of chunks.values()) {
          totalResources += chunk.resources.length;
        }
        console.log(`Total resources: ${totalResources}`);
      }
    }
  };
}

// Example 3: Worker with Progress Tracking
function progressTrackingExample() {
  console.log('\n=== Worker with Progress Tracking ===\n');

  const worker = new Worker('worker.js');
  const pendingChunks = new Set<string>();
  const completedChunks = new Map();

  worker.postMessage({
    type: 'init',
    config: worldConfig,
  });

  worker.onmessage = (e) => {
    const message = e.data;

    if (message.type === 'ready') {
      // Request a grid of chunks
      const gridSize = 5;
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          const key = `${x},${y}`;
          pendingChunks.add(key);
          
          worker.postMessage({
            type: 'generateChunk',
            chunkX: x,
            chunkY: y,
          });
        }
      }
      
      console.log(`Requested ${pendingChunks.size} chunks`);
    } else if (message.type === 'chunkReady') {
      const key = `${message.chunkX},${message.chunkY}`;
      pendingChunks.delete(key);
      
      const chunk = deserializeChunkData(message.chunk);
      completedChunks.set(key, chunk);
      
      const progress = (completedChunks.size / (completedChunks.size + pendingChunks.size)) * 100;
      console.log(`Progress: ${progress.toFixed(1)}% (${completedChunks.size}/${completedChunks.size + pendingChunks.size})`);
      
      if (pendingChunks.size === 0) {
        console.log('\nGeneration complete!');
        
        // Analyze the generated world
        let totalHeight = 0;
        let totalResources = 0;
        let totalStructures = 0;
        
        for (const chunk of completedChunks.values()) {
          for (let i = 0; i < chunk.heightmap.length; i++) {
            totalHeight += chunk.heightmap[i];
          }
          totalResources += chunk.resources.length;
          totalStructures += chunk.structures.length;
        }
        
        const avgHeight = totalHeight / (completedChunks.size * 32 * 32);
        console.log(`Average height: ${avgHeight.toFixed(3)}`);
        console.log(`Total resources: ${totalResources}`);
        console.log(`Total structures: ${totalStructures}`);
      }
    }
  };
}

// Example 4: Clearing Worker Cache
function cacheClearingExample() {
  console.log('\n=== Cache Clearing Example ===\n');

  const worker = new Worker('worker.js');

  worker.postMessage({
    type: 'init',
    config: worldConfig,
  });

  worker.onmessage = (e) => {
    const message = e.data;

    if (message.type === 'ready') {
      console.log('Worker ready');
      
      // Generate some chunks
      worker.postMessage({ type: 'generateChunk', chunkX: 0, chunkY: 0 });
      worker.postMessage({ type: 'generateChunk', chunkX: 1, chunkY: 0 });
      
      // Clear cache after a delay
      setTimeout(() => {
        console.log('Clearing worker cache...');
        worker.postMessage({ type: 'clearCache' });
      }, 1000);
    } else if (message.type === 'chunkReady') {
      console.log(`Chunk (${message.chunkX}, ${message.chunkY}) generated`);
    } else if (message.type === 'cacheCleared') {
      console.log('Cache cleared successfully');
    }
  };
}

// Run examples (uncomment to test)
// Note: These examples require a browser environment with Web Worker support

// basicWorkerExample();
// multipleChunksExample();
// progressTrackingExample();
// cacheClearingExample();

console.log('Web Worker examples ready. Uncomment function calls to run in browser.');
