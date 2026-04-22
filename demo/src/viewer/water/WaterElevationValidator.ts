/**
 * Water elevation validation utilities
 * 
 * Validates that water surfaces are positioned correctly relative to terrain
 * to prevent z-fighting and ensure proper visual appearance.
 */

import * as THREE from 'three';
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
 * Validates ocean water elevations
 * 
 * @param oceanGeometry - Ocean geometry
 * @param config - Water configuration
 * @returns Combined validation result
 */
export function validateWaterElevations(
  oceanGeometry: THREE.BufferGeometry | null,
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

  return result;
}
