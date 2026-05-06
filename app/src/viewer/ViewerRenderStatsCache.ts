import {
  calculateRenderStats,
  type RenderStats,
  type RenderStatsChunk,
} from './RenderStatsCalculator';

export type NowProvider = () => number;

export class ViewerRenderStatsCache {
  private cachedRenderStats: RenderStats | null = null;
  private lastRenderStatsUpdate = 0;

  constructor(
    private readonly chunks: Iterable<RenderStatsChunk>,
    private readonly cacheDurationMs = 1000,
    private readonly now: NowProvider = () => performance.now()
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
