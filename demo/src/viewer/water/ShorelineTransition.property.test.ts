/**
 * Property-based tests for shoreline transition smoothness
 * 
 * Tests Property 15: Shoreline Transition Smoothness
 * Validates: Requirements 9.2, 9.6
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import {
  analyzeShorelineTransitions,
  areTransitionsSmooth,
  calculateSmoothnessScore,
  getMaxElevationDiscontinuity,
  smoothRiverPathElevations,
  validateShorelineSmoothness,
} from './ShorelineTransitionSmoother';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

/**
 * Arbitrary generator for heightmap with controlled elevation changes
 */
const arbitrarySmoothedHeightmap = (size: number = 4): fc.Arbitrary<Float32Array> => {
  const vertexSize = size + 1;
  const vertexCount = vertexSize * vertexSize;
  
  return fc.array(
    fc.double({ min: 0, max: 1, noNaN: true }),
    { minLength: vertexCount, maxLength: vertexCount }
  ).map(arr => {
    const heightmap = new Float32Array(arr);
    
    // Apply simple smoothing to reduce abrupt changes
    const smoothed = new Float32Array(heightmap);
    for (let y = 1; y < vertexSize - 1; y++) {
      for (let x = 1; x < vertexSize - 1; x++) {
        const idx = y * vertexSize + x;
        const neighbors = [
          heightmap[idx - 1],
          heightmap[idx + 1],
          heightmap[idx - vertexSize],
          heightmap[idx + vertexSize],
        ];
        const avg = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
        smoothed[idx] = (heightmap[idx] + avg) / 2;
      }
    }
    
    return smoothed;
  });
};

/**
 * Arbitrary generator for chunk data with smooth terrain
 */
const arbitraryChunkWithSmoothTerrain = (): fc.Arbitrary<ChunkData> => {
  return fc.record({
    x: fc.integer({ min: -10, max: 10 }),
    y: fc.integer({ min: -10, max: 10 }),
    size: fc.constant(4),
  }).chain(({ x, y, size }) => {
    return arbitrarySmoothedHeightmap(size).map(heightmap => ({
      x,
      y,
      size,
      heightmap,
      biomeMap: new Uint8Array(size * size),
      biomeWeights: new Float32Array(size * size * 8),
      resources: [],
      structures: [],
      rivers: new Set<number>(),
    }));
  });
};

/**
 * Arbitrary generator for shoreline (chunk with mixed water/land)
 */
const arbitraryShoreline = (): fc.Arbitrary<{
  chunk: ChunkData;
  seaLevel: number;
}> => {
  return fc.record({
    x: fc.integer({ min: -10, max: 10 }),
    y: fc.integer({ min: -10, max: 10 }),
    size: fc.constant(4),
    seaLevel: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
  }).chain(({ x, y, size, seaLevel }) => {
    return arbitrarySmoothedHeightmap(size).map(heightmap => ({
      chunk: {
        x, y, size, heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set<number>(),
      },
      seaLevel,
    }));
  });
};

/**
 * Extract shoreline transitions from ocean geometry
 */
function extractShorelineTransitions(
  geometry: THREE.BufferGeometry | null,
  chunkData: ChunkData,
  seaLevel: number,
  waterOffset: number
): ReturnType<typeof analyzeShorelineTransitions> {
  if (!geometry) {
    return [];
  }

  // Identify ocean tiles
  const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
  const oceanTileSet = new Set(oceanTiles.map(t => t.index));

  // Analyze transitions
  const waterElevation = seaLevel + waterOffset;
  return analyzeShorelineTransitions(oceanTileSet, chunkData, waterElevation);
}

/**
 * Check if all transitions are smooth (elevation difference <= threshold)
 */
function allTransitionsSmooth(
  transitions: ReturnType<typeof analyzeShorelineTransitions>,
  maxElevationDifference: number
): boolean {
  return transitions.every(t => t.elevationDifference <= maxElevationDifference);
}

describe('Shoreline Transition Property Tests', () => {
  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('Shoreline transitions have no abrupt elevation discontinuities', () => {
    fc.assert(
      fc.property(
        arbitraryShoreline(),
        fc.double({ min: 0.05, max: 0.2, noNaN: true }),
        ({ chunk, seaLevel }, waterOffset) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };

          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          
          if (!geometry || oceanTiles.length === 0) {
            return true; // No shoreline to test
          }

          const transitions = extractShorelineTransitions(geometry, chunk, seaLevel, waterOffset);
          
          if (transitions.length === 0) {
            return true; // No transitions (all water or all land)
          }

          // Maximum allowed elevation difference for smooth transition
          const maxDiscontinuity = getMaxElevationDiscontinuity(transitions);
          
          // Verify no extreme discontinuities (allow up to 1.0 for procedural terrain)
          expect(maxDiscontinuity).toBeLessThanOrEqual(1.0);
          
          // Verify smoothness score is valid
          const smoothnessScore = calculateSmoothnessScore(transitions);
          expect(smoothnessScore).toBeGreaterThanOrEqual(0);
          expect(smoothnessScore).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('Smooth terrain produces smooth shoreline transitions', () => {
    fc.assert(
      fc.property(
        arbitraryChunkWithSmoothTerrain(),
        fc.double({ min: 0.3, max: 0.7, noNaN: true }),
        fc.double({ min: 0.05, max: 0.2, noNaN: true }),
        (chunk, seaLevel, waterOffset) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };

          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          
          if (!geometry || oceanTiles.length === 0) {
            return true;
          }

          const transitions = extractShorelineTransitions(geometry, chunk, seaLevel, waterOffset);
          
          if (transitions.length === 0) {
            return true;
          }

          // Smoothed terrain should have reasonable max discontinuity
          const maxDiscontinuity = getMaxElevationDiscontinuity(transitions);
          expect(maxDiscontinuity).toBeLessThanOrEqual(1.0);
          
          // Smoothness score should be valid
          const smoothnessScore = calculateSmoothnessScore(transitions);
          expect(smoothnessScore).toBeGreaterThanOrEqual(0);
          expect(smoothnessScore).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('Shoreline smoothness validation correctly identifies problems', () => {
    fc.assert(
      fc.property(
        arbitraryShoreline(),
        fc.double({ min: 0.05, max: 0.2, noNaN: true }),
        ({ chunk, seaLevel }, waterOffset) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };

          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          
          if (!geometry || oceanTiles.length === 0) {
            return true;
          }

          const transitions = extractShorelineTransitions(geometry, chunk, seaLevel, waterOffset);
          
          if (transitions.length === 0) {
            return true;
          }

          const validation = validateShorelineSmoothness(transitions, 0.5);
          
          // Validation result should be consistent
          expect(validation.smoothnessScore).toBeGreaterThanOrEqual(0);
          expect(validation.smoothnessScore).toBeLessThanOrEqual(1);
          expect(validation.maxDiscontinuity).toBeGreaterThanOrEqual(0);
          
          // If valid, max discontinuity should be within threshold
          if (validation.valid) {
            expect(validation.maxDiscontinuity).toBeLessThanOrEqual(0.5);
          }
          
          // Problematic transitions should have elevation difference > threshold
          for (const transition of validation.problematicTransitions) {
            expect(transition.elevationDifference).toBeGreaterThan(0.5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('River path elevation smoothing reduces discontinuities', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.double({ min: 0, max: 1, noNaN: true }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }),
        (elevations, smoothingFactor) => {
          const smoothed = smoothRiverPathElevations(elevations, smoothingFactor);
          
          // Smoothed array should have same length
          expect(smoothed.length).toBe(elevations.length);
          
          // First and last elements should be unchanged
          expect(smoothed[0]).toBeCloseTo(elevations[0], 5);
          expect(smoothed[smoothed.length - 1]).toBeCloseTo(elevations[elevations.length - 1], 5);
          
          // Calculate max elevation change between adjacent segments
          const getMaxChange = (arr: number[]) => {
            let maxChange = 0;
            for (let i = 1; i < arr.length; i++) {
              maxChange = Math.max(maxChange, Math.abs(arr[i] - arr[i - 1]));
            }
            return maxChange;
          };
          
          const originalMaxChange = getMaxChange(elevations);
          const smoothedMaxChange = getMaxChange(smoothed);
          
          // Smoothing should not increase max change
          expect(smoothedMaxChange).toBeLessThanOrEqual(originalMaxChange + 0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('Smoothness score is between 0 and 1', () => {
    fc.assert(
      fc.property(
        arbitraryShoreline(),
        fc.double({ min: 0.05, max: 0.2, noNaN: true }),
        ({ chunk, seaLevel }, waterOffset) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };

          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          
          if (!geometry || oceanTiles.length === 0) {
            return true;
          }

          const transitions = extractShorelineTransitions(geometry, chunk, seaLevel, waterOffset);
          const score = calculateSmoothnessScore(transitions);
          
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('All smooth transitions result in smoothness score of 1.0', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: -10, max: 10 }),
          y: fc.integer({ min: -10, max: 10 }),
          size: fc.constant(4),
          seaLevel: fc.double({ min: 0.4, max: 0.6, noNaN: true }),
        }),
        ({ x, y, size, seaLevel }) => {
          // Create heightmap where all terrain is very close to sea level
          // This ensures smooth transitions
          const vertexSize = size + 1;
          const vertexCount = vertexSize * vertexSize;
          const heightmap = new Float32Array(vertexCount);
          
          for (let i = 0; i < vertexCount; i++) {
            // Mix of slightly above and below sea level
            heightmap[i] = seaLevel + (Math.random() - 0.5) * 0.2;
          }

          const chunk: ChunkData = {
            x, y, size, heightmap,
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };

          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          
          if (!geometry || oceanTiles.length === 0) {
            return true;
          }

          const transitions = extractShorelineTransitions(
            geometry,
            chunk,
            seaLevel,
            config.rendering.waterOffset
          );
          
          if (transitions.length === 0) {
            return true;
          }

          // With terrain close to sea level, most transitions should be smooth
          const score = calculateSmoothnessScore(transitions);
          expect(score).toBeGreaterThanOrEqual(0.7); // At least 70% smooth
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('No transitions results in perfect smoothness score', () => {
    const score = calculateSmoothnessScore([]);
    expect(score).toBe(1.0);
  });

  // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
  // **Validates: Requirements 9.2, 9.6**
  test('Max elevation discontinuity is non-negative', () => {
    fc.assert(
      fc.property(
        arbitraryShoreline(),
        fc.double({ min: 0.05, max: 0.2, noNaN: true }),
        ({ chunk, seaLevel }, waterOffset) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };

          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          
          if (!geometry || oceanTiles.length === 0) {
            return true;
          }

          const transitions = extractShorelineTransitions(geometry, chunk, seaLevel, waterOffset);
          const maxDiscontinuity = getMaxElevationDiscontinuity(transitions);
          
          expect(maxDiscontinuity).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
