/**
 * Unit tests for ObjectPool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectPool, Poolable } from './ObjectPool';

class TestObject implements Poolable {
  value: number = 0;

  reset(): void {
    this.value = 0;
  }
}

describe('ObjectPool', () => {
  let pool: ObjectPool<TestObject>;

  beforeEach(() => {
    pool = new ObjectPool(() => new TestObject(), 5, 20);
  });

  it('should pre-allocate initial objects', () => {
    const stats = pool.getStats();
    expect(stats.available).toBe(5);
    expect(stats.inUse).toBe(0);
    expect(stats.total).toBe(5);
  });

  it('should acquire objects from pool', () => {
    const obj1 = pool.acquire();
    const obj2 = pool.acquire();

    expect(obj1).toBeInstanceOf(TestObject);
    expect(obj2).toBeInstanceOf(TestObject);
    expect(obj1).not.toBe(obj2);

    const stats = pool.getStats();
    expect(stats.available).toBe(3);
    expect(stats.inUse).toBe(2);
  });

  it('should create new objects when pool is empty', () => {
    // Acquire all pre-allocated objects
    for (let i = 0; i < 5; i++) {
      pool.acquire();
    }

    // This should create a new object
    const obj = pool.acquire();
    expect(obj).toBeInstanceOf(TestObject);

    const stats = pool.getStats();
    expect(stats.available).toBe(0);
    expect(stats.inUse).toBe(6);
  });

  it('should release objects back to pool', () => {
    const obj = pool.acquire();
    obj.value = 42;

    pool.release(obj);

    const stats = pool.getStats();
    expect(stats.available).toBe(5);
    expect(stats.inUse).toBe(0);
    expect(obj.value).toBe(0); // Should be reset
  });

  it('should not exceed max pool size', () => {
    // Create more objects than maxSize
    const objects: TestObject[] = [];
    for (let i = 0; i < 25; i++) {
      objects.push(pool.acquire());
    }

    // Release all objects
    for (const obj of objects) {
      pool.release(obj);
    }

    const stats = pool.getStats();
    expect(stats.available).toBeLessThanOrEqual(20); // maxSize
    expect(stats.inUse).toBe(0);
  });

  it('should release all objects', () => {
    const obj1 = pool.acquire();
    const obj2 = pool.acquire();
    const obj3 = pool.acquire();

    obj1.value = 1;
    obj2.value = 2;
    obj3.value = 3;

    pool.releaseAll();

    const stats = pool.getStats();
    expect(stats.inUse).toBe(0);
    expect(obj1.value).toBe(0);
    expect(obj2.value).toBe(0);
    expect(obj3.value).toBe(0);
  });

  it('should clear the pool', () => {
    pool.acquire();
    pool.acquire();

    pool.clear();

    const stats = pool.getStats();
    expect(stats.available).toBe(0);
    expect(stats.inUse).toBe(0);
    expect(stats.total).toBe(0);
  });

  it('should handle releasing objects not from pool', () => {
    const externalObj = new TestObject();
    
    // Should not throw
    expect(() => pool.release(externalObj)).not.toThrow();

    const stats = pool.getStats();
    expect(stats.inUse).toBe(0);
  });
});
