import type { ViewerSettings } from '../../core/WorldApp';
import type { WorldConfig } from '@engine/index';
import { updateCheckboxValue, updateSliderValue } from './controlElements';

export function syncVisibilityControls(viewerSettings: ViewerSettings): void {
  updateCheckboxValue('showTerrain', viewerSettings.showTerrain);
  updateCheckboxValue('showFoliage', viewerSettings.showFoliage);
  updateCheckboxValue('showBiomes', viewerSettings.showBiomes);
  updateCheckboxValue('showTemperature', viewerSettings.showTemperature);
  updateCheckboxValue('showWater', viewerSettings.showWater);
  updateCheckboxValue('showResources', viewerSettings.showResources);
  updateCheckboxValue('showStructures', viewerSettings.showStructures);
  updateCheckboxValue('showChunkBoundaries', viewerSettings.showChunkBoundaries);
  updateCheckboxValue('showWireframe', viewerSettings.showWireframe);
  updateCheckboxValue('terrainTexturesEnabled', viewerSettings.terrainTexturesEnabled);
  updateCheckboxValue('fogOfWarEnabled', viewerSettings.fogOfWarEnabled);
}

export function syncControlsWithConfig(config: WorldConfig): void {
  if (config.terrainConfig) {
    updateSliderValue('baseScale', config.terrainConfig.baseScale);
    updateSliderValue('octaves', config.terrainConfig.octaves);
    updateSliderValue('persistence', config.terrainConfig.persistence);
    updateSliderValue('lacunarity', config.terrainConfig.lacunarity);
    updateSliderValue('warpStrength', config.terrainConfig.warpStrength);
    updateSliderValue('heightMultiplier', config.terrainConfig.heightMultiplier);

    if (config.terrainConfig.enable3D !== undefined) {
      updateCheckboxValue('enable3D', config.terrainConfig.enable3D);
    }
    if (config.terrainConfig.zScale !== undefined) {
      updateSliderValue('zScale', config.terrainConfig.zScale);
    }
    if (config.terrainConfig.enableContinentalness !== undefined) {
      updateCheckboxValue('enableContinentalness', config.terrainConfig.enableContinentalness);
      setControlDisplay('continentalScale-group', config.terrainConfig.enableContinentalness);
      setControlDisplay('continentalStrength-group', config.terrainConfig.enableContinentalness);
    }
    if (config.terrainConfig.continentalScale !== undefined) {
      updateSliderValue('continentalScale', config.terrainConfig.continentalScale);
    }
    if (config.terrainConfig.continentalStrength !== undefined) {
      updateSliderValue('continentalStrength', config.terrainConfig.continentalStrength);
    }
  }

  if (config.biomeConfig) {
    updateSliderValue('temperatureScale', config.biomeConfig.temperatureScale);
    updateSliderValue('moistureScale', config.biomeConfig.moistureScale);
    updateSliderValue('blendRadius', config.biomeConfig.blendRadius);
  }

  if (config.enhancedBiomeConfig) {
    const ebc = config.enhancedBiomeConfig;
    if (ebc.worldTemperatureOffset !== undefined) {
      updateSliderValue('worldTemperatureOffset', ebc.worldTemperatureOffset);
    }
    if (ebc.worldMoistureOffset !== undefined) {
      updateSliderValue('worldMoistureOffset', ebc.worldMoistureOffset);
    }
    if (ebc.enableTransitions !== undefined) {
      updateCheckboxValue('enableTransitions', ebc.enableTransitions);
    }
    if (ebc.transitionWidth !== undefined) {
      updateSliderValue('transitionWidth', ebc.transitionWidth);
    }
    if (ebc.enableElevationBands !== undefined) {
      updateCheckboxValue('enableElevationBands', ebc.enableElevationBands);
    }
    if (ebc.snowLineElevation !== undefined) {
      updateSliderValue('snowLineElevation', ebc.snowLineElevation);
    }
  }

  if (config.resourceConfig?.densityThreshold !== undefined) {
    updateSliderValue('densityThreshold', config.resourceConfig.densityThreshold);
  }

  if (config.structureConfig?.minDistance !== undefined) {
    updateSliderValue('minDistance', config.structureConfig.minDistance);
  }
}

function setControlDisplay(id: string, visible: boolean): void {
  const control = document.getElementById(id);
  if (control) {
    control.style.display = visible ? 'block' : 'none';
  }
}
