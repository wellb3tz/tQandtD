import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  EnhancedBiomeSystem,
  EnhancedBiomeConfig,
  EnhancedBiomeData,
  MicroBiomeType,
  ElevationBand,
} from '../../src/world/enhanced-biome';
import { BiomeType } from '../../src/world/chunk';

describe('EnhancedBiomeSystem Property Tests', () => {
  const defaultConfig: EnhancedBiomeConfig = {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    enableTransitions: true,
    transitionWidth: 10,
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,
    microBiomeMaxSize: 20,
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75,
  };

  // Feature: 3d-world-generation-enhancements, Property 2: Biome transition existence
  // **Validates: Requirements 2.1**
  test('adjacent positions with different biomes have transition zones with blended weights', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // x
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // y
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }), // height (avoid ocean and mountain extremes)
        (seed, x, y, height) => {
          const system = new EnhancedBiomeSystem(seed, defaultConfig);
          
          // Get biome at center position
          const centerData = system.getEnhancedBiome(x, y, height);
          
          // Sample adjacent positions in 8 directions
          const adjacentOffsets = [
            [1, 0], [-1, 0], [0, 1], [0, -1],  // Cardinal directions
            [1, 1], [-1, -1], [1, -1], [-1, 1] // Diagonal directions
          ];
          
          for (const [dx, dy] of adjacentOffsets) {
            const adjacentX = x + dx;
            const adjacentY = y + dy;
            const adjacentData = system.getEnhancedBiome(adjacentX, adjacentY, height);
            
            // If adjacent position has a different biome
            if (adjacentData.biome !== centerData.biome) {
              // Then there should be a transition zone between them
              // This is indicated by either:
              // 1. The center position having multiple biome weights (blended)
              // 2. The adjacent position having multiple biome weights (blended)
              // 3. Positions between them having transition factors > 0
              
              const centerHasTransition = centerData.weights.size > 1 || centerData.transitionFactor > 0;
              const adjacentHasTransition = adjacentData.weights.size > 1 || adjacentData.transitionFactor > 0;
              
              // At least one of the positions should show transition characteristics
              const hasTransitionZone = centerHasTransition || adjacentHasTransition;
              
              // Additionally, check a position between them
              const midX = x + dx * 0.5;
              const midY = y + dy * 0.5;
              const midData = system.getEnhancedBiome(midX, midY, height);
              const midHasTransition = midData.weights.size > 1 || midData.transitionFactor > 0;
              
              // Either the endpoints or the midpoint should show transition
              expect(hasTransitionZone || midHasTransition).toBe(true);
              
              // If there are blended weights, they should sum to approximately 1.0
              if (centerData.weights.size > 1) {
                const weightSum = Array.from(centerData.weights.values()).reduce((a, b) => a + b, 0);
                expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.01);
              }
              
              if (adjacentData.weights.size > 1) {
                const weightSum = Array.from(adjacentData.weights.values()).reduce((a, b) => a + b, 0);
                expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.01);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 3: Biome transition smoothness
  // **Validates: Requirements 2.2, 2.3, 2.4**
  test('blended characteristics vary smoothly in transition zones with no abrupt discontinuities', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // x
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // y
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }), // height (avoid ocean and mountain extremes)
        fc.float({ min: Math.fround(0), max: Math.fround(2 * Math.PI), noNaN: true }), // direction angle
        (seed, x, y, height, angle) => {
          const system = new EnhancedBiomeSystem(seed, defaultConfig);
          
          // Sample along a line in the given direction to check for smoothness
          const stepSize = 0.5; // Small step for detecting discontinuities
          const numSteps = 20; // Sample 20 points along the line
          
          const samples: Array<{
            x: number;
            y: number;
            data: EnhancedBiomeData;
            temperature: number;
            moisture: number;
          }> = [];
          
          // Collect samples along the line
          for (let i = 0; i < numSteps; i++) {
            const sampleX = x + Math.cos(angle) * stepSize * i;
            const sampleY = y + Math.sin(angle) * stepSize * i;
            const data = system.getEnhancedBiome(sampleX, sampleY, height);
            const temperature = system.getTemperature(sampleX, sampleY);
            const moisture = system.getMoisture(sampleX, sampleY);
            
            samples.push({ x: sampleX, y: sampleY, data, temperature, moisture });
          }
          
          // Check smoothness between consecutive samples
          for (let i = 0; i < samples.length - 1; i++) {
            const current = samples[i];
            const next = samples[i + 1];
            
            // Only check smoothness in transition zones (where weights.size > 1 or transitionFactor > 0)
            const inTransitionZone = 
              current.data.weights.size > 1 || 
              next.data.weights.size > 1 ||
              current.data.transitionFactor > 0 ||
              next.data.transitionFactor > 0;
            
            if (inTransitionZone) {
              // 1. Check temperature smoothness (Requirements 2.4)
              const tempDiff = Math.abs(next.temperature - current.temperature);
              // Temperature should not jump by more than 0.5 over a small step
              expect(tempDiff).toBeLessThan(0.5);
              
              // 2. Check moisture smoothness (Requirements 2.4)
              const moistureDiff = Math.abs(next.moisture - current.moisture);
              // Moisture should not jump by more than 0.5 over a small step
              expect(moistureDiff).toBeLessThan(0.5);
              
              // 3. Check biome weight smoothness (Requirements 2.2, 2.3)
              // For each biome type present in either sample, check weight changes
              const allBiomes = new Set([
                ...Array.from(current.data.weights.keys()),
                ...Array.from(next.data.weights.keys())
              ]);
              
              for (const biome of allBiomes) {
                const currentWeight = current.data.weights.get(biome) || 0;
                const nextWeight = next.data.weights.get(biome) || 0;
                const weightDiff = Math.abs(nextWeight - currentWeight);
                
                // Biome weights should change gradually, not jump by more than 0.3
                // This ensures smooth blending of terrain features and vegetation density
                expect(weightDiff).toBeLessThan(0.3);
              }
              
              // 4. Verify weights still sum to 1.0 (sanity check)
              const currentWeightSum = Array.from(current.data.weights.values()).reduce((a, b) => a + b, 0);
              const nextWeightSum = Array.from(next.data.weights.values()).reduce((a, b) => a + b, 0);
              expect(Math.abs(currentWeightSum - 1.0)).toBeLessThan(0.01);
              expect(Math.abs(nextWeightSum - 1.0)).toBeLessThan(0.01);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 4: Micro-Biome Parent Constraint
  // **Validates: Requirements 3.2, 3.3, 3.4**
  test('micro-biomes only appear within valid parent biome types', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // x
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // y
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }), // height (avoid ocean and mountain extremes)
        (seed, x, y, height) => {
          const system = new EnhancedBiomeSystem(seed, defaultConfig);
          const data = system.getEnhancedBiome(x, y, height);
          
          // If a micro-biome is present, verify it matches the parent biome
          if (data.microBiome !== undefined) {
            switch (data.microBiome) {
              case MicroBiomeType.OASIS:
                expect(data.biome).toBe(BiomeType.DESERT);
                break;
              case MicroBiomeType.CLEARING:
                expect(data.biome).toBe(BiomeType.FOREST);
                break;
              case MicroBiomeType.POND:
                expect(data.biome).toBe(BiomeType.PLAINS);
                break;
              case MicroBiomeType.GROVE:
                expect(data.biome).toBe(BiomeType.TUNDRA);
                break;
              default:
                // Should never reach here
                expect(false).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 5: Micro-Biome Size Constraint
  // **Validates: Requirements 3.5**
  test('micro-biomes do not exceed maximum size threshold', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // x
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // y
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }), // height (avoid ocean and mountain extremes)
        (seed, x, y, height) => {
          const system = new EnhancedBiomeSystem(seed, defaultConfig);
          const centerData = system.getEnhancedBiome(x, y, height);
          
          // If a micro-biome is present at the center, measure its extent
          if (centerData.microBiome !== undefined) {
            const microBiomeType = centerData.microBiome;
            const maxSize = defaultConfig.microBiomeMaxSize;
            
            // Sample in multiple directions to find the extent of the micro-biome
            const sampleDirections = 8;
            let maxExtent = 0;
            
            for (let i = 0; i < sampleDirections; i++) {
              const angle = (i / sampleDirections) * Math.PI * 2;
              let extent = 0;
              
              // Sample outward from center until micro-biome changes or disappears
              for (let distance = 1; distance <= maxSize + 5; distance++) {
                const sampleX = x + Math.cos(angle) * distance;
                const sampleY = y + Math.sin(angle) * distance;
                const sampleData = system.getEnhancedBiome(sampleX, sampleY, height);
                
                if (sampleData.microBiome === microBiomeType) {
                  extent = distance;
                } else {
                  break;
                }
              }
              
              maxExtent = Math.max(maxExtent, extent);
            }
            
            // Verify the micro-biome does not exceed the maximum size
            expect(maxExtent).toBeLessThanOrEqual(maxSize);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 6: Elevation Band Classification
  // **Validates: Requirements 4.2, 4.3, 4.4**
  test('mountain terrain is classified into correct elevation bands based on height', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // x
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // y
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), // height (full range)
        (seed, x, y, height) => {
          const system = new EnhancedBiomeSystem(seed, defaultConfig);
          const data = system.getEnhancedBiome(x, y, height);
          
          // Only check elevation bands for mountain biomes
          if (data.biome === BiomeType.MOUNTAIN) {
            // Elevation band should be defined for mountains
            expect(data.elevationBand).toBeDefined();
            
            // Verify correct classification based on height thresholds
            if (height >= defaultConfig.snowLineElevation) {
              // Above snow line should be snowy peaks
              expect(data.elevationBand).toBe(ElevationBand.PEAKS);
            } else if (height >= defaultConfig.treeLineElevation) {
              // Between tree line and snow line should be rocky slopes
              expect(data.elevationBand).toBe(ElevationBand.SLOPES);
            } else {
              // Below tree line should be forested foothills
              expect(data.elevationBand).toBe(ElevationBand.FOOTHILLS);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 7: Elevation Band Transition Smoothness
  // **Validates: Requirements 4.5**
  test('adjacent positions in different elevation bands have smooth transitions with no abrupt changes', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // x
        fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }), // y
        fc.float({ min: Math.fround(0.7), max: Math.fround(0.85), noNaN: true }), // height (mountain range near band boundaries)
        fc.float({ min: Math.fround(0), max: Math.fround(2 * Math.PI), noNaN: true }), // direction angle
        (seed, x, y, height, angle) => {
          const system = new EnhancedBiomeSystem(seed, defaultConfig);
          
          // Sample along a line in the given direction to check for smoothness
          const stepSize = 0.1; // Small step for detecting discontinuities
          const numSteps = 30; // Sample 30 points along the line
          
          const samples: Array<{
            x: number;
            y: number;
            height: number;
            data: EnhancedBiomeData;
          }> = [];
          
          // Collect samples along the line with varying heights
          for (let i = 0; i < numSteps; i++) {
            const sampleX = x + Math.cos(angle) * stepSize * i;
            const sampleY = y + Math.sin(angle) * stepSize * i;
            // Vary height slightly to cross elevation band boundaries
            const sampleHeight = height + (i / numSteps) * 0.15 - 0.075; // ±0.075 variation
            const data = system.getEnhancedBiome(sampleX, sampleY, sampleHeight);
            
            samples.push({ x: sampleX, y: sampleY, height: sampleHeight, data });
          }
          
          // Check smoothness between consecutive samples in mountain biomes
          for (let i = 0; i < samples.length - 1; i++) {
            const current = samples[i];
            const next = samples[i + 1];
            
            // Only check if both positions are in mountain biomes
            if (current.data.biome === BiomeType.MOUNTAIN && next.data.biome === BiomeType.MOUNTAIN) {
              const currentBand = current.data.elevationBand;
              const nextBand = next.data.elevationBand;
              
              // If adjacent positions are in different elevation bands
              if (currentBand !== undefined && nextBand !== undefined && currentBand !== nextBand) {
                // 1. Verify bands are adjacent (differ by at most 1)
                const bandDiff = Math.abs(currentBand - nextBand);
                expect(bandDiff).toBeLessThanOrEqual(1);
                
                // 2. Verify height changes smoothly (no abrupt jumps)
                const heightDiff = Math.abs(next.height - current.height);
                // Height should change gradually, not jump by more than 0.1
                expect(heightDiff).toBeLessThan(0.1);
                
                // 3. Verify transition occurs near the threshold boundaries
                // If transitioning from FOOTHILLS to SLOPES, should be near tree line
                if ((currentBand === ElevationBand.FOOTHILLS && nextBand === ElevationBand.SLOPES) ||
                    (currentBand === ElevationBand.SLOPES && nextBand === ElevationBand.FOOTHILLS)) {
                  const avgHeight = (current.height + next.height) / 2;
                  const distanceFromTreeLine = Math.abs(avgHeight - defaultConfig.treeLineElevation);
                  // Transition should occur within 0.05 of the tree line threshold
                  expect(distanceFromTreeLine).toBeLessThan(0.05);
                }
                
                // If transitioning from SLOPES to PEAKS, should be near snow line
                if ((currentBand === ElevationBand.SLOPES && nextBand === ElevationBand.PEAKS) ||
                    (currentBand === ElevationBand.PEAKS && nextBand === ElevationBand.SLOPES)) {
                  const avgHeight = (current.height + next.height) / 2;
                  const distanceFromSnowLine = Math.abs(avgHeight - defaultConfig.snowLineElevation);
                  // Transition should occur within 0.05 of the snow line threshold
                  expect(distanceFromSnowLine).toBeLessThan(0.05);
                }
                
                // 4. Verify biome weights remain consistent (no abrupt changes in terrain characteristics)
                // Check that the primary biome (MOUNTAIN) weight doesn't change abruptly
                const currentMountainWeight = current.data.weights.get(BiomeType.MOUNTAIN) || 0;
                const nextMountainWeight = next.data.weights.get(BiomeType.MOUNTAIN) || 0;
                const weightDiff = Math.abs(nextMountainWeight - currentMountainWeight);
                // Mountain weight should not jump by more than 0.3
                expect(weightDiff).toBeLessThan(0.3);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
