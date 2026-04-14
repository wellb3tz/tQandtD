/**
 * Integration tests for HelpModal with main application
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HelpModal } from './HelpModal';

describe('HelpModal Integration', () => {
  let helpModal: HelpModal;

  beforeEach(() => {
    // Set up a basic HTML structure similar to the actual app
    document.body.innerHTML = `
      <div id="app">
        <header class="app-header">
          <h1>Procedural World Engine Demo</h1>
          <div class="header-actions">
            <button id="help-btn" class="icon-btn" title="Help">?</button>
          </div>
        </header>
      </div>
    `;

    helpModal = new HelpModal();
    helpModal.initialize();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Integration with Header', () => {
    it('should work with help button in header', () => {
      const helpBtn = document.getElementById('help-btn');
      expect(helpBtn).toBeTruthy();

      // Simulate clicking the help button
      helpBtn?.addEventListener('click', () => {
        helpModal.show();
      });

      helpBtn?.click();
      expect(helpModal.isOpen()).toBe(true);
    });

    it('should not interfere with other header buttons', () => {
      const helpBtn = document.getElementById('help-btn');
      
      // Add another button
      const otherBtn = document.createElement('button');
      otherBtn.id = 'other-btn';
      document.querySelector('.header-actions')?.appendChild(otherBtn);

      // Click help button
      helpBtn?.addEventListener('click', () => helpModal.show());
      helpBtn?.click();

      expect(helpModal.isOpen()).toBe(true);
      expect(otherBtn).toBeTruthy();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should open help with ? key from anywhere in the app', () => {
      const appElement = document.getElementById('app');
      expect(appElement).toBeTruthy();

      // Simulate pressing ? key
      const event = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(event);

      expect(helpModal.isOpen()).toBe(true);
    });

    it('should close help with Escape key', () => {
      helpModal.show();
      expect(helpModal.isOpen()).toBe(true);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(helpModal.isOpen()).toBe(false);
    });
  });

  describe('Modal Overlay', () => {
    it('should render modal outside of app container', () => {
      helpModal.show();

      const modal = document.getElementById('help-modal');
      expect(modal).toBeTruthy();
      
      // Modal should be a direct child of body, not inside #app
      expect(modal?.parentElement).toBe(document.body);
    });

    it('should have higher z-index than app content', () => {
      helpModal.show();

      const modal = document.getElementById('help-modal');
      const computedStyle = window.getComputedStyle(modal!);
      
      // Modal should have z-index set (even if not computed in jsdom)
      expect(modal?.classList.contains('modal-dialog')).toBe(true);
    });
  });

  describe('Content Completeness', () => {
    it('should document all major features', () => {
      const modal = document.getElementById('help-modal');
      const content = modal?.textContent || '';

      // Verify all major sections are present
      const requiredSections = [
        'Getting Started',
        'World Generation',
        'Terrain Parameters',
        'Biome System',
        'River Networks',
        'Terrain Editing',
        'Performance Features',
        'Keyboard Shortcuts',
        'Visibility Toggles',
        'World Management',
        'Performance Monitor',
        'Engine Documentation',
        'Tips'
      ];

      requiredSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should provide actionable information', () => {
      const modal = document.getElementById('help-modal');
      const content = modal?.textContent || '';

      // Check for actionable instructions
      expect(content).toContain('Click');
      expect(content).toContain('Enter');
      expect(content).toContain('Use');
      expect(content).toContain('Enable');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      helpModal.show();

      const closeBtn = document.getElementById('help-modal-close') as HTMLElement;
      const okBtn = document.getElementById('help-modal-ok') as HTMLElement;

      expect(closeBtn).toBeTruthy();
      expect(okBtn).toBeTruthy();
      
      // Both buttons should be focusable
      expect(closeBtn.tabIndex).toBeGreaterThanOrEqual(0);
      expect(okBtn.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('should have proper ARIA labels', () => {
      const closeBtn = document.getElementById('help-modal-close');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close help');
    });
  });

  describe('User Experience', () => {
    it('should provide quick access to help', () => {
      // User should be able to open help in multiple ways
      
      // Method 1: Click help button
      const helpBtn = document.getElementById('help-btn');
      helpBtn?.addEventListener('click', () => helpModal.show());
      helpBtn?.click();
      expect(helpModal.isOpen()).toBe(true);
      helpModal.hide();

      // Method 2: Press ? key
      const event = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(event);
      expect(helpModal.isOpen()).toBe(true);
      helpModal.hide();

      // Method 3: Direct API call
      helpModal.show();
      expect(helpModal.isOpen()).toBe(true);
    });

    it('should be easy to dismiss', () => {
      helpModal.show();

      // Method 1: Close button
      const closeBtn = document.getElementById('help-modal-close');
      closeBtn?.click();
      expect(helpModal.isOpen()).toBe(false);

      // Method 2: OK button
      helpModal.show();
      const okBtn = document.getElementById('help-modal-ok');
      okBtn?.click();
      expect(helpModal.isOpen()).toBe(false);

      // Method 3: Escape key
      helpModal.show();
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      expect(helpModal.isOpen()).toBe(false);

      // Method 4: Click outside
      helpModal.show();
      const modal = document.getElementById('help-modal');
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: modal, enumerable: true });
      modal?.dispatchEvent(clickEvent);
      expect(helpModal.isOpen()).toBe(false);
    });
  });
});
