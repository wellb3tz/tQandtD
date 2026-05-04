/**
 * Unit tests for water configuration
 * Tests type and configuration for ocean + lake water system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  validateWaterConfig,
  DEFAULT_WATER_CONFIG,
  DEFAULT_LAKE_RENDER_CONFIG,
  DEFAULT_RIVER_RENDER_CONFIG,
  DEFAULT_OCEAN_CONFIG,
} from './config';
import type { WaterConfig, WaterType, WaterLayerData } from './types';

describe('Water Configuration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WaterType', () => {
    it('should accept "ocean" as valid WaterType', () => {
      const validType: WaterType = 'ocean';
      expect(validType).toBe('ocean');
    });

    it('should accept "lake" as valid WaterType', () => {
      const validType: WaterType = 'lake';
      expect(validType).toBe('lake');
    });

    it('should accept "river" as valid WaterType', () => {
      const validType: WaterType = 'river';
      expect(validType).toBe('river');
    });
  });

  describe('WaterLayerData', () => {
    it('should have ocean, lake, and river fields', () => {
      const waterLayerData: WaterLayerData = {
        ocean: [],
        lake: [],
        river: [],
        group: {} as any, // Mock THREE.Group
      };

      expect(waterLayerData).toHaveProperty('ocean');
      expect(waterLayerData).toHaveProperty('lake');
      expect(waterLayerData).toHaveProperty('river');
      expect(waterLayerData).toHaveProperty('group');
    });
  });

  describe('WaterConfig', () => {
    it('should have ocean, lake, and river fields', () => {
      const config: WaterConfig = DEFAULT_WATER_CONFIG;

      expect(config).toHaveProperty('ocean');
      expect(config).toHaveProperty('lake');
      expect(config).toHaveProperty('river');
      expect(config).toHaveProperty('seaLevel');
      expect(config).toHaveProperty('rendering');
      expect(config).toHaveProperty('performance');
    });
  });

  describe('validateWaterConfig', () => {
    it('should return configuration with ocean, lake, and river', () => {
      const config = validateWaterConfig({});

      expect(config.ocean).toBeDefined();
      expect(config.ocean).toHaveProperty('enabled');
      expect(config.ocean).toHaveProperty('color');
      expect(config.ocean).toHaveProperty('opacity');
      expect(config.ocean).toHaveProperty('shininess');

      expect(config.lake).toBeDefined();
      expect(config.lake).toHaveProperty('enabled');
      expect(config.lake).toHaveProperty('color');
      expect(config.lake).toHaveProperty('opacity');
      expect(config.lake).toHaveProperty('shininess');

      expect(config.river).toBeDefined();
      expect(config.river).toHaveProperty('enabled');
      expect(config.river).toHaveProperty('color');
      expect(config.river).toHaveProperty('opacity');
      expect(config.river).toHaveProperty('shininess');
    });

    it('should apply custom lake configuration', () => {
      const config = validateWaterConfig({
        lake: { enabled: false, color: 0x123456, opacity: 0.5, shininess: 50 },
      });

      expect(config.lake.enabled).toBe(false);
      expect(config.lake.color).toBe(0x123456);
      expect(config.lake.opacity).toBe(0.5);
      expect(config.lake.shininess).toBe(50);
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

    it('should clamp lake opacity to valid range [0, 1]', () => {
      const configLow = validateWaterConfig({ lake: { enabled: true, color: 0x00ff88, opacity: -0.1, shininess: 60 } });
      const configHigh = validateWaterConfig({ lake: { enabled: true, color: 0x00ff88, opacity: 1.5, shininess: 60 } });

      expect(configLow.lake.opacity).toBe(0);
      expect(configHigh.lake.opacity).toBe(1);
    });

    it('should clamp lake shininess to valid range [0, 100]', () => {
      const configLow = validateWaterConfig({ lake: { enabled: true, color: 0x00ff88, opacity: 0.8, shininess: -5 } });
      const configHigh = validateWaterConfig({ lake: { enabled: true, color: 0x00ff88, opacity: 0.8, shininess: 200 } });

      expect(configLow.lake.shininess).toBe(0);
      expect(configHigh.lake.shininess).toBe(100);
    });

    it('should apply custom river configuration', () => {
      const config = validateWaterConfig({
        river: { enabled: false, color: 0x123456, opacity: 0.5, shininess: 50 },
      });

      expect(config.river.enabled).toBe(false);
      expect(config.river.color).toBe(0x123456);
      expect(config.river.opacity).toBe(0.5);
      expect(config.river.shininess).toBe(50);
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
          enableFrustumCulling: true,
        }
      });

      expect(config.performance.enableFrustumCulling).toBe(true);
    });
  });

  describe('DEFAULT_WATER_CONFIG', () => {
    it('should contain lake configuration', () => {
      expect(DEFAULT_WATER_CONFIG).toHaveProperty('lake');
      expect(DEFAULT_WATER_CONFIG.lake.enabled).toBe(true);
      expect(DEFAULT_WATER_CONFIG.lake.color).toBe(0x4fc3d4);
    });

    it('should contain ocean configuration', () => {
      expect(DEFAULT_WATER_CONFIG.ocean).toBeDefined();
      expect(DEFAULT_WATER_CONFIG.ocean.enabled).toBe(true);
      expect(DEFAULT_WATER_CONFIG.ocean.color).toBe(0x1e90ff);
      expect(DEFAULT_WATER_CONFIG.ocean.opacity).toBe(0.72);
      expect(DEFAULT_WATER_CONFIG.ocean.shininess).toBe(80);
    });

    it('should have valid default values', () => {
      expect(DEFAULT_WATER_CONFIG.enabled).toBe(true);
      expect(DEFAULT_WATER_CONFIG.seaLevel).toBe(0.3);
      expect(DEFAULT_WATER_CONFIG.rendering).toBeDefined();
      expect(DEFAULT_WATER_CONFIG.performance).toBeDefined();
    });
  });

  describe('DEFAULT_LAKE_RENDER_CONFIG', () => {
    it('should have freshwater cyan-teal color', () => {
      expect(DEFAULT_LAKE_RENDER_CONFIG.color).toBe(0x4fc3d4);
    });

    it('should be enabled by default', () => {
      expect(DEFAULT_LAKE_RENDER_CONFIG.enabled).toBe(true);
    });

    it('should have valid opacity and shininess', () => {
      expect(DEFAULT_LAKE_RENDER_CONFIG.opacity).toBeGreaterThan(0);
      expect(DEFAULT_LAKE_RENDER_CONFIG.opacity).toBeLessThanOrEqual(1);
      expect(DEFAULT_LAKE_RENDER_CONFIG.shininess).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_LAKE_RENDER_CONFIG.shininess).toBeLessThanOrEqual(100);
    });
  });

  describe('DEFAULT_RIVER_RENDER_CONFIG', () => {
    it('uses the same render values as ocean water', () => {
      expect(DEFAULT_RIVER_RENDER_CONFIG.color).toBe(DEFAULT_OCEAN_CONFIG.color);
      expect(DEFAULT_RIVER_RENDER_CONFIG.opacity).toBe(DEFAULT_OCEAN_CONFIG.opacity);
      expect(DEFAULT_RIVER_RENDER_CONFIG.shininess).toBe(DEFAULT_OCEAN_CONFIG.shininess);
    });
  });
});
