/**
 * Unit tests for underwater terrain processor
 * 
 * Tests color darkening, desaturation, depth gradient, and ocean biome exclusion.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSaturation,
  calculateBrightness,
  darkenColor,
  desaturateColor,
  applyDepthGradient,
  adjustUnderwaterColor,
  adjustUnderwaterColors,
  getUnderwaterAdjustmentDetails,
  type UnderwaterAdjustmentConfig,
} from './UnderwaterTerrainProcessor';
import { BiomeType } from '../../../../src/world/chunk';
import { BIOME_COLORS } from '../materials';

describe('UnderwaterTerrainProcessor', () => {
  const defaultConfig: UnderwaterAdjustmentConfig = {
    seaLevel: 0.3,
    darkenFactor: 0.4,
    desaturationFactor: 0.5,
    enableDepthGradient: true,
  };

  describe('calculateSaturation', () => {
    it('should return 0 for grayscale colors', () => {
      const gray = { r: 0.5, g: 0.5, b: 0.5 };
      expect(calculateSaturation(gray)).toBe(0);
    });

    it('should return high saturation for pure colors', () => {
      const red = { r: 1, g: 0, b: 0 };
      expect(calculateSaturation(red)).toBe(1);
    });

    it('should return 0 for black', () => {
      const black = { r: 0, g: 0, b: 0 };
      expect(calculateSaturation(black)).toBe(0);
    });

    it('should return intermediate saturation for mixed colors', () => {
      const color = { r: 0.8, g: 0.4, b: 0.4 };
      const saturation = calculateSaturation(color);
      expect(saturation).toBeGreaterThan(0);
      expect(saturation).toBeLessThan(1);
    });
  });

  describe('calculateBrightness', () => {
    it('should return max component value', () => {
      const color = { r: 0.3, g: 0.7, b: 0.5 };
      expect(calculateBrightness(color)).toBe(0.7);
    });

    it('should return 0 for black', () => {
      const black = { r: 0, g: 0, b: 0 };
      expect(calculateBrightness(black)).toBe(0);
    });

    it('should return 1 for colors with max component', () => {
      const color = { r: 1, g: 0.5, b: 0.3 };
      expect(calculateBrightness(color)).toBe(1);
    });
  });

  describe('darkenColor', () => {
    it('should darken color by specified factor', () => {
      const color = { r: 1, g: 0.8, b: 0.6 };
      const darkened = darkenColor(color, 0.4);
      
      expect(darkened.r).toBeCloseTo(0.6);
      expect(darkened.g).toBeCloseTo(0.48);
      expect(darkened.b).toBeCloseTo(0.36);
    });

    it('should return black when factor is 1', () => {
      const color = { r: 0.5, g: 0.5, b: 0.5 };
      const darkened = darkenColor(color, 1);
      
      expect(darkened.r).toBe(0);
      expect(darkened.g).toBe(0);
      expect(darkened.b).toBe(0);
    });

    it('should return original color when factor is 0', () => {
      const color = { r: 0.5, g: 0.5, b: 0.5 };
      const darkened = darkenColor(color, 0);
      
      expect(darkened.r).toBe(color.r);
      expect(darkened.g).toBe(color.g);
      expect(darkened.b).toBe(color.b);
    });

    it('should darken within 30-50% range', () => {
      const color = { r: 1, g: 1, b: 1 };
      
      const darkened30 = darkenColor(color, 0.3);
      expect(darkened30.r).toBeCloseTo(0.7);
      
      const darkened50 = darkenColor(color, 0.5);
      expect(darkened50.r).toBeCloseTo(0.5);
    });
  });

  describe('desaturateColor', () => {
    it('should reduce color saturation', () => {
      const color = { r: 1, g: 0, b: 0 };
      const desaturated = desaturateColor(color, 0.5);
      
      const originalSaturation = calculateSaturation(color);
      const newSaturation = calculateSaturation(desaturated);
      
      expect(newSaturation).toBeLessThan(originalSaturation);
    });

    it('should convert to grayscale when factor is 1', () => {
      const color = { r: 1, g: 0, b: 0 };
      const desaturated = desaturateColor(color, 1);
      
      // Should be grayscale (all components equal)
      expect(desaturated.r).toBeCloseTo(desaturated.g);
      expect(desaturated.g).toBeCloseTo(desaturated.b);
    });

    it('should not change color when factor is 0', () => {
      const color = { r: 0.8, g: 0.4, b: 0.2 };
      const desaturated = desaturateColor(color, 0);
      
      expect(desaturated.r).toBeCloseTo(color.r);
      expect(desaturated.g).toBeCloseTo(color.g);
      expect(desaturated.b).toBeCloseTo(color.b);
    });

    it('should preserve luminance', () => {
      const color = { r: 0.8, g: 0.4, b: 0.2 };
      const desaturated = desaturateColor(color, 0.5);
      
      const originalLuminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
      const newLuminance = 0.299 * desaturated.r + 0.587 * desaturated.g + 0.114 * desaturated.b;
      
      expect(newLuminance).toBeCloseTo(originalLuminance, 5);
    });
  });

  describe('applyDepthGradient', () => {
    it('should increase darkening factor with depth', () => {
      const baseFactor = 0.4;
      const seaLevel = 0.3;
      
      const shallow = applyDepthGradient(baseFactor, 0.05, seaLevel);
      const deep = applyDepthGradient(baseFactor, 0.2, seaLevel);
      
      expect(deep).toBeGreaterThan(shallow);
    });

    it('should not exceed 1.0', () => {
      const baseFactor = 0.9;
      const seaLevel = 0.3;
      const depth = 0.3;
      
      const adjusted = applyDepthGradient(baseFactor, depth, seaLevel);
      
      expect(adjusted).toBeLessThanOrEqual(1);
    });

    it('should return base factor for zero depth', () => {
      const baseFactor = 0.4;
      const seaLevel = 0.3;
      
      const adjusted = applyDepthGradient(baseFactor, 0, seaLevel);
      
      expect(adjusted).toBe(baseFactor);
    });

    it('should apply up to 20% additional darkening at max depth', () => {
      const baseFactor = 0.4;
      const seaLevel = 0.3;
      const maxDepth = seaLevel;
      
      const adjusted = applyDepthGradient(baseFactor, maxDepth, seaLevel);
      
      expect(adjusted).toBeCloseTo(baseFactor * 1.2);
    });
  });

  describe('adjustUnderwaterColor', () => {
    it('should return original color for above-water terrain', () => {
      const color = { r: 0.5, g: 0.7, b: 0.3 };
      const terrainHeight = 0.5;
      
      const adjusted = adjustUnderwaterColor(color, terrainHeight, defaultConfig);
      
      expect(adjusted).toEqual(color);
    });

    it('should darken underwater terrain', () => {
      const color = { r: 0.8, g: 0.8, b: 0.8 };
      const terrainHeight = 0.2;
      
      const adjusted = adjustUnderwaterColor(color, terrainHeight, defaultConfig);
      
      expect(calculateBrightness(adjusted)).toBeLessThan(calculateBrightness(color));
    });

    it('should desaturate underwater terrain', () => {
      const color = { r: 1, g: 0, b: 0 };
      const terrainHeight = 0.2;
      
      const adjusted = adjustUnderwaterColor(color, terrainHeight, defaultConfig);
      
      expect(calculateSaturation(adjusted)).toBeLessThan(calculateSaturation(color));
    });

    it('should apply depth gradient when enabled', () => {
      const color = { r: 0.8, g: 0.8, b: 0.8 };
      const shallowHeight = 0.25;
      const deepHeight = 0.1;
      
      const shallowAdjusted = adjustUnderwaterColor(color, shallowHeight, defaultConfig);
      const deepAdjusted = adjustUnderwaterColor(color, deepHeight, defaultConfig);
      
      expect(calculateBrightness(deepAdjusted)).toBeLessThan(calculateBrightness(shallowAdjusted));
    });

    it('should not apply depth gradient when disabled', () => {
      const color = { r: 0.8, g: 0.8, b: 0.8 };
      const shallowHeight = 0.25;
      const deepHeight = 0.1;
      const config = { ...defaultConfig, enableDepthGradient: false };
      
      const shallowAdjusted = adjustUnderwaterColor(color, shallowHeight, config);
      const deepAdjusted = adjustUnderwaterColor(color, deepHeight, config);
      
      // Brightness difference should be minimal (only from desaturation)
      const brightnessDiff = Math.abs(
        calculateBrightness(deepAdjusted) - calculateBrightness(shallowAdjusted)
      );
      expect(brightnessDiff).toBeLessThan(0.01);
    });
  });

  describe('adjustUnderwaterColors', () => {
    it('should process all tiles in chunk', () => {
      const chunkSize = 4;
      const heightmap = new Float32Array(chunkSize * chunkSize).fill(0.2);
      const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
      
      // Set all tiles to plains biome
      for (let i = 0; i < chunkSize * chunkSize; i++) {
        biomeWeights[i * 8 + BiomeType.PLAINS] = 1.0;
      }
      
      const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, defaultConfig);
      
      expect(colors).toHaveLength(chunkSize * chunkSize);
    });

    it('should exclude ocean biome from underwater terrain', () => {
      const chunkSize = 2;
      const heightmap = new Float32Array([0.2, 0.2, 0.2, 0.2]);
      const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
      
      // Set all tiles to ocean biome
      for (let i = 0; i < chunkSize * chunkSize; i++) {
        biomeWeights[i * 8 + BiomeType.OCEAN] = 1.0;
      }
      
      const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, defaultConfig);
      const oceanColor = BIOME_COLORS[BiomeType.OCEAN];
      
      // Colors should not be ocean color (should fallback to beach)
      for (const color of colors) {
        const isOceanColor = 
          Math.abs(color.r - oceanColor.r) < 0.01 &&
          Math.abs(color.g - oceanColor.g) < 0.01 &&
          Math.abs(color.b - oceanColor.b) < 0.01;
        expect(isOceanColor).toBe(false);
      }
    });

    it('should use underlying terrain biome for underwater tiles', () => {
      const chunkSize = 2;
      const heightmap = new Float32Array([0.2, 0.2, 0.2, 0.2]);
      const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
      
      // Set tiles to beach biome
      for (let i = 0; i < chunkSize * chunkSize; i++) {
        biomeWeights[i * 8 + BiomeType.BEACH] = 1.0;
      }
      
      const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, defaultConfig);
      
      // Colors should be darkened/desaturated beach colors
      for (const color of colors) {
        expect(calculateBrightness(color)).toBeGreaterThan(0);
        expect(calculateBrightness(color)).toBeLessThan(1);
      }
    });

    it('should blend multiple biomes excluding ocean', () => {
      const chunkSize = 2;
      const heightmap = new Float32Array([0.2, 0.2, 0.2, 0.2]);
      const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
      
      // Set tiles to 50% ocean, 50% beach
      for (let i = 0; i < chunkSize * chunkSize; i++) {
        biomeWeights[i * 8 + BiomeType.OCEAN] = 0.5;
        biomeWeights[i * 8 + BiomeType.BEACH] = 0.5;
      }
      
      const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, defaultConfig);
      
      // Should use beach color (ocean excluded)
      const beachColor = BIOME_COLORS[BiomeType.BEACH];
      for (const color of colors) {
        // Color should be darkened beach color
        expect(calculateBrightness(color)).toBeLessThan(calculateBrightness(beachColor));
      }
    });

    it('should not adjust above-water tiles', () => {
      const chunkSize = 2;
      const heightmap = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
      
      // Set tiles to plains biome
      for (let i = 0; i < chunkSize * chunkSize; i++) {
        biomeWeights[i * 8 + BiomeType.PLAINS] = 1.0;
      }
      
      const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, defaultConfig);
      const plainsColor = BIOME_COLORS[BiomeType.PLAINS];
      
      // Colors should match plains color (no adjustment)
      for (const color of colors) {
        expect(color.r).toBeCloseTo(plainsColor.r);
        expect(color.g).toBeCloseTo(plainsColor.g);
        expect(color.b).toBeCloseTo(plainsColor.b);
      }
    });
  });

  describe('getUnderwaterAdjustmentDetails', () => {
    it('should return detailed adjustment information', () => {
      const color = { r: 0.8, g: 0.6, b: 0.4 };
      const terrainHeight = 0.2;
      
      const details = getUnderwaterAdjustmentDetails(color, terrainHeight, defaultConfig);
      
      expect(details.originalColor).toEqual(color);
      expect(details.adjustedColor).toBeDefined();
      expect(details.depth).toBeCloseTo(0.1);
      expect(details.darkenFactor).toBeGreaterThanOrEqual(0.3);
      expect(details.darkenFactor).toBeLessThanOrEqual(0.5);
      expect(details.desaturationFactor).toBe(0.5);
    });

    it('should show zero depth for above-water terrain', () => {
      const color = { r: 0.8, g: 0.6, b: 0.4 };
      const terrainHeight = 0.5;
      
      const details = getUnderwaterAdjustmentDetails(color, terrainHeight, defaultConfig);
      
      expect(details.depth).toBe(0);
    });

    it('should show increased darken factor with depth gradient', () => {
      const color = { r: 0.8, g: 0.6, b: 0.4 };
      const deepHeight = 0.1;
      
      const details = getUnderwaterAdjustmentDetails(color, deepHeight, defaultConfig);
      
      expect(details.darkenFactor).toBeGreaterThan(defaultConfig.darkenFactor);
    });
  });
});
