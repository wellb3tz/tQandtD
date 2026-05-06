import { describe, expect, it, vi } from 'vitest';
import { ObjectPool, type Poolable } from './ObjectPool';

class TestPoolable implements Poolable {
  reset = vi.fn();
}

describe('ObjectPool', () => {
  it('preallocates objects and tracks acquire/release counts', () => {
    const pool = new ObjectPool(() => new TestPoolable(), 2, 3);

    const first = pool.acquire();
    const second = pool.acquire();

    expect(pool.getStats()).toEqual({ available: 0, inUse: 2, total: 2 });
    expect(first).toBeInstanceOf(TestPoolable);
    expect(second).toBeInstanceOf(TestPoolable);

    pool.release(first);

    expect(first.reset).toHaveBeenCalledTimes(1);
    expect(pool.getStats()).toEqual({ available: 1, inUse: 1, total: 2 });
  });

  it('ignores objects that did not come from the pool', () => {
    const pool = new ObjectPool(() => new TestPoolable(), 1, 2);
    const external = new TestPoolable();

    pool.release(external);

    expect(external.reset).not.toHaveBeenCalled();
    expect(pool.getStats()).toEqual({ available: 1, inUse: 0, total: 1 });
  });

  it('resets and releases all checked-out objects up to the max size', () => {
    const pool = new ObjectPool(() => new TestPoolable(), 0, 2);
    const first = pool.acquire();
    const second = pool.acquire();
    const third = pool.acquire();

    pool.releaseAll();

    expect(first.reset).toHaveBeenCalledTimes(1);
    expect(second.reset).toHaveBeenCalledTimes(1);
    expect(third.reset).toHaveBeenCalledTimes(1);
    expect(pool.getStats()).toEqual({ available: 2, inUse: 0, total: 2 });
  });
});
