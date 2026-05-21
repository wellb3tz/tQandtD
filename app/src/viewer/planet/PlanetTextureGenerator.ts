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
  heightMap: HTMLCanvasElement;
  normalMap: HTMLCanvasElement;
  roughnessMap: HTMLCanvasElement;
  cloudTexture: HTMLCanvasElement;
  width: number;
  height: number;
}

interface PlanetSample {
  color: [number, number, number];
  height: number;
  roughness: number;
  cloud: number;
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
  private readonly cloudNoise: NoiseEngine;

  constructor(seed: number) {
    this.seed = seed;
    this.elevationNoise = new NoiseEngine(seed + 42);
    this.moistureNoise = new NoiseEngine(seed + 123);
    this.tempNoise = new NoiseEngine(seed + 999);
    this.cloudNoise = new NoiseEngine(seed + 2027);
  }

  /**
   * Generate the planet surface texture.
   * @param width  Texture width in pixels (default 1024)
   * @param height Texture height in pixels (default 512)
   */
  generate(width = 1024, height = 512): PlanetTextureResult {
    const canvas = document.createElement('canvas');
    const heightCanvas = document.createElement('canvas');
    const normalCanvas = document.createElement('canvas');
    const roughnessCanvas = document.createElement('canvas');
    const cloudCanvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    heightCanvas.width = width;
    heightCanvas.height = height;
    normalCanvas.width = width;
    normalCanvas.height = height;
    roughnessCanvas.width = width;
    roughnessCanvas.height = height;
    cloudCanvas.width = width;
    cloudCanvas.height = height;

    const ctx = canvas.getContext('2d')!;
    const heightCtx = heightCanvas.getContext('2d')!;
    const normalCtx = normalCanvas.getContext('2d')!;
    const roughnessCtx = roughnessCanvas.getContext('2d')!;
    const cloudCtx = cloudCanvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    const heightImageData = heightCtx.createImageData(width, height);
    const normalImageData = normalCtx.createImageData(width, height);
    const roughnessImageData = roughnessCtx.createImageData(width, height);
    const cloudImageData = cloudCtx.createImageData(width, height);
    const data = imageData.data;
    const heightData = heightImageData.data;
    const roughnessData = roughnessImageData.data;
    const cloudData = cloudImageData.data;
    const heights = new Float32Array(width * height);

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

        const cloudNoise = this.cloudNoise.fbm3D(
          x * 3.4 + 300,
          y * 3.4 + 300,
          z * 3.4 + 300,
          {
            octaves: 5,
            persistence: 0.55,
            lacunarity: 2.15,
            scale: 1.0,
          }
        );

        const sample = this.pickSurfaceSample(elevation, temperature, moisture, cloudNoise, lat);

        const idx = (py * width + px) * 4;
        heights[py * width + px] = sample.height;
        data[idx] = sample.color[0];
        data[idx + 1] = sample.color[1];
        data[idx + 2] = sample.color[2];
        data[idx + 3] = 255;

        const heightValue = Math.round(sample.height * 255);
        heightData[idx] = heightValue;
        heightData[idx + 1] = heightValue;
        heightData[idx + 2] = heightValue;
        heightData[idx + 3] = 255;

        const roughnessValue = Math.round(sample.roughness * 255);
        roughnessData[idx] = roughnessValue;
        roughnessData[idx + 1] = roughnessValue;
        roughnessData[idx + 2] = roughnessValue;
        roughnessData[idx + 3] = 255;

        const cloudAlpha = Math.round(sample.cloud * 205);
        cloudData[idx] = 242;
        cloudData[idx + 1] = 248;
        cloudData[idx + 2] = 255;
        cloudData[idx + 3] = cloudAlpha;
      }
    }

    this.populateNormalMap(normalImageData.data, heights, width, height);

    ctx.putImageData(imageData, 0, 0);
    heightCtx.putImageData(heightImageData, 0, 0);
    normalCtx.putImageData(normalImageData, 0, 0);
    roughnessCtx.putImageData(roughnessImageData, 0, 0);
    cloudCtx.putImageData(cloudImageData, 0, 0);
    return {
      texture: canvas,
      heightMap: heightCanvas,
      normalMap: normalCanvas,
      roughnessMap: roughnessCanvas,
      cloudTexture: cloudCanvas,
      width,
      height,
    };
  }

  /**
   * Pick a surface sample based on elevation, temperature, moisture, and cloud cover.
   */
  private pickSurfaceSample(
    elevation: number,
    temperature: number,
    moisture: number,
    cloudNoise: number,
    lat: number
  ): PlanetSample {
    // Normalize elevation from [-1, 1] to roughly [0, 1] with bias
    const height = (elevation + 1) * 0.5;
    const waterLevel = 0.38;
    const polarIce = Math.max(0, (Math.abs(lat) - 1.05) / 0.45);
    const cloud = this.smoothstep(0.2, 0.74, cloudNoise + moisture * 0.22 - polarIce * 0.2);
    const variation = 0.9 + Math.max(-0.12, Math.min(0.12, elevation * 0.08 + moisture * 0.05));

    if (height < waterLevel - 0.06) {
      return {
        color: this.tint(BIOME_COLORS.deepOcean, 0.85 + height * 0.35),
        height: 0.03,
        roughness: 0.35,
        cloud,
      };
    }
    if (height < waterLevel) {
      return {
        color: this.tint(BIOME_COLORS.ocean, 0.9 + height * 0.25),
        height: 0.08,
        roughness: 0.3,
        cloud,
      };
    }
    if (height < waterLevel + 0.05) {
      return {
        color: this.tint(BIOME_COLORS.beach, variation),
        height: 0.28,
        roughness: 0.76,
        cloud,
      };
    }

    if (polarIce > 0.25 || (temperature < -0.55 && height > waterLevel + 0.05)) {
      return {
        color: this.mix(this.tint(BIOME_COLORS.glacier, variation), [205, 225, 238], polarIce * 0.35),
        height: 0.62 + Math.min(0.2, polarIce * 0.2),
        roughness: 0.58,
        cloud,
      };
    }

    if (height > 0.78) {
      if (height > 0.92 && temperature > 0.1) {
        return {
          color: this.tint(BIOME_COLORS.volcanic, variation * 0.92),
          height: 0.98,
          roughness: 0.92,
          cloud: cloud * 0.45,
        };
      }
      return {
        color: this.tint(temperature < -0.3 ? BIOME_COLORS.glacier : BIOME_COLORS.mountain, variation),
        height: 0.78 + Math.min(0.22, (height - 0.78) * 1.1),
        roughness: 0.95,
        cloud: cloud * 0.7,
      };
    }

    // Temperature / moisture classification (simplified from BiomeSystem)
    let color: [number, number, number];
    let roughness = 0.82;
    if (temperature < -0.5) {
      color = moisture > 0.1 ? BIOME_COLORS.taiga : BIOME_COLORS.tundra;
      roughness = 0.74;
    } else if (temperature < -0.3) {
      color = moisture > 0.2 ? BIOME_COLORS.taiga : BIOME_COLORS.tundra;
      roughness = 0.76;
    } else if (temperature > 0.5) {
      if (moisture > 0.4) {
        color = BIOME_COLORS.rainforest;
        roughness = 0.9;
      } else if (moisture < -0.2) {
        color = BIOME_COLORS.desert;
        roughness = 0.68;
      } else {
        color = BIOME_COLORS.savanna;
        roughness = 0.78;
      }
    } else if (temperature > 0.3) {
      if (moisture < -0.2) {
        color = BIOME_COLORS.desert;
        roughness = 0.68;
      } else if (moisture > 0.5) {
        color = BIOME_COLORS.rainforest;
        roughness = 0.9;
      } else {
        color = BIOME_COLORS.plains;
      }
    } else if (moisture > 0.5) {
      color = BIOME_COLORS.swamp;
      roughness = 0.86;
    } else if (moisture > 0.2) {
      color = BIOME_COLORS.forest;
      roughness = 0.88;
    } else {
      color = BIOME_COLORS.plains;
    }

    return {
      color: this.tint(color, variation),
      height: 0.35 + Math.max(0, height - waterLevel) * 0.62,
      roughness,
      cloud,
    };
  }

  private populateNormalMap(
    normalData: Uint8ClampedArray,
    heights: Float32Array,
    width: number,
    height: number
  ): void {
    const strength = 5.5;

    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(height - 1, y + 1);
      for (let x = 0; x < width; x++) {
        const x0 = (x - 1 + width) % width;
        const x1 = (x + 1) % width;
        const left = heights[y * width + x0];
        const right = heights[y * width + x1];
        const up = heights[y0 * width + x];
        const down = heights[y1 * width + x];
        const dx = (left - right) * strength;
        const dy = (up - down) * strength;
        const dz = 1;
        const length = Math.hypot(dx, dy, dz) || 1;
        const idx = (y * width + x) * 4;
        normalData[idx] = Math.round((dx / length * 0.5 + 0.5) * 255);
        normalData[idx + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
        normalData[idx + 2] = Math.round((dz / length * 0.5 + 0.5) * 255);
        normalData[idx + 3] = 255;
      }
    }
  }

  private tint(color: [number, number, number], factor: number): [number, number, number] {
    return [
      this.clampColor(color[0] * factor),
      this.clampColor(color[1] * factor),
      this.clampColor(color[2] * factor),
    ];
  }

  private mix(
    a: [number, number, number],
    b: [number, number, number],
    t: number
  ): [number, number, number] {
    const clamped = Math.max(0, Math.min(1, t));
    return [
      this.clampColor(a[0] + (b[0] - a[0]) * clamped),
      this.clampColor(a[1] + (b[1] - a[1]) * clamped),
      this.clampColor(a[2] + (b[2] - a[2]) * clamped),
    ];
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  private clampColor(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
  }
}
