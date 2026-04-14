/**
 * GeometryPools - Object pools for Three.js geometries and materials
 * 
 * Provides pooling for frequently created Three.js objects to reduce
 * garbage collection pressure and improve performance.
 */

import * as THREE from 'three';
import { ObjectPool, Poolable } from './ObjectPool';

/**
 * Poolable wrapper for THREE.BufferGeometry
 */
class PoolableGeometry implements Poolable {
  geometry: THREE.BufferGeometry;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
  }

  reset(): void {
    // Clear all attributes and indices
    const attributes = Object.keys(this.geometry.attributes);
    for (const key of attributes) {
      this.geometry.deleteAttribute(key);
    }
    this.geometry.setIndex(null);
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

/**
 * Poolable wrapper for THREE.Vector3
 */
class PoolableVector3 implements Poolable {
  vector: THREE.Vector3;

  constructor() {
    this.vector = new THREE.Vector3();
  }

  reset(): void {
    this.vector.set(0, 0, 0);
  }
}

/**
 * Poolable wrapper for THREE.Color
 */
class PoolableColor implements Poolable {
  color: THREE.Color;

  constructor() {
    this.color = new THREE.Color();
  }

  reset(): void {
    this.color.set(0xffffff);
  }
}

/**
 * Poolable wrapper for Float32Array
 */
class PoolableFloat32Array implements Poolable {
  array: Float32Array;
  size: number;

  constructor(size: number) {
    this.size = size;
    this.array = new Float32Array(size);
  }

  reset(): void {
    this.array.fill(0);
  }
}

/**
 * GeometryPools - Manages pools for various Three.js objects
 */
export class GeometryPools {
  private geometryPool: ObjectPool<PoolableGeometry>;
  private vector3Pool: ObjectPool<PoolableVector3>;
  private colorPool: ObjectPool<PoolableColor>;
  private float32Pools: Map<number, ObjectPool<PoolableFloat32Array>>;

  constructor() {
    this.geometryPool = new ObjectPool(() => new PoolableGeometry(), 20, 100);
    this.vector3Pool = new ObjectPool(() => new PoolableVector3(), 50, 200);
    this.colorPool = new ObjectPool(() => new PoolableColor(), 20, 100);
    this.float32Pools = new Map();
  }

  /**
   * Acquire a BufferGeometry from the pool
   */
  acquireGeometry(): THREE.BufferGeometry {
    const poolable = this.geometryPool.acquire();
    return poolable.geometry;
  }

  /**
   * Release a BufferGeometry back to the pool
   */
  releaseGeometry(geometry: THREE.BufferGeometry): void {
    // Find the poolable wrapper
    // Note: This is a simplified approach. In production, you'd want to track
    // the mapping between geometries and their poolable wrappers.
    const poolable = new PoolableGeometry();
    poolable.geometry = geometry;
    this.geometryPool.release(poolable);
  }

  /**
   * Acquire a Vector3 from the pool
   */
  acquireVector3(): THREE.Vector3 {
    const poolable = this.vector3Pool.acquire();
    return poolable.vector;
  }

  /**
   * Release a Vector3 back to the pool
   */
  releaseVector3(vector: THREE.Vector3): void {
    const poolable = new PoolableVector3();
    poolable.vector = vector;
    this.vector3Pool.release(poolable);
  }

  /**
   * Acquire a Color from the pool
   */
  acquireColor(): THREE.Color {
    const poolable = this.colorPool.acquire();
    return poolable.color;
  }

  /**
   * Release a Color back to the pool
   */
  releaseColor(color: THREE.Color): void {
    const poolable = new PoolableColor();
    poolable.color = color;
    this.colorPool.release(poolable);
  }

  /**
   * Acquire a Float32Array from the pool
   */
  acquireFloat32Array(size: number): Float32Array {
    if (!this.float32Pools.has(size)) {
      this.float32Pools.set(
        size,
        new ObjectPool(() => new PoolableFloat32Array(size), 10, 50)
      );
    }

    const pool = this.float32Pools.get(size)!;
    const poolable = pool.acquire();
    return poolable.array;
  }

  /**
   * Release a Float32Array back to the pool
   */
  releaseFloat32Array(array: Float32Array): void {
    const size = array.length;
    const pool = this.float32Pools.get(size);
    
    if (pool) {
      const poolable = new PoolableFloat32Array(size);
      poolable.array = array;
      pool.release(poolable);
    }
  }

  /**
   * Get statistics for all pools
   */
  getStats() {
    return {
      geometry: this.geometryPool.getStats(),
      vector3: this.vector3Pool.getStats(),
      color: this.colorPool.getStats(),
      float32Arrays: Array.from(this.float32Pools.entries()).map(([size, pool]) => ({
        size,
        stats: pool.getStats()
      }))
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.geometryPool.clear();
    this.vector3Pool.clear();
    this.colorPool.clear();
    this.float32Pools.clear();
  }
}
