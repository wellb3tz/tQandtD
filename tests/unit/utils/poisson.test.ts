// Unit tests for Poisson Disk Sampling

import { describe, test, expect } from 'vitest';
import { poissonDiskSampling, PoissonConfig } from '../../../src/utils/poisson.js';

describe('Poisson Disk Sampling', () => {
  test('maintains minimum distance constraint between all points', () => {
    const config: PoissonConfig = {
      width: 100,
      height: 100,
      minDistance: 10,
      maxAttempts: 30,
      seed: 12345,
    };

    const points = poissonDiskSampling(config);

    // Check all pairs of points
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        expect(distance).toBeGreaterThanOrEqual(config.minDistance - 0.0001); // Small epsilon for floating point
      }
    }
  });

  test('same seed produces same point distribution', () => {
    const config: PoissonConfig = {
      width: 50,
      height: 50,
      minDistance: 5,
      maxAttempts: 30,
      seed: 54321,
    };

    const points1 = poissonDiskSampling(config);
    const points2 = poissonDiskSampling(config);

    expect(points1.length).toBe(points2.length);

    for (let i = 0; i < points1.length; i++) {
      expect(points1[i].x).toBeCloseTo(points2[i].x, 5);
      expect(points1[i].y).toBeCloseTo(points2[i].y, 5);
    }
  });

  test('all points are within bounds', () => {
    const config: PoissonConfig = {
      width: 80,
      height: 60,
      minDistance: 8,
      maxAttempts: 30,
      seed: 99999,
    };

    const points = poissonDiskSampling(config);

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThan(config.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThan(config.height);
    }
  });

  test('generates at least one point', () => {
    const config: PoissonConfig = {
      width: 100,
      height: 100,
      minDistance: 10,
      maxAttempts: 30,
      seed: 11111,
    };

    const points = poissonDiskSampling(config);

    expect(points.length).toBeGreaterThan(0);
  });

  test('different seeds produce different distributions', () => {
    const config1: PoissonConfig = {
      width: 50,
      height: 50,
      minDistance: 5,
      maxAttempts: 30,
      seed: 1,
    };

    const config2: PoissonConfig = {
      ...config1,
      seed: 2,
    };

    const points1 = poissonDiskSampling(config1);
    const points2 = poissonDiskSampling(config2);

    // Should have different first points (very unlikely to be same)
    const firstPointsSame =
      Math.abs(points1[0].x - points2[0].x) < 0.001 &&
      Math.abs(points1[0].y - points2[0].y) < 0.001;

    expect(firstPointsSame).toBe(false);
  });

  test('smaller minDistance produces more points', () => {
    const config1: PoissonConfig = {
      width: 100,
      height: 100,
      minDistance: 15,
      maxAttempts: 30,
      seed: 12345,
    };

    const config2: PoissonConfig = {
      ...config1,
      minDistance: 8,
    };

    const points1 = poissonDiskSampling(config1);
    const points2 = poissonDiskSampling(config2);

    expect(points2.length).toBeGreaterThan(points1.length);
  });

  test('handles small areas correctly', () => {
    const config: PoissonConfig = {
      width: 20,
      height: 20,
      minDistance: 5,
      maxAttempts: 30,
      seed: 77777,
    };

    const points = poissonDiskSampling(config);

    expect(points.length).toBeGreaterThan(0);

    // Verify minimum distance
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(config.minDistance - 0.0001);
      }
    }
  });
});
