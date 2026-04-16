/**
 * Unit tests for water configuration validation
 */

import { describe, it, expect, vi } from 'vitest';
import { validateWaterConfig, DEFAULT_WATER_CONFIG } from './config';
import type { WaterConfig } from './types';

describe('validateWaterConfig', () => {
  it('should return default configuration when no config provided', () => {
    const config = validateWaterConfig();
    
    expect(config.enabled).toBe(true);
    expect(config.seaLevel).toBe(0.3);
    expect(config.ocean.color).toBe(0x1e90ff);
    expect(config.ocean.opacity).toBe(0.6);
    expect(config.river.color).toBe(0x4682b4);
    expect(config.lake.color).toBe(0x4169e1);
  });

  it('should preserve valid configuration values', () => {
    const input: Partial<WaterConfig> = {
      enabled: false,
      seaLevel: 0.5,
      ocean: {
        color: 0xff0000,
        opacity: 0.8,
        shininess: 50,
        enableWaves: true,
        waveHeight: 1.0,
        waveSpeed: 2.0,
      },
    };

    const config = validateWaterConfig(input);
    
    expect(config.enabled).toBe(false);
    expect(config.seaLevel).toBe(0.5);
    expect(config.ocean.color).toBe(0xff0000);
    expect(config.ocean.opacity).toBe(0.8);
    expect(config.ocean.shininess).toBe(50);
    expect(config.ocean.enableWaves).toBe(true);
  });

  it('should clamp ocean opacity to [0, 1] range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config1 = validateWaterConfig({
      ocean: { opacity: -0.5 } as any,
    });
    expect(config1.ocean.opacity).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ocean opacity -0.5 out of range')
    );

    consoleWarnSpy.mockClear();

    const config2 = validateWaterConfig({
      ocean: { opacity: 1.5 } as any,
    });
    expect(config2.ocean.opacity).toBe(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ocean opacity 1.5 out of range')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should clamp shininess to [0, 100] range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config1 = validateWaterConfig({
      ocean: { shininess: -10 } as any,
    });
    expect(config1.ocean.shininess).toBe(0);

    const config2 = validateWaterConfig({
      river: { shininess: 150 } as any,
    });
    expect(config2.river.shininess).toBe(100);

    consoleWarnSpy.mockRestore();
  });

  it('should clamp river opacity to [0, 1] range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = validateWaterConfig({
      river: { opacity: 2.0 } as any,
    });
    expect(config.river.opacity).toBe(1);

    consoleWarnSpy.mockRestore();
  });

  it('should clamp lake opacity to [0, 1] range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = validateWaterConfig({
      lake: { opacity: -1.0 } as any,
    });
    expect(config.lake.opacity).toBe(0);

    consoleWarnSpy.mockRestore();
  });

  it('should validate seaLevel and use default if out of range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config1 = validateWaterConfig({ seaLevel: -0.5 });
    expect(config1.seaLevel).toBe(0.3);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sea level -0.5 out of range')
    );

    consoleWarnSpy.mockClear();

    const config2 = validateWaterConfig({ seaLevel: 1.5 });
    expect(config2.seaLevel).toBe(0.3);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sea level 1.5 out of range')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should clamp underwater darken factor to [0, 1] range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = validateWaterConfig({
      rendering: { underwaterDarkenFactor: 1.5 } as any,
    });
    expect(config.rendering.underwaterDarkenFactor).toBe(1);

    consoleWarnSpy.mockRestore();
  });

  it('should clamp underwater desaturation factor to [0, 1] range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = validateWaterConfig({
      rendering: { underwaterDesaturationFactor: -0.2 } as any,
    });
    expect(config.rendering.underwaterDesaturationFactor).toBe(0);

    consoleWarnSpy.mockRestore();
  });

  it('should preserve performance configuration flags', () => {
    const config = validateWaterConfig({
      performance: {
        enableGeometryPooling: false,
        enableMeshMerging: false,
        enableLOD: true,
        enableFrustumCulling: false,
        useInstancedRendering: true,
      },
    });

    expect(config.performance.enableGeometryPooling).toBe(false);
    expect(config.performance.enableMeshMerging).toBe(false);
    expect(config.performance.enableLOD).toBe(true);
    expect(config.performance.enableFrustumCulling).toBe(false);
    expect(config.performance.useInstancedRendering).toBe(true);
  });

  it('should preserve rendering configuration', () => {
    const config = validateWaterConfig({
      rendering: {
        waterOffset: 0.2,
        underwaterDarkenFactor: 0.5,
        underwaterDesaturationFactor: 0.6,
        enableDepthGradient: false,
      },
    });

    expect(config.rendering.waterOffset).toBe(0.2);
    expect(config.rendering.underwaterDarkenFactor).toBe(0.5);
    expect(config.rendering.underwaterDesaturationFactor).toBe(0.6);
    expect(config.rendering.enableDepthGradient).toBe(false);
  });

  it('should handle partial ocean configuration', () => {
    const config = validateWaterConfig({
      ocean: {
        color: 0x00ff00,
      } as any,
    });

    expect(config.ocean.color).toBe(0x00ff00);
    expect(config.ocean.opacity).toBe(DEFAULT_WATER_CONFIG.ocean.opacity);
    expect(config.ocean.shininess).toBe(DEFAULT_WATER_CONFIG.ocean.shininess);
  });

  it('should handle partial river configuration', () => {
    const config = validateWaterConfig({
      river: {
        enableFlowAnimation: true,
      } as any,
    });

    expect(config.river.enableFlowAnimation).toBe(true);
    expect(config.river.color).toBe(DEFAULT_WATER_CONFIG.river.color);
    expect(config.river.opacity).toBe(DEFAULT_WATER_CONFIG.river.opacity);
  });

  it('should ensure non-negative wave parameters', () => {
    const config = validateWaterConfig({
      ocean: {
        waveHeight: -1.0,
        waveSpeed: -0.5,
      } as any,
    });

    expect(config.ocean.waveHeight).toBeGreaterThanOrEqual(0);
    expect(config.ocean.waveSpeed).toBeGreaterThanOrEqual(0);
  });

  it('should ensure non-negative flow speed', () => {
    const config = validateWaterConfig({
      river: {
        flowSpeed: -2.0,
      } as any,
    });

    expect(config.river.flowSpeed).toBeGreaterThanOrEqual(0);
  });

  it('should ensure non-negative water offset', () => {
    const config = validateWaterConfig({
      rendering: {
        waterOffset: -0.1,
      } as any,
    });

    expect(config.rendering.waterOffset).toBeGreaterThanOrEqual(0);
  });
});
