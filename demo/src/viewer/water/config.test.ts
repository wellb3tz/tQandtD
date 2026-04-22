/**
 * Unit tests for water configuration
 * Tests type and configuration changes for ocean-only water system
 */

import { describe, it, expect } from 'vitest';
import { validateWaterConfig, DEFAULT_WATER_CONFIG } from './config';
import type { WaterConfig, WaterType, WaterLayerData } from './types';

describe('Water Configuration - Ocean Only', () => {
  describe('WaterType', () => {
    it('should only accept "ocean" as valid WaterType', () => {
      // This test validates at compile time that WaterType is a single literal type
      const validType: WaterType = 'ocean';
      expect(validType).toBe('ocean');

      // TypeScript will prevent this at compile time:
      // const invalidType: WaterType = 'lake'; // ❌ Type error
    });
  });

  describe('WaterLayerData', () => {
    it('should not have lakes field', () => {
      // Create a mock WaterLayerData to verify structure
      const waterLayerData: WaterLayerData = {
        ocean: [],
        group: {} as any, // Mock THREE.Group
      };

      expect(waterLayerData).toHaveProperty('ocean');
      expect(waterLayerData).toHaveProperty('group');
      expect(waterLayerData).not.toHaveProperty('lakes');
    });
  });

  describe('WaterConfig', () => {
    it('should not have lake field', () => {
      const config: WaterConfig = DEFAULT_WATER_CONFIG;

      expect(config).toHaveProperty('ocean');
      expect(config).toHaveProperty('seaLevel');
      expect(config).toHaveProperty('rendering');
      expect(config).toHaveProperty('performance');
      expect(config).not.toHaveProperty('lake');
    });
  });

  describe('validateWaterConfig', () => {
    it('should return ocean-only configuration', () => {
      const config = validateWaterConfig({});

      expect(config.ocean).toBeDefined();
      expect(config.ocean).toHaveProperty('enabled');
      expect(config.ocean).toHaveProperty('color');
      expect(config.ocean).toHaveProperty('opacity');
      expect(config.ocean).toHaveProperty('shininess');
      expect(config).not.toHaveProperty('lake');
    });

    it('should ignore lake properties if provided', () => {
      // Attempt to pass lake configuration (using 'as any' to bypass TypeScript)
      const configWithLake = validateWaterConfig({
        lake: { color: 0x123456, opacity: 0.5, shininess: 50 }
      } as any);

      // Verify lake configuration is not present in result
      expect(configWithLake).not.toHaveProperty('lake');
      expect(configWithLake.ocean).toBeDefined();
    });

    it('should validate ocean configuration correctly', () => {
      const config = validateWaterConfig({
        ocean: {
          enabled: true,
          color: 0xff0000,
          opacity: 0.8,
          shininess: 75,
          enableWaves: true,
          waveHeight: 1.0,
          waveSpeed: 2.0,
        }
      });

      expect(config.ocean.enabled).toBe(true);
      expect(config.ocean.color).toBe(0xff0000);
      expect(config.ocean.opacity).toBe(0.8);
      expect(config.ocean.shininess).toBe(75);
      expect(config.ocean.enableWaves).toBe(true);
      expect(config.ocean.waveHeight).toBe(1.0);
      expect(config.ocean.waveSpeed).toBe(2.0);
    });

    it('should apply defaults for missing ocean properties', () => {
      const config = validateWaterConfig({
        ocean: {
          enabled: false,
          color: 0x00ff00,
          opacity: 0.5,
          shininess: 50,
          enableWaves: false,
          waveHeight: 0.5,
          waveSpeed: 1.0,
        }
      });

      expect(config.ocean.enabled).toBe(false);
      expect(config.ocean.color).toBe(0x00ff00);
      expect(config.seaLevel).toBe(DEFAULT_WATER_CONFIG.seaLevel);
      expect(config.rendering).toBeDefined();
      expect(config.performance).toBeDefined();
    });

    it('should clamp ocean opacity to valid range [0, 1]', () => {
      const configLow = validateWaterConfig({
        ocean: {
          enabled: true,
          color: 0x1e90ff,
          opacity: -0.5,
          shininess: 100,
          enableWaves: false,
          waveHeight: 0.5,
          waveSpeed: 1.0,
        }
      });

      const configHigh = validateWaterConfig({
        ocean: {
          enabled: true,
          color: 0x1e90ff,
          opacity: 1.5,
          shininess: 100,
          enableWaves: false,
          waveHeight: 0.5,
          waveSpeed: 1.0,
        }
      });

      expect(configLow.ocean.opacity).toBe(0);
      expect(configHigh.ocean.opacity).toBe(1);
    });

    it('should clamp ocean shininess to valid range [0, 100]', () => {
      const configLow = validateWaterConfig({
        ocean: {
          enabled: true,
          color: 0x1e90ff,
          opacity: 0.6,
          shininess: -10,
          enableWaves: false,
          waveHeight: 0.5,
          waveSpeed: 1.0,
        }
      });

      const configHigh = validateWaterConfig({
        ocean: {
          enabled: true,
          color: 0x1e90ff,
          opacity: 0.6,
          shininess: 150,
          enableWaves: false,
          waveHeight: 0.5,
          waveSpeed: 1.0,
        }
      });

      expect(configLow.ocean.shininess).toBe(0);
      expect(configHigh.ocean.shininess).toBe(100);
    });

    it('should validate seaLevel correctly', () => {
      const validConfig = validateWaterConfig({
        seaLevel: 0.5
      });

      expect(validConfig.seaLevel).toBe(0.5);
    });

    it('should use default seaLevel for out-of-range values', () => {
      const configLow = validateWaterConfig({
        seaLevel: -0.5
      });

      const configHigh = validateWaterConfig({
        seaLevel: 1.5
      });

      expect(configLow.seaLevel).toBe(DEFAULT_WATER_CONFIG.seaLevel);
      expect(configHigh.seaLevel).toBe(DEFAULT_WATER_CONFIG.seaLevel);
    });

    it('should preserve rendering configuration', () => {
      const config = validateWaterConfig({
        rendering: {
          waterOffset: 0.2,
          underwaterDarkenFactor: 0.5,
          underwaterDesaturationFactor: 0.6,
          enableDepthGradient: false,
        }
      });

      expect(config.rendering.waterOffset).toBe(0.2);
      expect(config.rendering.underwaterDarkenFactor).toBe(0.5);
      expect(config.rendering.underwaterDesaturationFactor).toBe(0.6);
      expect(config.rendering.enableDepthGradient).toBe(false);
    });

    it('should preserve performance configuration', () => {
      const config = validateWaterConfig({
        performance: {
          enableGeometryPooling: false,
          enableMeshMerging: false,
          enableLOD: true,
          enableFrustumCulling: true,
          useInstancedRendering: true,
        }
      });

      expect(config.performance.enableGeometryPooling).toBe(false);
      expect(config.performance.enableMeshMerging).toBe(false);
      expect(config.performance.enableLOD).toBe(true);
      expect(config.performance.enableFrustumCulling).toBe(true);
      expect(config.performance.useInstancedRendering).toBe(true);
    });
  });

  describe('DEFAULT_WATER_CONFIG', () => {
    it('should not contain lake configuration', () => {
      expect(DEFAULT_WATER_CONFIG).not.toHaveProperty('lake');
    });

    it('should contain ocean configuration', () => {
      expect(DEFAULT_WATER_CONFIG.ocean).toBeDefined();
      expect(DEFAULT_WATER_CONFIG.ocean.enabled).toBe(true);
      expect(DEFAULT_WATER_CONFIG.ocean.color).toBe(0x1e90ff);
      expect(DEFAULT_WATER_CONFIG.ocean.opacity).toBe(0.6);
      expect(DEFAULT_WATER_CONFIG.ocean.shininess).toBe(100);
    });

    it('should have valid default values', () => {
      expect(DEFAULT_WATER_CONFIG.enabled).toBe(true);
      expect(DEFAULT_WATER_CONFIG.seaLevel).toBe(0.3);
      expect(DEFAULT_WATER_CONFIG.rendering).toBeDefined();
      expect(DEFAULT_WATER_CONFIG.performance).toBeDefined();
    });
  });
});
