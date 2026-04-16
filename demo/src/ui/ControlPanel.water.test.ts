/**
 * Unit tests for water controls in ControlPanel
 * 
 * Tests water configuration controls including visibility toggle,
 * color pickers, and opacity/shininess sliders.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { DemoApp } from '../core/DemoApp';

describe('ControlPanel Water Controls', () => {
  let controlPanel: ControlPanel;
  let mockApp: DemoApp;
  let container: HTMLElement;
  let waterControlsContainer: HTMLElement;

  beforeEach(() => {
    // Create DOM structure
    document.body.innerHTML = `
      <div id="control-panel">
        <div id="preset-controls"></div>
        <div id="terrain-controls"></div>
        <div id="biome-controls"></div>
        <div id="river-controls"></div>
        <div id="resource-controls"></div>
        <div id="water-controls"></div>
        <div id="advanced-controls"></div>
        <div id="terrain-editing-controls"></div>
        <div id="visibility-controls"></div>
      </div>
    `;

    container = document.getElementById('control-panel')!;
    waterControlsContainer = document.getElementById('water-controls')!;

    mockApp = new DemoApp();
    controlPanel = new ControlPanel();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Control Initialization', () => {
    it('should create water visibility toggle', () => {
      controlPanel.initialize(container, mockApp);

      const enableWaterCheckbox = document.getElementById('enableWater') as HTMLInputElement;
      expect(enableWaterCheckbox).toBeDefined();
      expect(enableWaterCheckbox?.type).toBe('checkbox');
      expect(enableWaterCheckbox?.checked).toBe(true); // Default enabled
    });

    it('should create ocean color picker', () => {
      controlPanel.initialize(container, mockApp);

      const oceanColorInput = document.getElementById('oceanColor') as HTMLInputElement;
      expect(oceanColorInput).toBeDefined();
      expect(oceanColorInput?.type).toBe('color');
      expect(oceanColorInput?.value).toBe('#1e90ff'); // Default dodger blue
    });

    it('should create ocean opacity slider', () => {
      controlPanel.initialize(container, mockApp);

      const oceanOpacitySlider = document.getElementById('oceanOpacity') as HTMLInputElement;
      expect(oceanOpacitySlider).toBeDefined();
      expect(oceanOpacitySlider?.type).toBe('range');
      expect(parseFloat(oceanOpacitySlider?.value || '0')).toBe(0.7); // Default opacity
      expect(parseFloat(oceanOpacitySlider?.min || '0')).toBe(0);
      expect(parseFloat(oceanOpacitySlider?.max || '0')).toBe(1);
    });

    it('should create ocean shininess slider', () => {
      controlPanel.initialize(container, mockApp);

      const oceanShininessSlider = document.getElementById('oceanShininess') as HTMLInputElement;
      expect(oceanShininessSlider).toBeDefined();
      expect(oceanShininessSlider?.type).toBe('range');
      expect(parseFloat(oceanShininessSlider?.value || '0')).toBe(30); // Default shininess
      expect(parseFloat(oceanShininessSlider?.min || '0')).toBe(0);
      expect(parseFloat(oceanShininessSlider?.max || '0')).toBe(100);
    });

    it('should create river color picker', () => {
      controlPanel.initialize(container, mockApp);

      const riverColorInput = document.getElementById('riverColor') as HTMLInputElement;
      expect(riverColorInput).toBeDefined();
      expect(riverColorInput?.type).toBe('color');
      expect(riverColorInput?.value).toBe('#4682b4'); // Default steel blue
    });

    it('should create river opacity slider', () => {
      controlPanel.initialize(container, mockApp);

      const riverOpacitySlider = document.getElementById('riverOpacity') as HTMLInputElement;
      expect(riverOpacitySlider).toBeDefined();
      expect(riverOpacitySlider?.type).toBe('range');
      expect(parseFloat(riverOpacitySlider?.value || '0')).toBe(0.6); // Default opacity
    });

    it('should create lake color picker', () => {
      controlPanel.initialize(container, mockApp);

      const lakeColorInput = document.getElementById('lakeColor') as HTMLInputElement;
      expect(lakeColorInput).toBeDefined();
      expect(lakeColorInput?.type).toBe('color');
      expect(lakeColorInput?.value).toBe('#1e90ff'); // Default dodger blue
    });

    it('should create lake opacity slider', () => {
      controlPanel.initialize(container, mockApp);

      const lakeOpacitySlider = document.getElementById('lakeOpacity') as HTMLInputElement;
      expect(lakeOpacitySlider).toBeDefined();
      expect(lakeOpacitySlider?.type).toBe('range');
      expect(parseFloat(lakeOpacitySlider?.value || '0')).toBe(0.65); // Default opacity
    });
  });

  describe('Configuration Updates', () => {
    it('should dispatch waterConfigChanged event when ocean color changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const oceanColorInput = document.getElementById('oceanColor') as HTMLInputElement;
      oceanColorInput.value = '#ff0000';
      oceanColorInput.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('ocean');
      expect(event.detail.property).toBe('color');
      expect(event.detail.value).toBe(0xff0000);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });

    it('should dispatch waterConfigChanged event when ocean opacity changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const oceanOpacitySlider = document.getElementById('oceanOpacity') as HTMLInputElement;
      oceanOpacitySlider.value = '0.5';
      oceanOpacitySlider.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('ocean');
      expect(event.detail.property).toBe('opacity');
      expect(event.detail.value).toBe(0.5);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });

    it('should dispatch waterConfigChanged event when ocean shininess changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const oceanShininessSlider = document.getElementById('oceanShininess') as HTMLInputElement;
      oceanShininessSlider.value = '50';
      oceanShininessSlider.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('ocean');
      expect(event.detail.property).toBe('shininess');
      expect(event.detail.value).toBe(50);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });

    it('should dispatch waterConfigChanged event when river color changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const riverColorInput = document.getElementById('riverColor') as HTMLInputElement;
      riverColorInput.value = '#00ff00';
      riverColorInput.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('river');
      expect(event.detail.property).toBe('color');
      expect(event.detail.value).toBe(0x00ff00);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });

    it('should dispatch waterConfigChanged event when river opacity changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const riverOpacitySlider = document.getElementById('riverOpacity') as HTMLInputElement;
      riverOpacitySlider.value = '0.8';
      riverOpacitySlider.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('river');
      expect(event.detail.property).toBe('opacity');
      expect(event.detail.value).toBe(0.8);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });

    it('should dispatch waterConfigChanged event when lake color changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const lakeColorInput = document.getElementById('lakeColor') as HTMLInputElement;
      lakeColorInput.value = '#0000ff';
      lakeColorInput.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('lake');
      expect(event.detail.property).toBe('color');
      expect(event.detail.value).toBe(0x0000ff);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });

    it('should dispatch waterConfigChanged event when lake opacity changes', () => {
      controlPanel.initialize(container, mockApp);

      const eventSpy = vi.fn();
      window.addEventListener('waterConfigChanged', eventSpy);

      const lakeOpacitySlider = document.getElementById('lakeOpacity') as HTMLInputElement;
      lakeOpacitySlider.value = '0.75';
      lakeOpacitySlider.dispatchEvent(new Event('input'));

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.waterType).toBe('lake');
      expect(event.detail.property).toBe('opacity');
      expect(event.detail.value).toBe(0.75);

      window.removeEventListener('waterConfigChanged', eventSpy);
    });
  });

  describe('Visibility Toggle', () => {
    it('should update app state when water visibility is toggled', () => {
      controlPanel.initialize(container, mockApp);

      const updateStateSpy = vi.spyOn(mockApp, 'updateState');

      const enableWaterCheckbox = document.getElementById('enableWater') as HTMLInputElement;
      enableWaterCheckbox.checked = false;
      enableWaterCheckbox.dispatchEvent(new Event('change'));

      expect(updateStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ showWater: false })
      );
    });

    it('should enable water layer when checkbox is checked', () => {
      controlPanel.initialize(container, mockApp);

      const updateStateSpy = vi.spyOn(mockApp, 'updateState');

      const enableWaterCheckbox = document.getElementById('enableWater') as HTMLInputElement;
      enableWaterCheckbox.checked = true;
      enableWaterCheckbox.dispatchEvent(new Event('change'));

      expect(updateStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ showWater: true })
      );
    });
  });

  describe('Control Sections', () => {
    it('should create ocean water section header', () => {
      controlPanel.initialize(container, mockApp);

      const headers = waterControlsContainer.querySelectorAll('h4');
      const oceanHeader = Array.from(headers).find(h => h.textContent === 'Ocean Water');
      expect(oceanHeader).toBeDefined();
    });

    it('should create river water section header', () => {
      controlPanel.initialize(container, mockApp);

      const headers = waterControlsContainer.querySelectorAll('h4');
      const riverHeader = Array.from(headers).find(h => h.textContent === 'River Water');
      expect(riverHeader).toBeDefined();
    });

    it('should create lake water section header', () => {
      controlPanel.initialize(container, mockApp);

      const headers = waterControlsContainer.querySelectorAll('h4');
      const lakeHeader = Array.from(headers).find(h => h.textContent === 'Lake Water');
      expect(lakeHeader).toBeDefined();
    });
  });
});
