/**
 * Unit tests for PerformanceMonitor component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, GenerationBreakdown, LODStats, WorkerStats, IncrementalStats } from './PerformanceMonitor';

// Mock DOM elements
class MockElement {
  children: MockElement[] = [];
  private _classes: Set<string> = new Set();
  classList = {
    contains: (className: string) => this._classes.has(className),
    add: (className: string) => { this._classes.add(className); },
    remove: (className: string) => { this._classes.delete(className); },
    toggle: (className: string) => {
      if (this._classes.has(className)) {
        this._classes.delete(className);
      } else {
        this._classes.add(className);
      }
    }
  };
  style: any = {};
  textContent: string = '';
  id: string = '';
  className: string = '';
  innerHTML: string = '';
  
  appendChild(child: MockElement) {
    this.children.push(child);
    return child;
  }
  
  querySelector(selector: string): MockElement | null {
    // Simple mock implementation
    if (selector === 'h3') {
      return this.children.find(c => c.tagName === 'h3') || null;
    }
    if (selector === '.monitor-section') {
      return this.children.find(c => c.className === 'monitor-section') || null;
    }
    if (selector === '.metric') {
      return this.children.find(c => c.className === 'metric') || null;
    }
    if (selector === '.metric-label') {
      return this.children.find(c => c.className === 'metric-label') || null;
    }
    if (selector === '.metric-value') {
      return this.children.find(c => c.className === 'metric-value') || null;
    }
    if (selector === 'h4') {
      return this.children.find(c => c.tagName === 'h4') || null;
    }
    return null;
  }
  
  querySelectorAll(selector: string): MockElement[] {
    if (selector === '.monitor-section') {
      return this.getAllByClass('monitor-section');
    }
    if (selector === '.metric') {
      return this.getAllByClass('metric');
    }
    return [];
  }
  
  private getAllByClass(className: string): MockElement[] {
    const results: MockElement[] = [];
    for (const child of this.children) {
      if (child.className === className) {
        results.push(child);
      }
      results.push(...child.getAllByClass(className));
    }
    return results;
  }
  
  tagName: string = 'div';
}

// Mock document
const mockDocument = {
  createElement: (tag: string) => {
    const el = new MockElement();
    el.tagName = tag;
    return el;
  }
};

// Mock global objects
global.document = mockDocument as any;
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
}) as any;
global.performance = {
  now: vi.fn(() => Date.now())
} as any;
global.window = {
  setInterval: vi.fn((cb, ms) => setInterval(cb, ms)),
  clearInterval: vi.fn((id) => clearInterval(id))
} as any;

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let container: MockElement;

  beforeEach(() => {
    // Create a container element
    container = new MockElement();
    container.id = 'performance-monitor';

    // Create monitor instance
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    // Clean up
    monitor.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with container element', () => {
      monitor.initialize(container);
      
      // Check that UI elements were created
      expect(container.children.length).toBeGreaterThan(0);
      expect(container.querySelector('h3')?.textContent).toBe('Performance Monitor');
    });

    it('should create all metric sections', () => {
      monitor.initialize(container);
      
      const sections = container.querySelectorAll('.monitor-section');
      expect(sections.length).toBeGreaterThan(0);
      
      // Check for key sections (titles are not uppercase in implementation)
      const sectionTitles = Array.from(sections).map(s => s.querySelector('h4')?.textContent);
      expect(sectionTitles).toContain('Frame Rate');
      expect(sectionTitles).toContain('Generation Time');
      expect(sectionTitles).toContain('Memory & Cache');
      expect(sectionTitles).toContain('Render Stats');
    });

    it('should create FPS metric', () => {
      monitor.initialize(container);
      
      const metrics = container.querySelectorAll('.metric');
      const fpsMetric = Array.from(metrics).find(m => 
        m.querySelector('.metric-label')?.textContent === 'FPS'
      );
      
      expect(fpsMetric).toBeDefined();
      expect(fpsMetric?.querySelector('.metric-value')?.textContent).toBe('0');
    });

    it('should create generation time metrics', () => {
      monitor.initialize(container);
      
      const metrics = container.querySelectorAll('.metric');
      const labels = Array.from(metrics).map(m => m.querySelector('.metric-label')?.textContent);
      
      expect(labels).toContain('Average');
      expect(labels).toContain('Terrain');
      expect(labels).toContain('Biomes');
      expect(labels).toContain('Rivers');
      expect(labels).toContain('Resources');
      expect(labels).toContain('Structures');
    });
  });

  describe('FPS Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update FPS display', () => {
      monitor.updateFPS(60);
      
      const fpsValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'FPS')
        ?.querySelector('.metric-value');
      
      expect(fpsValue?.textContent).toBe('60');
    });

    it('should color code FPS based on performance - good', () => {
      monitor.updateFPS(60);
      
      const fpsValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'FPS')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(fpsValue?.style.color).toContain('success');
    });

    it('should color code FPS based on performance - warning', () => {
      monitor.updateFPS(45);
      
      const fpsValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'FPS')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(fpsValue?.style.color).toContain('warning');
    });

    it('should color code FPS based on performance - error', () => {
      monitor.updateFPS(25);
      
      const fpsValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'FPS')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(fpsValue?.style.color).toContain('error');
    });
  });

  describe('Generation Time Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update average generation time', () => {
      const breakdown: GenerationBreakdown = {
        terrain: 10,
        biomes: 5,
        rivers: 3,
        resources: 2,
        structures: 1,
        total: 21
      };
      
      monitor.updateGenerationTime(21, breakdown);
      
      const avgValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Average')
        ?.querySelector('.metric-value');
      
      expect(avgValue?.textContent).toBe('21.00 ms');
    });

    it('should update stage breakdown', () => {
      const breakdown: GenerationBreakdown = {
        terrain: 10.5,
        biomes: 5.2,
        rivers: 3.1,
        resources: 2.0,
        structures: 1.3,
        total: 22.1
      };
      
      monitor.updateGenerationTime(22.1, breakdown);
      
      const terrainValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Terrain')
        ?.querySelector('.metric-value');
      
      expect(terrainValue?.textContent).toBe('10.50 ms');
    });

    it('should color code generation time - fast', () => {
      const breakdown: GenerationBreakdown = {
        terrain: 10,
        biomes: 5,
        rivers: 3,
        resources: 2,
        structures: 1,
        total: 21
      };
      
      monitor.updateGenerationTime(30, breakdown);
      
      const avgValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Average')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(avgValue?.style.color).toContain('success');
    });

    it('should color code generation time - slow', () => {
      const breakdown: GenerationBreakdown = {
        terrain: 50,
        biomes: 30,
        rivers: 20,
        resources: 10,
        structures: 10,
        total: 120
      };
      
      monitor.updateGenerationTime(120, breakdown);
      
      const avgValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Average')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(avgValue?.style.color).toContain('error');
    });
  });

  describe('Memory and Cache Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update memory usage in MB', () => {
      const bytes = 50 * 1024 * 1024; // 50 MB
      monitor.updateMemoryUsage(bytes);
      
      const memValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Memory Usage')
        ?.querySelector('.metric-value');
      
      expect(memValue?.textContent).toBe('50.00 MB');
    });

    it('should update cache hit rate as percentage', () => {
      monitor.updateCacheStats(0.85, 50, 100);
      
      const hitRateValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Cache Hit Rate')
        ?.querySelector('.metric-value');
      
      expect(hitRateValue?.textContent).toBe('85.0%');
    });

    it('should update cache size', () => {
      monitor.updateCacheStats(0.85, 50, 100);
      
      const cacheSizeValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Cache Size')
        ?.querySelector('.metric-value');
      
      expect(cacheSizeValue?.textContent).toBe('50 / 100');
    });

    it('should color code cache hit rate - good', () => {
      monitor.updateCacheStats(0.9, 50, 100);
      
      const hitRateValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Cache Hit Rate')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(hitRateValue?.style.color).toContain('success');
    });

    it('should color code cache hit rate - poor', () => {
      monitor.updateCacheStats(0.3, 50, 100);
      
      const hitRateValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Cache Hit Rate')
        ?.querySelector('.metric-value') as HTMLElement;
      
      expect(hitRateValue?.style.color).toContain('error');
    });
  });

  describe('Render Statistics Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update vertex count with K suffix', () => {
      monitor.updateRenderStats(5000, 10);
      
      const vertexValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Vertices')
        ?.querySelector('.metric-value');
      
      expect(vertexValue?.textContent).toBe('5.00K');
    });

    it('should update vertex count with M suffix', () => {
      monitor.updateRenderStats(2500000, 50);
      
      const vertexValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Vertices')
        ?.querySelector('.metric-value');
      
      expect(vertexValue?.textContent).toBe('2.50M');
    });

    it('should update draw calls', () => {
      monitor.updateRenderStats(5000, 25);
      
      const drawCallsValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Draw Calls')
        ?.querySelector('.metric-value');
      
      expect(drawCallsValue?.textContent).toBe('25');
    });

    it('should update loaded chunks count', () => {
      monitor.updateLoadedChunks(15);
      
      const chunksValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Loaded Chunks')
        ?.querySelector('.metric-value');
      
      expect(chunksValue?.textContent).toBe('15');
    });
  });

  describe('LOD Statistics Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update LOD statistics', () => {
      const stats: LODStats = {
        highCount: 9,
        mediumCount: 12,
        lowCount: 6
      };
      
      monitor.updateLODStats(stats);
      
      const highValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'High Detail')
        ?.querySelector('.metric-value');
      
      const mediumValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Medium Detail')
        ?.querySelector('.metric-value');
      
      const lowValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Low Detail')
        ?.querySelector('.metric-value');
      
      expect(highValue?.textContent).toBe('9');
      expect(mediumValue?.textContent).toBe('12');
      expect(lowValue?.textContent).toBe('6');
    });
  });

  describe('Worker Pool Statistics Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update worker pool statistics', () => {
      const stats: WorkerStats = {
        activeWorkers: 4,
        queuedTasks: 8,
        completedTasks: 120,
        avgWorkerTime: 45.5
      };
      
      monitor.updateWorkerStats(stats);
      
      const activeValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Active Workers')
        ?.querySelector('.metric-value');
      
      const queuedValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'Queued Tasks')
        ?.querySelector('.metric-value');
      
      expect(activeValue?.textContent).toBe('4');
      expect(queuedValue?.textContent).toBe('8');
    });
  });

  describe('Incremental Generation Statistics Updates', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should update incremental generation statistics', () => {
      const stats: IncrementalStats = {
        chunksInProgress: new Map([
          ['0,0', 'terrain'],
          ['1,0', 'biomes']
        ]),
        currentFPS: 60
      };
      
      monitor.updateIncrementalStats(stats);
      
      const inProgressValue = Array.from(container.querySelectorAll('.metric'))
        .find(m => m.querySelector('.metric-label')?.textContent === 'In Progress')
        ?.querySelector('.metric-value');
      
      expect(inProgressValue?.textContent).toBe('2');
    });
  });

  describe('Visibility Controls', () => {
    beforeEach(() => {
      monitor.initialize(container);
    });

    it('should show monitor', () => {
      container.classList.add('hidden');
      monitor.show();
      
      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('should hide monitor', () => {
      monitor.hide();
      
      expect(container.classList.contains('hidden')).toBe(true);
    });

    it('should toggle visibility', () => {
      monitor.toggle();
      expect(container.classList.contains('hidden')).toBe(true);
      
      monitor.toggle();
      expect(container.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources', () => {
      monitor.initialize(container);
      monitor.dispose();
      
      // Monitor should be cleaned up
      // No errors should occur
      expect(true).toBe(true);
    });
  });
});
