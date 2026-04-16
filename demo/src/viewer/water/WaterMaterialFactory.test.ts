/**
 * Unit tests for water material factory
 */

import { describe, it, expect, vi } from 'vitest';
import { createOceanMaterial, createRiverMaterial, createLakeMaterial } from './WaterMaterialFactory';
import { DEFAULT_OCEAN_CONFIG, DEFAULT_RIVER_CONFIG, DEFAULT_LAKE_CONFIG } from './config';

// Mock THREE.js
vi.mock('three', () => import('../__mocks__/three'));

describe('WaterMaterialFactory', () => {
  describe('createOceanMaterial', () => {
    it('should create MeshPhongMaterial with correct properties', () => {
      const material = createOceanMaterial(DEFAULT_OCEAN_CONFIG);
      
      expect(material.constructor.name).toBe('MeshPhongMaterial');
      expect(material.color.r).toBeCloseTo(0.11764705882352941); // 0x1e / 255
      expect(material.color.g).toBeCloseTo(0.5647058823529412); // 0x90 / 255
      expect(material.color.b).toBe(1); // 0xff / 255
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(DEFAULT_OCEAN_CONFIG.opacity);
      expect(material.shininess).toBe(DEFAULT_OCEAN_CONFIG.shininess);
      expect(material.side).toBe(2); // DoubleSide
    });

    it('should apply custom color configuration', () => {
      const customConfig = { ...DEFAULT_OCEAN_CONFIG, color: 0xff0000 };
      const material = createOceanMaterial(customConfig);
      
      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(0);
      expect(material.color.b).toBe(0);
    });

    it('should apply custom opacity configuration', () => {
      const customConfig = { ...DEFAULT_OCEAN_CONFIG, opacity: 0.5 };
      const material = createOceanMaterial(customConfig);
      
      expect(material.opacity).toBe(0.5);
    });

    it('should apply custom shininess configuration', () => {
      const customConfig = { ...DEFAULT_OCEAN_CONFIG, shininess: 50 };
      const material = createOceanMaterial(customConfig);
      
      expect(material.shininess).toBe(50);
    });

    it('should apply optional normal map when provided', async () => {
      const { Texture } = await import('three');
      const normalMap = new Texture();
      const customConfig = { ...DEFAULT_OCEAN_CONFIG, normalMap };
      const material = createOceanMaterial(customConfig);
      
      expect(material.normalMap).toBe(normalMap);
    });

    it('should not have normal map when not provided', () => {
      const material = createOceanMaterial(DEFAULT_OCEAN_CONFIG);
      
      expect(material.normalMap).toBeNull();
    });
  });

  describe('createRiverMaterial', () => {
    it('should create MeshPhongMaterial with correct properties', () => {
      const material = createRiverMaterial(DEFAULT_RIVER_CONFIG);
      
      expect(material.constructor.name).toBe('MeshPhongMaterial');
      expect(material.color.r).toBeCloseTo(0.27450980392156865); // 0x46 / 255
      expect(material.color.g).toBeCloseTo(0.5098039215686274); // 0x82 / 255
      expect(material.color.b).toBeCloseTo(0.7058823529411765); // 0xb4 / 255
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(DEFAULT_RIVER_CONFIG.opacity);
      expect(material.shininess).toBe(DEFAULT_RIVER_CONFIG.shininess);
      expect(material.side).toBe(2); // DoubleSide
    });

    it('should apply custom color configuration', () => {
      const customConfig = { ...DEFAULT_RIVER_CONFIG, color: 0x00ff00 };
      const material = createRiverMaterial(customConfig);
      
      expect(material.color.r).toBe(0);
      expect(material.color.g).toBe(1);
      expect(material.color.b).toBe(0);
    });

    it('should apply custom opacity configuration', () => {
      const customConfig = { ...DEFAULT_RIVER_CONFIG, opacity: 0.8 };
      const material = createRiverMaterial(customConfig);
      
      expect(material.opacity).toBe(0.8);
    });

    it('should apply custom shininess configuration', () => {
      const customConfig = { ...DEFAULT_RIVER_CONFIG, shininess: 15 };
      const material = createRiverMaterial(customConfig);
      
      expect(material.shininess).toBe(15);
    });
  });

  describe('createLakeMaterial', () => {
    it('should create MeshPhongMaterial with correct properties', () => {
      const material = createLakeMaterial(DEFAULT_LAKE_CONFIG);
      
      expect(material.constructor.name).toBe('MeshPhongMaterial');
      expect(material.color.r).toBeCloseTo(0.11764705882352941); // 0x1e / 255
      expect(material.color.g).toBeCloseTo(0.5647058823529412); // 0x90 / 255
      expect(material.color.b).toBe(1); // 0xff / 255
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(DEFAULT_LAKE_CONFIG.opacity);
      expect(material.shininess).toBe(DEFAULT_LAKE_CONFIG.shininess);
      expect(material.side).toBe(2); // DoubleSide
    });

    it('should apply custom color configuration', () => {
      const customConfig = { ...DEFAULT_LAKE_CONFIG, color: 0x0000ff };
      const material = createLakeMaterial(customConfig);
      
      expect(material.color.r).toBe(0);
      expect(material.color.g).toBe(0);
      expect(material.color.b).toBe(1);
    });

    it('should apply custom opacity configuration', () => {
      const customConfig = { ...DEFAULT_LAKE_CONFIG, opacity: 0.75 };
      const material = createLakeMaterial(customConfig);
      
      expect(material.opacity).toBe(0.75);
    });

    it('should apply custom shininess configuration', () => {
      const customConfig = { ...DEFAULT_LAKE_CONFIG, shininess: 35 };
      const material = createLakeMaterial(customConfig);
      
      expect(material.shininess).toBe(35);
    });
  });

  describe('Material distinctness', () => {
    it('should create materials with distinct default properties', () => {
      const oceanMaterial = createOceanMaterial(DEFAULT_OCEAN_CONFIG);
      const riverMaterial = createRiverMaterial(DEFAULT_RIVER_CONFIG);
      const lakeMaterial = createLakeMaterial(DEFAULT_LAKE_CONFIG);
      
      // Ocean and river should have different colors (comparing RGB values)
      const oceanColorMatch = 
        oceanMaterial.color.r === riverMaterial.color.r &&
        oceanMaterial.color.g === riverMaterial.color.g &&
        oceanMaterial.color.b === riverMaterial.color.b;
      expect(oceanColorMatch).toBe(false);
      
      // Ocean and river should have different opacity
      expect(oceanMaterial.opacity).not.toBe(riverMaterial.opacity);
      
      // Ocean and river should have different shininess
      expect(oceanMaterial.shininess).not.toBe(riverMaterial.shininess);
      
      // Lake and river should have different opacity
      expect(lakeMaterial.opacity).not.toBe(riverMaterial.opacity);
      
      // Lake and river should have different shininess
      expect(lakeMaterial.shininess).not.toBe(riverMaterial.shininess);
    });
  });
});
