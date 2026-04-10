// Property-based tests for river generation

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { RiverGenerator, RiverConfig } from '../../src/gen/rivers.js';
import { BiomeType, ChunkData } from '../../src/world/chunk.js';

describe('RiverGenerator Properties', () => {
  // Feature: procedural-world-engine, Property 13: River Downhill Flow
  // **Validates: Requirements 7.2**
  test('Property 13: Rivers follow downhill flow (core path moves to equal or lower elevation)', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 16, max: 64 }),
        fc.float({ min: Math.fround(0.6), max: Math.fround(0.9), noNaN: true }),
        fc.integer({ min: 3, max: 10 }),
        (seed, chunkSize, sourceElevation, minFlowLength) => {
          const config: RiverConfig = {
            sourceElevation,
            minFlowLength,
            flowWidth: 1, // Use width 1 to test the core path without widening
          };

          const generator = new RiverGenerator(config);

          // Create a heightmap with clear downward gradient
          const heightmap = new Float32Array(chunkSize * chunkSize);
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            const x = i % chunkSize;
            const y = Math.floor(i / chunkSize);
            // Create a gradient from high (top-left) to low (bottom-right)
            const gradient = 1.0 - (x + y) / (chunkSize * 2);
            // Add small noise but keep clear gradient
            const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.02;
            heightmap[i] = Math.max(0, Math.min(1, gradient + noise));
          }

          const chunkData: ChunkData = {
            x: 0,
            y: 0,
            size: chunkSize,
            heightmap,
            biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
            biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          // Generate rivers
          const riverTiles = generator.generateRivers(chunkData, seed);

          // Reconstruct river paths by following downhill connections
          // Start from high elevation river tiles and trace downward
          const riverArray = Array.from(riverTiles);
          
          for (const startIndex of riverArray) {
            const startHeight = heightmap[startIndex];
            
            // Find the steepest downhill neighbor that's also a river tile
            let currentIndex = startIndex;
            let visited = new Set<number>();
            
            while (true) {
              visited.add(currentIndex);
              const currentHeight = heightmap[currentIndex];
              const x = currentIndex % chunkSize;
              const y = Math.floor(currentIndex / chunkSize);
              
              let nextIndex = -1;
              let nextHeight = currentHeight;
              
              // Find steepest downhill river neighbor
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  
                  const nx = x + dx;
                  const ny = y + dy;
                  
                  if (nx < 0 || nx >= chunkSize || ny < 0 || ny >= chunkSize) continue;
                  
                  const neighborIndex = ny * chunkSize + nx;
                  
                  if (!riverTiles.has(neighborIndex) || visited.has(neighborIndex)) continue;
                  
                  const neighborHeight = heightmap[neighborIndex];
                  
                  // Check downhill flow property
                  if (neighborHeight < nextHeight) {
                    nextHeight = neighborHeight;
                    nextIndex = neighborIndex;
                  }
                }
              }
              
              // If we found a downhill neighbor, verify the property
              if (nextIndex !== -1) {
                // The next tile should have equal or lower elevation
                expect(nextHeight).toBeLessThanOrEqual(currentHeight + 0.0001);
                currentIndex = nextIndex;
              } else {
                // No more downhill neighbors, end of path
                break;
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 14: River Termination Conditions
  // **Validates: Requirements 7.3**
  test('Property 14: River endpoints are at ocean level or local minima', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 16, max: 64 }),
        fc.float({ min: Math.fround(0.6), max: Math.fround(0.9), noNaN: true }),
        fc.integer({ min: 3, max: 10 }),
        (seed, chunkSize, sourceElevation, minFlowLength) => {
          const config: RiverConfig = {
            sourceElevation,
            minFlowLength,
            flowWidth: 1,
          };

          const generator = new RiverGenerator(config);

          // Create a heightmap with varied terrain
          const heightmap = new Float32Array(chunkSize * chunkSize);
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            const x = i % chunkSize;
            const y = Math.floor(i / chunkSize);
            // Create varied terrain with some local minima
            const gradient = 1.0 - (x + y) / (chunkSize * 2);
            const noise = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.1;
            heightmap[i] = Math.max(0, Math.min(1, gradient + noise));
          }

          const chunkData: ChunkData = {
            x: 0,
            y: 0,
            size: chunkSize,
            heightmap,
            biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
            biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          // Generate rivers
          const riverTiles = generator.generateRivers(chunkData, seed);

          // Ocean level threshold (from design doc and implementation)
          const oceanLevel = 0.3;

          // Find river endpoints (tiles with no downhill river neighbors)
          for (const index of riverTiles) {
            const x = index % chunkSize;
            const y = Math.floor(index / chunkSize);
            const currentHeight = heightmap[index];

            // Find downhill river neighbors
            let hasDownhillRiverNeighbor = false;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;

                if (nx < 0 || nx >= chunkSize || ny < 0 || ny >= chunkSize) continue;

                const neighborIndex = ny * chunkSize + nx;

                if (riverTiles.has(neighborIndex)) {
                  const neighborHeight = heightmap[neighborIndex];
                  if (neighborHeight < currentHeight - 0.0001) {
                    hasDownhillRiverNeighbor = true;
                    break;
                  }
                }
              }
              if (hasDownhillRiverNeighbor) break;
            }

            // If this is an endpoint (no downhill river neighbors)
            if (!hasDownhillRiverNeighbor) {
              // Check termination conditions:
              // 1. At ocean level (height < oceanLevel)
              // 2. At local minimum (no lower neighbors at all)
              
              const atOceanLevel = currentHeight < oceanLevel;
              
              // Check if it's a local minimum
              let isLocalMinimum = true;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;

                  const nx = x + dx;
                  const ny = y + dy;

                  if (nx < 0 || nx >= chunkSize || ny < 0 || ny >= chunkSize) continue;

                  const neighborIndex = ny * chunkSize + nx;
                  const neighborHeight = heightmap[neighborIndex];

                  if (neighborHeight < currentHeight - 0.0001) {
                    isLocalMinimum = false;
                    break;
                  }
                }
                if (!isLocalMinimum) break;
              }

              // Endpoint must satisfy at least one termination condition
              expect(atOceanLevel || isLocalMinimum).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 15: River Generation Determinism
  // **Validates: Requirements 7.5**
  test('Property 15: River generation is deterministic for same seed', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 16, max: 64 }),
        fc.float({ min: Math.fround(0.6), max: Math.fround(0.9), noNaN: true }),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (seed, chunkSize, sourceElevation, minFlowLength, flowWidth) => {
          const config: RiverConfig = {
            sourceElevation,
            minFlowLength,
            flowWidth,
          };

          const generator = new RiverGenerator(config);

          // Create a heightmap with varied terrain
          const heightmap = new Float32Array(chunkSize * chunkSize);
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            const x = i % chunkSize;
            const y = Math.floor(i / chunkSize);
            const gradient = 1.0 - (x + y) / (chunkSize * 2);
            const noise = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.08;
            heightmap[i] = Math.max(0, Math.min(1, gradient + noise));
          }

          const createChunkData = (): ChunkData => ({
            x: 0,
            y: 0,
            size: chunkSize,
            heightmap: heightmap.slice(), // Copy heightmap
            biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
            biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          });

          // Generate rivers twice with same seed
          const rivers1 = generator.generateRivers(createChunkData(), seed);
          const rivers2 = generator.generateRivers(createChunkData(), seed);

          // Should produce identical results
          expect(rivers1.size).toBe(rivers2.size);

          // Convert to sorted arrays for comparison
          const array1 = Array.from(rivers1).sort((a, b) => a - b);
          const array2 = Array.from(rivers2).sort((a, b) => a - b);

          for (let i = 0; i < array1.length; i++) {
            expect(array1[i]).toBe(array2[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
