/**
 * Verification tests for tasks 3.8 and 3.9
 * Tests that DemoApp.loadChunksAround() continues through BIOMES before first render
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DemoApp } from './DemoApp';
import { GenerationStage } from '../../../src/world/chunk';

describe('DemoApp - Biome Fix Verification (Tasks 3.8 & 3.9)', () => {
  let app: DemoApp;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
  });

  afterEach(() => {
    app.destroy();
  });

  it('Task 3.8: should continue through BIOMES before first render', async () => {
    // Enable incremental generation
    app.updateEngineConfig({
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: 16
      }
    });

    // Track CHUNK_LOADED events
    const loadedEvents: any[] = [];
    app.on('chunk_loaded', (data) => {
      loadedEvents.push(data);
    });

    // Load a single chunk
    await app.loadChunksAround(0, 0, 0);

    // Verify at least one chunk was loaded
    expect(loadedEvents.length).toBeGreaterThan(0);

    // Verify the first loaded chunk has both heightmap and biomeMap
    const firstEvent = loadedEvents[0];
    expect(firstEvent.chunk.heightmap).toBeDefined();
    expect(firstEvent.chunk.biomeMap).toBeDefined();
    expect(firstEvent.chunk.biomeMap.length).toBeGreaterThan(0);

    // Verify the stage is at least RIVERS (meaning TERRAIN and BIOMES are complete)
    expect(firstEvent.stage).toBeGreaterThanOrEqual(GenerationStage.RIVERS);
  });

  it('Task 3.9: should update progress tracking after each continueGeneration() call', async () => {
    // Enable incremental generation
    app.updateEngineConfig({
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: 16
      }
    });

    // Load a single chunk
    await app.loadChunksAround(0, 0, 0);

    // Get the current state
    const state = app.getState();

    // Verify chunksInProgress map is updated
    // After loadChunksAround completes through BIOMES, the chunk should be in progress
    // with stage >= RIVERS
    const chunkKey = '0,0';
    const chunkStage = state.chunksInProgress.get(chunkKey);

    // The chunk should be tracked in progress
    expect(chunkStage).toBeDefined();

    // The stage should be at least RIVERS (TERRAIN and BIOMES complete)
    expect(chunkStage).toBeGreaterThanOrEqual(GenerationStage.RIVERS);
  });

  it('Task 3.8 & 3.9: should not emit CHUNK_LOADED if biomeMap is missing', async () => {
    // Enable incremental generation with very tight budget
    // This ensures stages might not complete in one call
    app.updateEngineConfig({
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: 1 // Very tight budget
      }
    });

    // Track CHUNK_LOADED events
    const loadedEvents: any[] = [];
    app.on('chunk_loaded', (data) => {
      loadedEvents.push(data);
    });

    // Load a single chunk
    await app.loadChunksAround(0, 0, 0);

    // Verify all emitted chunks have biomeMap
    for (const event of loadedEvents) {
      if (event.chunk.heightmap) {
        // If heightmap exists, biomeMap should also exist
        expect(event.chunk.biomeMap).toBeDefined();
        expect(event.chunk.biomeMap.length).toBeGreaterThan(0);
      }
    }
  });

  it('Task 3.9: should remove from progress map only when stage = COMPLETE', async () => {
    // Enable incremental generation
    app.updateEngineConfig({
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: 16
      }
    });

    // Load a single chunk
    await app.loadChunksAround(0, 0, 0);

    // Get initial state
    let state = app.getState();
    const chunkKey = '0,0';

    // Chunk should be in progress (not complete yet)
    expect(state.chunksInProgress.has(chunkKey)).toBe(true);

    // Continue generation until complete
    let iterations = 0;
    const maxIterations = 100;
    while (state.chunksInProgress.has(chunkKey) && iterations < maxIterations) {
      app.continueIncrementalGeneration();
      state = app.getState();
      iterations++;
    }

    // Verify chunk was removed from progress map after completion
    expect(state.chunksInProgress.has(chunkKey)).toBe(false);

    // Verify chunk is now in loadedChunks
    expect(state.loadedChunks.has(chunkKey)).toBe(true);
  });
});
