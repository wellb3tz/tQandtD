/**
 * PerformanceMonitor - Real-time performance metrics display.
 * Binds to existing HTML elements by ID — does NOT create any markup.
 */

export interface GenerationBreakdown {
  terrain: number;
  biomes: number;
  resources: number;
  structures: number;
  total: number;
}

export interface WorkerStats {
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  avgWorkerTime: number;
}

export class PerformanceMonitor {
  private container: HTMLElement | null = null;

  private fpsElement:            HTMLElement | null = null;
  private totalChunksElement:    HTMLElement | null = null;
  private avgGenTimeElement:     HTMLElement | null = null;
  private memoryElement:         HTMLElement | null = null;
  private cacheHitRateElement:   HTMLElement | null = null;
  private cacheSizeElement:      HTMLElement | null = null;
  private loadedChunksElement:   HTMLElement | null = null;
  private vertexCountElement:    HTMLElement | null = null;
  private activeWorkersElement:  HTMLElement | null = null;
  private queuedTasksElement:    HTMLElement | null = null;
  private completedTasksElement: HTMLElement | null = null;
  private avgWorkerTimeElement:  HTMLElement | null = null;

  private fpsHistory: number[] = [];
  private lastFrameTime: number = performance.now();
  private updateInterval: number | null = null;

  initialize(container: HTMLElement): void {
    this.container = container;

    // Bind to existing HTML elements — no innerHTML modification
    this.fpsElement            = document.getElementById('fps-value');
    this.totalChunksElement    = document.getElementById('total-chunks-value');
    this.avgGenTimeElement     = document.getElementById('gen-time-value');
    this.memoryElement         = document.getElementById('memory-value');
    this.cacheHitRateElement   = document.getElementById('cache-value');
    this.cacheSizeElement      = document.getElementById('cache-size-value');
    this.loadedChunksElement   = document.getElementById('loaded-chunks-value');
    this.vertexCountElement    = document.getElementById('vertices-value');
    this.activeWorkersElement  = document.getElementById('active-workers-value');
    this.queuedTasksElement    = document.getElementById('queued-tasks-value');
    this.completedTasksElement = document.getElementById('completed-tasks-value');
    this.avgWorkerTimeElement  = document.getElementById('avg-worker-time-value');

    this.startFPSTracking();
    this.startPeriodicUpdates();

    console.log('PerformanceMonitor initialized');
  }

  private startFPSTracking(): void {
    const track = () => {
      const now = performance.now();
      const fps = 1000 / (now - this.lastFrameTime);
      this.lastFrameTime = now;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 60) this.fpsHistory.shift();
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  }

  private startPeriodicUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      if (this.fpsHistory.length > 0) {
        const avg = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        this.updateFPS(Math.round(avg));
      }
    }, 500);
  }

  updateFPS(fps: number): void {
    if (this.fpsElement) this.fpsElement.textContent = fps.toString();
  }

  updateGenerationTime(avgTime: number, _breakdown: GenerationBreakdown): void {
    if (this.avgGenTimeElement) {
      this.avgGenTimeElement.textContent = `${avgTime.toFixed(2)} ms`;
    }
  }

  updateMemoryUsage(bytes: number): void {
    if (this.memoryElement) {
      this.memoryElement.textContent = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  updateCacheStats(hitRate: number, size: number, maxSize: number): void {
    if (this.cacheHitRateElement) {
      this.cacheHitRateElement.textContent = `${(hitRate * 100).toFixed(1)}%`;
    }
    if (this.cacheSizeElement) {
      this.cacheSizeElement.textContent = `${size} / ${maxSize}`;
    }
  }

  updateRenderStats(vertexCount: number, _drawCalls: number): void {
    if (this.vertexCountElement) {
      this.vertexCountElement.textContent = this.formatNumber(vertexCount);
    }
  }

  updateLoadedChunks(count: number): void {
    if (this.loadedChunksElement)  this.loadedChunksElement.textContent  = count.toString();
    if (this.totalChunksElement)   this.totalChunksElement.textContent   = count.toString();
  }

  updateWorkerStats(stats: WorkerStats): void {
    if (this.activeWorkersElement)  this.activeWorkersElement.textContent  = stats.activeWorkers.toString();
    if (this.queuedTasksElement)    this.queuedTasksElement.textContent    = stats.queuedTasks.toString();
    if (this.completedTasksElement) this.completedTasksElement.textContent = stats.completedTasks.toString();
    if (this.avgWorkerTimeElement)  this.avgWorkerTimeElement.textContent  = `${stats.avgWorkerTime.toFixed(2)} ms`;
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
    return n.toString();
  }

  show():   void { this.container?.classList.remove('hidden'); }
  hide():   void { this.container?.classList.add('hidden'); }
  toggle(): void { this.container?.classList.toggle('hidden'); }

  dispose(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.fpsHistory = [];
    this.container = null;
    console.log('PerformanceMonitor disposed');
  }
}
