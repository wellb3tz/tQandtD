import { describe, test, expect } from 'vitest';
import { BiomeSystem, BiomeConfig } from '../../../src/world/biome';
import { BiomeType } from '../../../src/world/chunk';

describe('BiomeSystem', () => {
  const defaultConfig: BiomeConfig = {
    temperatureScale: 0.01,
    moistureScale: 0.01,
    blendRadius: 2.0,
  };

  test('returns OCEAN biome for low heights', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    // Test various positions with low height
    const biome1 = biomeSystem.getBiome(0, 0, 0.1);
    const biome2 = biomeSystem.getBiome(100, 200, 0.25);
    const biome3 = biomeSystem.getBiome(-50, 75, 0.29);
    
    expect(biome1).toBe(BiomeType.OCEAN);
    expect(biome2).toBe(BiomeType.OCEAN);
    expect(biome3).toBe(BiomeType.OCEAN);
  });

  test('returns BEACH biome for heights just above ocean', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    const biome1 = biomeSystem.getBiome(0, 0, 0.31);
    const biome2 = biomeSystem.getBiome(50, 50, 0.34);
    
    expect(biome1).toBe(BiomeType.BEACH);
    expect(biome2).toBe(BiomeType.BEACH);
  });

  test('returns MOUNTAIN biome for high heights', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    // Test various positions with high height
    const biome1 = biomeSystem.getBiome(0, 0, 0.75);
    const biome2 = biomeSystem.getBiome(100, 200, 0.85);
    const biome3 = biomeSystem.getBiome(-50, 75, 0.95);
    
    expect(biome1).toBe(BiomeType.MOUNTAIN);
    expect(biome2).toBe(BiomeType.MOUNTAIN);
    expect(biome3).toBe(BiomeType.MOUNTAIN);
  });

  test('temperature and moisture affect biome selection', () => {
    const biomeSystem = new BiomeSystem(54321, defaultConfig);
    
    // Test at medium height where temperature/moisture matter
    const height = 0.5;
    
    // Sample multiple positions to find different biomes
    const biomes = new Set<BiomeType>();
    for (let x = 0; x < 1000; x += 100) {
      for (let y = 0; y < 1000; y += 100) {
        const biome = biomeSystem.getBiome(x, y, height);
        biomes.add(biome);
      }
    }
    
    // Should have found multiple different biome types (not just one)
    expect(biomes.size).toBeGreaterThan(1);
    
    // Should not include height-based biomes at this height
    expect(biomes.has(BiomeType.OCEAN)).toBe(false);
    expect(biomes.has(BiomeType.BEACH)).toBe(false);
    expect(biomes.has(BiomeType.MOUNTAIN)).toBe(false);
  });

  test('getTemperature returns values in valid range', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 1000 - 500;
      const y = Math.random() * 1000 - 500;
      const temp = biomeSystem.getTemperature(x, y);
      
      expect(temp).toBeGreaterThanOrEqual(-1);
      expect(temp).toBeLessThanOrEqual(1);
    }
  });

  test('getMoisture returns values in valid range', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 1000 - 500;
      const y = Math.random() * 1000 - 500;
      const moisture = biomeSystem.getMoisture(x, y);
      
      expect(moisture).toBeGreaterThanOrEqual(-1);
      expect(moisture).toBeLessThanOrEqual(1);
    }
  });

  test('getBiomeWeights returns normalized weights that sum to 1.0', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    // Test at various positions
    const positions = [
      { x: 0, y: 0, height: 0.5 },
      { x: 100, y: 200, height: 0.6 },
      { x: -50, y: 75, height: 0.45 },
    ];
    
    for (const pos of positions) {
      // Create height callback that returns the same height for all positions
      const getHeight = () => pos.height;
      const weights = biomeSystem.getBiomeWeights(pos.x, pos.y, getHeight);
      
      // Calculate sum of all weights
      let sum = 0;
      for (const weight of weights.values()) {
        sum += weight;
        // Each individual weight should be positive
        expect(weight).toBeGreaterThan(0);
      }
      
      // Sum should be approximately 1.0 (allowing for floating point precision)
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  test('getBiomeWeights includes at least one biome', () => {
    const biomeSystem = new BiomeSystem(12345, defaultConfig);
    
    // Create height callback that returns constant height
    const getHeight = () => 0.5;
    const weights = biomeSystem.getBiomeWeights(0, 0, getHeight);
    
    expect(weights.size).toBeGreaterThan(0);
  });

  test('same position produces same biome with same seed', () => {
    const biomeSystem1 = new BiomeSystem(99999, defaultConfig);
    const biomeSystem2 = new BiomeSystem(99999, defaultConfig);
    
    const x = 123;
    const y = 456;
    const height = 0.5;
    
    const biome1 = biomeSystem1.getBiome(x, y, height);
    const biome2 = biomeSystem2.getBiome(x, y, height);
    
    expect(biome1).toBe(biome2);
  });

  test('different seeds produce potentially different biomes', () => {
    const biomeSystem1 = new BiomeSystem(11111, defaultConfig);
    const biomeSystem2 = new BiomeSystem(22222, defaultConfig);
    
    const height = 0.5;
    let foundDifference = false;
    
    // Sample multiple positions to find a difference
    for (let x = 0; x < 500; x += 50) {
      for (let y = 0; y < 500; y += 50) {
        const biome1 = biomeSystem1.getBiome(x, y, height);
        const biome2 = biomeSystem2.getBiome(x, y, height);
        
        if (biome1 !== biome2) {
          foundDifference = true;
          break;
        }
      }
      if (foundDifference) break;
    }
    
    expect(foundDifference).toBe(true);
  });
});

