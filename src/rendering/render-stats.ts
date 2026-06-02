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
      drawCalls += countVisibleDrawObjects(chunk.foliage);
    }

    if (chunk.resources?.visible) {
      drawCalls += countVisibleDrawObjects(chunk.resources);
    }

    if (chunk.structures?.visible) {
      drawCalls += countVisibleDrawObjects(chunk.structures);
    }

    if (chunk.boundaries?.visible) {
      drawCalls++;
    }
  }

  return { vertexCount, drawCalls };
}

function countVisibleDrawObjects(group: RenderStatsGroup): number {
  let count = 0;

  for (const child of group.children) {
    if (!isRenderStatsObject(child) || !child.visible) continue;

    if (isRenderStatsGroup(child)) {
      count += countVisibleDrawObjects(child);
    } else if (isRenderStatsMesh(child)) {
      count++;
    }
  }

  return count;
}

function isRenderStatsObject(value: unknown): value is RenderStatsObject {
  return typeof value === 'object' && value !== null && 'visible' in value;
}

function isRenderStatsGroup(value: unknown): value is RenderStatsGroup {
  return isRenderStatsObject(value) && Array.isArray((value as RenderStatsGroup).children);
}

function isRenderStatsMesh(value: unknown): value is RenderStatsMesh {
  return isRenderStatsObject(value) && 'geometry' in value;
}
