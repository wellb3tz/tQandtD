/**
 * LOD System Bug Exploration Test
 * 
 * This test is designed to FAIL on the current code to confirm the bug exists.
 * 
 * Bug: After applying LOD downsampling, the heightmap size doesn't match the expected size
 * based on data.size, causing rendering errors and incorrect terrain display.
 * 
 * Expected Result: This test should FAIL, confirming:
 * 1. Heightmap size mismatch after LOD downsampling
 * 2. data.size is not updated after downsampling
 * 3. Rendering code expects (size + 1) x (size + 1) heightmap for seamless boundaries
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LODManager, LODLevel } from '../src/world/lod';

describe('LOD System Bug Exploration', () => {
  describe('Heightmap Size Consistency After LOD', () => {
    it('should maintain correct heightmap size after LOD downsampling', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 64 }), // chunkSize
          fc.constantFrom(LODLevel.MEDIUM, LODLevel.LOW), // LOD level
          (chunkSize, lodLevel) => {
            // Create LOD manager with standard configuration
            const lodManager = new LODManager({
              distances: [2, 5],
              meshResolutions: [1.0, 0.5, 0.25],
              featureDensities: [1.0, 0.5, 0.1]
            });

            // Create a chunk with heightmap that has seamless boundaries
            // Original heightmap size: (chunkSize + 1) x (chunkSize + 1)
            const originalHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
            const heightmap = new Float32Array(originalHeightmapSize);
            
            // Fill with some test data
            for (let i = 0; i < originalHeightmapSize; i++) {
              heightmap[i] = Math.random();
            }

            const chunk = {
              x: 0,
              y: 0,
              size: chunkSize,
              heightmap,
              biomeMap: new Uint8Array(chunkSize * chunkSize),
              resources: [],
              structures: [],
              rivers: new Map()
            };

            // Apply LOD
            const lodChunk = lodManager.applyLOD(chunk, lodLevel);

            // Get the resolution multiplier for this LOD level
            const resolution = lodManager.getMeshResolution(lodLevel);
            const expectedNewSize = Math.max(1, Math.floor(chunkSize * resolution));

            // BUG CHECK 1: data.size should be updated after LOD
            // EXPECTED TO FAIL: Current code doesn't update data.size
            expect(lodChunk.size).toBe(expectedNewSize);

            // BUG CHECK 2: heightmap should have size (newSize + 1) x (newSize + 1)
            // for seamless boundaries
            const expectedHeightmapSize = (expectedNewSize + 1) * (expectedNewSize + 1);
            
            // EXPECTED TO FAIL: Current code creates heightmap of size newSize x newSize
            expect(lodChunk.heightmap.length).toBe(expectedHeightmapSize);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve seamless boundary structure in downsampled heightmap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 32 }), // chunkSize
          (chunkSize) => {
            const lodManager = new LODManager({
              distances: [2, 5],
              meshResolutions: [1.0, 0.5, 0.25],
              featureDensities: [1.0, 0.5, 0.1]
            });

            // Create heightmap with seamless boundaries
            const originalHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
            const heightmap = new Float32Array(originalHeightmapSize);
            
            // Fill with gradient pattern to verify interpolation
            for (let y = 0; y <= chunkSize; y++) {
              for (let x = 0; x <= chunkSize; x++) {
                heightmap[y * (chunkSize + 1) + x] = (x + y) / (chunkSize * 2);
              }
            }

            const chunk = {
              x: 0,
              y: 0,
              size: chunkSize,
              heightmap,
              biomeMap: new Uint8Array(chunkSize * chunkSize),
              resources: [],
              structures: [],
              rivers: new Map()
            };

            // Apply MEDIUM LOD (0.5 resolution)
            const lodChunk = lodManager.applyLOD(chunk, LODLevel.MEDIUM);
            
            const expectedNewSize = Math.max(1, Math.floor(chunkSize * 0.5));
            const expectedHeightmapSize = (expectedNewSize + 1) * (expectedNewSize + 1);

            // EXPECTED TO FAIL: heightmap size doesn't match expected size
            expect(lodChunk.heightmap.length).toBe(expectedHeightmapSize);

            // Verify heightmap can be indexed correctly for rendering
            // Rendering code expects to access heightmap[y * (size + 1) + x]
            // where x, y are in range [0, size]
            const verticesPerSide = lodChunk.size + 1;
            
            // Try to access all vertices that rendering code would access
            for (let y = 0; y <= lodChunk.size; y++) {
              for (let x = 0; x <= lodChunk.size; x++) {
                const index = y * verticesPerSide + x;
                
                // EXPECTED TO FAIL: index will be out of bounds
                expect(index).toBeLessThan(lodChunk.heightmap.length);
                
                // Should be able to read the value without error
                const height = lodChunk.heightmap[index];
                expect(height).toBeDefined();
                expect(typeof height).toBe('number');
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle edge case of 1x1 chunk after extreme downsampling', () => {
      const lodManager = new LODManager({
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.1]
      });

      // Small chunk that becomes 1x1 after LOW LOD (0.25 resolution)
      const chunkSize = 4;
      const originalHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
      const heightmap = new Float32Array(originalHeightmapSize);
      
      for (let i = 0; i < originalHeightmapSize; i++) {
        heightmap[i] = 0.5;
      }

      const chunk = {
        x: 0,
        y: 0,
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize),
        resources: [],
        structures: [],
        rivers: new Map()
      };

      // Apply LOW LOD (0.25 resolution)
      const lodChunk = lodManager.applyLOD(chunk, LODLevel.LOW);
      
      const expectedNewSize = Math.max(1, Math.floor(chunkSize * 0.25)); // = 1
      
      // For 1x1 chunk, heightmap should be 2x2 (for seamless boundaries)
      const expectedHeightmapSize = (expectedNewSize + 1) * (expectedNewSize + 1); // = 4

      // EXPECTED TO FAIL: Current code creates 1x1 heightmap instead of 2x2
      expect(lodChunk.size).toBe(expectedNewSize);
      expect(lodChunk.heightmap.length).toBe(expectedHeightmapSize);
    });

    it('should not cause rendering errors with various chunk sizes and LOD levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 64 }), // chunkSize
          fc.constantFrom(LODLevel.HIGH, LODLevel.MEDIUM, LODLevel.LOW),
          (chunkSize, lodLevel) => {
            const lodManager = new LODManager({
              distances: [2, 5],
              meshResolutions: [1.0, 0.5, 0.25],
              featureDensities: [1.0, 0.5, 0.1]
            });

            const originalHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
            const heightmap = new Float32Array(originalHeightmapSize);
            
            for (let i = 0; i < originalHeightmapSize; i++) {
              heightmap[i] = Math.random();
            }

            const chunk = {
              x: 0,
              y: 0,
              size: chunkSize,
              heightmap,
              biomeMap: new Uint8Array(chunkSize * chunkSize),
              resources: [],
              structures: [],
              rivers: new Map()
            };

            const lodChunk = lodManager.applyLOD(chunk, lodLevel);

            // Simulate what rendering code does
            const verticesPerSide = lodChunk.size + 1;
            const expectedVertexCount = verticesPerSide * verticesPerSide;

            // EXPECTED TO FAIL: heightmap size doesn't match expected vertex count
            expect(lodChunk.heightmap.length).toBe(expectedVertexCount);

            // Verify no out-of-bounds access during rendering
            for (let y = 0; y < lodChunk.size; y++) {
              for (let x = 0; x < lodChunk.size; x++) {
                // Rendering code accesses 4 vertices per quad
                const topLeft = y * verticesPerSide + x;
                const topRight = topLeft + 1;
                const bottomLeft = (y + 1) * verticesPerSide + x;
                const bottomRight = bottomLeft + 1;

                // All indices should be within bounds
                // EXPECTED TO FAIL: indices will be out of bounds
                expect(topLeft).toBeLessThan(lodChunk.heightmap.length);
                expect(topRight).toBeLessThan(lodChunk.heightmap.length);
                expect(bottomLeft).toBeLessThan(lodChunk.heightmap.length);
                expect(bottomRight).toBeLessThan(lodChunk.heightmap.length);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('LOD Downsampling Correctness', () => {
    it('should produce valid heightmap values after downsampling', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 32 }),
          fc.constantFrom(LODLevel.MEDIUM, LODLevel.LOW),
          (chunkSize, lodLevel) => {
            const lodManager = new LODManager({
              distances: [2, 5],
              meshResolutions: [1.0, 0.5, 0.25],
              featureDensities: [1.0, 0.5, 0.1]
            });

            const originalHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
            const heightmap = new Float32Array(originalHeightmapSize);
            
            // Fill with known values
            for (let i = 0; i < originalHeightmapSize; i++) {
              heightmap[i] = 0.5;
            }

            const chunk = {
              x: 0,
              y: 0,
              size: chunkSize,
              heightmap,
              biomeMap: new Uint8Array(chunkSize * chunkSize),
              resources: [],
              structures: [],
              rivers: new Map()
            };

            const lodChunk = lodManager.applyLOD(chunk, lodLevel);

            // All heightmap values should be valid numbers
            for (let i = 0; i < lodChunk.heightmap.length; i++) {
              const value = lodChunk.heightmap[i];
              expect(typeof value).toBe('number');
              expect(Number.isFinite(value)).toBe(true);
              expect(Number.isNaN(value)).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

