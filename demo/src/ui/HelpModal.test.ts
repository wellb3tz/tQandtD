/**
 * Unit tests for HelpModal component
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HelpModal } from './HelpModal';

describe('HelpModal', () => {
  let helpModal: HelpModal;
  let container: HTMLElement;

  beforeEach(() => {
    // Create a container for the modal
    container = document.createElement('div');
    document.body.appendChild(container);
    
    helpModal = new HelpModal();
    helpModal.initialize();
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should create modal element on initialization', () => {
      const modal = document.getElementById('help-modal');
      expect(modal).toBeTruthy();
      expect(modal?.classList.contains('modal-dialog')).toBe(true);
    });

    it('should be hidden by default', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.classList.contains('hidden')).toBe(true);
      expect(helpModal.isOpen()).toBe(false);
    });

    it('should have close button', () => {
      const closeBtn = document.getElementById('help-modal-close');
      expect(closeBtn).toBeTruthy();
    });

    it('should have OK button', () => {
      const okBtn = document.getElementById('help-modal-ok');
      expect(okBtn).toBeTruthy();
    });
  });

  describe('Content', () => {
    it('should contain getting started section', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Getting Started');
    });

    it('should contain world generation documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('World Generation');
      expect(modal?.textContent).toContain('Seed');
    });

    it('should contain terrain parameters documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Terrain Parameters');
      expect(modal?.textContent).toContain('Base Scale');
      expect(modal?.textContent).toContain('Octaves');
    });

    it('should contain biome system documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Biome System');
      expect(modal?.textContent).toContain('Temperature');
    });

    it('should contain river networks documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('River Networks');
      expect(modal?.textContent).toContain('Tributaries');
    });

    it('should contain terrain editing documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Terrain Editing');
      expect(modal?.textContent).toContain('Raise');
      expect(modal?.textContent).toContain('Lower');
    });

    it('should contain performance features documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Performance Features');
      expect(modal?.textContent).toContain('LOD System');
      expect(modal?.textContent).toContain('Worker Pool');
    });

    it('should contain keyboard shortcuts reference (requirement 20.5)', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Keyboard Shortcuts');
      expect(modal?.querySelector('.shortcuts-table')).toBeTruthy();
    });

    it('should list WASD controls in shortcuts', () => {
      const modal = document.getElementById('help-modal');
      const shortcutsTable = modal?.querySelector('.shortcuts-table');
      expect(shortcutsTable?.textContent).toContain('W');
      expect(shortcutsTable?.textContent).toContain('A');
      expect(shortcutsTable?.textContent).toContain('S');
      expect(shortcutsTable?.textContent).toContain('D');
    });

    it('should contain visibility toggles documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Visibility Toggles');
    });

    it('should contain world management documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('World Management');
      expect(modal?.textContent).toContain('Save');
      expect(modal?.textContent).toContain('Load');
    });

    it('should contain performance monitor documentation', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Performance Monitor');
      expect(modal?.textContent).toContain('FPS');
    });

    it('should contain link to engine documentation (requirement 20.7)', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Engine Documentation');
      
      const docLink = modal?.querySelector('.doc-link');
      expect(docLink).toBeTruthy();
      expect(docLink?.getAttribute('href')).toBeTruthy();
      expect(docLink?.getAttribute('target')).toBe('_blank');
    });

    it('should contain tips section', () => {
      const modal = document.getElementById('help-modal');
      expect(modal?.textContent).toContain('Tips');
      expect(modal?.textContent).toContain('tooltip');
    });
  });

  describe('Show/Hide', () => {
    it('should show modal when show() is called', () => {
      helpModal.show();
      
      const modal = document.getElementById('help-modal');
      expect(modal?.classList.contains('hidden')).toBe(false);
      expect(helpModal.isOpen()).toBe(true);
    });

    it('should hide modal when hide() is called', () => {
      helpModal.show();
      helpModal.hide();
      
      const modal = document.getElementById('help-modal');
      expect(modal?.classList.contains('hidden')).toBe(true);
      expect(helpModal.isOpen()).toBe(false);
    });

    it('should toggle modal visibility', () => {
      expect(helpModal.isOpen()).toBe(false);
      
      helpModal.toggle();
      expect(helpModal.isOpen()).toBe(true);
      
      helpModal.toggle();
      expect(helpModal.isOpen()).toBe(false);
    });
  });

  describe('Event Handlers', () => {
    it('should close modal when close button is clicked', () => {
      helpModal.show();
      
      const closeBtn = document.getElementById('help-modal-close');
      closeBtn?.click();
      
      expect(helpModal.isOpen()).toBe(false);
    });

    it('should close modal when OK button is clicked', () => {
      helpModal.show();
      
      const okBtn = document.getElementById('help-modal-ok');
      okBtn?.click();
      
      expect(helpModal.isOpen()).toBe(false);
    });

    it('should close modal when clicking outside', () => {
      helpModal.show();
      
      const modal = document.getElementById('help-modal');
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: modal, enumerable: true });
      modal?.dispatchEvent(clickEvent);
      
      expect(helpModal.isOpen()).toBe(false);
    });

    it('should not close modal when clicking inside content', () => {
      helpModal.show();
      
      const modalContent = document.querySelector('.modal-content');
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: modalContent, enumerable: true });
      modalContent?.dispatchEvent(clickEvent);
      
      expect(helpModal.isOpen()).toBe(true);
    });

    it('should close modal on Escape key', () => {
      helpModal.show();
      
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      expect(helpModal.isOpen()).toBe(false);
    });

    it('should open modal on ? key (requirement 20.5)', () => {
      const questionEvent = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(questionEvent);
      
      expect(helpModal.isOpen()).toBe(true);
    });

    it('should not open modal on ? key when typing in input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const questionEvent = new KeyboardEvent('keydown', { key: '?' });
      Object.defineProperty(questionEvent, 'target', { value: input, enumerable: true });
      document.dispatchEvent(questionEvent);
      
      expect(helpModal.isOpen()).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should focus close button when modal opens', () => {
      helpModal.show();
      
      const closeBtn = document.getElementById('help-modal-close') as HTMLElement;
      expect(document.activeElement).toBe(closeBtn);
    });

    it('should have aria-label on close button', () => {
      const closeBtn = document.getElementById('help-modal-close');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close help');
    });
  });

  describe('Feature Descriptions', () => {
    it('should describe all control parameters (requirement 20.3)', () => {
      const modal = document.getElementById('help-modal');
      const content = modal?.textContent || '';
      
      // Terrain parameters
      expect(content).toContain('Base Scale');
      expect(content).toContain('Octaves');
      expect(content).toContain('Persistence');
      expect(content).toContain('Lacunarity');
      expect(content).toContain('Warp Strength');
      expect(content).toContain('Height Multiplier');
      
      // Biome parameters
      expect(content).toContain('Temperature');
      expect(content).toContain('Moisture');
      expect(content).toContain('Blend Radius');
      
      // River parameters
      expect(content).toContain('Source Elevation');
      expect(content).toContain('Flow Length');
    });

    it('should provide example values for parameters (requirement 20.4)', () => {
      const modal = document.getElementById('help-modal');
      const content = modal?.textContent || '';
      
      // Check for range examples
      expect(content).toContain('0.001-0.1'); // Base Scale range
      expect(content).toContain('1-8'); // Octaves range
      expect(content).toContain('0.1-0.9'); // Persistence range
    });

    it('should describe hover states for features (requirement 20.6)', () => {
      const modal = document.getElementById('help-modal');
      const content = modal?.textContent || '';
      
      expect(content).toContain('Hover');
      expect(content).toContain('tooltip');
    });
  });
});
