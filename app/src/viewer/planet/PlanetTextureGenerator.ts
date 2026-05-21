import { NoiseEngine } from '@engine/core/noise';
import type { NoiseConfig } from '@engine/core/noise';

/**
 * Color palette for planet biomes (RGB tuples, 0-255).
 */
const BIOME_COLORS: Record<string, [number, number, number]> = {
  ocean: [34, 92, 150],
  deepOcean: [14, 58, 112],
  beach: [188, 172, 118],
  desert: [230, 210, 160],
  plains: [100, 160, 70],
  forest: [40, 110, 40],
  taiga: [80, 120, 90],
  tundra: [142, 150, 136],
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
  private readonly iceNoise: NoiseEngine;
  private readonly mountainNoise: NoiseEngine;

  constructor(seed: number) {
    this.seed = seed;
    this.elevationNoise = new NoiseEngine(seed + 42);
    this.moistureNoise = new NoiseEngine(seed + 123);
    this.tempNoise = new NoiseEngine(seed + 999);
    this.cloudNoise = new NoiseEngine(seed + 2027);
    this.iceNoise = new NoiseEngine(seed + 3141);
    this.mountainNoise = new NoiseEngine(seed + 4242);
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

    const continentConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.52,
      lacunarity: 1.9,
      scale: 0.82,
    };

    const elevationDetailConfig: NoiseConfig = {
      octaves: 3,
      persistence: 0.46,
      lacunarity: 2.1,
      scale: 1.15,
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

        // Elevation: low-frequency continental plates with restrained detail.
        const continentElevation = this.elevationNoise.fbm3D(
          x * 1.1,
          y * 1.1,
          z * 1.1,
          continentConfig
        );
        const elevationDetail = this.elevationNoise.fbm3D(
          x * 3.4 + 50,
          y * 3.4 + 50,
          z * 3.4 + 50,
          elevationDetailConfig
        );
        const elevation = Math.max(-1, Math.min(1, continentElevation * 0.86 + elevationDetail * 0.14));

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

        const iceNoise = this.iceNoise.fbm3D(
          x * 5.2 - 180,
          y * 5.2 - 180,
          z * 5.2 - 180,
          {
            octaves: 4,
            persistence: 0.54,
            lacunarity: 2.05,
            scale: 1.0,
          }
        );

        const mountainRelief = this.ridgeFbm3D(
          x * 2.6 + 90,
          y * 2.6 + 90,
          z * 2.6 + 90,
          {
            octaves: 5,
            persistence: 0.52,
            lacunarity: 2.05,
            scale: 1.0,
          }
        );

        const sample = this.pickSurfaceSample(
          elevation,
          temperature,
          moisture,
          cloudNoise,
          iceNoise,
          mountainRelief,
          lat
        );

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
    iceNoise: number,
    mountainRelief: number,
    lat: number
  ): PlanetSample {
    // Normalize elevation from [-1, 1] to roughly [0, 1] with bias
    const height = (elevation + 1) * 0.5;
    const waterLevel = 0.38;
    const absLat = Math.abs(lat);
    const raggedIceEdge = iceNoise * 0.18 + elevation * 0.07 + moisture * 0.04;
    const polarIce = this.smoothstep(1.14 + raggedIceEdge, 1.49 + raggedIceEdge * 0.35, absLat);
    const cloud = this.smoothstep(0.2, 0.74, cloudNoise + moisture * 0.22 - polarIce * 0.2);
    const variation = 0.9 + Math.max(-0.12, Math.min(0.12, elevation * 0.08 + moisture * 0.05));
    const landMask = this.smoothstep(waterLevel + 0.02, waterLevel + 0.18, height);
    const mountainMask = this.smoothstep(0.58, 0.86, mountainRelief) * landMask * (1 - polarIce * 0.7);
    const ruggedHeight = mountainMask * (0.14 + Math.max(0, height - 0.55) * 0.16);

    if (polarIce > 0.72) {
      const seaIce = height < waterLevel ? 0.22 : 0;
      return {
        color: this.mix(
          this.tint(BIOME_COLORS.glacier, variation),
          [205, 225, 238],
          Math.min(0.34, polarIce * 0.3 + seaIce)
        ),
        height: height < waterLevel
          ? 0.18 + polarIce * 0.1
          : 0.58 + Math.min(0.22, polarIce * 0.22),
        roughness: height < waterLevel ? 0.42 : 0.58,
        cloud,
      };
    }

    if (height < waterLevel - 0.06) {
      const depth = Math.max(0, Math.min(1, (waterLevel - height) / waterLevel));
      return {
        color: this.mix(BIOME_COLORS.ocean, BIOME_COLORS.deepOcean, depth * 0.72),
        height: 0.03,
        roughness: 0.22,
        cloud,
      };
    }
    if (height < waterLevel) {
      const coast = this.smoothstep(waterLevel - 0.06, waterLevel, height);
      return {
        color: this.mix(BIOME_COLORS.ocean, [58, 122, 168], coast * 0.35),
        height: 0.08,
        roughness: 0.24,
        cloud,
      };
    }
    if (height < waterLevel + 0.018) {
      const coast = this.smoothstep(waterLevel, waterLevel + 0.018, height);
      return {
        color: this.mix(
          this.tint(BIOME_COLORS.beach, variation * 0.92),
          this.tint(BIOME_COLORS.plains, variation * 0.94),
          coast * 0.55
        ),
        height: 0.24,
        roughness: 0.72,
        cloud,
      };
    }

    if (polarIce > 0.62 || (polarIce > 0.28 && temperature < -0.64 && height > waterLevel + 0.08)) {
      return {
        color: this.mix(
          this.tint(BIOME_COLORS.glacier, variation),
          [205, 225, 238],
          Math.min(0.32, polarIce * 0.28)
        ),
        height: 0.58 + Math.min(0.22, polarIce * 0.22),
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
      const coldPeak = temperature < -0.5 ? this.smoothstep(0.86, 0.98, height + ruggedHeight) * 0.38 : 0;
      return {
        color: this.mix(
          this.tint(BIOME_COLORS.mountain, variation),
          this.tint(BIOME_COLORS.glacier, variation),
          coldPeak
        ),
        height: Math.min(1, 0.78 + Math.min(0.22, (height - 0.78) * 1.1) + ruggedHeight),
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

    const mountainBlend = Math.min(0.72, mountainMask * 0.85);
    const surfaceColor = this.mix(this.tint(color, variation), this.tint(BIOME_COLORS.mountain, variation), mountainBlend);

    return {
      color: surfaceColor,
      height: Math.min(1, 0.35 + Math.max(0, height - waterLevel) * 0.62 + ruggedHeight),
      roughness: Math.min(0.98, roughness + mountainMask * 0.12),
      cloud,
    };
  }

  private ridgeFbm3D(x: number, y: number, z: number, config: NoiseConfig): number {
    let total = 0;
    let frequency = config.scale;
    let amplitude = 1;
    let maxValue = 0;
    let previous = 1;

    for (let i = 0; i < config.octaves; i++) {
      const folded = 1 - Math.abs(this.mountainNoise.noise3D(x * frequency, y * frequency, z * frequency));
      const ridge = folded * folded;
      total += ridge * amplitude * previous;
      maxValue += amplitude;
      previous = ridge;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    return maxValue > 0 ? total / maxValue : 0;
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
