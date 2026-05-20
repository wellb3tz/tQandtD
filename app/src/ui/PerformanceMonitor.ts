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

  // FPS graph
  private fpsCanvas:  HTMLCanvasElement | null = null;
  private fpsCtx:     CanvasRenderingContext2D | null = null;
  private fpsHistory: number[] = [];
  private readonly MAX_SAMPLES = 60;
  private readonly TARGET_FPS  = 60;

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

    // FPS graph canvas
    this.fpsCanvas = document.getElementById('fps-graph') as HTMLCanvasElement | null;
    if (this.fpsCanvas) {
      this.fpsCtx = this.fpsCanvas.getContext('2d');
      // Sync canvas pixel size to its CSS display size
      const rect = this.fpsCanvas.getBoundingClientRect();
      if (rect.width > 0) {
        this.fpsCanvas.width  = Math.floor(rect.width  * window.devicePixelRatio);
        this.fpsCanvas.height = Math.floor(rect.height * window.devicePixelRatio);
        this.fpsCtx?.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    }

    this.startFPSTracking();
    this.startPeriodicUpdates();
  }

  private startFPSTracking(): void {
    const track = () => {
      const now = performance.now();
      const fps = 1000 / (now - this.lastFrameTime);
      this.lastFrameTime = now;
      this.fpsHistory.push(Math.min(fps, 120)); // cap at 120 for graph scale
      if (this.fpsHistory.length > this.MAX_SAMPLES) this.fpsHistory.shift();
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  }

  private startPeriodicUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      if (this.fpsHistory.length > 0) {
        const avg = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        this.updateFPS(Math.round(avg));
        this.drawFPSGraph();
      }
    }, 1000); // update once per second
  }

  private drawFPSGraph(): void {
    const canvas = this.fpsCanvas;
    if (!canvas) return;

    // Lazy-init canvas size on first draw (element is guaranteed to be in DOM)
    if (canvas.width === 0 || canvas.dataset.sized !== '1') {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return; // not visible yet
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.floor(rect.width  * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      this.fpsCtx   = canvas.getContext('2d');
      this.fpsCtx?.scale(dpr, dpr);
      canvas.dataset.sized = '1';
    }

    const ctx = this.fpsCtx;
    if (!ctx || this.fpsHistory.length < 2) return;

    // Use CSS display size for drawing coordinates
    const W = canvas.getBoundingClientRect().width;
    const H = canvas.getBoundingClientRect().height;
    const samples = this.fpsHistory;
    const maxFPS  = 120;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 4);
    ctx.fill();

    // 60 FPS reference line
    const refY = H - (this.TARGET_FPS / maxFPS) * H;
    ctx.strokeStyle = 'rgba(180,83,9,0.2)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, refY);
    ctx.lineTo(W, refY);
    ctx.stroke();
    ctx.setLineDash([]);

    // "60" label
    ctx.fillStyle = 'rgba(180,83,9,0.35)';
    ctx.font      = '8px Inter, sans-serif';
    ctx.fillText('60', 3, refY - 2);

    // Gradient fill under graph
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0,   'rgba(180,83,9,0.4)');
    gradient.addColorStop(0.5, 'rgba(180,83,9,0.15)');
    gradient.addColorStop(1,   'rgba(180,83,9,0.02)');

    const stepX = W / (this.MAX_SAMPLES - 1);

    ctx.beginPath();
    // Start from bottom-left
    ctx.moveTo(0, H);
    for (let i = 0; i < samples.length; i++) {
      const x = (i / (this.MAX_SAMPLES - 1)) * W;
      const y = H - (samples[i] / maxFPS) * H;
      if (i === 0) ctx.lineTo(x, y);
      else         ctx.lineTo(x, y);
    }
    // Close to bottom-right
    ctx.lineTo((samples.length - 1) / (this.MAX_SAMPLES - 1) * W, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line on top
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = (i / (this.MAX_SAMPLES - 1)) * W;
      const y = H - (samples[i] / maxFPS) * H;
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }

    // Color line based on current avg FPS
    const avg = samples[samples.length - 1];
    ctx.strokeStyle = avg >= 55 ? '#22c55e' : avg >= 30 ? '#f59e0b' : '#ef4444';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Current FPS dot at end
    const lastX = (samples.length - 1) / (this.MAX_SAMPLES - 1) * W;
    const lastY = H - (samples[samples.length - 1] / maxFPS) * H;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  updateFPS(fps: number): void {
    if (!this.fpsElement) return;
    this.fpsElement.textContent = fps.toString();
    // Color the big number based on performance
    if (fps >= 55)      this.fpsElement.style.color = '#22c55e'; // good (green)
    else if (fps >= 30) this.fpsElement.style.color = '#f59e0b'; // yellow
    else                this.fpsElement.style.color = '#ef4444'; // red
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
  }
}
