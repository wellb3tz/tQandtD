export interface RenderStats {
  vertexCount: number;
  drawCalls: number;
}

export interface RenderStatsGeometryAttribute {
  count: number;
}

export interface RenderStatsGeometry {
  getAttribute(name: string): RenderStatsGeometryAttribute | undefined;
}

export interface RenderStatsObject {
  visible: boolean;
}

export interface RenderStatsMesh extends RenderStatsObject {
  geometry: RenderStatsGeometry;
  userData?: Record<string, unknown>;
}

export interface RenderStatsGroup extends RenderStatsObject {
  children: unknown[];
}

export interface RenderStatsChunk {
  terrain: RenderStatsMesh;
  foliage?: RenderStatsGroup;
  resources?: RenderStatsGroup;
  structures?: RenderStatsGroup;
  boundaries?: RenderStatsObject;
}

export type RenderStatsNowProvider = () => number;

export class RenderStatsCache<TChunk extends RenderStatsChunk = RenderStatsChunk> {
  private cachedRenderStats: RenderStats | null = null;
  private lastRenderStatsUpdate = 0;

  constructor(
    private readonly chunks: Iterable<TChunk>,
    private readonly cacheDurationMs = 1000,
    private readonly now: RenderStatsNowProvider = () => Date.now()
  ) {}

  getRenderStats(): RenderStats {
    const currentTime = this.now();

    if (
      this.cachedRenderStats &&
      currentTime - this.lastRenderStatsUpdate < this.cacheDurationMs
    ) {
      return this.cachedRenderStats;
    }

    this.cachedRenderStats = calculateRenderStats(this.chunks);
    this.lastRenderStatsUpdate = currentTime;

    return this.cachedRenderStats;
  }

  invalidate(): void {
    this.cachedRenderStats = null;
  }
}

export function calculateRenderStats(chunks: Iterable<RenderStatsChunk>): RenderStats {
  let vertexCount = 0;
  let drawCalls = 0;

  for (const chunk of chunks) {
    if (chunk.terrain.visible) {
      const position = chunk.terrain.geometry.getAttribute('position');
      if (position) {
        vertexCount += position.count;
      }
      drawCalls++;
    }

    if (chunk.foliage?.visible) {
      drawCalls += chunk.foliage.children.length;
    }

    if (chunk.resources?.visible) {
      drawCalls += chunk.resources.children.length;
    }

    if (chunk.structures?.visible) {
      drawCalls += chunk.structures.children.length;
    }

    if (chunk.boundaries?.visible) {
      drawCalls++;
    }
  }

  return { vertexCount, drawCalls };
}

export function calculateMicroBiomeCount(chunks: Iterable<RenderStatsChunk>): number {
  let totalCount = 0;

  for (const chunk of chunks) {
    const count = chunk.terrain.userData?.microBiomeCount;
    if (typeof count === 'number') {
      totalCount += count;
    }
  }

  return totalCount;
}
