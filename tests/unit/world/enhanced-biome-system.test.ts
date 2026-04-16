import { describe, it, expect } from 'vitest';
import {
  EnhancedBiomeSystem,
  EnhancedBiomeConfig,
  MicroBiomeType,
  ElevationBand,
} from '../../../src/world/enhanced-biome';
import { BiomeType } from '../../../src/world/chunk';

describe('EnhancedBiomeSystem', () => {
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

  // Helper function to create a simple height callback that returns a constant height
  const createConstantHeightCallback = (height: number) => {
    return (_worldX: number, _worldY: number) => height;
  };

  describe('constructor', () => {
    it('should create an instance with valid configuration', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      expect(system).toBeDefined();
    });
  });

  describe('getEnhancedBiome', () => {
    it('should return enhanced biome data with primary biome', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.5));
      
      expect(data).toBeDefined();
      expect(data.biome).toBeDefined();
      expect(data.weights).toBeInstanceOf(Map);
      expect(data.transitionFactor).toBeGreaterThanOrEqual(0);
      expect(data.transitionFactor).toBeLessThanOrEqual(1);
    });

    it('should return ocean biome for low height', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.2));
      
      expect(data.biome).toBe(BiomeType.OCEAN);
    });

    it('should return mountain biome for high height', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.8));
      
      expect(data.biome).toBe(BiomeType.MOUNTAIN);
    });

    it('should include elevation band for mountain biomes when enabled', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.85));
      
      if (data.biome === BiomeType.MOUNTAIN) {
        expect(data.elevationBand).toBeDefined();
        expect([ElevationBand.FOOTHILLS, ElevationBand.SLOPES, ElevationBand.PEAKS])
          .toContain(data.elevationBand);
      }
    });

    it('should not include elevation band when disabled', () => {
      const config = { ...defaultConfig, enableElevationBands: false };
      const system = new EnhancedBiomeSystem(12345, config);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.85));
      
      expect(data.elevationBand).toBeUndefined();
    });

    it('should not include transitions when disabled', () => {
      const config = { ...defaultConfig, enableTransitions: false };
      const system = new EnhancedBiomeSystem(12345, config);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.5));
      
      expect(data.transitionFactor).toBe(0);
      expect(data.weights.size).toBe(1);
      expect(data.weights.get(data.biome)).toBe(1.0);
    });

    it('should produce deterministic results for same seed and coordinates', () => {
      const system1 = new EnhancedBiomeSystem(12345, defaultConfig);
      const system2 = new EnhancedBiomeSystem(12345, defaultConfig);
      
      const data1 = system1.getEnhancedBiome(100, 100, createConstantHeightCallback(0.5));
      const data2 = system2.getEnhancedBiome(100, 100, createConstantHeightCallback(0.5));
      
      expect(data1.biome).toBe(data2.biome);
      expect(data1.transitionFactor).toBe(data2.transitionFactor);
      expect(data1.microBiome).toBe(data2.microBiome);
      expect(data1.elevationBand).toBe(data2.elevationBand);
    });
  });

  describe('elevation bands', () => {
    it('should classify peaks above snow line', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.85));
      
      if (data.biome === BiomeType.MOUNTAIN) {
        expect(data.elevationBand).toBe(ElevationBand.PEAKS);
      }
    });

    it('should classify slopes between tree line and snow line', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.77));
      
      if (data.biome === BiomeType.MOUNTAIN) {
        expect(data.elevationBand).toBe(ElevationBand.SLOPES);
      }
    });

    it('should classify foothills below tree line', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      const data = system.getEnhancedBiome(100, 100, createConstantHeightCallback(0.72));
      
      if (data.biome === BiomeType.MOUNTAIN) {
        expect(data.elevationBand).toBe(ElevationBand.FOOTHILLS);
      }
    });
  });

  describe('transition zones', () => {
    it('should return transition factor between 0 and 1', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      
      // Test multiple positions
      for (let i = 0; i < 50; i++) {
        const x = i * 20;
        const y = i * 20;
        const data = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        
        expect(data.transitionFactor).toBeGreaterThanOrEqual(0);
        expect(data.transitionFactor).toBeLessThanOrEqual(1);
      }
    });

    it('should return 0 transition factor in pure biome centers', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      
      // Find a position with pure biome (transition factor = 0)
      let foundPureBiome = false;
      for (let i = 0; i < 100; i++) {
        const x = i * 50;
        const y = i * 50;
        const data = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        
        if (data.transitionFactor === 0) {
          foundPureBiome = true;
          break;
        }
      }
      
      expect(foundPureBiome).toBe(true);
    });

    it('should return higher transition factor near biome boundaries', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      
      // Find a position with high transition factor
      let foundTransition = false;
      for (let i = 0; i < 100; i++) {
        const x = i * 10;
        const y = i * 10;
        const data = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        
        if (data.transitionFactor > 0.5) {
          foundTransition = true;
          break;
        }
      }
      
      expect(foundTransition).toBe(true);
    });

    it('should use configurable transition width', () => {
      const narrowConfig = { ...defaultConfig, transitionWidth: 5 };
      const wideConfig = { ...defaultConfig, transitionWidth: 20 };
      
      const narrowSystem = new EnhancedBiomeSystem(12345, narrowConfig);
      const wideSystem = new EnhancedBiomeSystem(12345, wideConfig);
      
      // The transition width affects how far we sample, which can affect the transition factor
      // Test that both systems work with different widths
      const narrowData = narrowSystem.getEnhancedBiome(100, 100, createConstantHeightCallback(0.5));
      const wideData = wideSystem.getEnhancedBiome(100, 100, createConstantHeightCallback(0.5));
      
      expect(narrowData.transitionFactor).toBeGreaterThanOrEqual(0);
      expect(narrowData.transitionFactor).toBeLessThanOrEqual(1);
      expect(wideData.transitionFactor).toBeGreaterThanOrEqual(0);
      expect(wideData.transitionFactor).toBeLessThanOrEqual(1);
    });

    it('should detect biome boundaries by sampling nearby positions', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      
      // Test that transition factor changes as we move through the world
      const samples: number[] = [];
      for (let i = 0; i < 20; i++) {
        const x = 100 + i * 5;
        const y = 100;
        const data = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        samples.push(data.transitionFactor);
      }
      
      // Verify that transition factors vary (not all the same)
      const uniqueValues = new Set(samples);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });

  describe('micro-biomes', () => {
    it('should only generate micro-biomes in valid parent biomes', () => {
      const system = new EnhancedBiomeSystem(12345, defaultConfig);
      
      // Test many positions to find micro-biomes
      for (let i = 0; i < 100; i++) {
        const x = i * 10;
        const y = i * 10;
        const data = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        
        if (data.microBiome !== undefined) {
          // Verify parent biome constraint
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
          }
        }
      }
    });

    it('should not generate micro-biomes when disabled', () => {
      const config = { ...defaultConfig, enableMicroBiomes: false };
      const system = new EnhancedBiomeSystem(12345, config);
      
      // Test many positions
      for (let i = 0; i < 100; i++) {
        const x = i * 10;
        const y = i * 10;
        const data = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        
        expect(data.microBiome).toBeUndefined();
      }
    });

    it('should enforce maximum micro-biome size', () => {
      const config = { ...defaultConfig, microBiomeMaxSize: 15, microBiomeFrequency: 0.2 };
      const system = new EnhancedBiomeSystem(12345, config);
      
      // Find a micro-biome and measure its extent
      let foundMicroBiome = false;
      
      for (let i = 0; i < 500 && !foundMicroBiome; i++) {
        const x = i * 5;
        const y = i * 5;
        const centerData = system.getEnhancedBiome(x, y, createConstantHeightCallback(0.5));
        
        if (centerData.microBiome !== undefined) {
          foundMicroBiome = true;
          const microBiomeType = centerData.microBiome;
          
          // Measure extent in multiple directions
          const directions = 8;
          for (let d = 0; d < directions; d++) {
            const angle = (d / directions) * Math.PI * 2;
            let extent = 0;
            
            // Sample outward until micro-biome changes
            for (let distance = 1; distance <= config.microBiomeMaxSize + 5; distance++) {
              const sampleX = x + Math.cos(angle) * distance;
              const sampleY = y + Math.sin(angle) * distance;
              const sampleData = system.getEnhancedBiome(sampleX, sampleY, createConstantHeightCallback(0.5));
              
              if (sampleData.microBiome === microBiomeType) {
                extent = distance;
              } else {
                break;
              }
            }
            
            // Verify extent does not exceed maximum
            expect(extent).toBeLessThanOrEqual(config.microBiomeMaxSize);
          }
        }
      }
      
      // We should have found at least one micro-biome to test
      expect(foundMicroBiome).toBe(true);
    });
  });
});

