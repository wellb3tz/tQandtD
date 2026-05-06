import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GeometryPools } from './GeometryPools';

describe('GeometryPools', () => {
  it('resets geometries before reusing them', () => {
    const pools = new GeometryPools();
    const geometry = pools.acquireGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    geometry.setIndex([0]);

    pools.releaseGeometry(geometry);
    const reused = pools.acquireGeometry();

    expect(reused).toBe(geometry);
    expect(reused.getAttribute('position')).toBeUndefined();
    expect(reused.index).toBeNull();
  });

  it('resets vector, color, and typed-array values before reuse', () => {
    const pools = new GeometryPools();
    const vector = pools.acquireVector3();
    const color = pools.acquireColor();
    const array = pools.acquireFloat32Array(4);

    vector.set(1, 2, 3);
    color.set(0x123456);
    array.fill(7);

    pools.releaseVector3(vector);
    pools.releaseColor(color);
    pools.releaseFloat32Array(array);

    expect(pools.acquireVector3().toArray()).toEqual([0, 0, 0]);
    expect(pools.acquireColor().getHex()).toBe(0xffffff);
    expect(Array.from(pools.acquireFloat32Array(4))).toEqual([0, 0, 0, 0]);
  });

  it('reports per-pool stats and disposes pooled geometries when cleared', () => {
    const pools = new GeometryPools();
    const geometry = pools.acquireGeometry();
    const dispose = vi.spyOn(geometry, 'dispose');

    pools.releaseGeometry(geometry);
    const stats = pools.getStats();

    expect(stats.geometry.available).toBeGreaterThan(0);
    expect(stats.float32Arrays).toEqual([]);

    pools.clear();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(pools.getStats().geometry).toEqual({ available: 0, inUse: 0, total: 0 });
  });
});
