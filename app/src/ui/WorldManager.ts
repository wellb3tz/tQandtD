/**
 * WorldManager - UI component for world serialization and export
 * 
 * Handles world save/load operations with format selection (JSON/Binary),
 * compression options, and export functionality for heightmaps and biome maps.
 * Displays world checksums and validates data integrity.
 */

import { WorldApp } from '@core/WorldApp';
import { WorldSerializer, SerializationFormat, type SerializationOptions, type WorldConfig } from '@engine/index';
import { errorHandler } from '../utils/ErrorHandler';
import { getBiomeRgb255 } from './biomeDisplay';
import {
  createExportDialogElement,
  createLoadDialogElement,
  createSaveDialogElement,
} from './world-manager/worldManagerDialogs';

/**
 * Export format for images
 */
export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg'
}

/**
 * WorldManager - Manages world persistence and export operations
 */
export class WorldManager {
  private app: WorldApp | null = null;
  private serializer: WorldSerializer;
  private saveDialog: HTMLElement | null = null;
  private loadDialog: HTMLElement | null = null;
  private exportDialog: HTMLElement | null = null;
  private lastChecksum: string = '';

  constructor() {
    this.serializer = new WorldSerializer();
  }

  /**
   * Initialize the world manager
   */
  initialize(app: WorldApp): void {
    this.app = app;
    
    this.createSaveDialog();
    this.createLoadDialog();
    this.createExportDialog();
    
    this.setupEventListeners();
    
    this.parseURLConfiguration();
    
  }

  /**
   * Create save dialog UI
   */
  private createSaveDialog(): void {
    const dialog = createSaveDialogElement();
    document.body.appendChild(dialog);
    this.saveDialog = dialog;
  }

  /**
   * Create load dialog UI
   */
  private createLoadDialog(): void {
    const dialog = createLoadDialogElement();
    document.body.appendChild(dialog);
    this.loadDialog = dialog;
  }

  /**
   * Create export dialog UI
   */
  private createExportDialog(): void {
    const dialog = createExportDialogElement();
    document.body.appendChild(dialog);
    this.exportDialog = dialog;
  }

  /**
   * Set up event listeners for buttons and dialogs
   */
  private setupEventListeners(): void {
    const saveJsonBtn = document.getElementById('save-json-btn');
    if (saveJsonBtn) {
      saveJsonBtn.addEventListener('click', () => {
        this.showSaveDialog(SerializationFormat.JSON);
      });
    }

    const saveBinaryBtn = document.getElementById('save-binary-btn');
    if (saveBinaryBtn) {
      saveBinaryBtn.addEventListener('click', () => {
        this.showSaveDialog(SerializationFormat.BINARY);
      });
    }

    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        this.showLoadDialog();
      });
    }

    const exportHeightmapBtn = document.getElementById('export-heightmap-btn');
    if (exportHeightmapBtn) {
      exportHeightmapBtn.addEventListener('click', () => {
        this.showExportDialog('heightmap');
      });
    }

    const exportBiomeBtn = document.getElementById('export-biome-btn');
    if (exportBiomeBtn) {
      exportBiomeBtn.addEventListener('click', () => {
        this.showExportDialog('biomemap');
      });
    }

    const exportConfigBtn = document.getElementById('export-config-btn');
    if (exportConfigBtn) {
      exportConfigBtn.addEventListener('click', () => {
        this.exportConfiguration();
      });
    }

    const copySeedBtn = document.getElementById('copy-seed-btn');
    if (copySeedBtn) {
      copySeedBtn.addEventListener('click', () => {
        this.copySeedToClipboard();
      });
    }

    const shareUrlBtn = document.getElementById('share-url-btn');
    if (shareUrlBtn) {
      shareUrlBtn.addEventListener('click', () => {
        this.generateAndCopyShareableURL();
      });
    }

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('data-close')) {
        const dialogId = target.getAttribute('data-close');
        this.closeDialog(dialogId!);
      }
    });

    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', () => {
        this.handleSave();
      });
    }

    const confirmLoadBtn = document.getElementById('confirm-load-btn');
    if (confirmLoadBtn) {
      confirmLoadBtn.addEventListener('click', () => {
        this.handleLoad();
      });
    }

    const confirmExportBtn = document.getElementById('confirm-export-btn');
    if (confirmExportBtn) {
      confirmExportBtn.addEventListener('click', () => {
        this.handleExport();
      });
    }

    const loadFileInput = document.getElementById('load-file-input') as HTMLInputElement;
    if (loadFileInput) {
      loadFileInput.addEventListener('change', () => {
        this.handleFileSelect();
      });
    }
  }

  /**
   * Show save dialog with pre-selected format
   */
  showSaveDialog(format?: SerializationFormat): void {
    if (!this.saveDialog) return;

    if (format) {
      const formatRadio = this.saveDialog.querySelector(
        `input[name="save-format"][value="${format}"]`
      ) as HTMLInputElement;
      if (formatRadio) {
        formatRadio.checked = true;
      }
    }

    this.saveDialog.classList.remove('hidden');
  }

  /**
   * Show load dialog
   */
  showLoadDialog(): void {
    if (!this.loadDialog) return;

    const fileInput = document.getElementById('load-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    const infoDisplay = document.getElementById('load-info-display');
    if (infoDisplay) {
      infoDisplay.classList.add('hidden');
    }

    const confirmBtn = document.getElementById('confirm-load-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    this.loadDialog.classList.remove('hidden');
  }

  /**
   * Show export dialog with pre-selected type
   */
  showExportDialog(type: 'heightmap' | 'biomemap'): void {
    if (!this.exportDialog) return;

    const typeRadio = this.exportDialog.querySelector(
      `input[name="export-type"][value="${type}"]`
    ) as HTMLInputElement;
    if (typeRadio) {
      typeRadio.checked = true;
    }

    this.exportDialog.classList.remove('hidden');
  }

  /**
   * Close dialog by ID
   */
  private closeDialog(dialogId: string): void {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
      dialog.classList.add('hidden');
    }
  }

  /**
   * Handle save operation
   */
  private async handleSave(): Promise<void> {
    if (!this.app || !this.saveDialog) return;

    try {
      const formatRadio = this.saveDialog.querySelector(
        'input[name="save-format"]:checked'
      ) as HTMLInputElement;
      const format = formatRadio.value as SerializationFormat;

      const compressCheckbox = document.getElementById('save-compress') as HTMLInputElement;
      const compress = compressCheckbox.checked;

      const filenameInput = document.getElementById('save-filename') as HTMLInputElement;
      const filename = filenameInput.value || 'world';

      const options: SerializationOptions = {
        format,
        compress
      };

      const { data: exportData, checksum } = this.app.exportWorld(options);
      this.lastChecksum = checksum;

      const checksumDisplay = document.getElementById('save-checksum-display');
      const checksumValue = document.getElementById('save-checksum-value');
      if (checksumDisplay && checksumValue) {
        checksumValue.textContent = this.lastChecksum;
        checksumDisplay.classList.remove('hidden');
      }

      const extension = format === SerializationFormat.JSON ? 'json' : 'bin';
      this.downloadFile(exportData, `${filename}.${extension}`);

      this.showToast('World saved successfully!', 'success');

      setTimeout(() => {
        this.closeDialog('save-dialog');
      }, 1500);

    } catch (error) {
      console.error('Failed to save world:', error);
      this.showToast('Failed to save world: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Handle file selection for loading
   */
  private async handleFileSelect(): Promise<void> {
    const fileInput = document.getElementById('load-file-input') as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return;
    }

    const file = fileInput.files[0];

    try {
      const format = file.name.endsWith('.json') 
        ? SerializationFormat.JSON 
        : SerializationFormat.BINARY;

      const serializedWorld = await this.serializer.import(file, format);

      const seedValue = document.getElementById('load-seed-value');
      const chunksValue = document.getElementById('load-chunks-value');
      const checksumValue = document.getElementById('load-checksum-value');
      const statusValue = document.getElementById('load-status-value');

      if (seedValue) seedValue.textContent = serializedWorld.seed.toString();
      if (chunksValue) chunksValue.textContent = serializedWorld.chunks.length.toString();
      if (checksumValue) checksumValue.textContent = serializedWorld.checksum;
      if (statusValue) {
        statusValue.textContent = 'Valid';
        statusValue.style.color = 'var(--success-color, green)';
      }

      const infoDisplay = document.getElementById('load-info-display');
      if (infoDisplay) {
        infoDisplay.classList.remove('hidden');
      }

      const confirmBtn = document.getElementById('confirm-load-btn') as HTMLButtonElement;
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }

    } catch (error) {
      console.error('Failed to validate file:', error);
      
      const statusValue = document.getElementById('load-status-value');
      if (statusValue) {
        statusValue.textContent = 'Invalid';
        statusValue.style.color = 'var(--error-color, red)';
      }

      this.showToast('Invalid world file: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Handle load operation
   */
  private async handleLoad(): Promise<void> {
    if (!this.app) return;

    const fileInput = document.getElementById('load-file-input') as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return;
    }

    const file = fileInput.files[0];

    try {
      const format = file.name.endsWith('.json') 
        ? SerializationFormat.JSON 
        : SerializationFormat.BINARY;

      const serializedWorld = await this.serializer.import(file, format);

      this.app.loadSerializedWorld(serializedWorld);

      this.showToast('World loaded successfully!', 'success');

      this.closeDialog('load-dialog');

    } catch (error) {
      console.error('Failed to load world:', error);
      this.showToast('Failed to load world: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Handle export operation
   */
  private async handleExport(): Promise<void> {
    if (!this.app || !this.exportDialog) return;

    try {
      const typeRadio = this.exportDialog.querySelector(
        'input[name="export-type"]:checked'
      ) as HTMLInputElement;
      const exportType = typeRadio.value as 'heightmap' | 'biomemap';

      const formatRadio = this.exportDialog.querySelector(
        'input[name="export-format"]:checked'
      ) as HTMLInputElement;
      const imageFormat = formatRadio.value as ImageFormat;

      const filenameInput = document.getElementById('export-filename') as HTMLInputElement;
      const filename = filenameInput.value || 'world-map';

      const loadedChunks = this.app.getLoadedChunksSnapshot();
      if (loadedChunks.size === 0) {
        throw new Error('No chunks loaded to export');
      }
      const chunkSize = this.app.getConfigSnapshot().chunkSize;

      let blob: Blob;
      if (exportType === 'heightmap') {
        blob = await this.exportHeightmap(loadedChunks, imageFormat, chunkSize);
      } else {
        blob = await this.exportBiomeMap(loadedChunks, imageFormat, chunkSize);
      }

      const extension = imageFormat === ImageFormat.PNG ? 'png' : 'jpg';
      this.downloadFile(blob, `${filename}.${extension}`);

      this.showToast(`${exportType === 'heightmap' ? 'Heightmap' : 'Biome map'} exported successfully!`, 'success');

      this.closeDialog('export-dialog');

    } catch (error) {
      console.error('Failed to export map:', error);
      this.showToast('Failed to export map: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Export heightmap as image
   */
  private async exportHeightmap(chunks: Map<string, any>, format: ImageFormat, chunkSize: number): Promise<Blob> {
    const bounds = this.calculateChunkBounds(chunks);
    
    const width = (bounds.maxX - bounds.minX + 1) * chunkSize;
    const height = (bounds.maxY - bounds.minY + 1) * chunkSize;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const imageData = ctx.createImageData(width, height);

    for (const [, chunk] of chunks) {
      const offsetX = (chunk.x - bounds.minX) * chunkSize;
      const offsetY = (chunk.y - bounds.minY) * chunkSize;

      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const chunkIndex = y * chunkSize + x;
          const height = chunk.heightmap[chunkIndex];
          
          const value = Math.floor(height * 255);
          
          const imgX = offsetX + x;
          const imgY = offsetY + y;
          const imgIndex = (imgY * width + imgX) * 4;
          
          imageData.data[imgIndex] = value;     // R
          imageData.data[imgIndex + 1] = value; // G
          imageData.data[imgIndex + 2] = value; // B
          imageData.data[imgIndex + 3] = 255;   // A
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, format === ImageFormat.PNG ? 'image/png' : 'image/jpeg');
    });
  }

  /**
   * Export biome map as image
   */
  private async exportBiomeMap(chunks: Map<string, any>, format: ImageFormat, chunkSize: number): Promise<Blob> {
    const bounds = this.calculateChunkBounds(chunks);
    
    const width = (bounds.maxX - bounds.minX + 1) * chunkSize;
    const height = (bounds.maxY - bounds.minY + 1) * chunkSize;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const imageData = ctx.createImageData(width, height);

    for (const [, chunk] of chunks) {
      const offsetX = (chunk.x - bounds.minX) * chunkSize;
      const offsetY = (chunk.y - bounds.minY) * chunkSize;

      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const chunkIndex = y * chunkSize + x;
          const biome = chunk.biomeMap[chunkIndex];
          
          const color = getBiomeRgb255(biome);
          
          const imgX = offsetX + x;
          const imgY = offsetY + y;
          const imgIndex = (imgY * width + imgX) * 4;
          
          imageData.data[imgIndex] = color[0];     // R
          imageData.data[imgIndex + 1] = color[1]; // G
          imageData.data[imgIndex + 2] = color[2]; // B
          imageData.data[imgIndex + 3] = 255;      // A
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, format === ImageFormat.PNG ? 'image/png' : 'image/jpeg');
    });
  }

  /**
   * Calculate bounds of loaded chunks
   */
  private calculateChunkBounds(chunks: Map<string, any>): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [, chunk] of chunks) {
      minX = Math.min(minX, chunk.x);
      minY = Math.min(minY, chunk.y);
      maxX = Math.max(maxX, chunk.x);
      maxY = Math.max(maxY, chunk.y);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Download file to user's browser
   */
  private downloadFile(data: Blob | string, filename: string): void {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Show toast notification
   */
  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    if (type === 'success') {
      errorHandler.showSuccessToast(message);
    } else if (type === 'error') {
      errorHandler.showErrorToast(message);
    } else {
      errorHandler.showInfoToast(message);
    }
  }

  /**
   * Parse URL configuration parameters and apply them
   */
  parseURLConfiguration(): void {
    if (!this.app) return;

    try {
      const params = new URLSearchParams(window.location.search);
      
      if (params.toString().length === 0) {
        return;
      }

      const config = this.app.getConfigSnapshot();

      if (params.has('config')) {
        const sharedConfig = JSON.parse(params.get('config')!) as Partial<WorldConfig>;
        this.app.applyWorldConfig({
          ...config,
          ...sharedConfig,
        });
        this.showToast('Configuration loaded from URL', 'info');
        return;
      }

      if (params.has('seed')) {
        const seed = parseInt(params.get('seed')!);
        if (!isNaN(seed)) {
          config.seed = seed;
        }
      }

      if (config.terrainConfig) {
        if (params.has('baseScale')) {
          const value = parseFloat(params.get('baseScale')!);
          if (!isNaN(value)) config.terrainConfig.baseScale = value;
        }
        if (params.has('octaves')) {
          const value = parseInt(params.get('octaves')!);
          if (!isNaN(value)) config.terrainConfig.octaves = value;
        }
        if (params.has('persistence')) {
          const value = parseFloat(params.get('persistence')!);
          if (!isNaN(value)) config.terrainConfig.persistence = value;
        }
        if (params.has('lacunarity')) {
          const value = parseFloat(params.get('lacunarity')!);
          if (!isNaN(value)) config.terrainConfig.lacunarity = value;
        }
        if (params.has('warpStrength')) {
          const value = parseFloat(params.get('warpStrength')!);
          if (!isNaN(value)) config.terrainConfig.warpStrength = value;
        }
        if (params.has('heightMultiplier')) {
          const value = parseFloat(params.get('heightMultiplier')!);
          if (!isNaN(value)) config.terrainConfig.heightMultiplier = value;
        }
        if (params.has('cliffStrength')) {
          const value = parseFloat(params.get('cliffStrength')!);
          if (!isNaN(value)) config.terrainConfig.cliffStrength = value;
        }
        if (params.has('canyonStrength')) {
          const value = parseFloat(params.get('canyonStrength')!);
          if (!isNaN(value)) config.terrainConfig.canyonStrength = value;
        }
      }

      if (config.biomeConfig) {
        if (params.has('tempScale')) {
          const value = parseFloat(params.get('tempScale')!);
          if (!isNaN(value)) config.biomeConfig.temperatureScale = value;
        }
        if (params.has('moistScale')) {
          const value = parseFloat(params.get('moistScale')!);
          if (!isNaN(value)) config.biomeConfig.moistureScale = value;
        }
        if (params.has('blendRadius')) {
          const value = parseInt(params.get('blendRadius')!);
          if (!isNaN(value)) config.biomeConfig.blendRadius = value;
        }
      }

      if (config.enhancedBiomeConfig) {
        if (params.has('worldTemperatureOffset')) {
          const value = parseFloat(params.get('worldTemperatureOffset')!);
          if (!isNaN(value)) config.enhancedBiomeConfig.worldTemperatureOffset = value;
        }
        if (params.has('worldMoistureOffset')) {
          const value = parseFloat(params.get('worldMoistureOffset')!);
          if (!isNaN(value)) config.enhancedBiomeConfig.worldMoistureOffset = value;
        }
      }

      this.app.applyWorldConfig(config);

      this.showToast('Configuration loaded from URL', 'info');

    } catch (error) {
      console.error('Failed to parse URL configuration:', error);
    }
  }

  /**
   * Export world configuration as JSON
   */
  exportConfiguration(): void {
    if (!this.app) return;

    try {
      const config = this.app.getConfigSnapshot();

      const jsonString = JSON.stringify(this.createShareableConfig(config), null, 2);

      this.downloadFile(jsonString, 'world-config.json');

      this.showToast('Configuration exported successfully!', 'success');

    } catch (error) {
      console.error('Failed to export configuration:', error);
      this.showToast('Failed to export configuration: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Generate shareable URL and copy to clipboard
   */
  async generateAndCopyShareableURL(): Promise<void> {
    try {
      const url = this.generateShareableURL();
      
      await navigator.clipboard.writeText(url);
      
      this.showToast('Shareable URL copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to generate shareable URL:', error);
      this.showToast('Failed to copy URL: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Generate shareable URL with current configuration
   */
  generateShareableURL(): string {
    if (!this.app) return '';

    const config = this.app.getConfigSnapshot();

    const params = new URLSearchParams();
    params.set('seed', config.seed.toString());
    params.set('config', JSON.stringify(this.createShareableConfig(config)));
    
    if (config.terrainConfig) {
      params.set('baseScale', config.terrainConfig.baseScale.toString());
      params.set('octaves', config.terrainConfig.octaves.toString());
      params.set('persistence', config.terrainConfig.persistence.toString());
      params.set('lacunarity', config.terrainConfig.lacunarity.toString());
      params.set('warpStrength', config.terrainConfig.warpStrength.toString());
      params.set('heightMultiplier', config.terrainConfig.heightMultiplier.toString());
      params.set('cliffStrength', (config.terrainConfig.cliffStrength ?? 0.42).toString());
      params.set('canyonStrength', (config.terrainConfig.canyonStrength ?? 0.55).toString());
    }

    if (config.biomeConfig) {
      params.set('tempScale', config.biomeConfig.temperatureScale.toString());
      params.set('moistScale', config.biomeConfig.moistureScale.toString());
      params.set('blendRadius', config.biomeConfig.blendRadius.toString());
    }

    if (config.enhancedBiomeConfig) {
      params.set('worldTemperatureOffset', config.enhancedBiomeConfig.worldTemperatureOffset?.toString() ?? '0');
      params.set('worldMoistureOffset', config.enhancedBiomeConfig.worldMoistureOffset?.toString() ?? '0');
    }

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  private createShareableConfig(config: WorldConfig): Partial<WorldConfig> {
    return {
      seed: config.seed,
      chunkSize: config.chunkSize,
      terrainConfig: config.terrainConfig,
      biomeConfig: config.biomeConfig,
      enhancedBiomeConfig: config.enhancedBiomeConfig,
      lakeConfig: config.lakeConfig,
      riverConfig: config.riverConfig,
      noise3DConfig: config.noise3DConfig,
      resourceConfig: config.resourceConfig,
      structureConfig: config.structureConfig,
      workerPoolConfig: config.workerPoolConfig,
      maxCacheSize: config.maxCacheSize,
      enablePerformanceMetrics: config.enablePerformanceMetrics,
      errorRecovery: config.errorRecovery,
    };
  }

  /**
   * Copy seed to clipboard
   */
  async copySeedToClipboard(): Promise<void> {
    if (!this.app) return;

    const seed = this.app.getSeed().toString();

    try {
      await navigator.clipboard.writeText(seed);
      this.showToast('Seed copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy seed:', error);
      this.showToast('Failed to copy seed', 'error');
    }
  }

  /**
   * Get last calculated checksum
   */
  getLastChecksum(): string {
    return this.lastChecksum;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.saveDialog) {
      document.body.removeChild(this.saveDialog);
      this.saveDialog = null;
    }
    if (this.loadDialog) {
      document.body.removeChild(this.loadDialog);
      this.loadDialog = null;
    }
    if (this.exportDialog) {
      document.body.removeChild(this.exportDialog);
      this.exportDialog = null;
    }

    this.app = null;
  }
}
