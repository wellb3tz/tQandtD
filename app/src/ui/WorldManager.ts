/**
 * WorldManager - UI component for world serialization and export
 * 
 * Handles world save/load operations with format selection (JSON/Binary),
 * compression options, and export functionality for heightmaps and biome maps.
 * Displays world checksums and validates data integrity.
 */

import { WorldApp } from '@core/WorldApp';
import { WorldSerializer, SerializationFormat, SerializationOptions } from '@engine/world/serialization';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Save dialog options
 */
interface SaveDialogOptions {
  format: SerializationFormat;
  compress: boolean;
  modifiedOnly: boolean;
}

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
    
    // Create dialogs
    this.createSaveDialog();
    this.createLoadDialog();
    this.createExportDialog();
    
    // Set up event listeners for buttons
    this.setupEventListeners();
    
    // Parse URL parameters on page load
    this.parseURLConfiguration();
    
    console.log('WorldManager initialized');
  }

  /**
   * Create save dialog UI
   */
  private createSaveDialog(): void {
    const dialog = document.createElement('div');
    dialog.id = 'save-dialog';
    dialog.className = 'modal-dialog hidden';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Save World</h3>
          <button class="close-btn" data-close="save-dialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Format:</label>
            <div class="radio-group">
              <label>
                <input type="radio" name="save-format" value="json" checked />
                JSON (Human-readable)
              </label>
              <label>
                <input type="radio" name="save-format" value="binary" />
                Binary (Compact)
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" id="save-compress" checked />
              Enable Compression
            </label>
            <p class="help-text">Reduces file size using deflate compression</p>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" id="save-modified-only" />
              Save Modified Chunks Only
            </label>
            <p class="help-text">Only save chunks that have been modified</p>
          </div>
          
          <div class="form-group">
            <label for="save-filename">Filename:</label>
            <input type="text" id="save-filename" value="world" />
          </div>
          
          <div id="save-checksum-display" class="checksum-display hidden">
            <strong>Checksum:</strong> <code id="save-checksum-value"></code>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-close="save-dialog">Cancel</button>
          <button class="primary-btn" id="confirm-save-btn">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.saveDialog = dialog;
  }

  /**
   * Create load dialog UI
   */
  private createLoadDialog(): void {
    const dialog = document.createElement('div');
    dialog.id = 'load-dialog';
    dialog.className = 'modal-dialog hidden';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Load World</h3>
          <button class="close-btn" data-close="load-dialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="load-file-input">Select World File:</label>
            <input type="file" id="load-file-input" accept=".json,.bin,.world" />
            <p class="help-text">Supports JSON and binary formats</p>
          </div>
          
          <div id="load-info-display" class="info-display hidden">
            <h4>World Information</h4>
            <div class="info-row">
              <span class="info-label">Seed:</span>
              <span id="load-seed-value" class="info-value">--</span>
            </div>
            <div class="info-row">
              <span class="info-label">Chunks:</span>
              <span id="load-chunks-value" class="info-value">--</span>
            </div>
            <div class="info-row">
              <span class="info-label">Checksum:</span>
              <code id="load-checksum-value" class="info-value">--</code>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span id="load-status-value" class="info-value">--</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-close="load-dialog">Cancel</button>
          <button class="primary-btn" id="confirm-load-btn" disabled>Load</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.loadDialog = dialog;
  }

  /**
   * Create export dialog UI
   */
  private createExportDialog(): void {
    const dialog = document.createElement('div');
    dialog.id = 'export-dialog';
    dialog.className = 'modal-dialog hidden';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Export Maps</h3>
          <button class="close-btn" data-close="export-dialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Export Type:</label>
            <div class="radio-group">
              <label>
                <input type="radio" name="export-type" value="heightmap" checked />
                Heightmap
              </label>
              <label>
                <input type="radio" name="export-type" value="biomemap" />
                Biome Map
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label>Image Format:</label>
            <div class="radio-group">
              <label>
                <input type="radio" name="export-format" value="png" checked />
                PNG
              </label>
              <label>
                <input type="radio" name="export-format" value="jpeg" />
                JPEG
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label for="export-filename">Filename:</label>
            <input type="text" id="export-filename" value="world-map" />
          </div>
          
          <p class="help-text">Exports all loaded chunks as a single image</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-close="export-dialog">Cancel</button>
          <button class="primary-btn" id="confirm-export-btn">Export</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.exportDialog = dialog;
  }

  /**
   * Set up event listeners for buttons and dialogs
   */
  private setupEventListeners(): void {
    // Save button
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

    // Load button
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        this.showLoadDialog();
      });
    }

    // Export buttons
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

    // Sharing buttons
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

    // Dialog close buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('data-close')) {
        const dialogId = target.getAttribute('data-close');
        this.closeDialog(dialogId!);
      }
    });

    // Confirm save button
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', () => {
        this.handleSave();
      });
    }

    // Confirm load button
    const confirmLoadBtn = document.getElementById('confirm-load-btn');
    if (confirmLoadBtn) {
      confirmLoadBtn.addEventListener('click', () => {
        this.handleLoad();
      });
    }

    // Confirm export button
    const confirmExportBtn = document.getElementById('confirm-export-btn');
    if (confirmExportBtn) {
      confirmExportBtn.addEventListener('click', () => {
        this.handleExport();
      });
    }

    // File input change
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

    // Set format if provided
    if (format) {
      const formatRadio = this.saveDialog.querySelector(
        `input[name="save-format"][value="${format}"]`
      ) as HTMLInputElement;
      if (formatRadio) {
        formatRadio.checked = true;
      }
    }

    // Show dialog
    this.saveDialog.classList.remove('hidden');
  }

  /**
   * Show load dialog
   */
  showLoadDialog(): void {
    if (!this.loadDialog) return;

    // Reset file input
    const fileInput = document.getElementById('load-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    // Hide info display
    const infoDisplay = document.getElementById('load-info-display');
    if (infoDisplay) {
      infoDisplay.classList.add('hidden');
    }

    // Disable load button
    const confirmBtn = document.getElementById('confirm-load-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    // Show dialog
    this.loadDialog.classList.remove('hidden');
  }

  /**
   * Show export dialog with pre-selected type
   */
  showExportDialog(type: 'heightmap' | 'biomemap'): void {
    if (!this.exportDialog) return;

    // Set export type
    const typeRadio = this.exportDialog.querySelector(
      `input[name="export-type"][value="${type}"]`
    ) as HTMLInputElement;
    if (typeRadio) {
      typeRadio.checked = true;
    }

    // Show dialog
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
      // Get save options from dialog
      const formatRadio = this.saveDialog.querySelector(
        'input[name="save-format"]:checked'
      ) as HTMLInputElement;
      const format = formatRadio.value as SerializationFormat;

      const compressCheckbox = document.getElementById('save-compress') as HTMLInputElement;
      const compress = compressCheckbox.checked;

      const modifiedOnlyCheckbox = document.getElementById('save-modified-only') as HTMLInputElement;
      const modifiedOnly = modifiedOnlyCheckbox.checked;

      const filenameInput = document.getElementById('save-filename') as HTMLInputElement;
      const filename = filenameInput.value || 'world';

      // Create serialization options
      const options: SerializationOptions = {
        format,
        compress,
        modifiedOnly
      };

      // Get chunk manager from app state
      const state = this.app.getState();
      if (!state.chunkManager) {
        throw new Error('No chunk manager available');
      }

      // Serialize world
      const exportData = this.serializer.export(state.chunkManager, options);

      // Calculate and display checksum
      const serializedWorld = this.serializer.serialize(state.chunkManager, options);
      this.lastChecksum = serializedWorld.checksum;

      const checksumDisplay = document.getElementById('save-checksum-display');
      const checksumValue = document.getElementById('save-checksum-value');
      if (checksumDisplay && checksumValue) {
        checksumValue.textContent = this.lastChecksum;
        checksumDisplay.classList.remove('hidden');
      }

      // Download file
      const extension = format === SerializationFormat.JSON ? 'json' : 'bin';
      this.downloadFile(exportData, `${filename}.${extension}`);

      // Show success toast
      this.showToast('World saved successfully!', 'success');

      // Close dialog after a short delay
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
      // Determine format from file extension
      const format = file.name.endsWith('.json') 
        ? SerializationFormat.JSON 
        : SerializationFormat.BINARY;

      // Import and validate file
      const serializedWorld = await this.serializer.import(file, format);

      // Display world information
      const seedValue = document.getElementById('load-seed-value');
      const chunksValue = document.getElementById('load-chunks-value');
      const checksumValue = document.getElementById('load-checksum-value');
      const statusValue = document.getElementById('load-status-value');

      if (seedValue) seedValue.textContent = serializedWorld.seed.toString();
      if (chunksValue) chunksValue.textContent = serializedWorld.chunks.length.toString();
      if (checksumValue) checksumValue.textContent = serializedWorld.checksum;
      if (statusValue) {
        statusValue.textContent = 'Valid ✓';
        statusValue.style.color = 'var(--success-color, green)';
      }

      // Show info display
      const infoDisplay = document.getElementById('load-info-display');
      if (infoDisplay) {
        infoDisplay.classList.remove('hidden');
      }

      // Enable load button
      const confirmBtn = document.getElementById('confirm-load-btn') as HTMLButtonElement;
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }

    } catch (error) {
      console.error('Failed to validate file:', error);
      
      // Show error status
      const statusValue = document.getElementById('load-status-value');
      if (statusValue) {
        statusValue.textContent = 'Invalid ✗';
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
      // Determine format from file extension
      const format = file.name.endsWith('.json') 
        ? SerializationFormat.JSON 
        : SerializationFormat.BINARY;

      // Import world data
      const serializedWorld = await this.serializer.import(file, format);

      // Get chunk manager from app state
      const state = this.app.getState();
      if (!state.chunkManager) {
        throw new Error('No chunk manager available');
      }

      // Deserialize and restore world
      this.serializer.deserialize(serializedWorld, state.chunkManager);

      // Update app state to trigger re-render
      this.app.updateState({
        loadedChunks: new Map(),
        config: serializedWorld.config
      });

      // Show success toast
      this.showToast('World loaded successfully!', 'success');

      // Close dialog
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
      // Get export options from dialog
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

      // Get loaded chunks from app state
      const state = this.app.getState();
      if (state.loadedChunks.size === 0) {
        throw new Error('No chunks loaded to export');
      }

      // Export map based on type
      let blob: Blob;
      if (exportType === 'heightmap') {
        blob = await this.exportHeightmap(state.loadedChunks, imageFormat);
      } else {
        blob = await this.exportBiomeMap(state.loadedChunks, imageFormat);
      }

      // Download file
      const extension = imageFormat === ImageFormat.PNG ? 'png' : 'jpg';
      this.downloadFile(blob, `${filename}.${extension}`);

      // Show success toast
      this.showToast(`${exportType === 'heightmap' ? 'Heightmap' : 'Biome map'} exported successfully!`, 'success');

      // Close dialog
      this.closeDialog('export-dialog');

    } catch (error) {
      console.error('Failed to export map:', error);
      this.showToast('Failed to export map: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }

  /**
   * Export heightmap as image
   */
  private async exportHeightmap(chunks: Map<string, any>, format: ImageFormat): Promise<Blob> {
    // Find bounds of loaded chunks
    const bounds = this.calculateChunkBounds(chunks);
    const chunkSize = 32; // Default chunk size
    
    const width = (bounds.maxX - bounds.minX + 1) * chunkSize;
    const height = (bounds.maxY - bounds.minY + 1) * chunkSize;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Create image data
    const imageData = ctx.createImageData(width, height);

    // Fill image data from chunks
    for (const [, chunk] of chunks) {
      const offsetX = (chunk.x - bounds.minX) * chunkSize;
      const offsetY = (chunk.y - bounds.minY) * chunkSize;

      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const chunkIndex = y * chunkSize + x;
          const height = chunk.heightmap[chunkIndex];
          
          // Normalize height to 0-255 range
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

    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Convert to blob
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
  private async exportBiomeMap(chunks: Map<string, any>, format: ImageFormat): Promise<Blob> {
    // Biome colors (matching typical biome visualization)
    const biomeColors: Record<number, [number, number, number]> = {
      0: [34, 139, 34],    // FOREST - Forest Green
      1: [255, 228, 181],  // DESERT - Moccasin
      2: [173, 216, 230],  // TUNDRA - Light Blue
      3: [144, 238, 144],  // GRASSLAND - Light Green
      4: [139, 69, 19],    // MOUNTAIN - Saddle Brown
      5: [30, 144, 255],   // OCEAN - Dodger Blue
      6: [255, 250, 205],  // BEACH - Lemon Chiffon
      7: [34, 139, 34]     // SWAMP - Dark Green
    };

    // Find bounds of loaded chunks
    const bounds = this.calculateChunkBounds(chunks);
    const chunkSize = 32; // Default chunk size
    
    const width = (bounds.maxX - bounds.minX + 1) * chunkSize;
    const height = (bounds.maxY - bounds.minY + 1) * chunkSize;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Create image data
    const imageData = ctx.createImageData(width, height);

    // Fill image data from chunks
    for (const [, chunk] of chunks) {
      const offsetX = (chunk.x - bounds.minX) * chunkSize;
      const offsetY = (chunk.y - bounds.minY) * chunkSize;

      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const chunkIndex = y * chunkSize + x;
          const biome = chunk.biomeMap[chunkIndex];
          
          // Get biome color
          const color = biomeColors[biome] || [128, 128, 128];
          
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

    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Convert to blob
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
    
    // Clean up
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
      
      // Check if there are any configuration parameters
      if (params.toString().length === 0) {
        return;
      }

      const state = this.app.getState();
      const config = { ...state.config };

      // Parse seed
      if (params.has('seed')) {
        const seed = parseInt(params.get('seed')!);
        if (!isNaN(seed)) {
          config.seed = seed;
        }
      }

      // Parse terrain config
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
      }

      // Parse biome config
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

      // Apply the parsed configuration
      this.app.updateState({ config });

      // Show notification that configuration was loaded from URL
      this.showToast('Configuration loaded from URL', 'info');

      console.log('URL configuration parsed and applied:', config);

    } catch (error) {
      console.error('Failed to parse URL configuration:', error);
      // Don't show error toast for URL parsing failures - just log it
    }
  }

  /**
   * Export world configuration as JSON
   */
  exportConfiguration(): void {
    if (!this.app) return;

    try {
      const state = this.app.getState();
      const config = state.config;

      // Create a clean configuration object
      const exportConfig = {
        seed: config.seed,
        terrainConfig: config.terrainConfig,
        biomeConfig: config.biomeConfig,
        resourceConfig: config.resourceConfig,
        structureConfig: config.structureConfig,
        workerPoolConfig: config.workerPoolConfig,
      };

      // Convert to JSON string with formatting
      const jsonString = JSON.stringify(exportConfig, null, 2);

      // Download file
      this.downloadFile(jsonString, 'world-config.json');

      // Show success toast
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
      
      // Copy to clipboard
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

    const state = this.app.getState();
    const config = state.config;

    // Encode configuration as URL parameters
    const params = new URLSearchParams();
    params.set('seed', config.seed.toString());
    
    // Add terrain config
    if (config.terrainConfig) {
      params.set('baseScale', config.terrainConfig.baseScale.toString());
      params.set('octaves', config.terrainConfig.octaves.toString());
      params.set('persistence', config.terrainConfig.persistence.toString());
      params.set('lacunarity', config.terrainConfig.lacunarity.toString());
      params.set('warpStrength', config.terrainConfig.warpStrength.toString());
      params.set('heightMultiplier', config.terrainConfig.heightMultiplier.toString());
    }

    // Add biome config
    if (config.biomeConfig) {
      params.set('tempScale', config.biomeConfig.temperatureScale.toString());
      params.set('moistScale', config.biomeConfig.moistureScale.toString());
      params.set('blendRadius', config.biomeConfig.blendRadius.toString());
    }

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  /**
   * Copy seed to clipboard
   */
  async copySeedToClipboard(): Promise<void> {
    if (!this.app) return;

    const state = this.app.getState();
    const seed = state.config.seed.toString();

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
    // Remove dialogs from DOM
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
    console.log('WorldManager disposed');
  }
}
