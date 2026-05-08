import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  getRiverChannelWidth,
  getRiverValleyWidth,
  getRiverWaterLevel,
  type RiverData,
} from '@engine/index';
import { HEIGHT_SCALE } from './config';
import { buildRiverGeometry, createRiverMaterial } from './RiverMeshGenerator';
import { WATER_NORMAL_SCALE } from './WaterMaterialFactory';

function river(points: RiverData['points']): RiverData {
  return {
    riverId: 'river_1',
    pathId: 'river_1:main',
    isTributary: false,
    points,
    bounds: { minX: 0, maxX: 4, minY: 1, maxY: 1 },
  };
}

describe('RiverMeshGenerator', () => {
  it('builds a subdivided surface ribbon for a two-point river', () => {
    const geometry = buildRiverGeometry([river([
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.35, surfaceLevel: 0.36, width: 1, depth: 0.03, flowX: 1, flowY: 0 },
    ])], 0, 0, 16);

    expect(geometry).not.toBeNull();
    expect(geometry!.getAttribute('position').count).toBe(25);
    expect(geometry!.getIndex()?.count).toBe(96);
  });

  it('returns null for empty river data', () => {
    expect(buildRiverGeometry([], 0, 0, 16)).toBeNull();
  });

  it('uses the water-level channel cross-section instead of the narrow floor width', () => {
    const points: RiverData['points'] = [
      {
        x: 0,
        y: 1,
        height: 0.6,
        surfaceLevel: 0.61,
        width: 1.4,
        depth: 0.12,
        flowX: 1,
        flowY: 0,
        flow: 0.4,
        channelWidth: 1.1,
        valleyWidth: 8,
        channelDepth: 0.16,
        valleyDepth: 0.08,
      },
      {
        x: 4,
        y: 1,
        height: 0.5,
        surfaceLevel: 0.51,
        width: 1.8,
        depth: 0.12,
        flowX: 1,
        flowY: 0,
        flow: 0.8,
        channelWidth: 1.6,
        valleyWidth: 10,
        channelDepth: 0.2,
        valleyDepth: 0.1,
      },
    ];

    const geometry = buildRiverGeometry([river(points)], 0, 0, 16)!;
    const positions = geometry.getAttribute('position').array;
    const firstLeftZ = positions[2];
    const firstRightZ = positions[14];
    const renderedWidth = Math.abs(firstLeftZ - firstRightZ);

    expect(renderedWidth).toBeGreaterThan(getRiverChannelWidth(points[0]) * 2);
    expect(renderedWidth).toBeLessThan(getRiverValleyWidth(points[0]));
  });

  it('places river water at the recessed channel water level', () => {
    const points: RiverData['points'] = [
      {
        x: 0,
        y: 1,
        height: 0.6,
        surfaceLevel: 0.61,
        width: 1.4,
        depth: 0.12,
        flowX: 1,
        flowY: 0,
        channelWidth: 1.1,
        channelDepth: 0.16,
      },
      {
        x: 4,
        y: 1,
        height: 0.5,
        surfaceLevel: 0.51,
        width: 1.8,
        depth: 0.12,
        flowX: 1,
        flowY: 0,
        channelWidth: 1.6,
        channelDepth: 0.2,
      },
    ];

    const geometry = buildRiverGeometry([river(points)], 0, 0, 16)!;
    const positions = geometry.getAttribute('position').array;

    expect(positions[1]).toBeCloseTo(getRiverWaterLevel(points[0]) * HEIGHT_SCALE - 1.0, 5);
  });

  it('uses the dark ocean vertex color for river water', () => {
    const geometry = buildRiverGeometry([river([
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.35, surfaceLevel: 0.36, width: 1, depth: 0.03, flowX: 1, flowY: 0 },
    ])], 0, 0, 16)!;
    const colors = geometry.getAttribute('color').array;
    const expected = [0.04, 0.1, 0.23];

    for (let vertex = 0; vertex < 5; vertex++) {
      for (let channel = 0; channel < expected.length; channel++) {
        expect(colors[vertex * 3 + channel]).toBeCloseTo(expected[channel], 5);
      }
    }
  });

  it('does not render river strips that are fully below ocean level', () => {
    const geometry = buildRiverGeometry([river([
      { x: 0, y: 1, height: 0.25, surfaceLevel: 0.26, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.24, surfaceLevel: 0.25, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ])], 0, 0, 16, 0.3);

    expect(geometry).toBeNull();
  });

  it('clips a river strip where it descends below ocean level', () => {
    const seaLevel = 0.3;
    const geometry = buildRiverGeometry([river([
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.34, surfaceLevel: 0.35, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 8, y: 1, height: 0.24, surfaceLevel: 0.25, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ])], 0, 0, 16, seaLevel)!;

    expect(geometry).not.toBeNull();
    const positions = geometry.getAttribute('position');
    const maxX = Array.from(positions.array).reduce((max, value, index) =>
      index % 3 === 0 ? Math.max(max, value) : max,
      -Infinity,
    );
    const surfacePositions = Array.from(positions.array).slice(0, 30 * 3);
    const minSurfaceY = surfacePositions.reduce((min, value, index) =>
      index % 3 === 1 ? Math.min(min, value) : min,
      Infinity,
    );

    expect(positions.count).toBe(30);
    expect(maxX).toBeLessThan(8);
    expect(maxX).toBeGreaterThan(4);
    expect(minSurfaceY).toBeGreaterThanOrEqual(seaLevel * HEIGHT_SCALE);
  });

  it('applies river normal maps for small flow ripples', () => {
    const normalMap = new THREE.Texture();
    const material = createRiverMaterial({
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      normalMap,
    });

    expect(material.normalMap).toBe(normalMap);
    expect(material.normalScale.x).toBeCloseTo(WATER_NORMAL_SCALE.x);
    expect(material.normalScale.y).toBeCloseTo(WATER_NORMAL_SCALE.y);
    expect(material.vertexColors).toBe(true);
  });
});
