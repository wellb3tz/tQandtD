import type { ThreeWorldRendererAdapter } from '@engine/adapters/three';
import { AppEvent, type WorldApp } from './WorldApp';
import { JOURNEY_MODE_CLASS } from './AppModeLifecycle';
import type { PerformanceMonitor } from '../ui/PerformanceMonitor';
import type { WorldViewer } from '../viewer/WorldViewer';
import { AppError, ErrorCategory, ErrorSeverity, errorHandler } from '../utils/ErrorHandler';

export interface AppEventBindingsOptions {
  app: WorldApp;
  getViewer: () => WorldViewer | null;
  getRenderer: () => ThreeWorldRendererAdapter | null;
  getPerformanceMonitor: () => PerformanceMonitor | null;
}

export function bindWorldAppEvents(options: AppEventBindingsOptions): void {
  const { app } = options;

  app.subscribeToState((state) => {
    options.getViewer()?.setStreamingViewDistance(state.appSettings.viewDistance, state.config.chunkSize);

    const performanceMonitor = options.getPerformanceMonitor();
    if (!performanceMonitor) return;

    const breakdown = {
      terrain: state.avgGenerationTime * 0.4,
      biomes: state.avgGenerationTime * 0.2,
      resources: state.avgGenerationTime * 0.2,
      structures: state.avgGenerationTime * 0.2,
      total: state.avgGenerationTime
    };
    performanceMonitor.updateGenerationTime(state.avgGenerationTime, breakdown);

    const cacheStats = app.getCacheStats();
    performanceMonitor.updateCacheStats(cacheStats.hitRate, cacheStats.size, cacheStats.maxSize);
    performanceMonitor.updateLoadedChunks(app.getLoadedChunkCount());
    performanceMonitor.updateWorkerStats({
      activeWorkers: state.activeWorkers,
      queuedTasks: state.queuedTasks,
      completedTasks: state.completedTasks,
      avgWorkerTime: state.avgWorkerTime
    });
  });

  app.on(AppEvent.WORLD_GENERATED, (data) => {
    const viewer = options.getViewer();
    if (viewer) {
      viewer.clearChunks();
      viewer.clearFogOfWar();
    }

    const statusSeed = document.getElementById('status-seed');
    if (statusSeed) statusSeed.textContent = data.seed.toString();
    if (!document.body.classList.contains(JOURNEY_MODE_CLASS)) {
      errorHandler.showSuccessToast(`World generated with seed: ${data.seed}`);
    }
  });

  app.on(AppEvent.PLANET_LANDED, (data) => {
    const viewer = options.getViewer();
    if (viewer) {
      viewer.clearChunks();
      viewer.clearFogOfWar();
    }

    const statusSeed = document.getElementById('status-seed');
    if (statusSeed) statusSeed.textContent = data.seed.toString();
    errorHandler.showSuccessToast(`New world from lat ${data.lat.toFixed(2)}, lon ${data.lon.toFixed(2)}`);
  });

  app.on(AppEvent.CHUNK_LOADED, (data) => {
    const renderSystem = app.getWorldSession()?.scene.renderSystem;
    const renderer = options.getRenderer();
    if (!data.partial && data.stage === undefined && renderSystem) {
      renderSystem.onChunkLoaded(data.chunk, { x: data.chunkX, y: data.chunkY });
    } else if (renderer) {
      renderer.addChunk(data.chunk, { x: data.chunkX, y: data.chunkY }, {
        partial: data.partial,
        stage: data.stage,
      });
    }
  });

  app.on(AppEvent.CHUNK_UPDATED, (data) => {
    options.getRenderer()?.updateChunk(data.chunk, { x: data.chunkX, y: data.chunkY });
  });

  app.on(AppEvent.CHUNK_UNLOADED, (data) => {
    const renderSystem = app.getWorldSession()?.scene.renderSystem;
    const renderer = options.getRenderer();
    if (!data.keepFogOfWar && renderSystem) {
      renderSystem.onChunkRemoved({ x: data.chunkX, y: data.chunkY });
    } else if (renderer) {
      renderer.removeChunk({ x: data.chunkX, y: data.chunkY }, {
        keepFogOfWar: data.keepFogOfWar || false,
      });
    }
  });

  app.on(AppEvent.VISIBILITY_CHANGED, (visibilityState) => {
    const viewer = options.getViewer();
    if (!viewer || !visibilityState) return;

    const startTime = performance.now();
    viewer.applyViewerSettings(visibilityState, app.getLoadedChunksSnapshot());

    const updateTime = performance.now() - startTime;
    if (updateTime > 50) {
      console.warn(`Visibility update took ${updateTime.toFixed(2)}ms (exceeds 50ms requirement)`);
    }
  });

  app.on(AppEvent.ERROR, (data) => {
    errorHandler.handleError(new AppError(
      data.message,
      ErrorCategory.GENERATION,
      ErrorSeverity.ERROR,
      true,
      data.message,
      data.error
    ));
  });
}
