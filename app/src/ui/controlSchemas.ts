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
  { id: 'temperatureScale', label: 'Temperature Scale', min: 0.0001, max: 0.05, step: 0.0001, defaultValue: 0.001, tooltip: 'Scale of temperature variation (lower = larger biomes)' },
  { id: 'moistureScale', label: 'Moisture Scale', min: 0.0001, max: 0.05, step: 0.0001, defaultValue: 0.001, tooltip: 'Scale of moisture variation (lower = larger biomes)' },
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
  label: 'View Distance (chunks)',
  min: 1,
  max: 8,
  step: 1,
  defaultValue: 3,
  tooltip: 'Number of chunks to load around camera (higher = more visible terrain, lower performance)',
};

export const CACHE_SIZE_SLIDER: SliderConfig = {
  id: 'maxCacheSize',
  label: 'Cache Size (chunks)',
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
} as const;

export const VISIBILITY_TOGGLES: CheckboxConfig[] = [
  { id: 'showTerrain', label: 'Show Terrain', defaultValue: true },
  { id: 'showBiomes', label: 'Show Biome Colors', defaultValue: true },
  { id: 'showWater', label: 'Show Water Layer', defaultValue: true },
  { id: 'showResources', label: 'Show Resources', defaultValue: false },
  { id: 'showStructures', label: 'Show Structures', defaultValue: false },
  { id: 'showChunkBoundaries', label: 'Show Chunk Boundaries', defaultValue: false },
  { id: 'showWireframe', label: 'Wireframe Mode', defaultValue: false },
  { id: 'terrainTexturesEnabled', label: 'Terrain Textures', defaultValue: true, tooltip: 'Toggle biome surface texture maps while keeping terrain colors' },
  { id: 'fogOfWarEnabled', label: 'Fog of War (Explored Chunks)', defaultValue: false },
  { id: 'skyBackground', label: 'Atmospheric Background', defaultValue: false, tooltip: 'Switch between UI-matched haze and the legacy blue sky' },
];
