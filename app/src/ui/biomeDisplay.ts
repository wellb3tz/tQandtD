import { BiomeType } from '@engine/index';
import { getBiomeColor } from '../viewer/materials';

export function getBiomeDisplayName(biome: number): string {
  const enumName = BiomeType[biome as BiomeType];
  if (!enumName) {
    return 'Unknown';
  }

  return enumName
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getBiomeRgb255(biome: number): [number, number, number] {
  const color = getBiomeColor(biome as BiomeType);
  return [
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
  ];
}

export function getBiomeCssColor(biome: number): string {
  const [r, g, b] = getBiomeRgb255(biome);
  return `rgb(${r},${g},${b})`;
}
