import { describe, it, expect } from 'vitest';
import {
  EnhancedBiomeConfig,
  EnhancedBiomeData,
  MicroBiomeType,
  ElevationBand,
} from '../../../src/world/enhanced-biome';
import { BiomeType } from '../../../src/world/chunk';

describe('Enhanced Biome Types', () => {
  describe('EnhancedBiomeConfig', () => {
    it('should extend BiomeConfig with enhanced properties', () => {
      const config: EnhancedBiomeConfig = {
        // Base BiomeConfig properties
        temperatureScale: 0.005,
        moistureScale: 0.005,
        blendRadius: 5,
        
        // Enhanced properties
        enableTransitions: true,
        transitionWidth: 10,
        enableMicroBiomes: true,
        microBiomeFrequency: 0.1,
        microBiomeMaxSize: 20,
        enableElevationBands: true,
        snowLineElevation: 0.8,
        treeLineElevation: 0.75,
      };

      expect(config.temperatureScale).toBe(0.005);
      expect(config.enableTransitions).toBe(true);
      expect(config.transitionWidth).toBe(10);
      expect(config.enableMicroBiomes).toBe(true);
      expect(config.microBiomeFrequency).toBe(0.1);
      expect(config.microBiomeMaxSize).toBe(20);
      expect(config.enableElevationBands).toBe(true);
      expect(config.snowLineElevation).toBe(0.8);
      expect(config.treeLineElevation).toBe(0.75);
    });
  });

  describe('MicroBiomeType', () => {
    it('should define all micro-biome types', () => {
      expect(MicroBiomeType.OASIS).toBe(0);
      expect(MicroBiomeType.CLEARING).toBe(1);
      expect(MicroBiomeType.POND).toBe(2);
      expect(MicroBiomeType.GROVE).toBe(3);
    });
  });

  describe('ElevationBand', () => {
    it('should define all elevation band types', () => {
      expect(ElevationBand.FOOTHILLS).toBe(0);
      expect(ElevationBand.SLOPES).toBe(1);
      expect(ElevationBand.PEAKS).toBe(2);
    });
  });

  describe('EnhancedBiomeData', () => {
    it('should contain primary biome and weights', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.FOREST, 0.7);
      weights.set(BiomeType.PLAINS, 0.3);

      const data: EnhancedBiomeData = {
        biome: BiomeType.FOREST,
        weights,
        transitionFactor: 0.5,
      };

      expect(data.biome).toBe(BiomeType.FOREST);
      expect(data.weights.get(BiomeType.FOREST)).toBe(0.7);
      expect(data.weights.get(BiomeType.PLAINS)).toBe(0.3);
      expect(data.transitionFactor).toBe(0.5);
      expect(data.microBiome).toBeUndefined();
      expect(data.elevationBand).toBeUndefined();
    });

    it('should support optional micro-biome', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.DESERT, 1.0);

      const data: EnhancedBiomeData = {
        biome: BiomeType.DESERT,
        weights,
        microBiome: MicroBiomeType.OASIS,
        transitionFactor: 0.0,
      };

      expect(data.microBiome).toBe(MicroBiomeType.OASIS);
    });

    it('should support optional elevation band', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.MOUNTAIN, 1.0);

      const data: EnhancedBiomeData = {
        biome: BiomeType.MOUNTAIN,
        weights,
        elevationBand: ElevationBand.PEAKS,
        transitionFactor: 0.0,
      };

      expect(data.elevationBand).toBe(ElevationBand.PEAKS);
    });

    it('should support both micro-biome and elevation band', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.MOUNTAIN, 0.8);
      weights.set(BiomeType.TUNDRA, 0.2);

      const data: EnhancedBiomeData = {
        biome: BiomeType.MOUNTAIN,
        weights,
        microBiome: MicroBiomeType.GROVE,
        elevationBand: ElevationBand.FOOTHILLS,
        transitionFactor: 0.3,
      };

      expect(data.microBiome).toBe(MicroBiomeType.GROVE);
      expect(data.elevationBand).toBe(ElevationBand.FOOTHILLS);
    });
  });
});
