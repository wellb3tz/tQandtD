import type { ChunkData } from '../chunk';

export interface CacheEntry {
  chunk: ChunkData;
  lastAccessed: number;
}

export interface ChunkCacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
}

export class ChunkCacheStore {
  private hits = 0;
  private misses = 0;

  constructor(
    readonly entries: Map<string, CacheEntry>,
    private readonly getAccessCounter: () => number,
    private readonly setAccessCounter: (value: number) => void,
    private readonly maxSize: number,
    private readonly onEvict?: (chunkX: number, chunkY: number) => void
  ) {}

  get size(): number {
    return this.entries.size;
  }

  touch(key: string): ChunkData | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    entry.lastAccessed = this.nextAccessCounter();
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.chunk;
  }

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  set(key: string, chunk: ChunkData): void {
    if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey) {
        const [chunkX, chunkY] = oldestKey.split(',').map(Number);
        this.entries.delete(oldestKey);
        this.onEvict?.(chunkX, chunkY);
      }
    }

    this.entries.set(key, {
      chunk,
      lastAccessed: this.nextAccessCounter(),
    });
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  stats(): ChunkCacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      size: this.entries.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    };
  }

  private nextAccessCounter(): number {
    const next = this.getAccessCounter() + 1;
    this.setAccessCounter(next);
    return next;
  }
}

export class InFlightChunkRequests {
  private readonly requests = new Map<string, Promise<ChunkData>>();

  get(key: string): Promise<ChunkData> | undefined {
    return this.requests.get(key);
  }

  set(key: string, request: Promise<ChunkData>): void {
    this.requests.set(key, request);
    request.catch(() => undefined).finally(() => {
      if (this.requests.get(key) === request) {
        this.requests.delete(key);
      }
    });
  }

  delete(key: string): void {
    this.requests.delete(key);
  }

  clear(): void {
    this.requests.clear();
  }
}
