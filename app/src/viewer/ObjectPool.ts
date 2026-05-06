/**
 * ObjectPool - Generic object pooling for frequently created objects
 * 
 * Reduces garbage collection pressure by reusing objects instead of
 * creating and destroying them repeatedly.
 */

export interface Poolable {
  reset(): void;
  dispose?(): void;
}

export class ObjectPool<T extends Poolable> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number = 10, maxSize: number = 100) {
    this.factory = factory;
    this.maxSize = maxSize;

    // Pre-allocate initial objects
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      return; // Object not from this pool
    }

    this.inUse.delete(obj);
    obj.reset();

    // Only keep up to maxSize objects in the pool
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }

  /**
   * Release all objects back to the pool
   */
  releaseAll(): void {
    for (const obj of this.inUse) {
      obj.reset();
      if (this.available.length < this.maxSize) {
        this.available.push(obj);
      }
    }
    this.inUse.clear();
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size
    };
  }

  /**
   * Clear the pool
   */
  clear(): void {
    for (const obj of this.available) {
      obj.dispose?.();
    }
    for (const obj of this.inUse) {
      obj.dispose?.();
    }
    this.available = [];
    this.inUse.clear();
  }
}
