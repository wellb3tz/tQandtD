/**
 * ControlPanel - UI component for parameter adjustment and feature toggles
 * 
 * Provides interactive controls for all terrain, biome, resource, and structure
 * parameters. Supports real-time updates and collapsible sections.
 */

import { WorldApp, AppState, type ViewerSettings, type WaterSurfaceViewSettings, type SkyViewSettings } from '../core/WorldApp';
import { TERRAIN_TILE_SIZE_METERS, type WorldConfig, type WorldConfigOverrides } from '@engine/index';
import { createWorker, getWorkerUrl } from '../../worker-loader';
import {
  BIOME_SLIDERS,
  CACHE_SIZE_SLIDER,
  RESOURCE_TYPE_TOGGLES,
  STRUCTURE_TYPE_TOGGLES,
  SKY_VIEW_CONTROLS,
  TERRAIN_SLIDERS,
  VIEW_DISTANCE_SLIDER,
  VISIBILITY_TOGGLES,
  WATER_VIEW_CONTROLS,
  RIVER_SPLINE_RESOLUTION_SLIDER,
} from './control-panel/controlSchemas';
import {
  createCheckboxControl,
  createColorControl,
  createSliderControl,
  updateSliderValue,
} from './control-panel/controlElements';
import {
  buildBiomeConfigPatch,
  buildBiomeUpdateConfig,
  buildLakeConfigPatch,
  buildResourceConfigPatch,
  buildResourceTypePatch,
  buildRiverConfigPatch,
  buildStructureConfigPatch,
  buildStructureTypePatch,
  buildTerrainConfigPatch,
} from './control-panel/controlConfigPatches';
import { syncControlsWithConfig, syncVisibilityControls } from './control-panel/controlSync';

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

    // Clear existing controls to prevent duplication on re-initialization
    const containers = [
      ELEMENT_IDS.TERRAIN_CONTROLS,
      ELEMENT_IDS.BIOME_CONTROLS,
      ELEMENT_IDS.RESOURCE_CONTROLS,
      ELEMENT_IDS.WATER_CONTROLS,
      ELEMENT_IDS.ADVANCED_CONTROLS,
      ELEMENT_IDS.VISIBILITY_CONTROLS,
    ];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
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
   * Create terrain parameter controls
   */
  private createTerrainControls(): void {
    const terrainContainer = document.getElementById(ELEMENT_IDS.TERRAIN_CONTROLS);
    if (!terrainContainer) return;

    TERRAIN_SLIDERS.forEach(config => {
      const control = createSliderControl(config, (value) => {
        this.updateTerrainConfig(config.id, value);
      });
      terrainContainer.appendChild(control);
    });

    // 3D noise checkbox
    const enable3DCheckbox = createCheckboxControl({
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
    const zScaleControl = createSliderControl({
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
    const continentalnessCheckbox = createCheckboxControl({
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
    const continentalScaleControl = createSliderControl({
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
    const continentalStrengthControl = createSliderControl({
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
      const control = createSliderControl(config, (value) => {
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
    const transitionsCheckbox = createCheckboxControl({
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
    const transitionWidthControl = createSliderControl({
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
    const elevationBandsCheckbox = createCheckboxControl({
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
    const snowLineControl = createSliderControl({
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
      const control = createCheckboxControl(config, (checked) => {
        this.updateResourceTypeConfig(config.id, checked);
      });
      resourceContainer.appendChild(control);
    });

    const densityControl = createSliderControl({
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
      const control = createCheckboxControl(config, (checked) => {
        this.updateStructureTypeConfig(config.id, checked);
      });
      resourceContainer.appendChild(control);
    });

    const minDistanceControl = createSliderControl({
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
   * Create water rendering controls
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

    const enableLakesCheckbox = createCheckboxControl({
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

    const enableRiversCheckbox = createCheckboxControl({
      id: 'enableRivers',
      label: 'Enable Rivers',
      defaultValue: riversEnabled,
      tooltip: 'Enable terrain-aware rivers that carve channels and flow to ocean.'
    }, (checked) => {
      this.updateRiverConfig('enabled', checked);
    });
    riversSection.appendChild(enableRiversCheckbox);

    const splineResolutionControl = createSliderControl(RIVER_SPLINE_RESOLUTION_SLIDER, (value) => {
      this.updateRiverConfig('splineResolution', value);
    });
    riversSection.appendChild(splineResolutionControl);

    const viewSection = document.createElement('div');
    viewSection.style.marginTop = '24px';
    viewSection.style.marginBottom = '16px';
    viewSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Water Surface View</h4>';
    waterContainer.appendChild(viewSection);

    const colorControl = createColorControl(WATER_VIEW_CONTROLS.color, (color) => {
      this.updateWaterViewConfig('ocean', 'color', parseInt(color.replace('#', '0x')));
    });
    viewSection.appendChild(colorControl);

    const opacityControl = createSliderControl(WATER_VIEW_CONTROLS.opacity, (value) => {
      this.updateWaterViewConfig('ocean', 'opacity', value);
    });
    viewSection.appendChild(opacityControl);

    const shininessControl = createSliderControl(WATER_VIEW_CONTROLS.shininess, (value) => {
      this.updateWaterViewConfig('ocean', 'shininess', value);
    });
    viewSection.appendChild(shininessControl);

    const wavesControl = createCheckboxControl(WATER_VIEW_CONTROLS.enableWaves, (checked) => {
      this.updateWaterViewConfig('ocean', 'enableWaves', checked);
    });
    viewSection.appendChild(wavesControl);

    const waveHeightControl = createSliderControl(WATER_VIEW_CONTROLS.waveHeight, (value) => {
      this.updateWaterViewConfig('ocean', 'waveHeight', value);
    });
    viewSection.appendChild(waveHeightControl);

    const waveSpeedControl = createSliderControl(WATER_VIEW_CONTROLS.waveSpeed, (value) => {
      this.updateWaterViewConfig('ocean', 'waveSpeed', value);
    });
    viewSection.appendChild(waveSpeedControl);
  }

  /**
   * Create advanced feature controls
   */
  private createAdvancedControls(): void {
    const advancedContainer = document.getElementById(ELEMENT_IDS.ADVANCED_CONTROLS);
    if (!advancedContainer) return;

    const viewDistanceControl = createSliderControl(VIEW_DISTANCE_SLIDER, (value) => {
      this.app?.updateAppSettings({ viewDistance: value });
    }, {
      formatValue: value => formatMeters(value * this.getChunkWorldSizeMeters()),
    });
    advancedContainer.appendChild(viewDistanceControl);

    const cacheSizeControl = createSliderControl(CACHE_SIZE_SLIDER, (value) => {
      if (this.app) {
        this.applyEngineConfigChange({ maxCacheSize: value });
      }
    });
    advancedContainer.appendChild(cacheSizeControl);

    const workerCheckbox = createCheckboxControl({
      id: 'enableWorkerPool',
      label: 'Enable Additional Worker (World Generation)',
      defaultValue: false,
      tooltip: 'Offloads world generation (noise, biomes, rivers) to a background worker. The geometry worker is always active for smooth rendering.'
    }, (checked) => {
      this.updateWorkerPoolConfig('enabled', checked);
    });
    advancedContainer.appendChild(workerCheckbox);

    // Atmosphere section
    const atmosphereSection = document.createElement('div');
    atmosphereSection.style.marginTop = '20px';
    atmosphereSection.innerHTML = '<h4 style="font-size: 0.875rem; margin-bottom: 8px; color: var(--text-secondary);">Atmosphere</h4>';
    advancedContainer.appendChild(atmosphereSection);

    const turbidityControl = createSliderControl(SKY_VIEW_CONTROLS.turbidity, (value) => {
      this.updateSkyConfig('turbidity', value);
    });
    atmosphereSection.appendChild(turbidityControl);

    const rayleighControl = createSliderControl(SKY_VIEW_CONTROLS.rayleigh, (value) => {
      this.updateSkyConfig('rayleigh', value);
    });
    atmosphereSection.appendChild(rayleighControl);

    const elevationControl = createSliderControl(SKY_VIEW_CONTROLS.elevation, (value) => {
      this.updateSkyConfig('elevation', value);
    });
    atmosphereSection.appendChild(elevationControl);

    const azimuthControl = createSliderControl(SKY_VIEW_CONTROLS.azimuth, (value) => {
      this.updateSkyConfig('azimuth', value);
    });
    atmosphereSection.appendChild(azimuthControl);
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
      const control = createCheckboxControl(config, (checked) => {
        this.updateVisibility(config.id as keyof ViewerSettings, checked);
      });
      visibilityContainer.appendChild(control);
    });
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

    this.applyEngineConfigChange(buildBiomeUpdateConfig(this.currentConfig, key, value));
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

    const patch = buildResourceTypePatch(this.currentConfig, key, enabled);
    if (patch) this.patchResourceConfig(patch);
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

    const patch = buildStructureTypePatch(this.currentConfig, key, enabled);
    if (patch) this.patchStructureConfig(patch);
  }

  /**
   * Update viewer-only water material settings.
   */
  private updateWaterViewConfig(
    waterType: 'ocean' | 'lake',
    property: keyof WaterSurfaceViewSettings,
    value: number | boolean
  ): void {
    this.app?.updateViewerSettings({
      waterView: {
        [waterType]: {
          [property]: value,
        },
      },
    });
  }

  /**
   * Update sky/atmosphere settings.
   */
  private updateSkyConfig(property: keyof SkyViewSettings, value: number): void {
    this.app?.updateViewerSettings({
      sky: {
        [property]: value,
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
  private updateVisibility(key: keyof ViewerSettings, value: boolean): void {
    if (!this.app) return;

    this.app.updateViewerSettings({ [key]: value });
  }

  /**
   * Update controls from application state
   */
  private updateFromState(state: AppState): void {
    this.currentConfig = state.config;
    updateSliderValue('viewDistance', state.appSettings.viewDistance);
    syncVisibilityControls(state.viewerSettings);
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

    this.applyEngineConfigChange(buildTerrainConfigPatch(this.currentConfig, patch));
  }

  private patchBiomeConfig(patch: Record<string, number | boolean>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange(buildBiomeConfigPatch(this.currentConfig, patch));
  }

  private patchResourceConfig(patch: Record<string, unknown>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange(buildResourceConfigPatch(this.currentConfig, patch));
  }

  private patchStructureConfig(patch: Record<string, unknown>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange(buildStructureConfigPatch(this.currentConfig, patch));
  }

  private patchLakeConfig(patch: Record<string, boolean>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange(buildLakeConfigPatch(this.currentConfig, patch));
  }

  private patchRiverConfig(patch: Record<string, boolean | number>): void {
    if (!this.currentConfig) return;

    this.applyEngineConfigChange(buildRiverConfigPatch(this.currentConfig, patch));
  }

  private getChunkWorldSizeMeters(): number {
    return (this.currentConfig?.chunkSize ?? 32) * TERRAIN_TILE_SIZE_METERS;
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
      syncControlsWithConfig(preset.config);
      
      // Notify callbacks
      for (const callback of this.presetSelectCallbacks) {
        callback(preset);
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

function formatMeters(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} m`;
}

