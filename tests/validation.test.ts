import { describe, it, expect } from 'vitest';
import { validateWorldConfig, ValidationError } from '../src/utils/validation';
import { makeMinimalConfig } from './helpers';
import { BiomeType } from '../src/world/chunk';

describe('Configuration Validation', () => {
  describe('Core parameters', () => {
    it('rejects NaN seed', () => {
      const config = makeMinimalConfig(12345);
      config.seed = NaN;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('seed');
    });

    it('rejects infinite seed', () => {
      const config = makeMinimalConfig(12345);
      config.seed = Infinity;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects negative chunkSize', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = -1;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('chunkSize');
    });

    it('rejects zero chunkSize', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = 0;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects too small chunkSize', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = 2;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('between 4 and 256');
    });

    it('rejects too large chunkSize', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = 512;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('accepts valid chunkSize range', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = 4;
      expect(() => validateWorldConfig(config)).not.toThrow();

      config.chunkSize = 32;
      expect(() => validateWorldConfig(config)).not.toThrow();

      config.chunkSize = 256;
      expect(() => validateWorldConfig(config)).not.toThrow();
    });
  });

  describe('Terrain configuration', () => {
    it('rejects negative baseScale', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.baseScale = -0.01;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('baseScale');
    });

    it('rejects zero octaves', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.octaves = 0;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects too many octaves', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.octaves = 100;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('between 1 and 16');
    });

    it('rejects persistence outside [0, 1]', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.persistence = 1.5;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);

      config.terrainConfig.persistence = -0.1;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects negative lacunarity', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.lacunarity = -2.0;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects negative warpStrength', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.warpStrength = -10;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects negative heightMultiplier', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.heightMultiplier = -1;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects invalid continentalStrength', () => {
      const config = makeMinimalConfig(12345);
      config.terrainConfig.enableContinentalness = true; // Enable to trigger validation
      config.terrainConfig.continentalStrength = 1.5;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });
  });

  describe('Biome configuration', () => {
    it('rejects negative temperatureScale', () => {
      const config = makeMinimalConfig(12345);
      config.biomeConfig.temperatureScale = -0.005;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('temperatureScale');
    });

    it('rejects negative moistureScale', () => {
      const config = makeMinimalConfig(12345);
      config.biomeConfig.moistureScale = -0.005;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects negative blendRadius', () => {
      const config = makeMinimalConfig(12345);
      config.biomeConfig.blendRadius = -5;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });
  });

  describe('Resource configuration', () => {
    it('rejects negative clusterScale', () => {
      const config = makeMinimalConfig(12345);
      config.resourceConfig.clusterScale = -20;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('clusterScale');
    });

    it('rejects densityThreshold outside [0, 1]', () => {
      const config = makeMinimalConfig(12345);
      config.resourceConfig.densityThreshold = 1.5;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects invalid rarity', () => {
      const config = makeMinimalConfig(12345);
      config.resourceConfig.types[0].rarity = 2.0;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('rarity');
    });

    it('rejects minAmount > maxAmount', () => {
      const config = makeMinimalConfig(12345);
      config.resourceConfig.types[0].minAmount = 100;
      config.resourceConfig.types[0].maxAmount = 10;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('minAmount');
    });

    it('rejects empty biomes array', () => {
      const config = makeMinimalConfig(12345);
      config.resourceConfig.types[0].biomes = [];
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('biomes');
    });
  });

  describe('Structure configuration', () => {
    it('rejects negative minDistance', () => {
      const config = makeMinimalConfig(12345);
      config.structureConfig.minDistance = -10;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('minDistance');
    });

    it('rejects zero maxAttempts', () => {
      const config = makeMinimalConfig(12345);
      config.structureConfig.maxAttempts = 0;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });
  });

  describe('Lake configuration', () => {
    it('rejects negative noiseScale', () => {
      const config = makeMinimalConfig(12345);
      config.lakeConfig = {
        enabled: true,
        noiseScale: -0.01,
        noiseThreshold: 0.62,
        minElevation: 0.32,
        maxElevation: 0.72,
        maxLakeTiles: 200,
        maxFillDepth: 0.1,
        allowedBiomes: [BiomeType.PLAINS],
      };
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('noiseScale');
    });

    it('rejects minElevation >= maxElevation', () => {
      const config = makeMinimalConfig(12345);
      config.lakeConfig = {
        enabled: true,
        noiseScale: 0.01,
        noiseThreshold: 0.62,
        minElevation: 0.8,
        maxElevation: 0.5,
        maxLakeTiles: 200,
        maxFillDepth: 0.1,
        allowedBiomes: [BiomeType.PLAINS],
      };
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('minElevation');
    });
  });

  describe('River configuration', () => {
    it('rejects invalid source elevation range', () => {
      const config = makeMinimalConfig(12345);
      config.riverConfig = {
        enabled: true,
        sourceNoiseScale: 0.006,
        sourceThreshold: 0.72,
        minSourceElevation: 0.8,
        maxSourceElevation: 0.5,
        allowedSourceBiomes: [BiomeType.MOUNTAIN],
        maxLength: 512,
        maxUphillBudget: 0.08,
        minRiverLength: 32,
        maxRiversPerRegion: 2,
        maxTributaries: 2,
        baseWidth: 1.6,
        baseDepth: 0.035,
        carveBankWidth: 2.5,
      };

      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('minSourceElevation');
    });

    it('accepts valid river config', () => {
      const config = makeMinimalConfig(12345);
      config.riverConfig = {
        enabled: true,
        sourceNoiseScale: 0.006,
        sourceThreshold: 0.72,
        minSourceElevation: 0.45,
        maxSourceElevation: 0.85,
        allowedSourceBiomes: [BiomeType.MOUNTAIN, BiomeType.FOREST],
        maxLength: 512,
        maxUphillBudget: 0.08,
        minRiverLength: 32,
        maxRiversPerRegion: 2,
        maxTributaries: 2,
        baseWidth: 1.6,
        baseDepth: 0.035,
        carveBankWidth: 2.5,
      };

      expect(() => validateWorldConfig(config)).not.toThrow();
    });
  });

  describe('Optional configurations', () => {
    it('rejects invalid maxCacheSize', () => {
      const config = makeMinimalConfig(12345);
      config.maxCacheSize = 0;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);

      config.maxCacheSize = 20000;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects invalid worker pool config', () => {
      const config = makeMinimalConfig(12345);
      config.workerPoolConfig = {
        maxWorkers: 0,
        workerScriptUrl: 'worker.js',
        taskTimeout: 30000,
      };
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);

      config.workerPoolConfig.maxWorkers = 100;
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
    });

    it('rejects empty workerScriptUrl', () => {
      const config = makeMinimalConfig(12345);
      config.workerPoolConfig = {
        maxWorkers: 4,
        workerScriptUrl: '',
        taskTimeout: 30000,
      };
      expect(() => validateWorldConfig(config)).toThrow(ValidationError);
      expect(() => validateWorldConfig(config)).toThrow('workerScriptUrl');
    });
  });

  describe('Valid configurations', () => {
    it('accepts minimal valid config', () => {
      const config = makeMinimalConfig(12345);
      expect(() => validateWorldConfig(config)).not.toThrow();
    });

    it('accepts config with all optional features', () => {
      const config = makeMinimalConfig(12345);
      config.maxCacheSize = 200;
      config.enablePerformanceMetrics = true;
      config.lakeConfig = {
        enabled: true,
        noiseScale: 0.01,
        noiseThreshold: 0.62,
        minElevation: 0.32,
        maxElevation: 0.72,
        maxLakeTiles: 200,
        maxFillDepth: 0.1,
        allowedBiomes: [BiomeType.PLAINS, BiomeType.FOREST],
      };
      expect(() => validateWorldConfig(config)).not.toThrow();
    });
  });

  describe('ValidationError', () => {
    it('provides detailed error information', () => {
      const config = makeMinimalConfig(12345);
      config.chunkSize = -5;

      try {
        validateWorldConfig(config);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.field).toBe('chunkSize');
        expect(validationError.value).toBe(-5);
        expect(validationError.constraint).toContain('between 4 and 256');
        expect(validationError.message).toContain('chunkSize');
        expect(validationError.message).toContain('-5');
      }
    });
  });
});
