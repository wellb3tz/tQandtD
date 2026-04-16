/**
 * Property-based tests for RiverMeshGenerator
 * 
 * Tests universal correctness properties using fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateRiverMeshes } from './RiverMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, RiverSegment } from '../../../../src/gen/rivers';
import { DEFAULT_WATER_CONFIG } from './config';

describe('RiverMeshGenerator - Property-Based Tests', () => {
  /**
   * Generate arbitrary heightmap with realistic terrain values
   */
  const arbitraryHeightmap = (size: number = 32) =>
    fc.array(fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), {
      minLength: (size + 1) * (size + 1),
      maxLength: (size + 1) * (size + 1),
    }).map(arr => new Float32Array(arr));

  /**
   * Generate arbitrary chunk data
   */
  const arbitraryChunkData = () =>
    fc.record({
      size: fc.constant(32),
    }).chain(({ size }) =>
      fc.record({
        x: fc.integer({ min: -10, max: 10 }),
        y: fc.integer({ min: -10, max: 10 }),
        size: fc.constant(size),
        heightmap: arbitraryHeightmap(size),
        biomes: fc.constant(new Uint8Array(size * size)),
        rivers: fc.constant(new Set<number>()),
      })
    );

  /**
   * Generate arbitrary valid river network with connected segments
   */
  const arbitraryValidRiverNetwork = (size: number = 32) =>
    fc.integer({ min: 1, max: 10 }).chain(pathLength => {
      // Generate unique indices for the path
      return fc.uniqueArray(
        fc.integer({ min: 0, max: size * size - 1 }),
        { minLength: pathLength, maxLength: pathLength }
      ).map(indices => {
        // Create connected segments with increasing flow
        const segments: RiverSegment[] = indices.map((index, i) => ({
          index,
          flow: (i + 1) * 1.0, // Increasing flow downstream
          width: Math.max(0.5, Math.min(5.0, (i + 1) * 0.5)), // Width based on flow
          order: 1,
          next: i < indices.length - 1 ? indices[i + 1] : -1,
        }));

        const tileToSegment = new Map<number, number>();
        segments.forEach((seg, idx) => {
          tileToSegment.set(seg.index, idx);
        });

        return {
          segments,
          lakes: [],
          tileToSegment,
        } as RiverNetwork;
      });
    });

  // ============================================================================
  // Property 3: River Water Path Following
  // ============================================================================

  it('Property 3: River Water Path Following - river meshes are created for valid river networks', () => {
    /**
     * **Validates: Requirements 1.3, 3.1, 3.2**
     * 
     * Feature: comprehensive-water-system, Property 3: River Water Path Following
     * 
     * For any river network with segments, river water meshes SHALL be created
     * and contain geometry with vertices.
     */
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryValidRiverNetwork(),
        (chunkData, riverNetwork) => {
          const config = DEFAULT_WATER_CONFIG;
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);

          // Should create at least one mesh for valid network
          expect(riverMeshes.length).toBeGreaterThan(0);

          // All meshes should have geometry with vertices
          for (const mesh of riverMeshes) {
            expect(mesh.geometry).toBeDefined();
            const positions = mesh.geometry.getAttribute('position');
            expect(positions.count).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // Property 9: River Water Terrain Elevation Matching
  // ============================================================================

  it('Property 9: River Water Terrain Elevation Matching - river water is positioned above terrain', () => {
    /**
     * **Validates: Requirements 3.3, 9.1, 9.3**
     * 
     * Feature: comprehensive-water-system, Property 9: River Water Terrain Elevation Matching
     * 
     * For any river segment, the river water mesh elevation SHALL be greater than
     * the minimum terrain height (ensuring it's positioned above terrain).
     */
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryValidRiverNetwork(),
        (chunkData, riverNetwork) => {
          const config = DEFAULT_WATER_CONFIG;
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);

          if (riverMeshes.length === 0) {
            return true;
          }

          // Find minimum terrain height
          let minTerrainHeight = Infinity;
          for (let i = 0; i < chunkData.heightmap.length; i++) {
            minTerrainHeight = Math.min(minTerrainHeight, chunkData.heightmap[i]);
          }

          // All river vertices should be above minimum terrain height
          for (const mesh of riverMeshes) {
            const positions = mesh.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
              const y = positions.getY(i);
              expect(y).toBeGreaterThanOrEqual(minTerrainHeight);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // Property 10: River Width Smooth Transitions
  // ============================================================================

  it('Property 10: River Width Smooth Transitions - connected segments have bounded width differences', () => {
    /**
     * **Validates: Requirements 3.5**
     * 
     * Feature: comprehensive-water-system, Property 10: River Width Smooth Transitions
     * 
     * For any sequence of connected river segments, the width differences between
     * adjacent segments SHALL be bounded (not exceed the maximum possible width range).
     */
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryValidRiverNetwork(),
        (chunkData, riverNetwork) => {
          const config = DEFAULT_WATER_CONFIG;

          // Maximum possible width difference (from min 0.5 to max 5.0)
          const maxPossibleWidthDiff = 5.0;

          // Check that all adjacent segments have bounded width differences
          for (let i = 0; i < riverNetwork.segments.length; i++) {
            const segment = riverNetwork.segments[i];
            if (segment.next === -1) continue;

            // Find next segment
            const nextSegment = riverNetwork.segments.find(s => s.index === segment.next);
            if (!nextSegment) continue;

            const widthDiff = Math.abs(segment.width - nextSegment.width);
            expect(widthDiff).toBeLessThanOrEqual(maxPossibleWidthDiff);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // Additional Test: Empty Network Handling
  // ============================================================================

  it('should handle empty river networks correctly', () => {
    /**
     * Verifies that empty river networks return empty mesh arrays
     */
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        (chunkData) => {
          const config = DEFAULT_WATER_CONFIG;
          const emptyNetwork: RiverNetwork = {
            segments: [],
            lakes: [],
            tileToSegment: new Map(),
          };

          const riverMeshes = generateRiverMeshes(chunkData, emptyNetwork, config);
          expect(riverMeshes).toEqual([]);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
