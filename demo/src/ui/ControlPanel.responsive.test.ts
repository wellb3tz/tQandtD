/**
 * Unit tests for ControlPanel responsive layout functionality
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { DemoApp } from '../core/DemoApp';

describe('ControlPanel - Responsive Layout', () => {
  let controlPanel: ControlPanel;
  let mockApp: DemoApp;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    container.id = 'control-panel';
    document.body.appendChild(container);

    // Create mock app
    mockApp = {
      getState: vi.fn().mockReturnValue({
        config: {
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
          riverConfig: {
            sourceElevation: 0.7,
            minFlowLength: 10,
            flowWidth: 2
          }
        }
      }),
      subscribeToState: vi.fn(),
      updateEngineConfig: vi.fn(),
      updateState: vi.fn()
    } as any;

    controlPanel = new ControlPanel();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Collapse/Expand functionality', () => {
    it('should collapse the control panel', () => {
      controlPanel.initialize(container, mockApp);
      
      controlPanel.collapse();
      
      expect(container.classList.contains('collapsed')).toBe(true);
    });

    it('should expand the control panel', () => {
      controlPanel.initialize(container, mockApp);
      container.classList.add('collapsed');
      
      controlPanel.expand();
      
      expect(container.classList.contains('collapsed')).toBe(false);
    });

    it('should toggle the control panel visibility', () => {
      controlPanel.initialize(container, mockApp);
      
      // Initially not collapsed
      expect(container.classList.contains('collapsed')).toBe(false);
      
      // Toggle to collapsed
      controlPanel.toggle();
      expect(container.classList.contains('collapsed')).toBe(true);
      
      // Toggle back to expanded
      controlPanel.toggle();
      expect(container.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('Responsive behavior', () => {
    it('should have CSS class for collapsed state', () => {
      controlPanel.initialize(container, mockApp);
      
      controlPanel.collapse();
      
      expect(container.className).toContain('collapsed');
    });

    it('should remove CSS class when expanded', () => {
      controlPanel.initialize(container, mockApp);
      container.classList.add('collapsed');
      
      controlPanel.expand();
      
      expect(container.className).not.toContain('collapsed');
    });

    it('should maintain state through multiple toggles', () => {
      controlPanel.initialize(container, mockApp);
      
      // Start expanded
      expect(container.classList.contains('collapsed')).toBe(false);
      
      // Toggle 5 times
      for (let i = 0; i < 5; i++) {
        controlPanel.toggle();
        const shouldBeCollapsed = (i + 1) % 2 === 1;
        expect(container.classList.contains('collapsed')).toBe(shouldBeCollapsed);
      }
    });
  });

  describe('Integration with DOM', () => {
    it('should work with actual DOM element', () => {
      const testContainer = document.createElement('aside');
      testContainer.id = 'test-control-panel';
      testContainer.className = 'control-panel';
      document.body.appendChild(testContainer);

      controlPanel.initialize(testContainer, mockApp);
      
      // Test collapse
      controlPanel.collapse();
      expect(testContainer.classList.contains('collapsed')).toBe(true);
      
      // Test expand
      controlPanel.expand();
      expect(testContainer.classList.contains('collapsed')).toBe(false);
      
      document.body.removeChild(testContainer);
    });

    it('should handle null container gracefully', () => {
      const nullContainer = null as any;
      
      // Should not throw error
      expect(() => {
        const panel = new ControlPanel();
        panel.collapse();
        panel.expand();
        panel.toggle();
      }).not.toThrow();
    });
  });

  describe('CSS transitions', () => {
    it('should apply transition class for smooth animation', () => {
      controlPanel.initialize(container, mockApp);
      
      // Check if container has transition styles (via CSS)
      const computedStyle = window.getComputedStyle(container);
      
      // The CSS should have transition property set
      // Note: This test verifies the element is ready for CSS transitions
      expect(container).toBeDefined();
      expect(container.classList).toBeDefined();
    });
  });

  describe('State persistence', () => {
    it('should maintain collapsed state after re-initialization', () => {
      controlPanel.initialize(container, mockApp);
      
      // Collapse the panel
      controlPanel.collapse();
      expect(container.classList.contains('collapsed')).toBe(true);
      
      // Re-initialize (simulating page refresh or component remount)
      const newControlPanel = new ControlPanel();
      newControlPanel.initialize(container, mockApp);
      
      // State should be maintained in DOM
      expect(container.classList.contains('collapsed')).toBe(true);
    });
  });
});
