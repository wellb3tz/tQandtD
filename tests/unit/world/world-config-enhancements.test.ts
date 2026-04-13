import { describe, it, expect } from 'vitest';
import { WorldConfig, Noise3DConfig } from '../../../src/world/chunk-manager';
import { EnhancedBiomeConfig } from '../../../src/world/enhanced-biome';
import { RiverNetworkConfig } from '../../../src/gen/rivers';
import { WorkerPoolConfig } from '../../../src/world/worker-pool';
import { LODConfig } from '../../../src/world/lod';
import { IncrementalConfig } from '../../../src/world/chunk';

describe('WorldConfig Enhancements', () => {
  it('should allow noise3DConfig to be added to WorldConfig', () => {
    const noise3DConfig: Noise3DConfig = {
      enable3D: true,
      zScale: 1.0,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 0.01,
    };

    const config: Partial<WorldConfig> = {
      noise3DConfig,
    };

    expect(config.noise3DConfig).toBeDefined();
    expect(config.noise3DConfig?.enable3D).toBe(true);
    expect(config.noise3DConfig?.zScale).toBe(1.0);
  });

  it('should allow enhancedBiomeConfig to be added to WorldConfig', () => {
    const enhancedBiomeConfig: EnhancedBiomeConfig = {
      temperatureScale: 0.01,
      moistureScale: 0.01,
      enableTransitions: true,
      transitionWidth: 10,
      enableMicroBiomes: true,
      microBiomeFrequency: 0.1,
      microBiomeMaxSize: 20,
      enableElevationBands: true,
      snowLineElevation: 0.8,
      treeLineElevation: 0.75,
    };

    const config: Partial<WorldConfig> = {
      enhancedBiomeConfig,
    };

    expect(config.enhancedBiomeConfig).toBeDefined();
    expect(config.enhancedBiomeConfig?.enableTransitions).toBe(true);
    expect(config.enhancedBiomeConfig?.transitionWidth).toBe(10);
  });

  it('should allow riverNetworkConfig to be added to WorldConfig', () => {
    const riverNetworkConfig: RiverNetworkConfig = {
      sourceElevation: 0.7,
      minFlowLength: 10,
      flowWidth: 2,
      enableTributaries: true,
      maxTributaryOrder: 2,
      tributaryProbability: 0.3,
      enableLakes: true,
      lakeDepressionThreshold: 0.05,
      maxLakeSize: 100,
      enableDeltas: true,
      deltaBranchCount: 3,
      deltaSpreadAngle: Math.PI / 3,
      minFlow: 1.0,
      maxFlow: 100.0,
      widthScale: 0.5,
    };

    const config: Partial<WorldConfig> = {
      riverNetworkConfig,
    };

    expect(config.riverNetworkConfig).toBeDefined();
    expect(config.riverNetworkConfig?.enableTributaries).toBe(true);
    expect(config.riverNetworkConfig?.enableLakes).toBe(true);
  });

  it('should allow workerPoolConfig to be added to WorldConfig', () => {
    const workerPoolConfig: WorkerPoolConfig = {
      maxWorkers: 4,
      workerScriptUrl: '/worker.js',
      taskTimeout: 30000,
    };

    const config: Partial<WorldConfig> = {
      workerPoolConfig,
    };

    expect(config.workerPoolConfig).toBeDefined();
    expect(config.workerPoolConfig?.maxWorkers).toBe(4);
    expect(config.workerPoolConfig?.taskTimeout).toBe(30000);
  });

  it('should verify lodConfig already exists in WorldConfig', () => {
    const lodConfig: LODConfig = {
      distances: [2, 5, 10],
      meshResolutions: [1.0, 0.5, 0.25],
      featureDensities: [1.0, 0.5, 0.25],
    };

    const config: Partial<WorldConfig> = {
      lodConfig,
    };

    expect(config.lodConfig).toBeDefined();
    expect(config.lodConfig?.distances).toEqual([2, 5, 10]);
  });

  it('should verify incrementalConfig already exists in WorldConfig', () => {
    const incrementalConfig: IncrementalConfig = {
      enabled: true,
      timeBudgetMs: 16,
    };

    const config: Partial<WorldConfig> = {
      incrementalConfig,
    };

    expect(config.incrementalConfig).toBeDefined();
    expect(config.incrementalConfig?.enabled).toBe(true);
  });

  it('should allow all new config options together in WorldConfig', () => {
    const config: Partial<WorldConfig> = {
      noise3DConfig: {
        enable3D: true,
        zScale: 1.0,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 0.01,
      },
      enhancedBiomeConfig: {
        temperatureScale: 0.01,
        moistureScale: 0.01,
        enableTransitions: true,
        transitionWidth: 10,
        enableMicroBiomes: true,
        microBiomeFrequency: 0.1,
        microBiomeMaxSize: 20,
        enableElevationBands: true,
        snowLineElevation: 0.8,
        treeLineElevation: 0.75,
      },
      riverNetworkConfig: {
        sourceElevation: 0.7,
        minFlowLength: 10,
        flowWidth: 2,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: true,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      },
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
      lodConfig: {
        distances: [2, 5, 10],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      },
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: 16,
      },
    };

    expect(config.noise3DConfig).toBeDefined();
    expect(config.enhancedBiomeConfig).toBeDefined();
    expect(config.riverNetworkConfig).toBeDefined();
    expect(config.workerPoolConfig).toBeDefined();
    expect(config.lodConfig).toBeDefined();
    expect(config.incrementalConfig).toBeDefined();
  });

  it('should maintain backward compatibility with all config options being optional', () => {
    // A minimal WorldConfig should still be valid without the new options
    const minimalConfig: Partial<WorldConfig> = {
      seed: 12345,
      chunkSize: 32,
    };

    expect(minimalConfig.noise3DConfig).toBeUndefined();
    expect(minimalConfig.enhancedBiomeConfig).toBeUndefined();
    expect(minimalConfig.riverNetworkConfig).toBeUndefined();
    expect(minimalConfig.workerPoolConfig).toBeUndefined();
    // lodConfig and incrementalConfig were already optional
    expect(minimalConfig.lodConfig).toBeUndefined();
    expect(minimalConfig.incrementalConfig).toBeUndefined();
  });
});
