/**
 * Unit tests for Worker Pool controls in ControlPanel
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { DemoApp } from '../core/DemoApp';

describe('ControlPanel - Worker Pool Controls', () => {
  let controlPanel: ControlPanel;
  let mockApp: DemoApp;
  let container: HTMLElement;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.id = 'test-container';
    
    // Create required sections
    const sections = [
      'preset-controls',
      'terrain-controls',
      'biome-controls',
      'river-controls',
      'resource-controls',
      'advanced-controls',
      'visibility-controls'
    ];
    
    sections.forEach(id => {
      const section = document.createElement('div');
      section.id = id;
      container.appendChild(section);
    });
    
    document.body.appendChild(container);

    // Create mock app
    mockApp = {
      getState: vi.fn().mockReturnValue({
        config: {
          seed: 12345,
          chunkSize: 32,
          terrainConfig: {
            baseScale: 0.01,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0,
            warpStrength: 30,
            heightMultiplier: 1.0
          },
          biomeConfig: {
            temperatureScale: 0.005,
            moistureScale: 0.005,
            blendRadius: 5
          },
          resourceConfig: {
            types: [],
            clusterScale: 20,
            densityThreshold: 0.6
          },
          structureConfig: {
            types: [],
            minDistance: 10,
            maxAttempts: 30
          },
          riverConfig: {
            sourceElevation: 0.7,
            minFlowLength: 10,
            flowWidth: 2
          }
        }
      }),
      updateEngineConfig: vi.fn(),
      updateState: vi.fn(),
      subscribeToState: vi.fn().mockReturnValue(() => {})
    } as any;

    controlPanel = new ControlPanel();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Worker Pool Enable Checkbox', () => {
    it('should create worker pool enable checkbox', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBe(false);
    });

    it('should enable worker pool when checkbox is checked', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          workerPoolConfig: expect.objectContaining({
            maxWorkers: expect.any(Number),
            workerScriptUrl: '/worker.js',
            taskTimeout: 30000
          })
        })
      );
    });

    it('should disable worker pool when checkbox is unchecked', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      
      // First enable it
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      // Then disable it
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workerPoolConfig: undefined
        })
      );
    });

    it('should show maxWorkers slider when worker pool is enabled', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      const maxWorkersGroup = document.getElementById('maxWorkers-group') as HTMLElement;
      
      expect(maxWorkersGroup.style.display).toBe('none');
      
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(maxWorkersGroup.style.display).toBe('block');
    });

    it('should hide maxWorkers slider when worker pool is disabled', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      const maxWorkersGroup = document.getElementById('maxWorkers-group') as HTMLElement;
      
      // Enable first
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      expect(maxWorkersGroup.style.display).toBe('block');
      
      // Then disable
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(maxWorkersGroup.style.display).toBe('none');
    });
  });

  describe('Max Workers Slider', () => {
    it('should create maxWorkers slider', () => {
      controlPanel.initialize(container, mockApp);
      
      const slider = document.getElementById('maxWorkers') as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.type).toBe('range');
      expect(slider.min).toBe('1');
      expect(slider.max).toBe('16');
      expect(slider.step).toBe('1');
    });

    it('should have default value based on hardware concurrency', () => {
      controlPanel.initialize(container, mockApp);
      
      const slider = document.getElementById('maxWorkers') as HTMLInputElement;
      const expectedDefault = navigator.hardwareConcurrency || 4;
      expect(parseInt(slider.value)).toBe(expectedDefault);
    });

    it('should update worker pool config when slider changes', () => {
      controlPanel.initialize(container, mockApp);
      
      // Enable worker pool first
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      // Update mock to return worker pool config
      (mockApp.getState as any).mockReturnValue({
        config: {
          ...mockApp.getState().config,
          workerPoolConfig: {
            maxWorkers: 4,
            workerScriptUrl: '/worker.js',
            taskTimeout: 30000
          }
        }
      });
      
      const slider = document.getElementById('maxWorkers') as HTMLInputElement;
      slider.value = '8';
      slider.dispatchEvent(new Event('input'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          workerPoolConfig: expect.objectContaining({
            maxWorkers: 8
          })
        })
      );
    });

    it('should display current value next to slider', () => {
      controlPanel.initialize(container, mockApp);
      
      const slider = document.getElementById('maxWorkers') as HTMLInputElement;
      const label = slider.parentElement?.querySelector('label');
      const valueDisplay = label?.querySelector('.slider-value');
      
      expect(valueDisplay).toBeTruthy();
      expect(valueDisplay?.textContent).toBe(slider.value);
    });

    it('should update value display when slider changes', () => {
      controlPanel.initialize(container, mockApp);
      
      const slider = document.getElementById('maxWorkers') as HTMLInputElement;
      const label = slider.parentElement?.querySelector('label');
      const valueDisplay = label?.querySelector('.slider-value');
      
      slider.value = '12';
      slider.dispatchEvent(new Event('input'));
      
      expect(valueDisplay?.textContent).toBe('12');
    });
  });

  describe('Worker Pool Configuration', () => {
    it('should use default worker script URL', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          workerPoolConfig: expect.objectContaining({
            workerScriptUrl: '/worker.js'
          })
        })
      );
    });

    it('should use default task timeout', () => {
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          workerPoolConfig: expect.objectContaining({
            taskTimeout: 30000
          })
        })
      );
    });

    it('should respect hardware concurrency for default maxWorkers', () => {
      const originalHardwareConcurrency = navigator.hardwareConcurrency;
      
      // Mock hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 8,
        writable: true,
        configurable: true
      });
      
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          workerPoolConfig: expect.objectContaining({
            maxWorkers: 8
          })
        })
      );
      
      // Restore original value
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: originalHardwareConcurrency,
        writable: true,
        configurable: true
      });
    });

    it('should fall back to 4 workers if hardware concurrency is unavailable', () => {
      const originalHardwareConcurrency = navigator.hardwareConcurrency;
      
      // Mock hardware concurrency as undefined
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      controlPanel.initialize(container, mockApp);
      
      const checkbox = document.getElementById('enableWorkerPool') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      expect(mockApp.updateEngineConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          workerPoolConfig: expect.objectContaining({
            maxWorkers: 4
          })
        })
      );
      
      // Restore original value
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: originalHardwareConcurrency,
        writable: true,
        configurable: true
      });
    });
  });

  describe('Tooltip', () => {
    it('should have tooltip on worker pool checkbox', () => {
      controlPanel.initialize(container, mockApp);
      
      const label = document.querySelector('label[for="enableWorkerPool"]') as HTMLLabelElement;
      expect(label?.title).toBe('Enable multi-threaded generation');
    });

    it('should have tooltip on maxWorkers slider', () => {
      controlPanel.initialize(container, mockApp);
      
      const label = document.querySelector('label[for="maxWorkers"]') as HTMLLabelElement;
      expect(label?.title).toBe('Maximum number of worker threads');
    });
  });
});
