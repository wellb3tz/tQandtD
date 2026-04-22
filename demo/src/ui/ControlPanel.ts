/**
 * ControlPanel - UI component for parameter adjustment and feature toggles
 * 
 * Provides interactive controls for all terrain, biome, resource, and structure
 * parameters. Supports real-time updates and collapsible sections.
 */

import { DemoApp, AppState, TerrainTool } from '../core/DemoApp';
import type { WorldConfig } from '../../../src/world/chunk-manager';
import { TerrainEditor } from '../editor/TerrainEditor';
import { getWorkerUrl } from '../../worker-loader';

/**
 * Parameter change callback type
 */
export type ParameterChangeCallback = (config: Partial<WorldConfig>) => void;

/**
 * Preset selection callback type
 */
export type PresetSelectCallback = (preset: PresetConfig) => void;

/**
 * Preset configuration interface
 */
export interface PresetConfig {
  name: string;
  description: string;
  config: WorldConfig;
}

/**
 * Built-in presets
 */
const PRESETS: PresetConfig[] = [];

/**
 * Control configuration for sliders
 */
interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  tooltip?: string;
}

/**
 * Control configuration for checkboxes
 */
interface CheckboxConfig {
  id: string;
  label: string;
  defaultValue: boolean;
  tooltip?: string;
}

/**
 * ControlPanel class - Manages all UI controls for parameter adjustment
 */
export class ControlPanel {
  private app: DemoApp | null = null;
  private terrainEditor: TerrainEditor | null = null;
  private container: HTMLElement | null = null;
  private parameterChangeCallbacks: Set<ParameterChangeCallback> = new Set();
  private presetSelectCallbacks: Set<PresetSelectCallback> = new Set();
  private currentConfig: WorldConfig | null = null;
  private customPresets: PresetConfig[] = [];

  /**
   * Initialize the control panel
   */
  initialize(container: HTMLElement, app: DemoApp, terrainEditor?: TerrainEditor): void {
    this.container = container;
    this.app = app;
    this.terrainEditor = terrainEditor || null;
    this.currentConfig = app.getState().config;

    // Subscribe to state changes
    app.subscribeToState((state: AppState) => {
      this.updateFromState(state);
    });

    // Create all control sections
    this.createTerrainControls();
    this.createBiomeControls();
    this.createResourceControls();
    this.createWaterControls();
    this.createAdvancedControls();
    this.createTerrainEditingControls();
    this.createVisibilityToggles();
  }

  /**
   * Create terrain parameter controls
   */
  private createTerrainControls(): void {
    const terrainContainer = document.getElementById('terrain-controls');
    if (!terrainContainer) return;

    const sliders: SliderConfig[] = [
      {
        id: 'baseScale',
        label: 'Base Scale',
        min: 0.001,
        max: 0.1,
        step: 0.001,
        defaultValue: 0.01,
        tooltip: 'Controls the overall scale of terrain features'
      },
      {
        id: 'octaves',
        label: 'Octaves',
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 4,
        tooltip: 'Number of noise layers for detail'
      },
      {
        id: 'persistence',
        label: 'Persistence',
        min: 0.1,
        max: 0.9,
        step: 0.1,
        defaultValue: 0.5,
        tooltip: 'How much each octave contributes'
      },
      {
        id: 'lacunarity',
        label: 'Lacunarity',
        min: 1.5,
        max: 3.0,
        step: 0.1,
        defaultValue: 2.0,
        tooltip: 'Frequency multiplier between octaves'
      },
      {
        id: 'warpStrength',
        label: 'Warp Strength',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 1,
        tooltip: 'Domain warping intensity'
      },
      {
        id: 'heightMultiplier',
        label: 'Height Multiplier',
        min: 0.5,
        max: 2.0,
        step: 0.1,
        defaultValue: 1.0,
        tooltip: 'Overall terrain height scaling'
      }
    ];

    sliders.forEach(config => {
      const control = this.createSliderControl(config, (value) => {
        this.updateTerrainConfig(config.id, value);
      });
      terrainContainer.appendChild(control);
    });

    // 3D noise checkbox
    const enable3DCheckbox = this.createCheckboxControl({
      id: 'enable3D',
      label: 'Enable 3D Noise',
      defaultValue: false,
      tooltip: 'Use 3D noise for terrain generation'
    }, (checked) => {
      this.updateTerrainConfig('enable3D', checked);
      const zScaleControl = document.getElementById('zScale-group');
      if (zScaleControl) {
        zScaleControl.style.display = checked ? 'block' : 'none';
      }
    });
    terrainContainer.appendChild(enable3DCheckbox);

    // Z-scale slider (conditional)
    const zScaleControl = this.createSliderControl({
      id: 'zScale',
      label: 'Z Scale',
      min: 0.1,
      max: 1.0,
      step: 0.1,
      defaultValue: 0.5,
      tooltip: 'Z-axis scale for 3D noise'
    }, (value) => {
      this.updateTerrainConfig('zScale', value);
    });
    zScaleControl.style.display = 'none';
    zScaleControl.id = 'zScale-group';
    terrainContainer.appendChild(zScaleControl);
  }

  /**
   * Create biome parameter controls
   */
  private createBiomeControls(): void {
    const biomeContainer = document.getElementById('biome-controls');
    if (!biomeContainer) return;

    const basicSliders: SliderConfig[] = [
      {
        id: 'temperatureScale',
        label: 'Temperature Scale',
        min: 0.001,
        max: 0.01,
        step: 0.001,
        defaultValue: 0.005,
        tooltip: 'Scale of temperature variation'
      },
      {
        id: 'moistureScale',
        label: 'Moisture Scale',
        min: 0.001,
        max: 0.01,
        step: 0.001,
        defaultValue: 0.005,
        tooltip: 'Scale of moisture variation'
      },
      {
        id: 'blendRadius',
        label: 'Blend Radius',
        min: 1,
        max: 10,
        step: 1,
        defaultValue: 5,
        tooltip: 'Radius for biome blending'
      }
    ];

    basicSliders.forEach(config => {
      const control = this.createSliderControl(config, (value) => {
        this.updateBiomeConfig(config.id, value);
      });
      biomeContainer.appendChild(control);
    });

    // Enhanced biome controls
    const enhancedSection = document.createElement('div');
    enhancedSection.style.marginTop = '16px';
    enhancedSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Enhanced Biomes</h4>';
    biomeContainer.appendChild(enhancedSection);

    // Enable transitions
    const transitionsCheckbox = this.createCheckboxControl({
      id: 'enableTransitions',
      label: 'Enable Transitions',
      defaultValue: true,
      tooltip: 'Enable smooth biome transitions'
    }, (checked) => {
      this.updateBiomeConfig('enableTransitions', checked);
      const transitionWidthControl = document.getElementById('transitionWidth-group');
      if (transitionWidthControl) {
        transitionWidthControl.style.display = checked ? 'block' : 'none';
      }
    });
    biomeContainer.appendChild(transitionsCheckbox);

    // Transition width (conditional)
    const transitionWidthControl = this.createSliderControl({
      id: 'transitionWidth',
      label: 'Transition Width',
      min: 5,
      max: 20,
      step: 1,
      defaultValue: 10,
      tooltip: 'Width of transition zones'
    }, (value) => {
      this.updateBiomeConfig('transitionWidth', value);
    });
    transitionWidthControl.style.display = 'block';
    transitionWidthControl.id = 'transitionWidth-group';
    biomeContainer.appendChild(transitionWidthControl);

    // Enable micro biomes
    const microBiomesCheckbox = this.createCheckboxControl({
      id: 'enableMicroBiomes',
      label: 'Enable Micro Biomes',
      defaultValue: false,
      tooltip: 'Enable small-scale biome variations'
    }, (checked) => {
      this.updateBiomeConfig('enableMicroBiomes', checked);
      const microFreqControl = document.getElementById('microBiomeFrequency-group');
      if (microFreqControl) {
        microFreqControl.style.display = checked ? 'block' : 'none';
      }
    });
    biomeContainer.appendChild(microBiomesCheckbox);

    // Micro biome frequency (conditional)
    const microFreqControl = this.createSliderControl({
      id: 'microBiomeFrequency',
      label: 'Micro Biome Frequency',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      defaultValue: 0.1,
      tooltip: 'Frequency of micro biome variations'
    }, (value) => {
      this.updateBiomeConfig('microBiomeFrequency', value);
    });
    microFreqControl.style.display = 'none';
    microFreqControl.id = 'microBiomeFrequency-group';
    biomeContainer.appendChild(microFreqControl);

    // Enable elevation bands
    const elevationBandsCheckbox = this.createCheckboxControl({
      id: 'enableElevationBands',
      label: 'Enable Elevation Bands',
      defaultValue: false,
      tooltip: 'Enable elevation-based biome bands'
    }, (checked) => {
      this.updateBiomeConfig('enableElevationBands', checked);
      const snowLineControl = document.getElementById('snowLineElevation-group');
      if (snowLineControl) {
        snowLineControl.style.display = checked ? 'block' : 'none';
      }
    });
    biomeContainer.appendChild(elevationBandsCheckbox);

    // Snow line elevation (conditional)
    const snowLineControl = this.createSliderControl({
      id: 'snowLineElevation',
      label: 'Snow Line Elevation',
      min: 0.6,
      max: 0.95,
      step: 0.05,
      defaultValue: 0.8,
      tooltip: 'Elevation threshold for snow biome'
    }, (value) => {
      this.updateBiomeConfig('snowLineElevation', value);
    });
    snowLineControl.style.display = 'none';
    snowLineControl.id = 'snowLineElevation-group';
    biomeContainer.appendChild(snowLineControl);
  }

  /**
  /**
   * Create resource and structure controls
   */
  private createResourceControls(): void {
    const resourceContainer = document.getElementById('resource-controls');
    if (!resourceContainer) return;

    // Resource types section
    const resourceTypesSection = document.createElement('div');
    resourceTypesSection.style.marginBottom = '16px';
    resourceTypesSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Resource Types</h4>';
    resourceContainer.appendChild(resourceTypesSection);

    // Resource type checkboxes
    const resourceTypes = [
      { id: 'enableIron', label: 'Iron', defaultValue: true },
      { id: 'enableGold', label: 'Gold', defaultValue: true },
      { id: 'enableCoal', label: 'Coal', defaultValue: true },
      { id: 'enableStone', label: 'Stone', defaultValue: true },
      { id: 'enableWood', label: 'Wood', defaultValue: true }
    ];

    resourceTypes.forEach(config => {
      const control = this.createCheckboxControl(config, (checked) => {
        this.updateResourceTypeConfig(config.id, checked);
      });
      resourceContainer.appendChild(control);
    });

    // Resource density threshold
    const densityControl = this.createSliderControl({
      id: 'densityThreshold',
      label: 'Resource Density',
      min: 0.3,
      max: 0.9,
      step: 0.1,
      defaultValue: 0.6,
      tooltip: 'Threshold for resource placement'
    }, (value) => {
      this.updateResourceConfig('densityThreshold', value);
    });
    densityControl.style.marginTop = '16px';
    resourceContainer.appendChild(densityControl);

    // Structure types section
    const structureTypesSection = document.createElement('div');
    structureTypesSection.style.marginTop = '24px';
    structureTypesSection.style.marginBottom = '16px';
    structureTypesSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Structure Types</h4>';
    resourceContainer.appendChild(structureTypesSection);

    // Structure type checkboxes
    const structureTypes = [
      { id: 'enableVillage', label: 'Village', defaultValue: true },
      { id: 'enableRuins', label: 'Ruins', defaultValue: true },
      { id: 'enableTower', label: 'Tower', defaultValue: true }
    ];

    structureTypes.forEach(config => {
      const control = this.createCheckboxControl(config, (checked) => {
        this.updateStructureTypeConfig(config.id, checked);
      });
      resourceContainer.appendChild(control);
    });

    // Structure min distance
    const minDistanceControl = this.createSliderControl({
      id: 'minDistance',
      label: 'Structure Min Distance',
      min: 5,
      max: 50,
      step: 5,
      defaultValue: 30,
      tooltip: 'Minimum distance between structures'
    }, (value) => {
      this.updateStructureConfig('minDistance', value);
    });
    minDistanceControl.style.marginTop = '16px';
    resourceContainer.appendChild(minDistanceControl);
  }

  /**
   * Create water configuration controls
   */
  private createWaterControls(): void {
    const waterContainer = document.getElementById('water-controls');
    if (!waterContainer) return;

    // Water color picker
    const colorControl = this.createColorControl({
      id: 'waterColor',
      label: 'Water Color',
      defaultValue: '#1e90ff',
      tooltip: 'Color of water surface'
    }, (color) => {
      this.updateWaterConfig('ocean', 'color', parseInt(color.replace('#', '0x')));
    });
    waterContainer.appendChild(colorControl);

    // Water opacity slider
    const opacityControl = this.createSliderControl({
      id: 'waterOpacity',
      label: 'Water Opacity',
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 0.7,
      tooltip: 'Transparency of water (0 = transparent, 1 = opaque)'
    }, (value) => {
      this.updateWaterConfig('ocean', 'opacity', value);
    });
    waterContainer.appendChild(opacityControl);

    // Water shininess slider
    const shininessControl = this.createSliderControl({
      id: 'waterShininess',
      label: 'Water Shininess',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 30,
      tooltip: 'Shininess of water surface'
    }, (value) => {
      this.updateWaterConfig('ocean', 'shininess', value);
    });
    waterContainer.appendChild(shininessControl);
  }

  /**
   * Create advanced feature controls
   */
  private createAdvancedControls(): void {
    const advancedContainer = document.getElementById('advanced-controls');
    if (!advancedContainer) return;

    // View Distance slider
    const viewDistanceControl = this.createSliderControl({
      id: 'viewDistance',
      label: 'View Distance (chunks)',
      min: 1,
      max: 8,
      step: 1,
      defaultValue: 3,
      tooltip: 'Number of chunks to load around camera (higher = more visible terrain, lower performance)'
    }, (value) => {
      if (this.app) {
        this.app.updateState({ viewDistance: value });
      }
    });
    advancedContainer.appendChild(viewDistanceControl);

    // Cache Size slider
    const cacheSizeControl = this.createSliderControl({
      id: 'maxCacheSize',
      label: 'Cache Size (chunks)',
      min: 100,
      max: 2000,
      step: 100,
      defaultValue: 1000,
      tooltip: 'Maximum number of chunks to keep in memory. Higher values improve performance when revisiting areas.'
    }, (value) => {
      if (this.app) {
        const newConfig = { ...this.app.getState().config, maxCacheSize: value };
        this.app.updateEngineConfig(newConfig);
      }
    });
    advancedContainer.appendChild(cacheSizeControl);

    // LOD system
    const lodCheckbox = this.createCheckboxControl({
      id: 'enableLOD',
      label: 'Enable LOD System',
      defaultValue: false,
      tooltip: 'Enable Level of Detail optimization'
    }, (checked) => {
      this.updateLODConfig('enabled', checked);
      const lodDistancesControl = document.getElementById('lodDistances-group');
      if (lodDistancesControl) {
        lodDistancesControl.style.display = checked ? 'block' : 'none';
      }
    });
    advancedContainer.appendChild(lodCheckbox);

    // LOD distance thresholds (conditional)
    const lodDistancesControl = this.createLODDistanceControls();
    lodDistancesControl.style.display = 'none';
    lodDistancesControl.id = 'lodDistances-group';
    advancedContainer.appendChild(lodDistancesControl);

    // Worker pool (FIXED - memory leak resolved)
    const workerCheckbox = this.createCheckboxControl({
      id: 'enableWorkerPool',
      label: 'Enable Worker Pool (Multi-threaded)',
      defaultValue: false,
      tooltip: 'Enable multi-threaded chunk generation using Web Workers for better performance. Uses 4 workers by default.'
    }, (checked) => {
      this.updateWorkerPoolConfig('enabled', checked);
    });
    advancedContainer.appendChild(workerCheckbox);

    // Incremental generation
    const incrementalCheckbox = this.createCheckboxControl({
      id: 'enableIncremental',
      label: 'Enable Incremental Generation',
      defaultValue: false,
      tooltip: 'Enable progressive chunk generation'
    }, (checked) => {
      this.updateIncrementalConfig('enabled', checked);
      const timeBudgetControl = document.getElementById('timeBudgetMs-group');
      if (timeBudgetControl) {
        timeBudgetControl.style.display = checked ? 'block' : 'none';
      }
    });
    advancedContainer.appendChild(incrementalCheckbox);

    // Time budget slider (conditional)
    const timeBudgetControl = this.createSliderControl({
      id: 'timeBudgetMs',
      label: 'Time Budget (ms)',
      min: 8,
      max: 32,
      step: 1,
      defaultValue: 16,
      tooltip: 'Time budget per frame for incremental generation (16ms = 60fps)'
    }, (value) => {
      this.updateIncrementalConfig('timeBudgetMs', value);
    });
    timeBudgetControl.style.display = 'none';
    timeBudgetControl.id = 'timeBudgetMs-group';
    advancedContainer.appendChild(timeBudgetControl);
  }

  /**
   * Create LOD distance threshold controls
   */
  private createLODDistanceControls(): HTMLElement {
    const container = document.createElement('div');
    container.style.marginLeft = 'var(--spacing-md)';
    container.style.marginTop = 'var(--spacing-md)';
    container.style.paddingLeft = 'var(--spacing-md)';
    container.style.borderLeft = '2px solid var(--border-color)';

    const title = document.createElement('div');
    title.textContent = 'LOD Distance Thresholds';
    title.style.fontSize = '0.75rem';
    title.style.color = 'var(--text-secondary)';
    title.style.marginBottom = 'var(--spacing-sm)';
    container.appendChild(title);

    // High to Medium distance threshold
    const highToMediumControl = this.createSliderControl({
      id: 'lodHighToMedium',
      label: 'High → Medium (chunks)',
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 2,
      tooltip: 'Distance where chunks switch from high to medium detail'
    }, (value) => {
      this.updateLODConfig('highToMedium', value);
    });
    container.appendChild(highToMediumControl);

    // Medium to Low distance threshold
    const mediumToLowControl = this.createSliderControl({
      id: 'lodMediumToLow',
      label: 'Medium → Low (chunks)',
      min: 2,
      max: 20,
      step: 1,
      defaultValue: 5,
      tooltip: 'Distance where chunks switch from medium to low detail'
    }, (value) => {
      this.updateLODConfig('mediumToLow', value);
    });
    container.appendChild(mediumToLowControl);

    return container;
  }

  /**
   * Update Incremental Generation configuration
   */
  private updateIncrementalConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    if (key === 'enabled') {
      if (value === true) {
        // Enable incremental generation with default configuration
        const newConfig: Partial<WorldConfig> = {
          incrementalConfig: {
            enabled: true,
            timeBudgetMs: 16
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      } else {
        // Disable incremental generation
        const newConfig: Partial<WorldConfig> = {
          incrementalConfig: {
            enabled: false,
            timeBudgetMs: 16
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      }
    } else if (key === 'timeBudgetMs') {
      // Update time budget
      const currentIncrementalConfig = this.currentConfig.incrementalConfig;
      if (currentIncrementalConfig) {
        const newConfig: Partial<WorldConfig> = {
          incrementalConfig: {
            ...currentIncrementalConfig,
            timeBudgetMs: value as number
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      }
    }
  }

  /**
   * Update LOD configuration
   */
  private updateLODConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    if (key === 'enabled') {
      if (value === true) {
        // Enable LOD with default configuration
        const newConfig: Partial<WorldConfig> = {
          lodConfig: {
            distances: [2, 5],
            meshResolutions: [1.0, 0.5, 0.25],
            featureDensities: [1.0, 0.5, 0.1]
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      } else {
        // Disable LOD
        const newConfig: Partial<WorldConfig> = {
          lodConfig: undefined
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      }
    } else if (key === 'highToMedium' || key === 'mediumToLow') {
      // Update distance thresholds
      const currentLODConfig = this.currentConfig.lodConfig;
      if (currentLODConfig) {
        const distances = [...currentLODConfig.distances];
        if (key === 'highToMedium') {
          distances[0] = value as number;
        } else if (key === 'mediumToLow') {
          distances[1] = value as number;
        }

        const newConfig: Partial<WorldConfig> = {
          lodConfig: {
            ...currentLODConfig,
            distances
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      }
    }
  }

  /**
   * Update Worker Pool configuration
   */
  private updateWorkerPoolConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    if (key === 'enabled') {
      if (value === true) {
        // Enable Worker Pool with fixed 4 workers for optimal balance
        const defaultMaxWorkers = 4;
        
        // Use the worker loader to get the correct URL for dev/prod
        const workerUrl = getWorkerUrl();
        
        const newConfig: Partial<WorldConfig> = {
          workerPoolConfig: {
            maxWorkers: defaultMaxWorkers,
            workerScriptUrl: workerUrl,
            taskTimeout: 5000 // 5 second timeout for faster fallback
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      } else {
        // Disable Worker Pool
        const newConfig: Partial<WorldConfig> = {
          workerPoolConfig: undefined
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      }
    } else if (key === 'maxWorkers') {
      // Update max workers
      const currentWorkerPoolConfig = this.currentConfig.workerPoolConfig;
      if (currentWorkerPoolConfig) {
        const newConfig: Partial<WorldConfig> = {
          workerPoolConfig: {
            ...currentWorkerPoolConfig,
            maxWorkers: value as number
          }
        };
        this.app.updateEngineConfig(newConfig);
        this.notifyParameterChange(newConfig);
      }
    }
  }

  /**
   * Create terrain editing controls
   */
  private createTerrainEditingControls(): void {
    const editingContainer = document.getElementById('terrain-editing-controls');
    if (!editingContainer) return;

    // Tool selection buttons
    const toolsSection = document.createElement('div');
    toolsSection.style.marginBottom = '16px';
    toolsSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Tools</h4>';
    editingContainer.appendChild(toolsSection);

    const toolButtons = [
      { id: 'tool-none', label: 'None', tool: TerrainTool.NONE },
      { id: 'tool-raise', label: 'Raise', tool: TerrainTool.RAISE },
      { id: 'tool-lower', label: 'Lower', tool: TerrainTool.LOWER },
      { id: 'tool-flatten', label: 'Flatten', tool: TerrainTool.FLATTEN },
      { id: 'tool-smooth', label: 'Smooth', tool: TerrainTool.SMOOTH }
    ];

    const toolButtonGroup = document.createElement('div');
    toolButtonGroup.style.display = 'grid';
    toolButtonGroup.style.gridTemplateColumns = 'repeat(2, 1fr)';
    toolButtonGroup.style.gap = '8px';
    toolButtonGroup.style.marginBottom = '16px';

    toolButtons.forEach(({ id, label, tool }) => {
      const button = document.createElement('button');
      button.id = id;
      button.textContent = label;
      button.style.padding = '8px';
      button.style.borderRadius = '4px';
      button.style.border = '1px solid var(--border-color, #ccc)';
      button.style.backgroundColor = 'var(--bg-primary, #f0f0f0)';
      button.style.color = 'var(--text-primary, #000)';
      button.style.cursor = 'pointer';
      button.style.fontSize = '0.875rem';

      if (tool === TerrainTool.NONE) {
        button.style.backgroundColor = 'var(--bg-active, #007bff)';
        button.style.color = '#fff';
      }

      button.addEventListener('click', () => {
        if (this.terrainEditor) {
          this.terrainEditor.setTool(tool);
          
          // Update button states
          toolButtons.forEach(({ id: btnId }) => {
            const btn = document.getElementById(btnId);
            if (btn) {
              if (btnId === id) {
                btn.style.backgroundColor = 'var(--bg-active, #007bff)';
                btn.style.color = '#fff';
              } else {
                btn.style.backgroundColor = 'var(--bg-primary, #f0f0f0)';
                btn.style.color = 'var(--text-primary, #000)';
              }
            }
          });
        }
      });

      toolButtonGroup.appendChild(button);
    });

    editingContainer.appendChild(toolButtonGroup);

    // Brush size slider
    const brushSizeControl = this.createSliderControl({
      id: 'brushSize',
      label: 'Brush Size',
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 5,
      tooltip: 'Size of the terrain editing brush'
    }, (value) => {
      if (this.terrainEditor) {
        this.terrainEditor.setBrushSize(value);
      }
    });
    editingContainer.appendChild(brushSizeControl);

    // Brush strength slider
    const brushStrengthControl = this.createSliderControl({
      id: 'brushStrength',
      label: 'Brush Strength',
      min: 0.1,
      max: 2.0,
      step: 0.1,
      defaultValue: 1.0,
      tooltip: 'Strength of the terrain editing brush'
    }, (value) => {
      if (this.terrainEditor) {
        this.terrainEditor.setBrushStrength(value);
      }
    });
    editingContainer.appendChild(brushStrengthControl);

    // Undo/Redo section
    const undoRedoSection = document.createElement('div');
    undoRedoSection.style.marginTop = '16px';
    undoRedoSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">History</h4>';
    editingContainer.appendChild(undoRedoSection);

    // Undo/Redo button group
    const undoRedoGroup = document.createElement('div');
    undoRedoGroup.style.display = 'grid';
    undoRedoGroup.style.gridTemplateColumns = '1fr 1fr';
    undoRedoGroup.style.gap = '8px';

    // Undo button
    const undoButton = document.createElement('button');
    undoButton.id = 'undo-btn';
    undoButton.textContent = '↶ Undo';
    undoButton.style.padding = '8px';
    undoButton.style.borderRadius = '4px';
    undoButton.style.border = '1px solid var(--border-color, #ccc)';
    undoButton.style.backgroundColor = 'var(--bg-primary, #f0f0f0)';
    undoButton.style.color = 'var(--text-primary, #000)';
    undoButton.style.cursor = 'pointer';
    undoButton.style.fontSize = '0.875rem';
    undoButton.disabled = true;
    undoButton.style.opacity = '0.5';

    undoButton.addEventListener('click', () => {
      if (this.terrainEditor && this.terrainEditor.canUndo()) {
        this.terrainEditor.undo();
        this.updateUndoRedoButtons();
      }
    });

    // Redo button
    const redoButton = document.createElement('button');
    redoButton.id = 'redo-btn';
    redoButton.textContent = '↷ Redo';
    redoButton.style.padding = '8px';
    redoButton.style.borderRadius = '4px';
    redoButton.style.border = '1px solid var(--border-color, #ccc)';
    redoButton.style.backgroundColor = 'var(--bg-primary, #f0f0f0)';
    redoButton.style.color = 'var(--text-primary, #000)';
    redoButton.style.cursor = 'pointer';
    redoButton.style.fontSize = '0.875rem';
    redoButton.disabled = true;
    redoButton.style.opacity = '0.5';

    redoButton.addEventListener('click', () => {
      if (this.terrainEditor && this.terrainEditor.canRedo()) {
        this.terrainEditor.redo();
        this.updateUndoRedoButtons();
      }
    });

    undoRedoGroup.appendChild(undoButton);
    undoRedoGroup.appendChild(redoButton);
    editingContainer.appendChild(undoRedoGroup);

    // Register modification callback to update undo/redo buttons
    if (this.terrainEditor) {
      this.terrainEditor.onModification(() => {
        this.updateUndoRedoButtons();
      });
    }
  }

  /**
   * Update undo/redo button states
   */
  private updateUndoRedoButtons(): void {
    if (!this.terrainEditor) return;

    const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
    const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;

    if (undoButton) {
      const canUndo = this.terrainEditor.canUndo();
      undoButton.disabled = !canUndo;
      undoButton.style.opacity = canUndo ? '1' : '0.5';
      undoButton.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }

    if (redoButton) {
      const canRedo = this.terrainEditor.canRedo();
      redoButton.disabled = !canRedo;
      redoButton.style.opacity = canRedo ? '1' : '0.5';
      redoButton.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    }
  }

  /**
   * Create visibility toggle controls
   */
  private createVisibilityToggles(): void {
    const visibilityContainer = document.getElementById('visibility-controls');
    if (!visibilityContainer) return;

    const toggles: CheckboxConfig[] = [
      { id: 'showTerrain', label: 'Show Terrain', defaultValue: true },
      { id: 'showBiomes', label: 'Show Biome Colors', defaultValue: true },
      { id: 'showWater', label: 'Show Water Layer', defaultValue: true },
      { id: 'showResources', label: 'Show Resources', defaultValue: true },
      { id: 'showStructures', label: 'Show Structures', defaultValue: true },
      { id: 'showChunkBoundaries', label: 'Show Chunk Boundaries', defaultValue: false },
      { id: 'showWireframe', label: 'Wireframe Mode', defaultValue: false },
      { id: 'fogOfWarEnabled', label: 'Fog of War (Explored Chunks)', defaultValue: true }
    ];

    toggles.forEach(config => {
      const control = this.createCheckboxControl(config, (checked) => {
        this.updateVisibility(config.id, checked);
      });
      visibilityContainer.appendChild(control);
    });
  }

  /**
   * Create a slider control element
   */
  private createSliderControl(
    config: SliderConfig,
    onChange: (value: number) => void
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('label');
    label.htmlFor = config.id;
    label.textContent = config.label;
    if (config.tooltip) {
      label.title = config.tooltip;
    }

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'slider-value';
    valueDisplay.textContent = config.defaultValue.toString();

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = config.id;
    slider.min = config.min.toString();
    slider.max = config.max.toString();
    slider.step = config.step.toString();
    slider.value = config.defaultValue.toString();

    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      valueDisplay.textContent = value.toFixed(config.step < 1 ? 3 : 0);
      onChange(value);
    });

    label.appendChild(valueDisplay);
    group.appendChild(label);
    group.appendChild(slider);

    return group;
  }

  /**
   * Create a color control element
   */
  private createColorControl(
    config: { id: string; label: string; defaultValue: string; tooltip?: string },
    onChange: (color: string) => void
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';
    group.style.display = 'flex';
    group.style.alignItems = 'center';
    group.style.gap = '8px';
    group.style.marginBottom = '12px';

    const label = document.createElement('label');
    label.htmlFor = config.id;
    label.textContent = config.label;
    label.style.flex = '1';
    if (config.tooltip) {
      label.title = config.tooltip;
    }

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = config.id;
    colorInput.value = config.defaultValue;
    colorInput.style.width = '50px';
    colorInput.style.height = '30px';
    colorInput.style.border = '1px solid var(--border-color, #ccc)';
    colorInput.style.borderRadius = '4px';
    colorInput.style.cursor = 'pointer';

    colorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      onChange(color);
    });

    group.appendChild(label);
    group.appendChild(colorInput);

    return group;
  }

  /**
   * Create a checkbox control element
   */
  private createCheckboxControl(
    config: CheckboxConfig,
    onChange: (checked: boolean) => void
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';
    group.style.display = 'flex';
    group.style.alignItems = 'center';
    group.style.gap = '8px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = config.id;
    checkbox.checked = config.defaultValue;

    const label = document.createElement('label');
    label.htmlFor = config.id;
    label.textContent = config.label;
    label.style.marginBottom = '0';
    label.style.cursor = 'pointer';
    if (config.tooltip) {
      label.title = config.tooltip;
    }

    checkbox.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      onChange(checked);
    });

    group.appendChild(checkbox);
    group.appendChild(label);

    return group;
  }

  /**
   * Update terrain configuration
   */
  private updateTerrainConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    const newConfig: Partial<WorldConfig> = {
      terrainConfig: {
        ...this.currentConfig.terrainConfig,
        [key]: value
      }
    };

    this.app.updateEngineConfig(newConfig);
    this.notifyParameterChange(newConfig);
  }

  /**
   * Update biome configuration
   */
  private updateBiomeConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    // Check if this is an enhanced biome feature
    const enhancedFeatures = [
      'enableTransitions', 'transitionWidth',
      'enableMicroBiomes', 'microBiomeFrequency', 'microBiomeMaxSize',
      'enableElevationBands', 'snowLineElevation', 'treeLineElevation'
    ];
    
    if (enhancedFeatures.includes(key)) {
      // Update enhancedBiomeConfig
      const currentEnhancedConfig = this.currentConfig.enhancedBiomeConfig || {
        ...this.currentConfig.biomeConfig,
        enableTransitions: true,
        transitionWidth: 10,
        enableMicroBiomes: false,
        microBiomeFrequency: 0.1,
        microBiomeMaxSize: 20,
        enableElevationBands: false,
        snowLineElevation: 0.8,
        treeLineElevation: 0.75
      };

      const newConfig: Partial<WorldConfig> = {
        enhancedBiomeConfig: {
          ...currentEnhancedConfig,
          [key]: value
        }
      };

      this.app.updateEngineConfig(newConfig);
      this.notifyParameterChange(newConfig);
    } else {
      // Update basic biomeConfig
      const newConfig: Partial<WorldConfig> = {
        biomeConfig: {
          ...this.currentConfig.biomeConfig,
          [key]: value
        }
      };

      // If enhancedBiomeConfig exists, also update it to keep them in sync
      if (this.currentConfig.enhancedBiomeConfig) {
        newConfig.enhancedBiomeConfig = {
          ...this.currentConfig.enhancedBiomeConfig,
          [key]: value
        };
      }

      this.app.updateEngineConfig(newConfig);
      this.notifyParameterChange(newConfig);
    }
  }

  /**
   * Update resource configuration
   */
  private updateResourceConfig(key: string, value: number): void {
    if (!this.app || !this.currentConfig) return;

    const newConfig: Partial<WorldConfig> = {
      resourceConfig: {
        ...this.currentConfig.resourceConfig,
        [key]: value
      }
    };

    this.app.updateEngineConfig(newConfig);
    this.notifyParameterChange(newConfig);
  }

  /**
   * Update resource type configuration
   */
  private updateResourceTypeConfig(key: string, enabled: boolean): void {
    if (!this.app || !this.currentConfig) return;

    // Map UI checkbox IDs to resource type indices
    const resourceTypeMap: Record<string, number> = {
      'enableIron': 0,    // ResourceType.IRON
      'enableGold': 1,    // ResourceType.GOLD
      'enableCoal': 2,    // ResourceType.COAL
      'enableStone': 3,   // ResourceType.STONE
      'enableWood': 4     // ResourceType.WOOD
    };

    const resourceTypeIndex = resourceTypeMap[key];
    if (resourceTypeIndex === undefined) return;

    // Update the resource types array
    const currentTypes = this.currentConfig.resourceConfig?.types || [];
    let updatedTypes = [...currentTypes];

    if (enabled) {
      // Add the resource type if not already present
      if (!updatedTypes.some(t => t.type === resourceTypeIndex)) {
        updatedTypes.push({
          type: resourceTypeIndex,
          rarity: 0.5,
          biomes: [], // Will use default biomes
          minAmount: 1,
          maxAmount: 5
        });
      }
    } else {
      // Remove the resource type
      updatedTypes = updatedTypes.filter(t => t.type !== resourceTypeIndex);
    }

    const newConfig: Partial<WorldConfig> = {
      resourceConfig: {
        ...this.currentConfig.resourceConfig,
        types: updatedTypes
      }
    };

    this.app.updateEngineConfig(newConfig);
    this.notifyParameterChange(newConfig);
  }

  /**
   * Update structure configuration
   */
  private updateStructureConfig(key: string, value: number): void {
    if (!this.app || !this.currentConfig) return;

    const newConfig: Partial<WorldConfig> = {
      structureConfig: {
        ...this.currentConfig.structureConfig,
        [key]: value
      }
    };

    this.app.updateEngineConfig(newConfig);
    this.notifyParameterChange(newConfig);
  }

  /**
   * Update structure type configuration
   */
  private updateStructureTypeConfig(key: string, enabled: boolean): void {
    if (!this.app || !this.currentConfig) return;

    // Map UI checkbox IDs to structure type indices
    const structureTypeMap: Record<string, number> = {
      'enableVillage': 0,  // StructureType.VILLAGE
      'enableRuins': 1,    // StructureType.RUINS
      'enableTower': 2     // StructureType.TOWER
    };

    const structureTypeIndex = structureTypeMap[key];
    if (structureTypeIndex === undefined) return;

    // Update the structure types array
    const currentTypes = this.currentConfig.structureConfig?.types || [];
    let updatedTypes = [...currentTypes];

    if (enabled) {
      // Add the structure type if not already present
      if (!updatedTypes.some(t => t.type === structureTypeIndex)) {
        updatedTypes.push({
          type: structureTypeIndex,
          rarity: 1.0,
          rules: [] // Will use default rules
        });
      }
    } else {
      // Remove the structure type
      updatedTypes = updatedTypes.filter(t => t.type !== structureTypeIndex);
    }

    const newConfig: Partial<WorldConfig> = {
      structureConfig: {
        ...this.currentConfig.structureConfig,
        types: updatedTypes
      }
    };

    this.app.updateEngineConfig(newConfig);
    this.notifyParameterChange(newConfig);
  }

  /**
   * Update water visibility
   */
  private updateWaterVisibility(visible: boolean): void {
    // Emit event through app state system
    if (this.app) {
      this.app.updateState({ showWater: visible } as any);
    }
  }

  /**
   * Update water configuration
   */
  private updateWaterConfig(waterType: 'ocean' | 'lake', property: string, value: number): void {
    // Store water config in app state and emit event
    if (this.app) {
      const event = new CustomEvent('waterConfigChanged', {
        detail: { waterType, property, value }
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Update visibility settings
   */
  private updateVisibility(key: string, value: boolean): void {
    if (!this.app) return;

    // Update app state
    this.app.updateState({ [key]: value });
    
    // Emit visibility change event for WorldViewer to handle
    // The event will be caught by the main app which will update WorldViewer
  }

  /**
   * Update controls from application state
   */
  private updateFromState(state: AppState): void {
    this.currentConfig = state.config;
    // Update UI elements to reflect current state
    // This would sync slider values if state changes externally
  }

  /**
   * Notify parameter change callbacks
   */
  private notifyParameterChange(config: Partial<WorldConfig>): void {
    for (const callback of this.parameterChangeCallbacks) {
      callback(config);
    }
  }

  /**
   * Register parameter change callback
   */
  onParameterChange(callback: ParameterChangeCallback): void {
    this.parameterChangeCallbacks.add(callback);
  }

  /**
   * Register preset selection callback
   */
  onPresetSelect(callback: PresetSelectCallback): void {
    this.presetSelectCallbacks.add(callback);
  }

  /**
   * Load a preset configuration
   */
  loadPreset(presetName: string): void {
    // Try to find in built-in presets
    let preset = PRESETS.find((p: PresetConfig) => p.name === presetName);
    
    // Try to find in custom presets
    if (!preset) {
      preset = this.customPresets.find((p: PresetConfig) => p.name === presetName);
    }

    if (!preset) {
      console.error(`Preset not found: ${presetName}`);
      return;
    }

    // Update description
    const descriptionDiv = document.getElementById('preset-description');
    if (descriptionDiv) {
      descriptionDiv.textContent = preset.description;
    }

    // Apply preset configuration
    if (this.app) {
      this.app.updateEngineConfig(preset.config);
      this.currentConfig = preset.config;
      
      // Update all UI controls to reflect preset values
      this.syncUIWithConfig(preset.config);
      
      // Notify callbacks
      for (const callback of this.presetSelectCallbacks) {
        callback(preset);
      }
    }
  }

  /**
   * Synchronize UI controls with configuration
   */
  private syncUIWithConfig(config: WorldConfig): void {
    // Sync terrain controls
    if (config.terrainConfig) {
      this.updateSliderValue('baseScale', config.terrainConfig.baseScale);
      this.updateSliderValue('octaves', config.terrainConfig.octaves);
      this.updateSliderValue('persistence', config.terrainConfig.persistence);
      this.updateSliderValue('lacunarity', config.terrainConfig.lacunarity);
      this.updateSliderValue('warpStrength', config.terrainConfig.warpStrength);
      this.updateSliderValue('heightMultiplier', config.terrainConfig.heightMultiplier);
      
      if (config.terrainConfig.enable3D !== undefined) {
        this.updateCheckboxValue('enable3D', config.terrainConfig.enable3D);
      }
      if (config.terrainConfig.zScale !== undefined) {
        this.updateSliderValue('zScale', config.terrainConfig.zScale);
      }
    }

    // Sync biome controls
    if (config.biomeConfig) {
      this.updateSliderValue('temperatureScale', config.biomeConfig.temperatureScale);
      this.updateSliderValue('moistureScale', config.biomeConfig.moistureScale);
      this.updateSliderValue('blendRadius', config.biomeConfig.blendRadius);
    }

    // Sync enhanced biome controls
    if (config.enhancedBiomeConfig) {
      const ebc = config.enhancedBiomeConfig;
      if (ebc.enableTransitions !== undefined) {
        this.updateCheckboxValue('enableTransitions', ebc.enableTransitions);
      }
      if (ebc.transitionWidth !== undefined) {
        this.updateSliderValue('transitionWidth', ebc.transitionWidth);
      }
      if (ebc.enableMicroBiomes !== undefined) {
        this.updateCheckboxValue('enableMicroBiomes', ebc.enableMicroBiomes);
      }
      if (ebc.microBiomeFrequency !== undefined) {
        this.updateSliderValue('microBiomeFrequency', ebc.microBiomeFrequency);
      }
      if (ebc.enableElevationBands !== undefined) {
        this.updateCheckboxValue('enableElevationBands', ebc.enableElevationBands);
      }
      if (ebc.snowLineElevation !== undefined) {
        this.updateSliderValue('snowLineElevation', ebc.snowLineElevation);
      }
    }

    // Sync resource controls
    if (config.resourceConfig) {
      if (config.resourceConfig.densityThreshold !== undefined) {
        this.updateSliderValue('densityThreshold', config.resourceConfig.densityThreshold);
      }
    }

    // Sync structure controls
    if (config.structureConfig) {
      if (config.structureConfig.minDistance !== undefined) {
        this.updateSliderValue('minDistance', config.structureConfig.minDistance);
      }
    }
  }

  /**
   * Update slider value and display
   */
  private updateSliderValue(id: string, value: number): void {
    const slider = document.getElementById(id) as HTMLInputElement;
    if (slider) {
      slider.value = value.toString();
      
      // Update value display
      const label = slider.parentElement?.querySelector('label');
      const valueDisplay = label?.querySelector('.slider-value');
      if (valueDisplay) {
        const step = parseFloat(slider.step);
        valueDisplay.textContent = value.toFixed(step < 1 ? 3 : 0);
      }
    }
  }

  /**
   * Update checkbox value without triggering engine config updates.
   * Also updates dependent UI elements (e.g. conditional sliders).
   */
  private updateCheckboxValue(id: string, checked: boolean): void {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    if (!checkbox) return;

    checkbox.checked = checked;

    // Update dependent conditional controls without going through updateBiomeConfig
    switch (id) {
      case 'enableTransitions': {
        const ctrl = document.getElementById('transitionWidth-group');
        if (ctrl) ctrl.style.display = checked ? 'block' : 'none';
        break;
      }
      case 'enableMicroBiomes': {
        const ctrl = document.getElementById('microBiomeFrequency-group');
        if (ctrl) ctrl.style.display = checked ? 'block' : 'none';
        break;
      }
      case 'enableElevationBands': {
        const ctrl = document.getElementById('snowLineElevation-group');
        if (ctrl) ctrl.style.display = checked ? 'block' : 'none';
        break;
      }
      case 'enable3D': {
        const ctrl = document.getElementById('zScale-group');
        if (ctrl) ctrl.style.display = checked ? 'block' : 'none';
        break;
      }
    }
  }

  /**
   * Show dialog to save current configuration as custom preset
   */
  private showSavePresetDialog(): void {
    const name = prompt('Enter a name for this preset:');
    if (!name || name.trim() === '') {
      return;
    }

    const description = prompt('Enter a description for this preset:') || 'Custom preset';

    if (this.currentConfig) {
      const customPreset: PresetConfig = {
        name: name.trim(),
        description: description.trim(),
        config: { ...this.currentConfig }
      };

      // Add to custom presets
      this.customPresets.push(customPreset);

      // Update dropdown
      const select = document.getElementById('preset-select') as HTMLSelectElement;
      if (select) {
        const option = document.createElement('option');
        option.value = customPreset.name;
        option.textContent = `${customPreset.name} (Custom)`;
        option.title = customPreset.description;
        select.appendChild(option);
        select.value = customPreset.name;
      }

      // Save to localStorage
      this.saveCustomPresetsToStorage();

      alert(`Preset "${name}" saved successfully!`);
    }
  }

  /**
   * Save custom presets to localStorage
   */
  private saveCustomPresetsToStorage(): void {
    try {
      localStorage.setItem('customPresets', JSON.stringify(this.customPresets));
    } catch (e) {
      console.error('Failed to save custom presets to localStorage:', e);
    }
  }

  /**
   * Load custom presets from localStorage
   */
  private loadCustomPresetsFromStorage(): void {
    try {
      const stored = localStorage.getItem('customPresets');
      if (stored) {
        this.customPresets = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load custom presets from localStorage:', e);
      this.customPresets = [];
    }
  }

  /**
   * Get all available presets (built-in + custom)
   */
  getPresets(): PresetConfig[] {
    return [...PRESETS, ...this.customPresets];
  }

  /**
   * Collapse the control panel
   */
  collapse(): void {
    this.container?.classList.add('collapsed');
  }

  /**
   * Expand the control panel
   */
  expand(): void {
    this.container?.classList.remove('collapsed');
  }

  /**
   * Toggle control panel visibility
   */
  toggle(): void {
    this.container?.classList.toggle('collapsed');
  }
}
