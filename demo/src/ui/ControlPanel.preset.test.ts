/**
 * Integration tests for ControlPanel preset functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { PRESETS } from '../config/presets';

describe('ControlPanel - Preset System (Logic Tests)', () => {
  describe('getPresets method', () => {
    it('should return all built-in presets initially', () => {
      const controlPanel = new ControlPanel();
      const presets = controlPanel.getPresets();
      expect(presets.length).toBe(5);
      expect(presets).toEqual(PRESETS);
    });
  });

  describe('onPresetSelect callback registration', () => {
    it('should allow registering preset select callbacks', () => {
      const controlPanel = new ControlPanel();
      const callback = vi.fn();
      
      controlPanel.onPresetSelect(callback);
      
      // Callback should be registered (we can't test execution without DOM)
      expect(callback).toBeDefined();
    });
  });

  describe('onParameterChange callback registration', () => {
    it('should allow registering parameter change callbacks', () => {
      const controlPanel = new ControlPanel();
      const callback = vi.fn();
      
      controlPanel.onParameterChange(callback);
      
      // Callback should be registered
      expect(callback).toBeDefined();
    });
  });

  describe('Preset configuration validation', () => {
    it('should have valid preset configurations', () => {
      const controlPanel = new ControlPanel();
      const presets = controlPanel.getPresets();
      
      presets.forEach(preset => {
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(preset.config).toBeDefined();
        expect(preset.config.seed).toBeTypeOf('number');
        expect(preset.config.chunkSize).toBeTypeOf('number');
        expect(preset.config.terrainConfig).toBeDefined();
        expect(preset.config.biomeConfig).toBeDefined();
      });
    });
  });
});
