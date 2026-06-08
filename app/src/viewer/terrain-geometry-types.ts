import { BiomeType } from '@engine/index';

export type TerrainSurfaceKey =
  | 'plains'
  | 'desert'
  | 'beach'
  | 'mountainRock'
  | 'snow'
  | 'forestFloor'
  | 'dryGrass'
  | 'swampMud'
  | 'volcanicRock'
  | 'ice'
  | 'riverbed';

export function selectTerrainSurfaceKey(
  biome: BiomeType,
  elevation: number,
  slope: number,
  moisture: number = 0,
  temperature: number = 0,
): TerrainSurfaceKey {
  const wetness = clamp01(moisture);

  if ((biome === BiomeType.MOUNTAIN || biome === BiomeType.GLACIER) && elevation >= 0.78 && slope < 0.55 && temperature < 0.3) {
    return 'snow';
  }

  if (biome === BiomeType.VOLCANIC) {
    return 'volcanicRock';
  }

  if (slope >= 0.6 || biome === BiomeType.MOUNTAIN) {
    return biome === BiomeType.GLACIER && wetness > 0.45 ? 'ice' : 'mountainRock';
  }

  if (biome === BiomeType.DESERT) {
    if (wetness > 0.7 && elevation < 0.5) {
      return 'beach';
    }
    return 'desert';
  }

  if (biome === BiomeType.SAVANNA) {
    if (wetness > 0.72 && elevation < 0.55) {
      return 'swampMud';
    }
    if (wetness > 0.42) {
      return 'plains';
    }
    return 'dryGrass';
  }

  if (biome === BiomeType.BEACH) {
    if (temperature < -0.55) {
      return wetness > 0.35 ? 'ice' : 'snow';
    }

    if (temperature < -0.25) {
      return wetness > 0.55 ? 'ice' : 'snow';
    }

    return wetness > 0.55 ? 'swampMud' : 'beach';
  }

  if (biome === BiomeType.GLACIER) {
    return 'ice';
  }

  if (biome === BiomeType.TUNDRA) {
    return wetness > 0.72 ? 'ice' : 'snow';
  }

  if (biome === BiomeType.SWAMP) {
    return 'swampMud';
  }

  if (biome === BiomeType.FOREST || biome === BiomeType.TAIGA || biome === BiomeType.RAINFOREST) {
    if (wetness > 0.74) {
      return 'swampMud';
    }

    if (wetness > 0.42 || elevation < 0.42) {
      return 'forestFloor';
    }

    return wetness < 0.1 && elevation > 0.5 ? 'dryGrass' : 'forestFloor';
  }

  if (wetness > 0.74 && elevation < 0.5) {
    return 'swampMud';
  }

  if (wetness > 0.45 && elevation < 0.58) {
    return 'forestFloor';
  }

  if (wetness < 0.22 && elevation > 0.52) {
    return 'dryGrass';
  }

  return 'plains';
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
