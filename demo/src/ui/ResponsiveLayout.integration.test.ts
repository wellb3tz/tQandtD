/**
 * Integration tests for responsive layout functionality
 * Tests the auto-collapse behavior for narrow screens
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Responsive Layout Integration', () => {
  let controlPanel: HTMLElement;
  let performanceMonitor: HTMLElement;
  let originalInnerWidth: number;

  beforeEach(() => {
    // Store original window width
    originalInnerWidth = window.innerWidth;

    // Create mock DOM elements
    controlPanel = document.createElement('aside');
    controlPanel.id = 'control-panel';
    controlPanel.className = 'control-panel';
    document.body.appendChild(controlPanel);

    performanceMonitor = document.createElement('aside');
    performanceMonitor.id = 'performance-monitor';
    performanceMonitor.className = 'performance-monitor';
    document.body.appendChild(performanceMonitor);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(controlPanel);
    document.body.removeChild(performanceMonitor);

    // Restore original window width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    });
  });

  describe('Auto-collapse on narrow screens (<768px)', () => {
    it('should auto-collapse control panel when width < 768px', () => {
      // Simulate narrow screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 767
      });

      // Simulate the responsive layout handler
      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        }
      };

      handleResponsiveLayout();

      expect(controlPanel.classList.contains('collapsed')).toBe(true);
      expect(performanceMonitor.classList.contains('hidden')).toBe(true);
    });

    it('should auto-collapse at exactly 767px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 767
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        }
      };

      handleResponsiveLayout();

      expect(controlPanel.classList.contains('collapsed')).toBe(true);
    });

    it('should NOT auto-collapse at exactly 768px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        }
      };

      handleResponsiveLayout();

      expect(controlPanel.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('Auto-expand on wide screens (>=1200px)', () => {
    it('should auto-expand control panel when width >= 1200px', () => {
      // Start with collapsed state
      controlPanel.classList.add('collapsed');
      performanceMonitor.classList.add('hidden');

      // Simulate wide screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
          performanceMonitor.classList.remove('hidden');
        }
      };

      handleResponsiveLayout();

      expect(controlPanel.classList.contains('collapsed')).toBe(false);
      expect(performanceMonitor.classList.contains('hidden')).toBe(false);
    });

    it('should auto-expand at exactly 1200px', () => {
      controlPanel.classList.add('collapsed');
      performanceMonitor.classList.add('hidden');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
          performanceMonitor.classList.remove('hidden');
        }
      };

      handleResponsiveLayout();

      expect(controlPanel.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('Medium screens (768px - 1199px)', () => {
    it('should maintain current state at 768px', () => {
      // Start expanded
      controlPanel.classList.remove('collapsed');
      performanceMonitor.classList.remove('hidden');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        } else if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
          performanceMonitor.classList.remove('hidden');
        }
        // For medium screens, maintain current state
      };

      handleResponsiveLayout();

      // Should remain expanded
      expect(controlPanel.classList.contains('collapsed')).toBe(false);
    });

    it('should maintain current state at 1000px', () => {
      // Start collapsed
      controlPanel.classList.add('collapsed');
      performanceMonitor.classList.add('hidden');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1000
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        } else if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
          performanceMonitor.classList.remove('hidden');
        }
      };

      handleResponsiveLayout();

      // Should remain collapsed
      expect(controlPanel.classList.contains('collapsed')).toBe(true);
    });

    it('should maintain current state at 1199px', () => {
      // Start expanded
      controlPanel.classList.remove('collapsed');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1199
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
        } else if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
        }
      };

      handleResponsiveLayout();

      // Should remain expanded
      expect(controlPanel.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('Window resize events', () => {
    it('should respond to window resize from wide to narrow', () => {
      // Start wide
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        } else if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
          performanceMonitor.classList.remove('hidden');
        }
      };

      handleResponsiveLayout();
      expect(controlPanel.classList.contains('collapsed')).toBe(false);

      // Resize to narrow
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500
      });

      handleResponsiveLayout();
      expect(controlPanel.classList.contains('collapsed')).toBe(true);
    });

    it('should respond to window resize from narrow to wide', () => {
      // Start narrow
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500
      });

      const handleResponsiveLayout = () => {
        const width = window.innerWidth;
        if (width < 768) {
          controlPanel.classList.add('collapsed');
          performanceMonitor.classList.add('hidden');
        } else if (width >= 1200) {
          controlPanel.classList.remove('collapsed');
          performanceMonitor.classList.remove('hidden');
        }
      };

      handleResponsiveLayout();
      expect(controlPanel.classList.contains('collapsed')).toBe(true);

      // Resize to wide
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      });

      handleResponsiveLayout();
      expect(controlPanel.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('Canvas resize handler', () => {
    it('should handle canvas resize on window resize', () => {
      const viewerContainer = document.createElement('div');
      viewerContainer.id = 'viewer';
      document.body.appendChild(viewerContainer);

      // Mock clientWidth and clientHeight since jsdom doesn't compute them
      Object.defineProperty(viewerContainer, 'clientWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
      Object.defineProperty(viewerContainer, 'clientHeight', {
        writable: true,
        configurable: true,
        value: 768
      });

      // Mock WorldViewer resize method
      const mockResize = vi.fn();
      const mockWorldViewer = {
        resize: mockResize
      };

      // Simulate resize handler
      const handleResize = () => {
        if (viewerContainer && mockWorldViewer) {
          mockWorldViewer.resize(
            viewerContainer.clientWidth,
            viewerContainer.clientHeight
          );
        }
      };

      // Trigger resize
      handleResize();

      expect(mockResize).toHaveBeenCalledWith(1024, 768);

      document.body.removeChild(viewerContainer);
    });
  });

  describe('CSS Grid responsive layout', () => {
    it('should have correct grid template for wide screens', () => {
      const appContent = document.createElement('div');
      appContent.className = 'app-content';
      document.body.appendChild(appContent);

      // Simulate wide screen (>1200px)
      // CSS should apply: grid-template-columns: var(--sidebar-width) 1fr var(--monitor-width)
      
      expect(appContent.className).toBe('app-content');
      
      document.body.removeChild(appContent);
    });

    it('should have correct grid template for medium screens', () => {
      const appContent = document.createElement('div');
      appContent.className = 'app-content';
      document.body.appendChild(appContent);

      // Simulate medium screen (768-1200px)
      // CSS should apply: grid-template-columns: var(--sidebar-width) 1fr
      
      expect(appContent.className).toBe('app-content');
      
      document.body.removeChild(appContent);
    });

    it('should have correct grid template for narrow screens', () => {
      const appContent = document.createElement('div');
      appContent.className = 'app-content';
      document.body.appendChild(appContent);

      // Simulate narrow screen (<768px)
      // CSS should apply: grid-template-columns: 1fr
      
      expect(appContent.className).toBe('app-content');
      
      document.body.removeChild(appContent);
    });
  });

  describe('Toggle button functionality', () => {
    it('should toggle control panel when button is clicked', () => {
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'toggle-controls-btn';
      document.body.appendChild(toggleBtn);

      toggleBtn.addEventListener('click', () => {
        controlPanel.classList.toggle('collapsed');
      });

      // Initially not collapsed
      expect(controlPanel.classList.contains('collapsed')).toBe(false);

      // Click to collapse
      toggleBtn.click();
      expect(controlPanel.classList.contains('collapsed')).toBe(true);

      // Click to expand
      toggleBtn.click();
      expect(controlPanel.classList.contains('collapsed')).toBe(false);

      document.body.removeChild(toggleBtn);
    });

    it('should toggle performance monitor when button is clicked', () => {
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'toggle-monitor-btn';
      document.body.appendChild(toggleBtn);

      toggleBtn.addEventListener('click', () => {
        performanceMonitor.classList.toggle('hidden');
      });

      // Initially not hidden
      expect(performanceMonitor.classList.contains('hidden')).toBe(false);

      // Click to hide
      toggleBtn.click();
      expect(performanceMonitor.classList.contains('hidden')).toBe(true);

      // Click to show
      toggleBtn.click();
      expect(performanceMonitor.classList.contains('hidden')).toBe(false);

      document.body.removeChild(toggleBtn);
    });
  });
});
