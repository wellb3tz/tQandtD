import { describe, test } from 'vitest';
import { StructurePlacer, StructureConfig } from '../src/gen/structures.js';
import { BiomeType, ChunkData, StructureType } from '../src/world/chunk.js';
import { poissonDiskSampling } from '../src/utils/poisson.js';

describe('Debug Structures', () => {
  test('debug poisson points', () => {
    const points = poissonDiskSampling({
      width: 16,
      height: 16,
      minDistance: 3,
      maxAttempts: 30,
      seed: 0,
    });

    console.log('Poisson points:');
    for (let i = 0; i < points.length; i++) {
      const floored = {
        x: Math.floor(points[i].x),
        y: Math.floor(points[i].y),
      };
      console.log(`Point ${i}: (${points[i].x.toFixed(2)}, ${points[i].y.toFixed(2)}) -> floored: (${floored.x}, ${floored.y})`);
    }

    // Check which floored points are too close
    const flooredPoints = points.map(p => ({
      x: Math.floor(p.x),
      y: Math.floor(p.y),
    }));

    console.log('\nChecking floored distances:');
    for (let i = 0; i < flooredPoints.length; i++) {
      for (let j = i + 1; j < flooredPoints.length; j++) {
        const dx = flooredPoints[i].x - flooredPoints[j].x;
        const dy = flooredPoints[i].y - flooredPoints[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
          console.log(`Points ${i} and ${j}: (${flooredPoints[i].x}, ${flooredPoints[i].y}) and (${flooredPoints[j].x}, ${flooredPoints[j].y}) -> distance: ${dist.toFixed(3)}`);
        }
      }
    }
  });
});

