/**
 * PerformanceMonitor - Real-time performance metrics display
 * 
 * Displays FPS, generation times, memory usage, cache statistics, and render metrics
 * in an overlay panel. Updates metrics in real-time and provides visual feedback
 * for performance characteristics.
 */

import { DemoApp, AppState } from '../core/DemoApp';

/**
 * Generation time breakdown by stage
 */
export interface GenerationBreakdown {
  terrain: number;
  biomes: number;
  resources: number;
  structures: number;
  total: number;
}

/**
 * LOD statistics
 */
export interface LODStats {
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Worker pool statistics
 */
export interface WorkerStats {
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  avgWorkerTime: number;
}

/**
 * Incremental generation statistics
 */
export interface IncrementalStats {
  chunksInProgress: Map<string, string>;
  currentFPS: number;
}

/**
 * PerformanceMonitor - Displays real-time performance metrics
 */
export class PerformanceMonitor {
  private container: HTMLElement | null = null;
  private app: DemoApp | null = null;
  
  // Metric display elements
  private fpsElement: HTMLElement | null = null;
  private avgGenTimeElement: HTMLElement | null = null;
  private memoryElement: HTMLElement | null = null;
  private cacheHitRateElement: HTMLElement | null = null;
  private cacheSizeElement: HTMLElement | null = null;
  private vertexCountElement: HTMLElement | null = null;
  private drawCallsElement: HTMLElement | null = null;
  private loadedChunksElement: HTMLElement | null = null;
  
  // Generation breakdown elements
  private terrainTimeElement: HTMLElement | null = null;
  private biomesTimeElement: HTMLElement | null = null;
  private resourcesTimeElement: HTMLElement | null = null;
  private structuresTimeElement: HTMLElement | null = null;
  
  // LOD stats elements
  private lodHighElement: HTMLElement | null = null;
  private lodMediumElement: HTMLElement | null = null;
  private lodLowElement: HTMLElement | null = null;
  
  // Worker stats elements
  private activeWorkersElement: HTMLElement | null = null;
  private queuedTasksElement: HTMLElement | null = null;
  private completedTasksElement: HTMLElement | null = null;
  private avgWorkerTimeElement: HTMLElement | null = null;
  
  // Incremental stats elements
  private chunksInProgressElement: HTMLElement | null = null;
  private incrementalFPSElement: HTMLElement | null = null;
  
  // FPS tracking
  private fpsHistory: number[] = [];
  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;
  
  // Update interval
  private updateInterval: number | null = null;

  /**
   * Initialize the performance monitor
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    
    // Create monitor UI
    this.createMonitorUI();
    
    // Start FPS tracking
    this.startFPSTracking();
    
    // Start periodic updates
    this.startPeriodicUpdates();
    
    console.log('PerformanceMonitor initialized');
  }

  /**
   * Create the monitor UI structure
   */
  private createMonitorUI(): void {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create header
    const header = document.createElement('h3');
    header.textContent = 'Performance Monitor';
    header.style.fontSize = '1.25rem';
    header.style.marginBottom = 'var(--spacing-lg)';
    this.container.appendChild(header);
    
    // Create sections
    this.createFPSSection();
    this.createGenerationSection();
    this.createMemorySection();
    this.createRenderSection();
    this.createLODSection();
    this.createWorkerSection();
    this.createIncrementalSection();
  }

  /**
   * Create FPS metrics section
   */
  private createFPSSection(): void {
    const section = this.createSection('Frame Rate');
    
    this.fpsElement = this.createMetric(section, 'FPS', '0');
    
    this.container?.appendChild(section);
  }

  /**
   * Create generation time section
   */
  private createGenerationSection(): void {
    const section = this.createSection('Generation Time');
    
    this.avgGenTimeElement = this.createMetric(section, 'Average', '0 ms');
    
    // Breakdown subsection
    const breakdownTitle = document.createElement('div');
    breakdownTitle.textContent = 'Stage Breakdown';
    breakdownTitle.style.fontSize = '0.75rem';
    breakdownTitle.style.color = 'var(--text-secondary)';
    breakdownTitle.style.marginTop = 'var(--spacing-md)';
    breakdownTitle.style.marginBottom = 'var(--spacing-sm)';
    section.appendChild(breakdownTitle);
    
    this.terrainTimeElement = this.createMetric(section, 'Terrain', '0 ms', true);
    this.biomesTimeElement = this.createMetric(section, 'Biomes', '0 ms', true);
    this.resourcesTimeElement = this.createMetric(section, 'Resources', '0 ms', true);
    this.structuresTimeElement = this.createMetric(section, 'Structures', '0 ms', true);
    
    this.container?.appendChild(section);
  }

  /**
   * Create memory and cache section
   */
  private createMemorySection(): void {
    const section = this.createSection('Memory & Cache');
    
    this.memoryElement = this.createMetric(section, 'Memory Usage', '0 MB');
    this.cacheHitRateElement = this.createMetric(section, 'Cache Hit Rate', '0%');
    this.cacheSizeElement = this.createMetric(section, 'Cache Size', '0 / 0');
    
    this.container?.appendChild(section);
  }

  /**
   * Create render statistics section
   */
  private createRenderSection(): void {
    const section = this.createSection('Render Stats');
    
    this.loadedChunksElement = this.createMetric(section, 'Loaded Chunks', '0');
    this.vertexCountElement = this.createMetric(section, 'Vertices', '0');
    this.drawCallsElement = this.createMetric(section, 'Draw Calls', '0');
    
    this.container?.appendChild(section);
  }

  /**
   * Create LOD statistics section
   */
  private createLODSection(): void {
    const section = this.createSection('LOD System');
    
    this.lodHighElement = this.createMetric(section, 'High Detail', '0');
    this.lodMediumElement = this.createMetric(section, 'Medium Detail', '0');
    this.lodLowElement = this.createMetric(section, 'Low Detail', '0');
    
    this.container?.appendChild(section);
  }

  /**
   * Create worker pool statistics section
   */
  private createWorkerSection(): void {
    const section = this.createSection('Worker Pool');
    
    this.activeWorkersElement = this.createMetric(section, 'Active Workers', '0');
    this.queuedTasksElement = this.createMetric(section, 'Queued Tasks', '0');
    this.completedTasksElement = this.createMetric(section, 'Completed', '0');
    this.avgWorkerTimeElement = this.createMetric(section, 'Avg Time', '0 ms');
    
    this.container?.appendChild(section);
  }

  /**
   * Create incremental generation section
   */
  private createIncrementalSection(): void {
    const section = this.createSection('Incremental Gen');
    
    this.chunksInProgressElement = this.createMetric(section, 'In Progress', '0');
    this.incrementalFPSElement = this.createMetric(section, 'Target FPS', '60');
    
    this.container?.appendChild(section);
  }

  /**
   * Create a section container
   */
  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'monitor-section';
    section.style.marginBottom = 'var(--spacing-lg)';
    section.style.paddingBottom = 'var(--spacing-lg)';
    section.style.borderBottom = '1px solid var(--border-color)';
    
    const heading = document.createElement('h4');
    heading.textContent = title;
    heading.style.fontSize = '0.875rem';
    heading.style.color = 'var(--text-secondary)';
    heading.style.marginBottom = 'var(--spacing-md)';
    heading.style.textTransform = 'uppercase';
    heading.style.letterSpacing = '0.05em';
    
    section.appendChild(heading);
    
    return section;
  }

  /**
   * Create a metric display element
   */
  private createMetric(
    parent: HTMLElement,
    label: string,
    initialValue: string,
    isSubMetric: boolean = false
  ): HTMLElement {
    const metric = document.createElement('div');
    metric.className = 'metric';
    metric.style.display = 'flex';
    metric.style.justifyContent = 'space-between';
    metric.style.alignItems = 'center';
    metric.style.marginBottom = 'var(--spacing-sm)';
    
    if (isSubMetric) {
      metric.style.paddingLeft = 'var(--spacing-md)';
      metric.style.fontSize = '0.8rem';
    }
    
    const labelElement = document.createElement('span');
    labelElement.className = 'metric-label';
    labelElement.textContent = label;
    labelElement.style.fontSize = isSubMetric ? '0.75rem' : '0.875rem';
    labelElement.style.color = 'var(--text-secondary)';
    
    const valueElement = document.createElement('span');
    valueElement.className = 'metric-value';
    valueElement.textContent = initialValue;
    valueElement.style.fontSize = isSubMetric ? '0.875rem' : '1rem';
    valueElement.style.fontWeight = '600';
    valueElement.style.color = 'var(--text-color)';
    
    metric.appendChild(labelElement);
    metric.appendChild(valueElement);
    parent.appendChild(metric);
    
    return valueElement;
  }

  /**
   * Start FPS tracking
   */
  private startFPSTracking(): void {
    const trackFrame = () => {
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      
      // Calculate instantaneous FPS
      const fps = 1000 / delta;
      this.fpsHistory.push(fps);
      
      // Keep only last 60 frames
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
      
      this.frameCount++;
      
      requestAnimationFrame(trackFrame);
    };
    
    trackFrame();
  }

  /**
   * Start periodic metric updates
   */
  private startPeriodicUpdates(): void {
    // Update metrics every 500ms as per requirements
    this.updateInterval = window.setInterval(() => {
      this.updateMetrics();
    }, 500);
  }

  /**
   * Update all metrics from current state
   */
  private updateMetrics(): void {
    // Calculate average FPS from history
    if (this.fpsHistory.length > 0) {
      const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.updateFPS(Math.round(avgFPS));
    }
  }

  /**
   * Update FPS display
   */
  updateFPS(fps: number): void {
    if (this.fpsElement) {
      this.fpsElement.textContent = fps.toString();
      
      // Color code based on performance
      if (fps >= 55) {
        this.fpsElement.style.color = 'var(--success-color)';
      } else if (fps >= 30) {
        this.fpsElement.style.color = 'var(--warning-color)';
      } else {
        this.fpsElement.style.color = 'var(--error-color)';
      }
    }
  }

  /**
   * Update generation time with stage breakdown
   */
  updateGenerationTime(avgTime: number, breakdown: GenerationBreakdown): void {
    if (this.avgGenTimeElement) {
      this.avgGenTimeElement.textContent = `${avgTime.toFixed(2)} ms`;
      
      // Color code based on performance
      if (avgTime < 50) {
        this.avgGenTimeElement.style.color = 'var(--success-color)';
      } else if (avgTime < 100) {
        this.avgGenTimeElement.style.color = 'var(--warning-color)';
      } else {
        this.avgGenTimeElement.style.color = 'var(--error-color)';
      }
    }
    
    // Update breakdown
    if (this.terrainTimeElement) {
      this.terrainTimeElement.textContent = `${breakdown.terrain.toFixed(2)} ms`;
    }
    if (this.biomesTimeElement) {
      this.biomesTimeElement.textContent = `${breakdown.biomes.toFixed(2)} ms`;
    }
    if (this.resourcesTimeElement) {
      this.resourcesTimeElement.textContent = `${breakdown.resources.toFixed(2)} ms`;
    }
    if (this.structuresTimeElement) {
      this.structuresTimeElement.textContent = `${breakdown.structures.toFixed(2)} ms`;
    }
  }

  /**
   * Update memory usage display
   */
  updateMemoryUsage(bytes: number): void {
    if (this.memoryElement) {
      const mb = bytes / (1024 * 1024);
      this.memoryElement.textContent = `${mb.toFixed(2)} MB`;
      
      // Color code based on usage
      if (mb < 100) {
        this.memoryElement.style.color = 'var(--success-color)';
      } else if (mb < 200) {
        this.memoryElement.style.color = 'var(--warning-color)';
      } else {
        this.memoryElement.style.color = 'var(--error-color)';
      }
    }
  }

  /**
   * Update cache statistics
   */
  updateCacheStats(hitRate: number, size: number, maxSize: number): void {
    if (this.cacheHitRateElement) {
      this.cacheHitRateElement.textContent = `${(hitRate * 100).toFixed(1)}%`;
      
      // Color code based on hit rate
      if (hitRate >= 0.8) {
        this.cacheHitRateElement.style.color = 'var(--success-color)';
      } else if (hitRate >= 0.5) {
        this.cacheHitRateElement.style.color = 'var(--warning-color)';
      } else {
        this.cacheHitRateElement.style.color = 'var(--error-color)';
      }
    }
    
    if (this.cacheSizeElement) {
      this.cacheSizeElement.textContent = `${size} / ${maxSize}`;
      
      // Color code based on cache fullness
      const fullness = size / maxSize;
      if (fullness < 0.7) {
        this.cacheSizeElement.style.color = 'var(--success-color)';
      } else if (fullness < 0.9) {
        this.cacheSizeElement.style.color = 'var(--warning-color)';
      } else {
        this.cacheSizeElement.style.color = 'var(--error-color)';
      }
    }
  }

  /**
   * Update render statistics
   */
  updateRenderStats(vertexCount: number, drawCalls: number): void {
    if (this.vertexCountElement) {
      // Format large numbers with K/M suffix
      const formatted = this.formatLargeNumber(vertexCount);
      this.vertexCountElement.textContent = formatted;
    }
    
    if (this.drawCallsElement) {
      this.drawCallsElement.textContent = drawCalls.toString();
    }
  }

  /**
   * Update LOD statistics
   */
  updateLODStats(stats: LODStats): void {
    if (this.lodHighElement) {
      this.lodHighElement.textContent = stats.highCount.toString();
      this.lodHighElement.style.color = 'var(--success-color)';
    }
    if (this.lodMediumElement) {
      this.lodMediumElement.textContent = stats.mediumCount.toString();
      this.lodMediumElement.style.color = 'var(--warning-color)';
    }
    if (this.lodLowElement) {
      this.lodLowElement.textContent = stats.lowCount.toString();
      this.lodLowElement.style.color = 'var(--text-color)';
    }
  }

  /**
   * Update worker pool statistics
   */
  updateWorkerStats(stats: WorkerStats): void {
    if (this.activeWorkersElement) {
      this.activeWorkersElement.textContent = stats.activeWorkers.toString();
    }
    if (this.queuedTasksElement) {
      this.queuedTasksElement.textContent = stats.queuedTasks.toString();
    }
    if (this.completedTasksElement) {
      this.completedTasksElement.textContent = stats.completedTasks.toString();
    }
    if (this.avgWorkerTimeElement) {
      this.avgWorkerTimeElement.textContent = `${stats.avgWorkerTime.toFixed(2)} ms`;
    }
  }

  /**
   * Update incremental generation statistics
   */
  updateIncrementalStats(stats: IncrementalStats): void {
    if (this.chunksInProgressElement) {
      this.chunksInProgressElement.textContent = stats.chunksInProgress.size.toString();
    }
    if (this.incrementalFPSElement) {
      this.incrementalFPSElement.textContent = stats.currentFPS.toString();
    }
  }

  /**
   * Update loaded chunks count
   */
  updateLoadedChunks(count: number): void {
    if (this.loadedChunksElement) {
      this.loadedChunksElement.textContent = count.toString();
    }
  }

  /**
   * Format large numbers with K/M suffix
   */
  private formatLargeNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toString();
  }

  /**
   * Show the performance monitor
   */
  show(): void {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  /**
   * Hide the performance monitor
   */
  hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.container) {
      this.container.classList.toggle('hidden');
    }
  }

  /**
   * Clean up resources
   */
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
