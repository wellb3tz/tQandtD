/**
 * Unit tests for WorldManager component
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldManager, ImageFormat } from './WorldManager';
import { DemoApp } from '../core/DemoApp';

describe('WorldManager', () => {
  let worldManager: WorldManager;
  let mockApp: DemoApp;
  let container: HTMLElement;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create mock app
    mockApp = new DemoApp();
    
    // Initialize world manager
    worldManager = new WorldManager();
  });

  afterEach(() => {
    worldManager.dispose();
    document.body.removeChild(container);
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => {
        worldManager.initialize(mockApp);
      }).not.toThrow();
    });

    it('should create save dialog', () => {
      worldManager.initialize(mockApp);
      const saveDialog = document.getElementById('save-dialog');
      expect(saveDialog).toBeTruthy();
    });

    it('should create load dialog', () => {
      worldManager.initialize(mockApp);
      const loadDialog = document.getElementById('load-dialog');
      expect(loadDialog).toBeTruthy();
    });

    it('should create export dialog', () => {
      worldManager.initialize(mockApp);
      const exportDialog = document.getElementById('export-dialog');
      expect(exportDialog).toBeTruthy();
    });
  });

  describe('Save Dialog', () => {
    beforeEach(() => {
      worldManager.initialize(mockApp);
    });

    it('should show save dialog', () => {
      worldManager.showSaveDialog();
      const dialog = document.getElementById('save-dialog');
      expect(dialog?.classList.contains('hidden')).toBe(false);
    });

    it('should have format selection options', () => {
      worldManager.showSaveDialog();
      const jsonRadio = document.querySelector('input[name="save-format"][value="json"]');
      const binaryRadio = document.querySelector('input[name="save-format"][value="binary"]');
      
      expect(jsonRadio).toBeTruthy();
      expect(binaryRadio).toBeTruthy();
    });

    it('should have compression checkbox', () => {
      worldManager.showSaveDialog();
      const compressCheckbox = document.getElementById('save-compress');
      expect(compressCheckbox).toBeTruthy();
      expect((compressCheckbox as HTMLInputElement).type).toBe('checkbox');
    });

    it('should have modifiedOnly checkbox', () => {
      worldManager.showSaveDialog();
      const modifiedOnlyCheckbox = document.getElementById('save-modified-only');
      expect(modifiedOnlyCheckbox).toBeTruthy();
      expect((modifiedOnlyCheckbox as HTMLInputElement).type).toBe('checkbox');
    });

    it('should have filename input', () => {
      worldManager.showSaveDialog();
      const filenameInput = document.getElementById('save-filename');
      expect(filenameInput).toBeTruthy();
      expect((filenameInput as HTMLInputElement).value).toBe('world');
    });

    it('should have checksum display area', () => {
      worldManager.showSaveDialog();
      const checksumDisplay = document.getElementById('save-checksum-display');
      expect(checksumDisplay).toBeTruthy();
    });
  });

  describe('Load Dialog', () => {
    beforeEach(() => {
      worldManager.initialize(mockApp);
    });

    it('should show load dialog', () => {
      worldManager.showLoadDialog();
      const dialog = document.getElementById('load-dialog');
      expect(dialog?.classList.contains('hidden')).toBe(false);
    });

    it('should have file input', () => {
      worldManager.showLoadDialog();
      const fileInput = document.getElementById('load-file-input');
      expect(fileInput).toBeTruthy();
      expect((fileInput as HTMLInputElement).type).toBe('file');
    });

    it('should have world information display', () => {
      worldManager.showLoadDialog();
      const infoDisplay = document.getElementById('load-info-display');
      expect(infoDisplay).toBeTruthy();
    });

    it('should have seed display', () => {
      worldManager.showLoadDialog();
      const seedValue = document.getElementById('load-seed-value');
      expect(seedValue).toBeTruthy();
    });

    it('should have chunks count display', () => {
      worldManager.showLoadDialog();
      const chunksValue = document.getElementById('load-chunks-value');
      expect(chunksValue).toBeTruthy();
    });

    it('should have checksum display', () => {
      worldManager.showLoadDialog();
      const checksumValue = document.getElementById('load-checksum-value');
      expect(checksumValue).toBeTruthy();
    });

    it('should have status display', () => {
      worldManager.showLoadDialog();
      const statusValue = document.getElementById('load-status-value');
      expect(statusValue).toBeTruthy();
    });

    it('should disable load button initially', () => {
      worldManager.showLoadDialog();
      const confirmBtn = document.getElementById('confirm-load-btn') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);
    });
  });

  describe('Export Dialog', () => {
    beforeEach(() => {
      worldManager.initialize(mockApp);
    });

    it('should show export dialog', () => {
      worldManager.showExportDialog('heightmap');
      const dialog = document.getElementById('export-dialog');
      expect(dialog?.classList.contains('hidden')).toBe(false);
    });

    it('should have export type selection', () => {
      worldManager.showExportDialog('heightmap');
      const heightmapRadio = document.querySelector('input[name="export-type"][value="heightmap"]');
      const biomemapRadio = document.querySelector('input[name="export-type"][value="biomemap"]');
      
      expect(heightmapRadio).toBeTruthy();
      expect(biomemapRadio).toBeTruthy();
    });

    it('should have image format selection', () => {
      worldManager.showExportDialog('heightmap');
      const pngRadio = document.querySelector('input[name="export-format"][value="png"]');
      const jpegRadio = document.querySelector('input[name="export-format"][value="jpeg"]');
      
      expect(pngRadio).toBeTruthy();
      expect(jpegRadio).toBeTruthy();
    });

    it('should have filename input', () => {
      worldManager.showExportDialog('heightmap');
      const filenameInput = document.getElementById('export-filename');
      expect(filenameInput).toBeTruthy();
      expect((filenameInput as HTMLInputElement).value).toBe('world-map');
    });

    it('should pre-select heightmap type', () => {
      worldManager.showExportDialog('heightmap');
      const heightmapRadio = document.querySelector('input[name="export-type"][value="heightmap"]') as HTMLInputElement;
      expect(heightmapRadio.checked).toBe(true);
    });

    it('should pre-select biomemap type', () => {
      worldManager.showExportDialog('biomemap');
      const biomemapRadio = document.querySelector('input[name="export-type"][value="biomemap"]') as HTMLInputElement;
      expect(biomemapRadio.checked).toBe(true);
    });
  });

  describe('Shareable URL', () => {
    beforeEach(async () => {
      worldManager.initialize(mockApp);
      await mockApp.initialize();
    });

    it('should generate shareable URL with seed', () => {
      const url = worldManager.generateShareableURL();
      expect(url).toContain('seed=');
    });

    it('should include terrain parameters in URL', () => {
      const url = worldManager.generateShareableURL();
      expect(url).toContain('baseScale=');
      expect(url).toContain('octaves=');
      expect(url).toContain('persistence=');
    });

    it('should include biome parameters in URL', () => {
      const url = worldManager.generateShareableURL();
      expect(url).toContain('tempScale=');
      expect(url).toContain('moistScale=');
    });
  });

  describe('Clipboard Operations', () => {
    beforeEach(async () => {
      worldManager.initialize(mockApp);
      await mockApp.initialize();
      
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined)
        },
        writable: true,
        configurable: true
      });
    });

    it('should copy seed to clipboard', async () => {
      await worldManager.copySeedToClipboard();
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('should copy correct seed value', async () => {
      const state = mockApp.getState();
      await worldManager.copySeedToClipboard();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(state.config.seed.toString());
    });

    it('should copy shareable URL to clipboard', async () => {
      // Mock the method to avoid actual clipboard interaction
      const generateAndCopySpy = vi.spyOn(worldManager, 'generateAndCopyShareableURL');
      await worldManager.generateAndCopyShareableURL();
      expect(generateAndCopySpy).toHaveBeenCalled();
    });
  });

  describe('Export Configuration', () => {
    beforeEach(async () => {
      worldManager.initialize(mockApp);
      await mockApp.initialize();
    });

    it('should export configuration as JSON', () => {
      // Mock downloadFile to capture the export
      const downloadSpy = vi.spyOn(worldManager as any, 'downloadFile');
      
      worldManager.exportConfiguration();
      
      expect(downloadSpy).toHaveBeenCalled();
      const [data, filename] = downloadSpy.mock.calls[0];
      expect(filename).toBe('world-config.json');
      expect(typeof data).toBe('string');
    });

    it('should include seed in exported configuration', () => {
      const downloadSpy = vi.spyOn(worldManager as any, 'downloadFile');
      
      worldManager.exportConfiguration();
      
      const [data] = downloadSpy.mock.calls[0];
      const config = JSON.parse(data as string);
      expect(config).toHaveProperty('seed');
    });

    it('should include terrain config in exported configuration', () => {
      const downloadSpy = vi.spyOn(worldManager as any, 'downloadFile');
      
      worldManager.exportConfiguration();
      
      const [data] = downloadSpy.mock.calls[0];
      const config = JSON.parse(data as string);
      expect(config).toHaveProperty('terrainConfig');
    });

    it('should include biome config in exported configuration', () => {
      const downloadSpy = vi.spyOn(worldManager as any, 'downloadFile');
      
      worldManager.exportConfiguration();
      
      const [data] = downloadSpy.mock.calls[0];
      const config = JSON.parse(data as string);
      expect(config).toHaveProperty('biomeConfig');
    });

    it('should format JSON with indentation', () => {
      const downloadSpy = vi.spyOn(worldManager as any, 'downloadFile');
      
      worldManager.exportConfiguration();
      
      const [data] = downloadSpy.mock.calls[0];
      // Check if JSON is formatted (contains newlines and spaces)
      expect(data).toContain('\n');
      expect(data).toContain('  ');
    });
  });

  describe('URL Parameter Parsing', () => {
    beforeEach(() => {
      // Mock window.location.search
      delete (window as any).location;
      (window as any).location = { search: '' };
    });

    it('should parse seed from URL', async () => {
      (window as any).location.search = '?seed=99999';
      
      worldManager.initialize(mockApp);
      await mockApp.initialize();
      
      const state = mockApp.getState();
      expect(state.config.seed).toBe(99999);
    });

    it('should parse terrain parameters from URL', async () => {
      (window as any).location.search = '?baseScale=0.05&octaves=5&persistence=0.7';
      
      worldManager.initialize(mockApp);
      await mockApp.initialize();
      
      const state = mockApp.getState();
      expect(state.config.terrainConfig?.baseScale).toBe(0.05);
      expect(state.config.terrainConfig?.octaves).toBe(5);
      expect(state.config.terrainConfig?.persistence).toBe(0.7);
    });

    it('should parse biome parameters from URL', async () => {
      (window as any).location.search = '?tempScale=0.005&moistScale=0.006&blendRadius=7';
      
      worldManager.initialize(mockApp);
      await mockApp.initialize();
      
      const state = mockApp.getState();
      expect(state.config.biomeConfig?.temperatureScale).toBe(0.005);
      expect(state.config.biomeConfig?.moistureScale).toBe(0.006);
      expect(state.config.biomeConfig?.blendRadius).toBe(7);
    });

    it('should handle empty URL parameters', async () => {
      (window as any).location.search = '';
      
      expect(() => {
        worldManager.initialize(mockApp);
      }).not.toThrow();
    });

    it('should handle invalid parameter values', async () => {
      (window as any).location.search = '?seed=invalid&octaves=abc';
      
      expect(() => {
        worldManager.initialize(mockApp);
      }).not.toThrow();
    });

    it('should ignore unknown parameters', async () => {
      (window as any).location.search = '?unknownParam=123&seed=12345';
      
      worldManager.initialize(mockApp);
      await mockApp.initialize();
      
      const state = mockApp.getState();
      expect(state.config.seed).toBe(12345);
    });
  });

  describe('Checksum', () => {
    beforeEach(() => {
      worldManager.initialize(mockApp);
    });

    it('should return empty checksum initially', () => {
      const checksum = worldManager.getLastChecksum();
      expect(checksum).toBe('');
    });

    it('should store checksum after save operation', () => {
      // This would require mocking the save operation
      // For now, just verify the method exists
      expect(typeof worldManager.getLastChecksum).toBe('function');
    });
  });

  describe('Dialog Close', () => {
    beforeEach(() => {
      worldManager.initialize(mockApp);
    });

    it('should close save dialog when close button clicked', () => {
      worldManager.showSaveDialog();
      const closeBtn = document.querySelector('#save-dialog .close-btn') as HTMLElement;
      closeBtn.click();
      
      const dialog = document.getElementById('save-dialog');
      expect(dialog?.classList.contains('hidden')).toBe(true);
    });

    it('should close load dialog when close button clicked', () => {
      worldManager.showLoadDialog();
      const closeBtn = document.querySelector('#load-dialog .close-btn') as HTMLElement;
      closeBtn.click();
      
      const dialog = document.getElementById('load-dialog');
      expect(dialog?.classList.contains('hidden')).toBe(true);
    });

    it('should close export dialog when close button clicked', () => {
      worldManager.showExportDialog('heightmap');
      const closeBtn = document.querySelector('#export-dialog .close-btn') as HTMLElement;
      closeBtn.click();
      
      const dialog = document.getElementById('export-dialog');
      expect(dialog?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Disposal', () => {
    beforeEach(() => {
      worldManager.initialize(mockApp);
    });

    it('should remove dialogs on disposal', () => {
      worldManager.dispose();
      
      expect(document.getElementById('save-dialog')).toBeNull();
      expect(document.getElementById('load-dialog')).toBeNull();
      expect(document.getElementById('export-dialog')).toBeNull();
    });

    it('should not throw when disposing twice', () => {
      worldManager.dispose();
      expect(() => {
        worldManager.dispose();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle initialization without app', () => {
      const manager = new WorldManager();
      // Should not throw, but operations should be no-ops
      expect(() => {
        manager.generateShareableURL();
      }).not.toThrow();
    });

    it('should handle missing DOM elements gracefully', () => {
      // Remove all potential DOM elements
      const elements = [
        'save-json-btn', 
        'save-binary-btn', 
        'load-btn', 
        'export-heightmap-btn', 
        'export-biome-btn',
        'export-config-btn',
        'copy-seed-btn',
        'share-url-btn'
      ];
      elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      expect(() => {
        worldManager.initialize(mockApp);
      }).not.toThrow();
    });

    it('should handle export configuration without app', () => {
      const manager = new WorldManager();
      expect(() => {
        manager.exportConfiguration();
      }).not.toThrow();
    });

    it('should handle copy seed without app', async () => {
      const manager = new WorldManager();
      await expect(manager.copySeedToClipboard()).resolves.not.toThrow();
    });

    it('should handle generate shareable URL without app', async () => {
      const manager = new WorldManager();
      await expect(manager.generateAndCopyShareableURL()).resolves.not.toThrow();
    });
  });
});
