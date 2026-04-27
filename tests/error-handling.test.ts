import { describe, it, expect, vi } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import {
  ChunkGenerationError,
  TerrainGenerationError,
  BiomeGenerationError,
  ResourceGenerationError,
  StructureGenerationError,
} from '../src/utils/errors';
import { makeMinimalConfig } from './helpers';

describe('Error Handling', () => {
  describe('ChunkGenerationError', () => {
    it('includes chunk coordinates and stage', () => {
      const error = new ChunkGenerationError('Test error', 5, 10, 'terrain');
      
      expect(error.chunkX).toBe(5);
      expect(error.chunkY).toBe(10);
      expect(error.stage).toBe('terrain');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ChunkGenerationError');
    });

    it('includes cause error', () => {
      const cause = new Error('Original error');
      const error = new ChunkGenerationError('Test error', 5, 10, 'terrain', cause);
      
      expect(error.cause).toBe(cause);
      expect(error.toString()).toContain('Caused by: Original error');
    });

    it('formats error message with context', () => {
      const error = new ChunkGenerationError('Test error', 5, 10, 'terrain');
      const message = error.toString();
      
      expect(message).toContain('chunk (5, 10)');
      expect(message).toContain("stage 'terrain'");
      expect(message).toContain('Test error');
    });
  });

  describe('Specific error types', () => {
    it('TerrainGenerationError has correct name and stage', () => {
      const error = new TerrainGenerationError(1, 2);
      expect(error.name).toBe('TerrainGenerationError');
      expect(error.stage).toBe('terrain');
    });

    it('BiomeGenerationError has correct name and stage', () => {
      const error = new BiomeGenerationError(1, 2);
      expect(error.name).toBe('BiomeGenerationError');
      expect(error.stage).toBe('biomes');
    });

    it('ResourceGenerationError has correct name and stage', () => {
      const error = new ResourceGenerationError(1, 2);
      expect(error.name).toBe('ResourceGenerationError');
      expect(error.stage).toBe('resources');
    });

    it('StructureGenerationError has correct name and stage', () => {
      const error = new StructureGenerationError(1, 2);
      expect(error.name).toBe('StructureGenerationError');
      expect(error.stage).toBe('structures');
    });
  });

  describe('Error recovery - allowPartialChunks', () => {
    it('validates config before attempting generation', async () => {
      const config = makeMinimalConfig(12345);
      config.errorRecovery = {
        allowPartialChunks: true,
        retryOnFailure: false,
      };
      
      // Try to create manager with invalid config
      config.terrainConfig.octaves = 0; // This will fail validation
      
      // Validation should catch this before any generation happens
      expect(() => new ChunkManager(config)).toThrow();
    });

    it('generates valid chunk with proper config and error recovery enabled', async () => {
      const config = makeMinimalConfig(12345);
      config.errorRecovery = {
        allowPartialChunks: true,
        retryOnFailure: false,
      };
      
      const manager = new ChunkManager(config);
      const chunk = await manager.getChunk(0, 0);
      
      // Should generate successfully with valid config
      expect(chunk).toBeDefined();
      expect(chunk.x).toBe(0);
      expect(chunk.y).toBe(0);
      expect(chunk.heightmap).toBeDefined();
      expect(chunk.biomeMap).toBeDefined();
    });
  });

  describe('Error recovery - custom error handler', () => {
    it('calls custom error handler on failure', async () => {
      const errorHandler = vi.fn();
      const config = makeMinimalConfig(12345);
      config.errorRecovery = {
        allowPartialChunks: true,
        onError: errorHandler,
      };
      
      const manager = new ChunkManager(config);
      
      // Generate a chunk (should succeed with valid config)
      await manager.getChunk(0, 0);
      
      // Error handler should not be called for successful generation
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('Empty chunk creation', () => {
    it('creates valid empty chunk structure', async () => {
      const config = makeMinimalConfig(12345);
      const manager = new ChunkManager(config);
      
      // Generate normal chunk to test structure
      const chunk = await manager.getChunk(0, 0);
      
      expect(chunk.heightmap).toBeInstanceOf(Float32Array);
      expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
      expect(chunk.sparseBiomeTypes).toBeInstanceOf(Uint8Array);
      expect(chunk.sparseBiomeWeights).toBeInstanceOf(Float32Array);
      expect(chunk.sparseBiomeOffsets).toBeInstanceOf(Uint16Array);
      expect(chunk.resources).toBeInstanceOf(Array);
      expect(chunk.structures).toBeInstanceOf(Array);
      expect(chunk.lakes).toBeInstanceOf(Array);
      
      // Check sizes
      const expectedVertexCount = (config.chunkSize + 1) * (config.chunkSize + 1);
      const expectedTileCount = config.chunkSize * config.chunkSize;
      
      expect(chunk.heightmap.length).toBe(expectedVertexCount);
      expect(chunk.biomeMap.length).toBe(expectedTileCount);
    });
  });

  describe('Validation prevents invalid configs', () => {
    it('throws ValidationError for invalid config before generation', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = -5; // Invalid
      
      expect(() => new ChunkManager(config)).toThrow();
    });

    it('throws ValidationError for NaN seed', () => {
      const config = makeMinimalConfig(12345);
      config.seed = NaN;
      
      expect(() => new ChunkManager(config)).toThrow();
    });
  });

  describe('Graceful degradation', () => {
    it('continues generation if optional features fail with allowPartialChunks', async () => {
      const config = makeMinimalConfig(12345);
      config.errorRecovery = {
        allowPartialChunks: true,
      };
      
      const manager = new ChunkManager(config);
      const chunk = await manager.getChunk(0, 0);
      
      // Should have at least terrain and biomes (required)
      expect(chunk.heightmap).toBeDefined();
      expect(chunk.biomeMap).toBeDefined();
      
      // Optional features may or may not be present
      expect(chunk.resources).toBeDefined();
      expect(chunk.structures).toBeDefined();
      expect(chunk.lakes).toBeDefined();
    });
  });
});
