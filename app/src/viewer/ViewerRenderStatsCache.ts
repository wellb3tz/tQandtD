import {
  RenderStatsCache,
  type RenderStatsChunk,
  type RenderStatsNowProvider,
} from '@engine/index';

export type NowProvider = RenderStatsNowProvider;

export class ViewerRenderStatsCache extends RenderStatsCache<RenderStatsChunk> {
  constructor(
    chunks: Iterable<RenderStatsChunk>,
    cacheDurationMs = 1000,
    now: NowProvider = () => performance.now()
  ) {
    super(chunks, cacheDurationMs, now);
  }
}
