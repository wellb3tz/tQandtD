// Poisson Disk Sampling utility using Bridson's algorithm

import { SeededRNG } from '../core/rng.js';

/**
 * Configuration for Poisson Disk Sampling
 */
export interface PoissonConfig {
  width: number;
  height: number;
  minDistance: number;
  maxAttempts: number;
  seed: number;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Generate points using Poisson Disk Sampling (Bridson's algorithm)
 * Ensures minimum distance between all points
 * 
 * @param config Configuration for sampling
 * @returns Array of points with minimum distance constraint
 */
export function poissonDiskSampling(config: PoissonConfig): Point[] {
  const { width, height, minDistance, maxAttempts, seed } = config;
  const rng = new SeededRNG(seed);

  // Cell size for spatial grid (divide by sqrt(2) for 2D)
  const cellSize = minDistance / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);

  // Grid for fast spatial lookup (stores point indices)
  const grid: (number | null)[][] = Array.from({ length: gridHeight }, () =>
    Array(gridWidth).fill(null)
  );

  const points: Point[] = [];
  const activeList: number[] = []; // Indices of points to try generating around

  // Helper: Convert point to grid coordinates
  const toGridCoords = (x: number, y: number): [number, number] => {
    return [Math.floor(x / cellSize), Math.floor(y / cellSize)];
  };

  // Helper: Check if point is valid (maintains minimum distance)
  const isValidPoint = (x: number, y: number): boolean => {
    // Check bounds
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return false;
    }

    const [gridX, gridY] = toGridCoords(x, y);

    // Check neighboring cells in grid (5x5 neighborhood)
    const searchRadius = 2;
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const checkX = gridX + dx;
        const checkY = gridY + dy;

        if (checkX < 0 || checkX >= gridWidth || checkY < 0 || checkY >= gridHeight) {
          continue;
        }

        const pointIndex = grid[checkY][checkX];
        if (pointIndex !== null) {
          const other = points[pointIndex];
          const distSq = (x - other.x) ** 2 + (y - other.y) ** 2;
          if (distSq < minDistance * minDistance) {
            return false;
          }
        }
      }
    }

    return true;
  };

  // Helper: Add point to grid and lists
  const addPoint = (x: number, y: number): void => {
    const [gridX, gridY] = toGridCoords(x, y);
    const index = points.length;
    points.push({ x, y });
    grid[gridY][gridX] = index;
    activeList.push(index);
  };

  // Start with random initial point
  const initialX = rng.nextFloat() * width;
  const initialY = rng.nextFloat() * height;
  addPoint(initialX, initialY);

  // Process active list
  // Optimization: Use swap-and-pop instead of splice for O(1) removal
  while (activeList.length > 0) {
    // Pick random active point
    const activeIndex = rng.nextInt(0, activeList.length);
    const pointIndex = activeList[activeIndex];
    const point = points[pointIndex];

    let found = false;

    // Try to generate new points around this point
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random point in annulus between minDistance and 2*minDistance
      const angle = rng.nextFloat() * 2 * Math.PI;
      const radius = minDistance + rng.nextFloat() * minDistance;
      const newX = point.x + radius * Math.cos(angle);
      const newY = point.y + radius * Math.sin(angle);

      if (isValidPoint(newX, newY)) {
        addPoint(newX, newY);
        found = true;
        break;
      }
    }

    // If no valid point found, remove from active list
    // Optimization: swap with last element and pop (O(1) instead of O(n))
    if (!found) {
      const lastIndex = activeList.length - 1;
      if (activeIndex !== lastIndex) {
        activeList[activeIndex] = activeList[lastIndex];
      }
      activeList.pop();
    }
  }

  return points;
}
