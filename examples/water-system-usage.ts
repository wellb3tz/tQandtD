/**
 * Water System Usage Example
 * 
 * Demonstrates how to configure and use the comprehensive water rendering system.
 */

import { ChunkManager } from '../src/world/chunk-manager';
import type { WaterConfig } from '../demo/src/viewer/water/types';

// Basic water system configuration
const waterConfig: Partial<WaterConfig> = {
  enabled: true,
  seaLevel: 0.3,
  
  // Ocean configuration
  ocean: {
    color: 0x0066cc,
    opacity: 0.7,
    shininess: 80,
    enableWaves: false,
    waveHeight: 0,
    waveSpeed: 0,
  },
  
  // River configuration
  river: {
    color: 0x3399ff,
    opacity: 0.6,
  },
  
  // Lake configuration
  lake: {
    color: 0x4da6ff,
    opacity: 0.65,
  },
  
  // Rendering settings
  rendering: {
    waterOffset: 0.1,
    underwaterDarkenFactor: 0.4,
    underwaterDesaturationFactor: 0.5,
    enableDepthGradient: true,
  },
  
  // Performance optimizations
  performance: {
    enableLOD: true,
    enableFrustumCulling: true,
    lodDistances: {
      near: 200,
      medium: 500,
    },
  },
};

// Example: Generate world with water
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  rivers: {
    enabled: true,
    minLength: 10,
    maxBranches: 3,
  },
});

// Generate chunks
const chunk = chunkManager.generateChunk(0, 0);

console.log('Water System Configuration:');
console.log('- Ocean tiles:', chunk.heightmap.filter((h, i) => h < 0.3).length);
console.log('- River tiles:', chunk.rivers?.size || 0);
console.log('- Lake tiles:', chunk.riverNetwork?.lakes.reduce((sum, lake) => sum + lake.tiles.length, 0) || 0);

// In your viewer/renderer:
// viewer.setWaterConfig(waterConfig);
// viewer.setWaterVisibility(true);
