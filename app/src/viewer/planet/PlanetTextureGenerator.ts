import { NoiseEngine } from '@engine/core/noise';
import type { NoiseConfig } from '@engine/core/noise';

/**
 * Color palette for planet biomes (RGB tuples, 0-255).
 */
const BIOME_COLORS: Record<string, [number, number, number]> = {
  ocean: [20, 60, 120],
  deepOcean: [10, 40, 90],
  beach: [210, 190, 140],
  desert: [230, 210, 160],
  plains: [100, 160, 70],
  forest: [40, 110, 40],
  taiga: [80, 120, 90],
  tundra: [180, 190, 200],
  mountain: [120, 110, 100],
  savanna: [180, 160, 80],
  swamp: [80, 100, 60],
  rainforest: [30, 100, 30],
  volcanic: [80, 50, 40],
  glacier: [240, 250, 255],
};

interface PlanetTextureResult {
  texture: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Generates a procedural equirectangular planet texture using 3D simplex noise.
 * Sampling 3D noise on a sphere eliminates pole artifacts that 2D noise creates.
 * The texture is deterministic based on the provided seed.
 */
export class PlanetTextureGenerator {
  private readonly seed: number;
  private readonly elevationNoise: NoiseEngine;
  private readonly moistureNoise: NoiseEngine;
  private readonly tempNoise: NoiseEngine;

  constructor(seed: number) {
    this.seed = seed;
    this.elevationNoise = new NoiseEngine(seed + 42);
    this.moistureNoise = new NoiseEngine(seed + 123);
    this.tempNoise = new NoiseEngine(seed + 999);
  }

  /**
   * Generate the planet surface texture.
   * @param width  Texture width in pixels (default 1024)
   * @param height Texture height in pixels (default 512)
   */
  generate(width = 1024, height = 512): PlanetTextureResult {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const elevationConfig: NoiseConfig = {
      octaves: 5,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 1.8,
    };

    const tempConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 1.2,
    };

    const moistureConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 1.5,
    };

    for (let py = 0; py < height; py++) {
      const v = py / (height - 1);
      const lat = (v - 0.5) * Math.PI; // -PI/2 .. PI/2

      // Latitude-based temperature bias: poles are cold, equator is hot
      const latTempBias = -Math.cos(2 * lat); // -1 at equator, +1 at poles
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      for (let px = 0; px < width; px++) {
        const u = px / (width - 1);
        const lon = (u - 0.5) * 2 * Math.PI;

        // Unit-sphere coordinates for 3D noise (no pole artifacts)
        const x = cosLat * Math.cos(lon);
        const y = sinLat;
        const z = cosLat * Math.sin(lon);

        // Elevation: 3D fbm sampled on the sphere surface
        const elevation = this.elevationNoise.fbm3D(
          x * 2.0,
          y * 2.0,
          z * 2.0,
          elevationConfig
        );

        // Temperature: latitude bias + 3D noise variation
        const tempNoise = this.tempNoise.fbm3D(
          x * 1.5 + 100,
          y * 1.5 + 100,
          z * 1.5 + 100,
          tempConfig
        );
        const temperature = Math.max(-1, Math.min(1, latTempBias + tempNoise * 0.4));

        // Moisture: 3D noise
        const moisture = this.moistureNoise.fbm3D(
          x * 1.8 + 200,
          y * 1.8 + 200,
          z * 1.8 + 200,
          moistureConfig
        );

        const [r, g, b] = this.pickBiomeColor(elevation, temperature, moisture);

        const idx = (py * width + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return { texture: canvas, width, height };
  }

  /**
   * Pick a biome color based on elevation, temperature, and moisture.
   */
  private pickBiomeColor(
    elevation: number,
    temperature: number,
    moisture: number
  ): [number, number, number] {
    // Normalize elevation from [-1, 1] to roughly [0, 1] with bias
    const height = (elevation + 1) * 0.5;
    const waterLevel = 0.38;

    if (height < waterLevel - 0.06) {
      return BIOME_COLORS.deepOcean;
    }
    if (height < waterLevel) {
      return BIOME_COLORS.ocean;
    }
    if (height < waterLevel + 0.05) {
      return BIOME_COLORS.beach;
    }
    if (height > 0.78) {
      if (height > 0.92 && temperature > 0.1) {
        return BIOME_COLORS.volcanic;
      }
      return temperature < -0.3 ? BIOME_COLORS.glacier : BIOME_COLORS.mountain;
    }

    // Temperature / moisture classification (simplified from BiomeSystem)
    if (temperature < -0.5) {
      return moisture > 0.1 ? BIOME_COLORS.taiga : BIOME_COLORS.tundra;
    }
    if (temperature < -0.3) {
      return moisture > 0.2 ? BIOME_COLORS.taiga : BIOME_COLORS.tundra;
    }
    if (temperature > 0.5) {
      if (moisture > 0.4) return BIOME_COLORS.rainforest;
      if (moisture < -0.2) return BIOME_COLORS.desert;
      return BIOME_COLORS.savanna;
    }
    if (temperature > 0.3) {
      if (moisture < -0.2) return BIOME_COLORS.desert;
      if (moisture > 0.5) return BIOME_COLORS.rainforest;
      return BIOME_COLORS.plains;
    }

    // Temperate
    if (moisture > 0.5) return BIOME_COLORS.swamp;
    if (moisture > 0.2) return BIOME_COLORS.forest;
    return BIOME_COLORS.plains;
  }
}
