/**
 * Configuration validation utilities
 * 
 * Provides validation functions for world generation configuration
 * to prevent invalid inputs and provide clear error messages.
 */

import type { WorldConfig } from '../world/chunk-manager';
import type { TerrainConfig } from '../gen/terrain';
import type { BiomeConfig } from '../world/biome';
import type { ResourceConfig } from '../gen/resources';
import type { StructureConfig } from '../gen/structures';
import type { LakeConfig } from '../gen/lakes';
import type { RiverConfig } from '../gen/rivers';

/**
 * Validation error with detailed context
 */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly constraint: string
  ) {
    super(`Invalid configuration: ${field} = ${value}. ${constraint}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validates that a number is finite and not NaN
 */
function validateFinite(field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new ValidationError(field, value, 'Must be a finite number');
  }
}

/**
 * Validates that a number is within a range (inclusive)
 */
function validateRange(field: string, value: number, min: number, max: number): void {
  validateFinite(field, value);
  if (value < min || value > max) {
    throw new ValidationError(field, value, `Must be between ${min} and ${max}`);
  }
}

/**
 * Validates that a number is positive
 */
function validatePositive(field: string, value: number): void {
  validateFinite(field, value);
  if (value <= 0) {
    throw new ValidationError(field, value, 'Must be positive (> 0)');
  }
}

/**
 * Validates that a number is non-negative
 */
function validateNonNegative(field: string, value: number): void {
  validateFinite(field, value);
  if (value < 0) {
    throw new ValidationError(field, value, 'Must be non-negative (>= 0)');
  }
}

/**
 * Validates terrain generation configuration
 */
export function validateTerrainConfig(config: TerrainConfig): void {
  validatePositive('terrainConfig.baseScale', config.baseScale);
  validateRange('terrainConfig.octaves', config.octaves, 1, 16);
  validateRange('terrainConfig.persistence', config.persistence, 0, 1);
  validatePositive('terrainConfig.lacunarity', config.lacunarity);
  validateNonNegative('terrainConfig.warpStrength', config.warpStrength);
  validatePositive('terrainConfig.heightMultiplier', config.heightMultiplier);

  if (config.enable3D && config.zScale !== undefined) {
    validatePositive('terrainConfig.zScale', config.zScale);
  }

  if (config.enableContinentalness !== false) {
    if (config.continentalScale !== undefined) {
      validatePositive('terrainConfig.continentalScale', config.continentalScale);
    }
    if (config.continentalStrength !== undefined) {
      validateRange('terrainConfig.continentalStrength', config.continentalStrength, 0, 1);
    }
  }
}

/**
 * Validates biome generation configuration
 */
export function validateBiomeConfig(config: BiomeConfig): void {
  validatePositive('biomeConfig.temperatureScale', config.temperatureScale);
  validatePositive('biomeConfig.moistureScale', config.moistureScale);
  validateNonNegative('biomeConfig.blendRadius', config.blendRadius);
}

/**
 * Validates resource generation configuration
 */
export function validateResourceConfig(config: ResourceConfig): void {
  validatePositive('resourceConfig.clusterScale', config.clusterScale);
  validateRange('resourceConfig.densityThreshold', config.densityThreshold, 0, 1);

  if (!Array.isArray(config.types)) {
    throw new ValidationError('resourceConfig.types', config.types, 'Must be an array');
  }

  config.types.forEach((typeConfig, index) => {
    const prefix = `resourceConfig.types[${index}]`;
    validateRange(`${prefix}.rarity`, typeConfig.rarity, 0, 1);
    validatePositive(`${prefix}.minAmount`, typeConfig.minAmount);
    validatePositive(`${prefix}.maxAmount`, typeConfig.maxAmount);

    if (typeConfig.minAmount > typeConfig.maxAmount) {
      throw new ValidationError(
        `${prefix}.minAmount`,
        typeConfig.minAmount,
        `Must be <= maxAmount (${typeConfig.maxAmount})`
      );
    }

    if (!Array.isArray(typeConfig.biomes) || typeConfig.biomes.length === 0) {
      throw new ValidationError(`${prefix}.biomes`, typeConfig.biomes, 'Must be a non-empty array');
    }
  });
}

/**
 * Validates structure placement configuration
 */
export function validateStructureConfig(config: StructureConfig): void {
  validatePositive('structureConfig.minDistance', config.minDistance);
  validatePositive('structureConfig.maxAttempts', config.maxAttempts);

  if (!Array.isArray(config.types)) {
    throw new ValidationError('structureConfig.types', config.types, 'Must be an array');
  }

  config.types.forEach((typeConfig, index) => {
    const prefix = `structureConfig.types[${index}]`;
    validateRange(`${prefix}.rarity`, typeConfig.rarity, 0, 1);

    if (!Array.isArray(typeConfig.rules)) {
      throw new ValidationError(`${prefix}.rules`, typeConfig.rules, 'Must be an array');
    }
  });
}

/**
 * Validates lake generation configuration
 */
export function validateLakeConfig(config: LakeConfig): void {
  validatePositive('lakeConfig.noiseScale', config.noiseScale);
  validateRange('lakeConfig.noiseThreshold', config.noiseThreshold, 0, 1);
  validateRange('lakeConfig.minElevation', config.minElevation, 0, 1);
  validateRange('lakeConfig.maxElevation', config.maxElevation, 0, 1);

  if (config.minElevation >= config.maxElevation) {
    throw new ValidationError(
      'lakeConfig.minElevation',
      config.minElevation,
      `Must be < maxElevation (${config.maxElevation})`
    );
  }

  if (config.maxLakeTiles !== undefined) {
    validatePositive('lakeConfig.maxLakeTiles', config.maxLakeTiles);
  }

  if (config.maxFillDepth !== undefined) {
    validatePositive('lakeConfig.maxFillDepth', config.maxFillDepth);
  }

  if (!Array.isArray(config.allowedBiomes)) {
    throw new ValidationError('lakeConfig.allowedBiomes', config.allowedBiomes, 'Must be an array');
  }
}

/**
 * Validates river generation configuration
 */
export function validateRiverConfig(config: RiverConfig): void {
  validatePositive('riverConfig.sourceNoiseScale', config.sourceNoiseScale);
  validateRange('riverConfig.sourceThreshold', config.sourceThreshold, 0, 1);
  validateRange('riverConfig.minSourceElevation', config.minSourceElevation, 0, 1);
  validateRange('riverConfig.maxSourceElevation', config.maxSourceElevation, 0, 1);

  if (config.minSourceElevation >= config.maxSourceElevation) {
    throw new ValidationError(
      'riverConfig.minSourceElevation',
      config.minSourceElevation,
      `Must be < maxSourceElevation (${config.maxSourceElevation})`
    );
  }

  validatePositive('riverConfig.maxLength', config.maxLength);
  validatePositive('riverConfig.minRiverLength', config.minRiverLength);
  validatePositive('riverConfig.baseWidth', config.baseWidth);
  validatePositive('riverConfig.baseDepth', config.baseDepth);
  validatePositive('riverConfig.carveBankWidth', config.carveBankWidth);
  validateNonNegative('riverConfig.maxUphillBudget', config.maxUphillBudget);
  validateNonNegative('riverConfig.splineResolution', config.splineResolution);

  if (config.minRiverLength >= config.maxLength) {
    throw new ValidationError(
      'riverConfig.minRiverLength',
      config.minRiverLength,
      `Must be < maxLength (${config.maxLength})`
    );
  }

  if (!Array.isArray(config.allowedSourceBiomes) || config.allowedSourceBiomes.length === 0) {
    throw new ValidationError(
      'riverConfig.allowedSourceBiomes',
      config.allowedSourceBiomes,
      'Must be a non-empty array'
    );
  }

  if (!Number.isInteger(config.maxRiversPerRegion) || config.maxRiversPerRegion < 0) {
    throw new ValidationError(
      'riverConfig.maxRiversPerRegion',
      config.maxRiversPerRegion,
      'Must be a non-negative integer'
    );
  }

  if (!Number.isInteger(config.maxTributaries) || config.maxTributaries < 0 || config.maxTributaries > 4) {
    throw new ValidationError(
      'riverConfig.maxTributaries',
      config.maxTributaries,
      'Must be an integer between 0 and 4'
    );
  }
}

/**
 * Validates complete world generation configuration
 * 
 * @param config - World configuration to validate
 * @throws {ValidationError} If any configuration value is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   validateWorldConfig(config);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error(`Invalid ${error.field}: ${error.constraint}`);
 *   }
 * }
 * ```
 */
export function validateWorldConfig(config: WorldConfig): void {
  // Validate core parameters
  validateFinite('seed', config.seed);
  validateRange('chunkSize', config.chunkSize, 4, 256);

  // Validate sub-configurations
  validateTerrainConfig(config.terrainConfig);
  validateBiomeConfig(config.biomeConfig);
  validateResourceConfig(config.resourceConfig);
  validateStructureConfig(config.structureConfig);

  // Validate optional configurations
  if (config.lakeConfig) {
    validateLakeConfig(config.lakeConfig);
  }

  if (config.riverConfig) {
    validateRiverConfig(config.riverConfig);
  }

  if (config.maxCacheSize !== undefined) {
    validateRange('maxCacheSize', config.maxCacheSize, 1, 10000);
  }

  if (config.noise3DConfig?.enable3D) {
    validateRange('noise3DConfig.octaves', config.noise3DConfig.octaves, 1, 16);
    validateRange('noise3DConfig.persistence', config.noise3DConfig.persistence, 0, 1);
    validatePositive('noise3DConfig.lacunarity', config.noise3DConfig.lacunarity);
    validatePositive('noise3DConfig.scale', config.noise3DConfig.scale);

    if (config.noise3DConfig.zScale !== undefined) {
      validatePositive('noise3DConfig.zScale', config.noise3DConfig.zScale);
    }
  }

  if (config.workerPoolConfig) {
    validateRange('workerPoolConfig.maxWorkers', config.workerPoolConfig.maxWorkers, 1, 32);
    validatePositive('workerPoolConfig.taskTimeout', config.workerPoolConfig.taskTimeout);

    if (!config.workerPoolConfig.workerScriptUrl) {
      throw new ValidationError(
        'workerPoolConfig.workerScriptUrl',
        config.workerPoolConfig.workerScriptUrl,
        'Must be a non-empty string'
      );
    }
  }
}
