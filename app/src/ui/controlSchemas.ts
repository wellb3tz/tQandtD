export interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  tooltip?: string;
}

export interface CheckboxConfig {
  id: string;
  label: string;
  defaultValue: boolean;
  tooltip?: string;
}

export const TERRAIN_SLIDERS: SliderConfig[] = [
  { id: 'baseScale', label: 'Base Scale', min: 0.001, max: 0.1, step: 0.001, defaultValue: 0.01, tooltip: 'Controls the overall scale of terrain features' },
  { id: 'octaves', label: 'Octaves', min: 1, max: 8, step: 1, defaultValue: 4, tooltip: 'Number of noise layers for detail' },
  { id: 'persistence', label: 'Persistence', min: 0.1, max: 0.9, step: 0.1, defaultValue: 0.5, tooltip: 'How much each octave contributes' },
  { id: 'lacunarity', label: 'Lacunarity', min: 1.5, max: 3.0, step: 0.1, defaultValue: 2.0, tooltip: 'Frequency multiplier between octaves' },
  { id: 'warpStrength', label: 'Warp Strength', min: 0, max: 100, step: 1, defaultValue: 1, tooltip: 'Domain warping intensity' },
  { id: 'heightMultiplier', label: 'Height Multiplier', min: 0.5, max: 5.0, step: 0.1, defaultValue: 2.0, tooltip: 'Overall terrain height scaling' },
];

export const BIOME_SLIDERS: SliderConfig[] = [
  { id: 'worldTemperatureOffset', label: 'World Temperature', min: -1, max: 1, step: 0.05, defaultValue: 0, tooltip: 'Global temperature offset (cold ↔ hot)' },
  { id: 'worldMoistureOffset', label: 'World Moisture', min: -1, max: 1, step: 0.05, defaultValue: 0, tooltip: 'Global moisture offset (dry ↔ wet)' },
  { id: 'temperatureScale', label: 'Climate Zone Scale', min: 0.0001, max: 0.2, step: 0.001, defaultValue: 0.005, tooltip: 'Size of climate zones (lower = larger biomes)' },
  { id: 'moistureScale', label: 'Moisture Detail Scale', min: 0.0001, max: 0.2, step: 0.001, defaultValue: 0.005, tooltip: 'Scale of moisture variation detail (lower = smoother)' },
  { id: 'blendRadius', label: 'Biome Blend Radius', min: 0.5, max: 20, step: 0.5, defaultValue: 0.5, tooltip: 'Radius (world units) used to sample neighbouring biomes for blending' },
];

export const RESOURCE_TYPE_TOGGLES: CheckboxConfig[] = [
  { id: 'enableIron', label: 'Iron', defaultValue: true },
  { id: 'enableGold', label: 'Gold', defaultValue: true },
  { id: 'enableCoal', label: 'Coal', defaultValue: true },
  { id: 'enableStone', label: 'Stone', defaultValue: true },
  { id: 'enableWood', label: 'Wood', defaultValue: true },
];

export const STRUCTURE_TYPE_TOGGLES: CheckboxConfig[] = [
  { id: 'enableVillage', label: 'Village', defaultValue: true },
  { id: 'enableRuins', label: 'Ruins', defaultValue: true },
  { id: 'enableTower', label: 'Tower', defaultValue: true },
];

export const RESOURCE_TYPE_BY_CONTROL_ID: Record<string, number> = {
  enableIron: 0,
  enableGold: 1,
  enableCoal: 2,
  enableStone: 3,
  enableWood: 4,
};

export const DEFAULT_RESOURCE_BIOMES: Record<number, number[]> = {
  0: [6, 7, 8],
  1: [6, 7],
  2: [3, 4, 5, 6],
  3: [6, 7, 8],
  4: [4, 5, 9],
};

export const STRUCTURE_TYPE_BY_CONTROL_ID: Record<string, number> = {
  enableVillage: 0,
  enableRuins: 1,
  enableTower: 2,
};

export const VIEW_DISTANCE_SLIDER: SliderConfig = {
  id: 'viewDistance',
  label: 'Chunk Radius',
  min: 1,
  max: 8,
  step: 1,
  defaultValue: 3,
  tooltip: 'Number of chunks to keep active around the camera (higher = more visible terrain, lower performance)',
};

export const CACHE_SIZE_SLIDER: SliderConfig = {
  id: 'maxCacheSize',
  label: 'Chunk Cache',
  min: 100,
  max: 2000,
  step: 100,
  defaultValue: 1000,
  tooltip: 'Maximum number of chunks to keep in memory. Higher values improve performance when revisiting areas.',
};

export const WATER_VIEW_CONTROLS = {
  color: {
    id: 'waterColor',
    label: 'Water Color',
    defaultValue: '#1e90ff',
    tooltip: 'Color of water surface',
  },
  opacity: {
    id: 'waterOpacity',
    label: 'Water Opacity',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.7,
    tooltip: 'Transparency of water (0 = transparent, 1 = opaque)',
  },
  shininess: {
    id: 'waterShininess',
    label: 'Water Shininess',
    min: 0,
    max: 100,
    step: 5,
    defaultValue: 30,
    tooltip: 'Shininess of water surface',
  },
  enableWaves: {
    id: 'waterEnableWaves',
    label: 'Ocean Waves',
    defaultValue: true,
    tooltip: 'Animate ocean surface waves',
  },
  waveHeight: {
    id: 'waterWaveHeight',
    label: 'Wave Height',
    min: 0,
    max: 1.25,
    step: 0.05,
    defaultValue: 0.65,
    tooltip: 'Vertical height of ocean waves',
  },
  waveSpeed: {
    id: 'waterWaveSpeed',
    label: 'Wave Speed',
    min: 0,
    max: 3,
    step: 0.05,
    defaultValue: 1.05,
    tooltip: 'Animation speed of ocean waves',
  },
} as const;

export const SKY_VIEW_CONTROLS = {
  turbidity: {
    id: 'skyTurbidity',
    label: 'Turbidity',
    min: 1,
    max: 20,
    step: 0.5,
    defaultValue: 2,
    tooltip: 'Haziness of the sky (1 = clear, 20 = very hazy)',
  },
  rayleigh: {
    id: 'skyRayleigh',
    label: 'Rayleigh',
    min: 0,
    max: 4,
    step: 0.1,
    defaultValue: 0.5,
    tooltip: 'Atmospheric scattering strength (higher = bluer sky)',
  },
  elevation: {
    id: 'skyElevation',
    label: 'Sun Elevation',
    min: 0,
    max: 90,
    step: 1,
    defaultValue: 45,
    tooltip: 'Height of the sun above the horizon in degrees',
  },
  azimuth: {
    id: 'skyAzimuth',
    label: 'Sun Azimuth',
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 150,
    tooltip: 'Horizontal direction of the sun in degrees (0 = North, 90 = East, 180 = South, 270 = West)',
  },
} as const;

export const VISIBILITY_TOGGLES: CheckboxConfig[] = [
  { id: 'showTerrain', label: 'Terrain Layer', defaultValue: true },
  { id: 'showBiomes', label: 'Biome Colors', defaultValue: true },
  { id: 'showTemperature', label: 'Temperature Map', defaultValue: false, tooltip: 'Show temperature heatmap overlay on terrain (blue=cold, red=hot)' },
  { id: 'showWater', label: 'Water Layer', defaultValue: true },
  { id: 'showResources', label: 'Resource Markers', defaultValue: false },
  { id: 'showStructures', label: 'Structure Markers', defaultValue: false },
  { id: 'showChunkBoundaries', label: 'Chunk Grid', defaultValue: false },
  { id: 'showWireframe', label: 'Wireframe View', defaultValue: false },
  { id: 'terrainTexturesEnabled', label: 'Surface Textures', defaultValue: true, tooltip: 'Toggle terrain texture maps while keeping the underlying colors' },
  { id: 'fogOfWarEnabled', label: 'Exploration Mask', defaultValue: false },
];
