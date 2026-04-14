/**
 * Unit tests for preset configurations
 */

import { describe, it, expect } from 'vitest';
import { PRESETS, getPresetByName, getPresetNames, PresetConfig } from './presets';
import { BiomeType, ResourceType, StructureType } from '../../../src/index';

describe('Presets', () => {
  describe('PRESETS array', () => {
    it('should contain exactly 5 presets', () => {
      expect(PRESETS).toHaveLength(5);
    });

    it('should have all required preset names', () => {
      const names = PRESETS.map(p => p.name);
      expect(names).toContain('Mountainous');
      expect(names).toContain('Flat Plains');
      expect(names).toContain('Island World');
      expect(names).toContain('River Valley');
      expect(names).toContain('Performance Test');
    });

    it('should have unique preset names', () => {
      const names = PRESETS.map(p => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have descriptions for all presets', () => {
      PRESETS.forEach(preset => {
        expect(preset.description).toBeTruthy();
        expect(preset.description.length).toBeGreaterThan(0);
      });
    });

    it('should have valid WorldConfig for all presets', () => {
      PRESETS.forEach(preset => {
        expect(preset.config).toBeDefined();
        expect(preset.config.seed).toBeTypeOf('number');
        expect(preset.config.chunkSize).toBeTypeOf('number');
        expect(preset.config.terrainConfig).toBeDefined();
        expect(preset.config.biomeConfig).toBeDefined();
        expect(preset.config.resourceConfig).toBeDefined();
        expect(preset.config.structureConfig).toBeDefined();
        expect(preset.config.riverConfig).toBeDefined();
      });
    });
  });

  describe('Mountainous preset', () => {
    const preset = PRESETS.find(p => p.name === 'Mountainous')!;

    it('should have high warpStrength for dramatic terrain', () => {
      expect(preset.config.terrainConfig.warpStrength).toBeGreaterThanOrEqual(40);
    });

    it('should have low baseScale for large features', () => {
      expect(preset.config.terrainConfig.baseScale).toBeLessThanOrEqual(0.01);
    });

    it('should have high heightMultiplier', () => {
      expect(preset.config.terrainConfig.heightMultiplier).toBeGreaterThanOrEqual(1.2);
    });

    it('should have mountain-appropriate resources', () => {
      const resourceTypes = preset.config.resourceConfig.types?.map(t => t.type) || [];
      expect(resourceTypes).toContain(ResourceType.STONE);
    });
  });

  describe('Flat Plains preset', () => {
    const preset = PRESETS.find(p => p.name === 'Flat Plains')!;

    it('should have low octaves for smooth terrain', () => {
      expect(preset.config.terrainConfig.octaves).toBeLessThanOrEqual(3);
    });

    it('should have high baseScale for small features', () => {
      expect(preset.config.terrainConfig.baseScale).toBeGreaterThanOrEqual(0.015);
    });

    it('should have low heightMultiplier', () => {
      expect(preset.config.terrainConfig.heightMultiplier).toBeLessThanOrEqual(0.7);
    });

    it('should have low warpStrength', () => {
      expect(preset.config.terrainConfig.warpStrength).toBeLessThanOrEqual(20);
    });
  });

  describe('Island World preset', () => {
    const preset = PRESETS.find(p => p.name === 'Island World')!;

    it('should have enhanced biome configuration', () => {
      expect(preset.config.enhancedBiomeConfig).toBeDefined();
    });

    it('should enable biome transitions', () => {
      expect(preset.config.enhancedBiomeConfig?.enableTransitions).toBe(true);
    });

    it('should enable micro biomes', () => {
      expect(preset.config.enhancedBiomeConfig?.enableMicroBiomes).toBe(true);
    });

    it('should enable elevation bands', () => {
      expect(preset.config.enhancedBiomeConfig?.enableElevationBands).toBe(true);
    });
  });

  describe('River Valley preset', () => {
    const preset = PRESETS.find(p => p.name === 'River Valley')!;

    it('should have river network configuration', () => {
      expect(preset.config.riverNetworkConfig).toBeDefined();
    });

    it('should enable tributaries', () => {
      expect(preset.config.riverNetworkConfig?.enableTributaries).toBe(true);
    });

    it('should enable lakes', () => {
      expect(preset.config.riverNetworkConfig?.enableLakes).toBe(true);
    });

    it('should enable deltas', () => {
      expect(preset.config.riverNetworkConfig?.enableDeltas).toBe(true);
    });

    it('should have high tributary probability', () => {
      expect(preset.config.riverNetworkConfig?.tributaryProbability).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('Performance Test preset', () => {
    const preset = PRESETS.find(p => p.name === 'Performance Test')!;

    it('should have LOD configuration', () => {
      expect(preset.config.lodConfig).toBeDefined();
    });

    it('should have worker pool configuration', () => {
      expect(preset.config.workerPoolConfig).toBeDefined();
    });

    it('should have incremental generation configuration', () => {
      expect(preset.config.incrementalConfig).toBeDefined();
    });

    it('should enable performance metrics', () => {
      expect(preset.config.enablePerformanceMetrics).toBe(true);
    });

    it('should have valid LOD distances', () => {
      expect(preset.config.lodConfig?.distances).toBeDefined();
      expect(preset.config.lodConfig?.distances.length).toBeGreaterThan(0);
    });

    it('should have valid worker pool settings', () => {
      expect(preset.config.workerPoolConfig?.maxWorkers).toBeGreaterThan(0);
      expect(preset.config.workerPoolConfig?.workerScriptUrl).toBeTruthy();
    });
  });

  describe('getPresetByName', () => {
    it('should return preset for valid name', () => {
      const preset = getPresetByName('Mountainous');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Mountainous');
    });

    it('should return undefined for invalid name', () => {
      const preset = getPresetByName('NonExistent');
      expect(preset).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const preset = getPresetByName('mountainous');
      expect(preset).toBeUndefined();
    });

    it('should work for all preset names', () => {
      PRESETS.forEach(p => {
        const found = getPresetByName(p.name);
        expect(found).toBeDefined();
        expect(found?.name).toBe(p.name);
      });
    });
  });

  describe('getPresetNames', () => {
    it('should return array of all preset names', () => {
      const names = getPresetNames();
      expect(names).toHaveLength(5);
    });

    it('should return names in correct order', () => {
      const names = getPresetNames();
      expect(names[0]).toBe('Mountainous');
      expect(names[1]).toBe('Flat Plains');
      expect(names[2]).toBe('Island World');
      expect(names[3]).toBe('River Valley');
      expect(names[4]).toBe('Performance Test');
    });

    it('should return a new array each time', () => {
      const names1 = getPresetNames();
      const names2 = getPresetNames();
      expect(names1).not.toBe(names2);
      expect(names1).toEqual(names2);
    });
  });

  describe('Preset configuration validity', () => {
    it('should have valid terrain config ranges', () => {
      PRESETS.forEach(preset => {
        const tc = preset.config.terrainConfig;
        expect(tc.baseScale).toBeGreaterThan(0);
        expect(tc.baseScale).toBeLessThanOrEqual(0.1);
        expect(tc.octaves).toBeGreaterThanOrEqual(1);
        expect(tc.octaves).toBeLessThanOrEqual(8);
        expect(tc.persistence).toBeGreaterThan(0);
        expect(tc.persistence).toBeLessThan(1);
        expect(tc.lacunarity).toBeGreaterThanOrEqual(1.5);
        expect(tc.lacunarity).toBeLessThanOrEqual(3.0);
        expect(tc.warpStrength).toBeGreaterThanOrEqual(0);
        expect(tc.warpStrength).toBeLessThanOrEqual(100);
        expect(tc.heightMultiplier).toBeGreaterThan(0);
        expect(tc.heightMultiplier).toBeLessThanOrEqual(2.0);
      });
    });

    it('should have valid biome config ranges', () => {
      PRESETS.forEach(preset => {
        const bc = preset.config.biomeConfig;
        expect(bc.temperatureScale).toBeGreaterThan(0);
        expect(bc.temperatureScale).toBeLessThanOrEqual(0.01);
        expect(bc.moistureScale).toBeGreaterThan(0);
        expect(bc.moistureScale).toBeLessThanOrEqual(0.01);
        expect(bc.blendRadius).toBeGreaterThanOrEqual(1);
        expect(bc.blendRadius).toBeLessThanOrEqual(10);
      });
    });

    it('should have valid river config ranges', () => {
      PRESETS.forEach(preset => {
        const rc = preset.config.riverConfig;
        expect(rc.sourceElevation).toBeGreaterThanOrEqual(0.5);
        expect(rc.sourceElevation).toBeLessThanOrEqual(0.9);
        expect(rc.minFlowLength).toBeGreaterThanOrEqual(5);
        expect(rc.minFlowLength).toBeLessThanOrEqual(50);
        expect(rc.flowWidth).toBeGreaterThanOrEqual(1);
        expect(rc.flowWidth).toBeLessThanOrEqual(5);
      });
    });

    it('should have valid resource configurations', () => {
      PRESETS.forEach(preset => {
        const rc = preset.config.resourceConfig;
        expect(rc.types).toBeDefined();
        expect(Array.isArray(rc.types)).toBe(true);
        
        rc.types?.forEach(type => {
          expect(type.type).toBeGreaterThanOrEqual(0);
          expect(type.rarity).toBeGreaterThan(0);
          expect(type.rarity).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should have valid structure configurations', () => {
      PRESETS.forEach(preset => {
        const sc = preset.config.structureConfig;
        expect(sc.types).toBeDefined();
        expect(Array.isArray(sc.types)).toBe(true);
        expect(sc.minDistance).toBeGreaterThanOrEqual(5);
        expect(sc.minDistance).toBeLessThanOrEqual(30);
        
        sc.types?.forEach(type => {
          expect(type.type).toBeGreaterThanOrEqual(0);
          expect(type.rarity).toBeGreaterThan(0);
          expect(type.rarity).toBeLessThanOrEqual(1);
        });
      });
    });
  });
});
