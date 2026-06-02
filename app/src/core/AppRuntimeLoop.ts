import { TERRAIN_TILE_SIZE_METERS } from '@engine/index';
import type { WorldApp } from './WorldApp';
import type { PerformanceMonitor } from '../ui/PerformanceMonitor';
import type { Minimap } from '../ui/Minimap';
import type { WorldViewer } from '../viewer/WorldViewer';

const HORIZON_STREAMING_BUFFER_CHUNKS = 2;

export interface AppRuntimeLoopOptions {
  app: WorldApp;
  viewer: WorldViewer;
  getPerformanceMonitor: () => PerformanceMonitor | null;
  getMinimap: () => Minimap | null;
}

export function getBufferedStreamingRadius(visualRadius: number): number {
  return visualRadius + HORIZON_STREAMING_BUFFER_CHUNKS;
}

export class AppRuntimeLoop {
  private readonly app: WorldApp;
  private readonly viewer: WorldViewer;
  private readonly getPerformanceMonitor: () => PerformanceMonitor | null;
  private readonly getMinimap: () => Minimap | null;

  private uiUpdateTimer: ReturnType<typeof setInterval> | null = null;
  private chunkLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private performanceTimer: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private running = false;
  private lastCameraUpdate = 0;
  private lastPerformanceUpdate = 0;
  private lastUIUpdate = 0;
  private lastChunkLoadCameraPos: { x: number; z: number } | null = null;

  constructor(options: AppRuntimeLoopOptions) {
    this.app = options.app;
    this.viewer = options.viewer;
    this.getPerformanceMonitor = options.getPerformanceMonitor;
    this.getMinimap = options.getMinimap;
  }

  start(): void {
    if (this.running) return;

    this.running = true;
    this.startFpsLoop();
    this.startUiLoop();
    this.scheduleChunkLoad();
    this.startPerformanceLoop();
  }

  stop(): void {
    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.uiUpdateTimer !== null) {
      clearInterval(this.uiUpdateTimer);
      this.uiUpdateTimer = null;
    }
    if (this.chunkLoadTimer !== null) {
      clearTimeout(this.chunkLoadTimer);
      this.chunkLoadTimer = null;
    }
    if (this.performanceTimer !== null) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }
  }

  private startFpsLoop(): void {
    let frameCount = 0;
    let lastFPSUpdate = performance.now();

    const renderLoop = () => {
      if (!this.running) return;

      frameCount++;
      const now = performance.now();

      if (now - lastFPSUpdate >= 1000) {
        const currentFPS = Math.round((frameCount * 1000) / (now - lastFPSUpdate));
        frameCount = 0;
        lastFPSUpdate = now;
        this.app.updateState({ fps: currentFPS });
      }

      this.rafId = requestAnimationFrame(renderLoop);
    };

    this.rafId = requestAnimationFrame(renderLoop);
  }

  private startUiLoop(): void {
    this.uiUpdateTimer = setInterval(() => {
      const cameraPos = this.viewer.getCameraPosition();
      const now = performance.now();

      if (now - this.lastCameraUpdate >= 100) {
        this.app.updateCameraPosition(cameraPos);
        this.lastCameraUpdate = now;
      }

      if (now - this.lastUIUpdate >= 100) {
        updateText('camera-x', cameraPos.x.toFixed(2));
        updateText('camera-y', cameraPos.y.toFixed(2));
        updateText('camera-z', cameraPos.z.toFixed(2));
        updateText('status-position', `${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)}`);
        updateText('status-chunks', this.app.getLoadedChunkCount().toString());

        const compassNeedle = document.getElementById('compass-needle');
        if (compassNeedle) {
          const heading = this.viewer.getCameraHeading();
          compassNeedle.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
        }

        this.lastUIUpdate = now;
      }
    }, 100);
  }

  private scheduleChunkLoad(delay = 100): void {
    this.chunkLoadTimer = setTimeout(() => {
      if (!this.running) return;

      let nextInterval = 100;

      if (this.viewer.isOrbitalOrTransitioning()) {
        this.scheduleChunkLoad(200);
        return;
      }

      const cameraPos = this.viewer.getCameraPosition();
      let distance = 0;
      if (this.lastChunkLoadCameraPos) {
        distance = Math.hypot(
          cameraPos.x - this.lastChunkLoadCameraPos.x,
          cameraPos.z - this.lastChunkLoadCameraPos.z
        );
      }
      this.lastChunkLoadCameraPos = { x: cameraPos.x, z: cameraPos.z };

      if (distance > 0.15) {
        nextInterval = 50;
      } else if (distance > 0.03) {
        nextInterval = 100;
      } else {
        nextInterval = 300;
      }

      setTimeout(() => this.loadChunksForCamera(cameraPos), 0);
      this.scheduleChunkLoad(nextInterval);
    }, delay);
  }

  private loadChunksForCamera(cameraPos: { x: number; z: number }): void {
    if (!this.running) return;

    const chunkSize = this.app.getConfigSnapshot().chunkSize * TERRAIN_TILE_SIZE_METERS;
    const loadRadius = getBufferedStreamingRadius(this.app.getViewDistance());
    const cameraChunkX = Math.floor(cameraPos.x / chunkSize);
    const cameraChunkY = Math.floor(cameraPos.z / chunkSize);

    void this.app.loadChunksAround(cameraChunkX, cameraChunkY, loadRadius);
    this.app.unloadDistantChunks(cameraChunkX, cameraChunkY, loadRadius + 2);
  }

  private startPerformanceLoop(): void {
    this.performanceTimer = setInterval(() => {
      const now = performance.now();
      if (now - this.lastPerformanceUpdate < 1000) {
        return;
      }

      setTimeout(() => {
        if (!this.running) return;

        const renderStats = this.viewer.getRenderStats();
        const memoryUsage = this.app.getApproximateMemoryUsage();
        const performanceMonitor = this.getPerformanceMonitor();
        if (performanceMonitor) {
          performanceMonitor.updateMemoryUsage(memoryUsage);
          performanceMonitor.updateRenderStats(renderStats.vertexCount, renderStats.drawCalls);
        }

        const dominantBiome = this.app.getDominantBiomeName();
        if (dominantBiome) {
          updateText('status-biome', dominantBiome);
        }

        this.getMinimap()?.draw();

        if (this.app.isWorkerPoolEnabled()) {
          this.app.updateWorkerPoolStats();
        }
      }, 0);

      this.lastPerformanceUpdate = now;
    }, 1000);
  }
}

function updateText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}
