/**
 * ControlPanel - UI component for parameter adjustment and feature toggles
 * 
 * Provides interactive controls for all terrain, biome, resource, and structure
 * parameters. Supports real-time updates and collapsible sections.
 */

import { WorldApp, AppState } from '../core/WorldApp';
import { DEFAULT_RIVER_CONFIG, type WorldConfig, type WorldConfigOverrides } from '@engine/index';
import { createWorker, getWorkerUrl } from '../../worker-loader';
import {
  BIOME_SLIDERS,
  CACHE_SIZE_SLIDER,
  DEFAULT_RESOURCE_BIOMES,
  RESOURCE_TYPE_TOGGLES,
  RESOURCE_TYPE_BY_CONTROL_ID,
  STRUCTURE_TYPE_TOGGLES,
  STRUCTURE_TYPE_BY_CONTROL_ID,
  TERRAIN_SLIDERS,
  VIEW_DISTANCE_SLIDER,
  VISIBILITY_TOGGLES,
  WATER_VIEW_CONTROLS,
  type CheckboxConfig,
  type SliderConfig,
} from './controlSchemas';

/**
 * Parameter change callback type
 */
export type ParameterChangeCallback = (config: WorldConfigOverrides) => void;

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

const ENHANCED_BIOME_FEATURES = new Set([
  'enableTransitions',
  'transitionWidth',
  'enableElevationBands',
  'snowLineElevation',
  'treeLineElevation',
]);

/**
 * Element ID constants for DOM queries
 */
const ELEMENT_IDS = {
  TERRAIN_CONTROLS: 'terrain-controls',
  BIOME_CONTROLS: 'biome-controls',
  RESOURCE_CONTROLS: 'resource-controls',
  WATER_CONTROLS: 'water-controls',
  ADVANCED_CONTROLS: 'advanced-controls',
  VISIBILITY_CONTROLS: 'visibility-controls',
  PRESET_SELECT: 'preset-select',
  PRESET_DESCRIPTION: 'preset-description',
} as const;

/**
 * ControlPanel class - Manages all UI controls for parameter adjustment
 */
export class ControlPanel {
  private app: WorldApp | null = null;
  private container: HTMLElement | null = null;
  private parameterChangeCallbacks: Set<ParameterChangeCallback> = new Set();
  private presetSelectCallbacks: Set<PresetSelectCallback> = new Set();
  private currentConfig: WorldConfig | null = null;
  private customPresets: PresetConfig[] = [];

  /**
   * Initialize the control panel
   */
  initialize(container: HTMLElement, app: WorldApp): void {
    this.container = container;
    this.app = app;
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
    this.createVisibilityToggles();
  }

  /**
   * Calculate decimal places from step size
   */
  private getDecimalPlaces(step: number): number {
    if (step >= 1) return 0;
    
    const stepStr = step.toString();
    const decimalIndex = stepStr.indexOf('.');
    return decimalIndex !== -1 ? stepStr.length - decimalIndex - 1 : 0;
  }

  /**
   * Create terrain parameter controls
   */
  private createTerrainControls(): void {
    const terrainContainer = document.getElementById(ELEMENT_IDS.TERRAIN_CONTROLS);
    if (!terrainContainer) return;

    TERRAIN_SLIDERS.forEach(config => {
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

    // Continental noise section
    const continentalSection = document.createElement('div');
    continentalSection.style.marginTop = '16px';
    continentalSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Continental Shape</h4>';
    terrainContainer.appendChild(continentalSection);

    // Enable continentalness checkbox
    const continentalnessCheckbox = this.createCheckboxControl({
      id: 'enableContinentalness',
      label: 'Enable Continentalness',
      defaultValue: true,
      tooltip: 'Large-scale noise that creates ocean basins and continents'
    }, (checked) => {
      this.updateTerrainConfig('enableContinentalness', checked);
      const scaleCtrl    = document.getElementById('continentalScale-group');
      const strengthCtrl = document.getElementById('continentalStrength-group');
      if (scaleCtrl)    scaleCtrl.style.display    = checked ? 'block' : 'none';
      if (strengthCtrl) strengthCtrl.style.display = checked ? 'block' : 'none';
    });
    terrainContainer.appendChild(continentalnessCheckbox);

    // Continental scale slider
    const continentalScaleControl = this.createSliderControl({
      id: 'continentalScale',
      label: 'Continental Scale',
      min: 0.0005,
      max: 0.008,
      step: 0.0005,
      defaultValue: 0.002,
      tooltip: 'Size of ocean basins and continents (lower = larger)'
    }, (value) => {
      this.updateTerrainConfig('continentalScale', value);
    });
    continentalScaleControl.id = 'continentalScale-group';
    terrainContainer.appendChild(continentalScaleControl);

    // Continental strength slider
    const continentalStrengthControl = this.createSliderControl({
      id: 'continentalStrength',
      label: 'Ocean Coverage',
      min: 0.1,
      max: 0.9,
      step: 0.05,
      defaultValue: 0.45,
      tooltip: 'How much of the world is ocean (higher = more ocean)',
    }, (value) => {
      this.updateTerrainConfig('continentalStrength', value);
    });
    continentalStrengthControl.id = 'continentalStrength-group';
    terrainContainer.appendChild(continentalStrengthControl);
  }

  /**
   * Create biome parameter controls
   */
  private createBiomeControls(): void {
    const biomeContainer = document.getElementById(ELEMENT_IDS.BIOME_CONTROLS);
    if (!biomeContainer) return;

    BIOME_SLIDERS.forEach(config => {
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
      label: 'Enable Biome Blending',
      defaultValue: false,
      tooltip: 'Enable smooth color transitions on biome boundaries'
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
      label: 'Blend Strength',
      min: 0.01,
      max: 50,
      step: 0.01,
      defaultValue: 4,
      tooltip: 'Strength of color blending on biome edges (lower = sharper, higher = smoother)'
    }, (value) => {
      this.updateBiomeConfig('transitionWidth', value);
    });
    transitionWidthControl.style.display = 'none';
    transitionWidthControl.id = 'transitionWidth-group';
    biomeContainer.appendChild(transitionWidthControl);

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
   * Create resource and structure controls
   */
  private createResourceControls(): void {
    const resourceContainer = document.getElementById(ELEMENT_IDS.RESOURCE_CONTROLS);
    if (!resourceContainer) return;

    const resourceTypesSection = document.createElement('div');
    resourceTypesSection.style.marginBottom = '16px';
    resourceTypesSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Resource Types</h4>';
    resourceContainer.appendChild(resourceTypesSection);

    RESOURCE_TYPE_TOGGLES.forEach(config => {
      const control = this.createCheckboxControl(config, (checked) => {
        this.updateResourceTypeConfig(config.id, checked);
      });
      resourceContainer.appendChild(control);
    });

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

    const structureTypesSection = document.createElement('div');
    structureTypesSection.style.marginTop = '24px';
    structureTypesSection.style.marginBottom = '16px';
    structureTypesSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Structure Types</h4>';
    resourceContainer.appendChild(structureTypesSection);

    STRUCTURE_TYPE_TOGGLES.forEach(config => {
      const control = this.createCheckboxControl(config, (checked) => {
        this.updateStructureTypeConfig(config.id, checked);
      });
      resourceContainer.appendChild(control);
    });

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
    const waterContainer = document.getElementById(ELEMENT_IDS.WATER_CONTROLS);
    if (!waterContainer) return;

    const generationSection = document.createElement('div');
    generationSection.style.marginBottom = '20px';
    generationSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Water Generation</h4>';
    waterContainer.appendChild(generationSection);

    const lakesSection = document.createElement('div');
    lakesSection.style.marginBottom = '16px';
    lakesSection.innerHTML = '<h5 style="font-size: 0.8rem; margin-bottom: 8px; color: var(--text-muted, var(--text-secondary));">Lakes</h5>';
    generationSection.appendChild(lakesSection);

    const currentLakeConfig = this.currentConfig?.lakeConfig;
    const lakesEnabled = currentLakeConfig?.enabled ?? true;

    const enableLakesCheckbox = this.createCheckboxControl({
      id: 'enableMultiChunkLakes',
      label: 'Enable Multi-Chunk Lakes',
      defaultValue: lakesEnabled,
      tooltip: 'Enable lake generation. Lakes can span multiple chunks for more natural appearance. Enabled by default.'
    }, (checked) => {
      this.updateLakeConfig('enabled', checked);
      this.updateLakeConfig('useMultiChunk', checked);
    });
    lakesSection.appendChild(enableLakesCheckbox);

    const riversSection = document.createElement('div');
    riversSection.style.marginBottom = '16px';
    riversSection.innerHTML = '<h5 style="font-size: 0.8rem; margin-bottom: 8px; color: var(--text-muted, var(--text-secondary));">Rivers</h5>';
    generationSection.appendChild(riversSection);

    const currentRiverConfig = this.currentConfig?.riverConfig;
    const riversEnabled = currentRiverConfig?.enabled ?? true;

    const enableRiversCheckbox = this.createCheckboxControl({
      id: 'enableRivers',
      label: 'Enable Rivers',
      defaultValue: riversEnabled,
      tooltip: 'Enable terrain-aware rivers that carve channels and flow to ocean.'
    }, (checked) => {
      this.updateRiverConfig('enabled', checked);
    });
    riversSection.appendChild(enableRiversCheckbox);

    const viewSection = document.createElement('div');
    viewSection.style.marginTop = '24px';
    viewSection.style.marginBottom = '16px';
    viewSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Water View</h4>';
    waterContainer.appendChild(viewSection);

    const colorControl = this.createColorControl(WATER_VIEW_CONTROLS.color, (color) => {
      this.updateWaterViewConfig('ocean', 'color', parseInt(color.replace('#', '0x')));
    });
    viewSection.appendChild(colorControl);

    const opacityControl = this.createSliderControl(WATER_VIEW_CONTROLS.opacity, (value) => {
      this.updateWaterViewConfig('ocean', 'opacity', value);
    });
    viewSection.appendChild(opacityControl);

    const shininessControl = this.createSliderControl(WATER_VIEW_CONTROLS.shininess, (value) => {
      this.updateWaterViewConfig('ocean', 'shininess', value);
    });
    viewSection.appendChild(shininessControl);
  }

  /**
   * Create advanced feature controls
   */
  private createAdvancedControls(): void {
    const advancedContainer = document.getElementById(ELEMENT_IDS.ADVANCED_CONTROLS);
    if (!advancedContainer) return;

    const viewDistanceControl = this.createSliderControl(VIEW_DISTANCE_SLIDER, (value) => {
      this.app?.updateAppSettings({ viewDistance: value });
    });
    advancedContainer.appendChild(viewDistanceControl);

    const cacheSizeControl = this.createSliderControl(CACHE_SIZE_SLIDER, (value) => {
      if (this.app) {
        this.applyEngineConfigChange({ maxCacheSize: value });
      }
    });
    advancedContainer.appendChild(cacheSizeControl);

    const workerCheckbox = this.createCheckboxControl({
      id: 'enableWorkerPool',
      label: 'Enable Worker Pool (Multi-threaded)',
      defaultValue: false,
      tooltip: 'Enable multi-threaded chunk generation using Web Workers for better performance. Uses 4 workers by default.'
    }, (checked) => {
      this.updateWorkerPoolConfig('enabled', checked);
    });
    advancedContainer.appendChild(workerCheckbox);
  }

  /**
   * Update Worker Pool configuration
   */
  private updateWorkerPoolConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    if (key === 'enabled') {
      if (value === true) {
        const workerUrl = getWorkerUrl();
        const newConfig: Partial<WorldConfig> = {
          workerPoolConfig: {
            maxWorkers: 4,
            workerScriptUrl: workerUrl,
            createWorker: () => createWorker(),
            taskTimeout: 5000,
          }
        };
        this.applyEngineConfigChange(newConfig);
      } else {
        const newConfig: Partial<WorldConfig> = {
          workerPoolConfig: undefined
        };
        this.applyEngineConfigChange(newConfig);
      }
    } else if (key === 'maxWorkers') {
      const currentWorkerPoolConfig = this.currentConfig.workerPoolConfig;
      if (currentWorkerPoolConfig) {
        const newConfig: Partial<WorldConfig> = {
          workerPoolConfig: {
            ...currentWorkerPoolConfig,
            maxWorkers: value as number
          }
        };
        this.applyEngineConfigChange(newConfig);
      }
    }
  }

  /**
   * Create visibility toggle controls
   */
  private createVisibilityToggles(): void {
    const visibilityContainer = document.getElementById(ELEMENT_IDS.VISIBILITY_CONTROLS);
    if (!visibilityContainer) return;

    VISIBILITY_TOGGLES.forEach(config => {
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
    const decimalPlaces = this.getDecimalPlaces(config.step);
    valueDisplay.textContent = config.defaultValue.toFixed(decimalPlaces);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = config.id;
    slider.min = config.min.toString();
    slider.max = config.max.toString();
    slider.step = config.step.toString();
    slider.value = config.defaultValue.toString();

    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      const decimalPlaces = this.getDecimalPlaces(config.step);
      valueDisplay.textContent = value.toFixed(decimalPlaces);
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

    this.patchTerrainConfig({ [key]: value });
  }

  /**
   * Update biome configuration
   */
  private updateBiomeConfig(key: string, value: number | boolean): void {
    if (!this.app || !this.currentConfig) return;

    if (ENHANCED_BIOME_FEATURES.has(key)) {
      // Update enhancedBiomeConfig
      const currentEnhancedConfig = this.currentConfig.enhancedBiomeConfig || {
        ...this.currentConfig.biomeConfig,
        enableTransitions: true,
        transitionWidth: 10,
        enableElevationBands: false,
        snowLineElevation: 0.8,
        treeLineElevation: 0.75
      };

      this.applyEngineConfigChange({
        enhancedBiomeConfig: {
          ...currentEnhancedConfig,
          [key]: value
        }
      });
    } else {
      this.patchBiomeConfig({ [key]: value });
    }
  }

  /**
   * Update resource configuration
   */
  private updateResourceConfig(key: string, value: number): void {
    if (!this.app || !this.currentConfig) return;

    this.patchResourceConfig({ [key]: value });
  }

  /**
   * Update resource type configuration
   */
  private updateResourceTypeConfig(key: string, enabled: boolean): void {
    if (!this.app || !this.currentConfig) return;

    const resourceTypeIndex = RESOURCE_TYPE_BY_CONTROL_ID[key];
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
          biomes: DEFAULT_RESOURCE_BIOMES[resourceTypeIndex] || [3, 4, 5, 6],
          minAmount: 1,
          maxAmount: 5
        });
      }
    } else {
      // Remove the resource type
      updatedTypes = updatedTypes.filter(t => t.type !== resourceTypeIndex);
    }

    this.patchResourceConfig({ types: updatedTypes });
  }

  /**
   * Update structure configuration
   */
  private updateStructureConfig(key: string, value: number): void {
    if (!this.app || !this.currentConfig) return;

    this.patchStructureConfig({ [key]: value });
  }

  /**
   * Update structure type configuration
   */
  private updateStructureTypeConfig(key: string, enabled: boolean): void {
    if (!this.app || !this.currentConfig) return;

    const structureTypeIndex = STRUCTURE_TYPE_BY_CONTROL_ID[key];
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

    this.patchStructureConfig({ types: updatedTypes });
  }

  /**
   * Update viewer-only water material settings.
   */
  private updateWaterViewConfig(waterType: 'ocean' | 'lake', property: string, value: number): void {
    this.app?.updateViewerSettings({
      waterView: {
        [waterType]: {
          [property]: value,
        },
      },
    });
  }

  /**
   * Update lake configuration
   */
  private updateLakeConfig(property: string, value: boolean): void {
    if (!this.app || !this.currentConfig) {
      console.warn('[ControlPanel] Cannot update lake config - missing app or config');
      return;
    }

    // Create lakeConfig if it doesn't exist
    const currentLakeConfig = this.currentConfig.lakeConfig || {
      enabled: true,
      useMultiChunk: false,
      noiseScale: 0.01,
      noiseThreshold: 0.62,
      minElevation: 0.32,
      maxElevation: 0.72,
      allowedBiomes: [3, 4, 5, 6, 7, 8, 9], // BiomeType values
      maxLakeTiles: 80,
      maxFillDepth: 0.06,
    };

    this.patchLakeConfig({ [property]: value });
  }

  private updateRiverConfig(property: string, value: boolean | number): void {
    if (!this.app || !this.currentConfig) {
      console.warn('[ControlPanel] Cannot update river config - missing app or config');
      return;
    }

    this.patchRiverConfig({ [property]: value });
  }

  /**
   * Update visibility settings
   */
  private updateVisibility(key: string, value: boolean): void {
    if (!this.app) return;

    this.app.updateViewerSettings({ [key]: value });
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
  private notifyParameterChange(config: WorldConfigOverrides): void {
    for (const callback of this.parameterChangeCallbacks) {
      callback(config);
    }
  }

  private applyEngineConfigChange(config: WorldConfigOverrides): void {
    if (!this.app) return;

    this.app.updateEngineConfig(config);
    this.notifyParameterChange(config);
  }

  private patchTerrainConfig(patch: Record<string, number | boolean>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange({
      terrainConfig: {
        ...this.currentConfig.terrainConfig,
        ...patch,
      },
    });
  }

  private patchBiomeConfig(patch: Record<string, number | boolean>): void {
    if (!this.currentConfig) return;

    const newConfig: WorldConfigOverrides = {
      biomeConfig: {
        ...this.currentConfig.biomeConfig,
        ...patch,
      },
    };

    if (this.currentConfig.enhancedBiomeConfig) {
      newConfig.enhancedBiomeConfig = {
        ...this.currentConfig.enhancedBiomeConfig,
        ...patch,
      };
    }

    this.applyEngineConfigChange(newConfig);
  }

  private patchResourceConfig(patch: Record<string, unknown>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange({
      resourceConfig: {
        ...this.currentConfig.resourceConfig,
        ...patch,
      },
    });
  }

  private patchStructureConfig(patch: Record<string, unknown>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange({
      structureConfig: {
        ...this.currentConfig.structureConfig,
        ...patch,
      },
    });
  }

  private patchLakeConfig(patch: Record<string, boolean>): void {
    if (!this.currentConfig) return;

    const currentLakeConfig = this.currentConfig.lakeConfig || {
      enabled: true,
      useMultiChunk: false,
      noiseScale: 0.01,
      noiseThreshold: 0.62,
      minElevation: 0.32,
      maxElevation: 0.72,
      allowedBiomes: [3, 4, 5, 6, 7, 8, 9],
      maxLakeTiles: 80,
      maxFillDepth: 0.06,
    };

    this.applyEngineConfigChange({
      lakeConfig: {
        ...currentLakeConfig,
        ...patch,
      },
    });
  }

  private patchRiverConfig(patch: Record<string, boolean | number>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange({
      riverConfig: {
        ...(this.currentConfig.riverConfig || DEFAULT_RIVER_CONFIG),
        ...patch,
      },
    });
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
    const descriptionDiv = document.getElementById(ELEMENT_IDS.PRESET_DESCRIPTION);
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
      if (config.terrainConfig.enableContinentalness !== undefined) {
        this.updateCheckboxValue('enableContinentalness', config.terrainConfig.enableContinentalness);
        const scaleCtrl    = document.getElementById('continentalScale-group');
        const strengthCtrl = document.getElementById('continentalStrength-group');
        if (scaleCtrl)    scaleCtrl.style.display    = config.terrainConfig.enableContinentalness ? 'block' : 'none';
        if (strengthCtrl) strengthCtrl.style.display = config.terrainConfig.enableContinentalness ? 'block' : 'none';
      }
      if (config.terrainConfig.continentalScale !== undefined) {
        this.updateSliderValue('continentalScale', config.terrainConfig.continentalScale);
      }
      if (config.terrainConfig.continentalStrength !== undefined) {
        this.updateSliderValue('continentalStrength', config.terrainConfig.continentalStrength);
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
    if (!slider) return;
    
    slider.value = value.toString();
    
    // Update value display
    const label = slider.parentElement?.querySelector('label');
    const valueDisplay = label?.querySelector('.slider-value');
    if (valueDisplay) {
      const step = parseFloat(slider.step);
      const decimalPlaces = this.getDecimalPlaces(step);
      valueDisplay.textContent = value.toFixed(decimalPlaces);
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
      case 'enableContinentalness': {
        const scaleCtrl    = document.getElementById('continentalScale-group');
        const strengthCtrl = document.getElementById('continentalStrength-group');
        if (scaleCtrl)    scaleCtrl.style.display    = checked ? 'block' : 'none';
        if (strengthCtrl) strengthCtrl.style.display = checked ? 'block' : 'none';
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
      const select = document.getElementById(ELEMENT_IDS.PRESET_SELECT) as HTMLSelectElement;
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
