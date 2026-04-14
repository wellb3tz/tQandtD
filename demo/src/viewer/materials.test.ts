/**
 * Unit tests for materials module
 */

import { describe, it, expect } from 'vitest';
import {
  BIOME_COLORS,
  getBiomeColor,
  blendBiomeColors,
  extractBiomeWeights,
  calculateBlendedColor,
  toGrayscale,
  lerpColor,
  biomeColorToThree,
  createTerrainMaterial,
  BiomeColor
} from './materials';
import { BiomeType } from '../../../src/world/chunk';
import * as THREE from 'three';

describe('materials', () => {
  describe('getBiomeColor', () => {
    it('should return correct color for each biome type', () => {
      const oceanColor = getBiomeColor(BiomeType.OCEAN);
      expect(oceanColor).toEqual(BIOME_COLORS[BiomeType.OCEAN]);
      
      const forestColor = getBiomeColor(BiomeType.FOREST);
      expect(forestColor).toEqual(BIOME_COLORS[BiomeType.FOREST]);
      
      const desertColor = getBiomeColor(BiomeType.DESERT);
      expect(desertColor).toEqual(BIOME_COLORS[BiomeType.DESERT]);
    });
    
    it('should return default gray for invalid biome', () => {
      const invalidColor = getBiomeColor(999 as BiomeType);
      expect(invalidColor).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
    });
  });
  
  describe('blendBiomeColors', () => {
    it('should return single color when only one biome has weight', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.FOREST, 1.0);
      
      const blended = blendBiomeColors(weights);
      const forestColor = getBiomeColor(BiomeType.FOREST);
      
      expect(blended.r).toBeCloseTo(forestColor.r);
      expect(blended.g).toBeCloseTo(forestColor.g);
      expect(blended.b).toBeCloseTo(forestColor.b);
    });
    
    it('should blend two colors with equal weights', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.FOREST, 0.5);
      weights.set(BiomeType.PLAINS, 0.5);
      
      const blended = blendBiomeColors(weights);
      const forestColor = getBiomeColor(BiomeType.FOREST);
      const plainsColor = getBiomeColor(BiomeType.PLAINS);
      
      const expectedR = (forestColor.r + plainsColor.r) / 2;
      const expectedG = (forestColor.g + plainsColor.g) / 2;
      const expectedB = (forestColor.b + plainsColor.b) / 2;
      
      expect(blended.r).toBeCloseTo(expectedR);
      expect(blended.g).toBeCloseTo(expectedG);
      expect(blended.b).toBeCloseTo(expectedB);
    });
    
    it('should blend multiple colors with different weights', () => {
      const weights = new Map<BiomeType, number>();
      weights.set(BiomeType.FOREST, 0.5);
      weights.set(BiomeType.PLAINS, 0.3);
      weights.set(BiomeType.DESERT, 0.2);
      
      const blended = blendBiomeColors(weights);
      
      // Verify result is within valid color range
      expect(blended.r).toBeGreaterThanOrEqual(0);
      expect(blended.r).toBeLessThanOrEqual(1);
      expect(blended.g).toBeGreaterThanOrEqual(0);
      expect(blended.g).toBeLessThanOrEqual(1);
      expect(blended.b).toBeGreaterThanOrEqual(0);
      expect(blended.b).toBeLessThanOrEqual(1);
    });
  });
  
  describe('extractBiomeWeights', () => {
    it('should extract weights for a position', () => {
      const numBiomes = 8;
      const biomeWeights = new Float32Array(numBiomes * 2); // 2 positions
      
      // Set weights for first position
      biomeWeights[0 * numBiomes + BiomeType.FOREST] = 0.6;
      biomeWeights[0 * numBiomes + BiomeType.PLAINS] = 0.4;
      
      const weights = extractBiomeWeights(biomeWeights, 0, numBiomes);
      
      expect(weights.size).toBe(2);
      expect(weights.get(BiomeType.FOREST)).toBeCloseTo(0.6);
      expect(weights.get(BiomeType.PLAINS)).toBeCloseTo(0.4);
    });
    
    it('should only include biomes with non-zero weights', () => {
      const numBiomes = 8;
      const biomeWeights = new Float32Array(numBiomes);
      
      biomeWeights[BiomeType.FOREST] = 0.7;
      biomeWeights[BiomeType.PLAINS] = 0.3;
      biomeWeights[BiomeType.DESERT] = 0.0; // Zero weight
      
      const weights = extractBiomeWeights(biomeWeights, 0, numBiomes);
      
      expect(weights.size).toBe(2);
      expect(weights.has(BiomeType.DESERT)).toBe(false);
    });
  });
  
  describe('calculateBlendedColor', () => {
    it('should calculate blended color from biome weights', () => {
      const numBiomes = 8;
      const biomeWeights = new Float32Array(numBiomes);
      
      biomeWeights[BiomeType.FOREST] = 0.5;
      biomeWeights[BiomeType.PLAINS] = 0.5;
      
      const color = calculateBlendedColor(biomeWeights, 0, numBiomes);
      
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(1);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(1);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(1);
    });
    
    it('should return default color when no weights available', () => {
      const numBiomes = 8;
      const biomeWeights = new Float32Array(numBiomes); // All zeros
      
      const color = calculateBlendedColor(biomeWeights, 0, numBiomes);
      
      expect(color).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
    });
  });
  
  describe('toGrayscale', () => {
    it('should convert color to grayscale using luminance formula', () => {
      const color: BiomeColor = { r: 1.0, g: 0.0, b: 0.0 }; // Pure red
      const gray = toGrayscale(color);
      
      // Red luminance is 0.299
      expect(gray.r).toBeCloseTo(0.299);
      expect(gray.g).toBeCloseTo(0.299);
      expect(gray.b).toBeCloseTo(0.299);
    });
    
    it('should preserve grayscale colors', () => {
      const color: BiomeColor = { r: 0.5, g: 0.5, b: 0.5 };
      const gray = toGrayscale(color);
      
      expect(gray.r).toBeCloseTo(0.5);
      expect(gray.g).toBeCloseTo(0.5);
      expect(gray.b).toBeCloseTo(0.5);
    });
  });
  
  describe('lerpColor', () => {
    it('should return first color when t=0', () => {
      const color1: BiomeColor = { r: 1.0, g: 0.0, b: 0.0 };
      const color2: BiomeColor = { r: 0.0, g: 1.0, b: 0.0 };
      
      const result = lerpColor(color1, color2, 0);
      
      expect(result).toEqual(color1);
    });
    
    it('should return second color when t=1', () => {
      const color1: BiomeColor = { r: 1.0, g: 0.0, b: 0.0 };
      const color2: BiomeColor = { r: 0.0, g: 1.0, b: 0.0 };
      
      const result = lerpColor(color1, color2, 1);
      
      expect(result).toEqual(color2);
    });
    
    it('should interpolate colors at t=0.5', () => {
      const color1: BiomeColor = { r: 1.0, g: 0.0, b: 0.0 };
      const color2: BiomeColor = { r: 0.0, g: 1.0, b: 0.0 };
      
      const result = lerpColor(color1, color2, 0.5);
      
      expect(result.r).toBeCloseTo(0.5);
      expect(result.g).toBeCloseTo(0.5);
      expect(result.b).toBeCloseTo(0.0);
    });
  });
  
  describe('biomeColorToThree', () => {
    it('should convert BiomeColor to THREE.Color', () => {
      const color: BiomeColor = { r: 0.5, g: 0.7, b: 0.3 };
      const threeColor = biomeColorToThree(color);
      
      expect(threeColor).toBeInstanceOf(THREE.Color);
      expect(threeColor.r).toBeCloseTo(0.5);
      expect(threeColor.g).toBeCloseTo(0.7);
      expect(threeColor.b).toBeCloseTo(0.3);
    });
  });
  
  describe('createTerrainMaterial', () => {
    it('should create material with vertex colors', () => {
      const material = createTerrainMaterial();
      
      expect(material).toBeInstanceOf(THREE.MeshLambertMaterial);
      expect(material.vertexColors).toBe(true);
      expect(material.wireframe).toBe(false);
    });
    
    it('should create wireframe material when requested', () => {
      const material = createTerrainMaterial(true);
      
      expect(material.wireframe).toBe(true);
    });
  });
  
  describe('BIOME_COLORS', () => {
    it('should have colors for all biome types', () => {
      const biomeTypes = [
        BiomeType.OCEAN,
        BiomeType.BEACH,
        BiomeType.DESERT,
        BiomeType.PLAINS,
        BiomeType.FOREST,
        BiomeType.TAIGA,
        BiomeType.TUNDRA,
        BiomeType.MOUNTAIN
      ];
      
      for (const biome of biomeTypes) {
        expect(BIOME_COLORS[biome]).toBeDefined();
        expect(BIOME_COLORS[biome].r).toBeGreaterThanOrEqual(0);
        expect(BIOME_COLORS[biome].r).toBeLessThanOrEqual(1);
        expect(BIOME_COLORS[biome].g).toBeGreaterThanOrEqual(0);
        expect(BIOME_COLORS[biome].g).toBeLessThanOrEqual(1);
        expect(BIOME_COLORS[biome].b).toBeGreaterThanOrEqual(0);
        expect(BIOME_COLORS[biome].b).toBeLessThanOrEqual(1);
      }
    });
  });
});
