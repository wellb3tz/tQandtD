/**
 * Water elevation validation utilities
 * 
 * Validates that water surfaces are positioned correctly relative to terrain
 * to prevent z-fighting and ensure proper visual appearance.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/world/chunk';
import type { RiverNetwork, Lake } from '@engine/gen/rivers';
import type { WaterConfig } from './types';

/**
 * Validation result for water elevation
 */
export interface ElevationValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages if validation failed */
  errors: string[];
  /** Warning messages */
  warnings: string[];
}

/**
 * Validate ocean water elevation
 * 
 * Verifies that ocean water is positioned at seaLevel + waterOffset
 * 
 * @param geometry - Ocean geometry to validate
 * @param config - Water configuration
 * @returns Validation result
 */
export function validateOceanElevation(
  geometry: THREE.BufferGeometry | null,
  config: WaterConfig
): ElevationValidationResult {
  const result: ElevationValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!geometry) {
    return result; // No geometry to validate
  }

  const heightScale = 50; // Must match WorldViewer's heightScale
  const expectedElevation = (config.seaLevel + config.rendering.waterOffset) * heightScale;
  const positions = geometry.getAttribute('position');
  const tolerance = 0.001;

  // Check all vertices have correct elevation
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    
    if (Math.abs(y - expectedElevation) > tolerance) {
      result.valid = false;
      result.errors.push(
        `Ocean vertex ${i} has incorrect elevation ${y}, expected ${expectedElevation}`
      );
    }
  }

  return result;
}

/**
 * Validate river water elevation
 * 
 * Verifies that river water is positioned at terrain height + waterOffset
 * 
 * @param geometry - River geometry to validate
 * @param chunkData - Chunk data with heightmap
 * @param config - Water configuration
 * @returns Validation result
 */
export function validateRiverElevation(
  geometry: THREE.BufferGeometry | null,
  chunkData: ChunkData,
  config: WaterConfig
): ElevationValidationResult {
  const result: ElevationValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!geometry) {
    return result; // No geometry to validate
  }

  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const heightScale = 50; // Must match WorldViewer's heightScale
  const waterOffset = config.rendering.waterOffset * heightScale;
  const positions = geometry.getAttribute('position');
  const tolerance = 0.01 * heightScale; // Slightly larger tolerance for river interpolation

  // Check vertices are at terrain height + waterOffset
  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localY = positions.getY(i);
    const localZ = positions.getZ(i);

    // Sample terrain height at this position
    const x = Math.floor(Math.min(localX, size - 1));
    const z = Math.floor(Math.min(localZ, size - 1));
    const heightIndex = z * vertexSize + x;
    const terrainHeight = heightmap[heightIndex] * heightScale;
    const expectedElevation = terrainHeight + waterOffset;

    if (Math.abs(localY - expectedElevation) > tolerance) {
      result.valid = false;
      result.errors.push(
        `River vertex ${i} at (${localX}, ${localZ}) has elevation ${localY}, ` +
        `expected ${expectedElevation} (terrain: ${terrainHeight} + offset: ${waterOffset})`
      );
    }
  }

  return result;
}

/**
 * Validate lake water elevation
 * 
 * Verifies that lake water is positioned at lake elevation + waterOffset
 * 
 * @param geometry - Lake geometry to validate
 * @param lake - Lake data with elevation
 * @param config - Water configuration
 * @returns Validation result
 */
export function validateLakeElevation(
  geometry: THREE.BufferGeometry | null,
  lake: Lake,
  config: WaterConfig
): ElevationValidationResult {
  const result: ElevationValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!geometry) {
    return result; // No geometry to validate
  }

  const heightScale = 50; // Must match WorldViewer's heightScale
  const expectedElevation = (lake.elevation + config.rendering.waterOffset) * heightScale;
  const positions = geometry.getAttribute('position');
  const tolerance = 0.001;

  // Check all vertices have correct elevation
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    
    if (Math.abs(y - expectedElevation) > tolerance) {
      result.valid = false;
      result.errors.push(
        `Lake vertex ${i} has incorrect elevation ${y}, expected ${expectedElevation}`
      );
    }
  }

  return result;
}

/**
 * Validate z-fighting prevention
 * 
 * Verifies that water offset is sufficient to prevent z-fighting with terrain
 * 
 * @param config - Water configuration
 * @returns Validation result
 */
export function validateZFightingPrevention(
  config: WaterConfig
): ElevationValidationResult {
  const result: ElevationValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const minOffset = 0.05; // Minimum recommended offset
  const recommendedOffset = 0.1;

  if (config.rendering.waterOffset < minOffset) {
    result.valid = false;
    result.errors.push(
      `Water offset ${config.rendering.waterOffset} is too small, ` +
      `minimum ${minOffset} required to prevent z-fighting`
    );
  } else if (config.rendering.waterOffset < recommendedOffset) {
    result.warnings.push(
      `Water offset ${config.rendering.waterOffset} is below recommended value ${recommendedOffset}`
    );
  }

  return result;
}

/**
 * Validate all water elevations in a chunk
 * 
 * Comprehensive validation of ocean, river, and lake water elevations
 * 
 * @param oceanGeometry - Ocean geometry
 * @param riverGeometries - Array of river geometries
 * @param lakeGeometries - Array of lake geometries with lake data
 * @param chunkData - Chunk data
 * @param riverNetwork - River network data
 * @param config - Water configuration
 * @returns Combined validation result
 */
export function validateWaterElevations(
  oceanGeometry: THREE.BufferGeometry | null,
  riverGeometries: THREE.BufferGeometry[],
  lakeGeometries: Array<{ geometry: THREE.BufferGeometry; lake: Lake }>,
  chunkData: ChunkData,
  riverNetwork: RiverNetwork | undefined,
  config: WaterConfig
): ElevationValidationResult {
  const result: ElevationValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Validate z-fighting prevention
  const zFightingResult = validateZFightingPrevention(config);
  result.errors.push(...zFightingResult.errors);
  result.warnings.push(...zFightingResult.warnings);
  result.valid = result.valid && zFightingResult.valid;

  // Validate ocean elevation
  const oceanResult = validateOceanElevation(oceanGeometry, config);
  result.errors.push(...oceanResult.errors);
  result.warnings.push(...oceanResult.warnings);
  result.valid = result.valid && oceanResult.valid;

  // Validate river elevations
  for (let i = 0; i < riverGeometries.length; i++) {
    const riverResult = validateRiverElevation(riverGeometries[i], chunkData, config);
    result.errors.push(...riverResult.errors.map(e => `River ${i}: ${e}`));
    result.warnings.push(...riverResult.warnings.map(w => `River ${i}: ${w}`));
    result.valid = result.valid && riverResult.valid;
  }

  // Validate lake elevations
  for (let i = 0; i < lakeGeometries.length; i++) {
    const { geometry, lake } = lakeGeometries[i];
    const lakeResult = validateLakeElevation(geometry, lake, config);
    result.errors.push(...lakeResult.errors.map(e => `Lake ${i}: ${e}`));
    result.warnings.push(...lakeResult.warnings.map(w => `Lake ${i}: ${w}`));
    result.valid = result.valid && lakeResult.valid;
  }

  return result;
}
