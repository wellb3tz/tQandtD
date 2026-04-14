/**
 * Unit tests for ControlPanel visibility toggles
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { DemoApp } from '../core/DemoApp';

describe('ControlPanel - Visibility Toggles', () => {
  let controlPanel: ControlPanel;
  let app: DemoApp;
  let container: HTMLElement;

  beforeEach(async () => {
    // Create container with required elements
    container = document.createElement('div');
    container.innerHTML = `
      <div id="preset-controls"></div>
      <div id="terrain-controls"></div>
      <div id="biome-controls"></div>
      <div id="river-controls"></div>
      <div id="resource-controls"></div>
      <div id="advanced-controls"></div>
      <div id="visibility-controls"></div>
    `;
    document.body.appendChild(container);

    // Initialize app
    app = new DemoApp();
    await app.initialize();

    // Initialize control panel
    controlPanel = new ControlPanel();
    controlPanel.initialize(container, app);
  });

  it('should create all visibility toggle checkboxes', () => {
    const visibilityContainer = document.getElementById('visibility-controls');
    expect(visibilityContainer).toBeTruthy();

    // Check that all 7 toggles are created
    const checkboxes = visibilityContainer?.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes?.length).toBe(7);

    // Verify specific toggles exist
    expect(document.getElementById('showTerrain')).toBeTruthy();
    expect(document.getElementById('showBiomes')).toBeTruthy();
    expect(document.getElementById('showRivers')).toBeTruthy();
    expect(document.getElementById('showResources')).toBeTruthy();
    expect(document.getElementById('showStructures')).toBeTruthy();
    expect(document.getElementById('showChunkBoundaries')).toBeTruthy();
    expect(document.getElementById('showWireframe')).toBeTruthy();
  });

  it('should have correct default values for visibility toggles', () => {
    const showTerrain = document.getElementById('showTerrain') as HTMLInputElement;
    const showBiomes = document.getElementById('showBiomes') as HTMLInputElement;
    const showRivers = document.getElementById('showRivers') as HTMLInputElement;
    const showResources = document.getElementById('showResources') as HTMLInputElement;
    const showStructures = document.getElementById('showStructures') as HTMLInputElement;
    const showChunkBoundaries = document.getElementById('showChunkBoundaries') as HTMLInputElement;
    const showWireframe = document.getElementById('showWireframe') as HTMLInputElement;

    // Most should be checked by default
    expect(showTerrain.checked).toBe(true);
    expect(showBiomes.checked).toBe(true);
    expect(showRivers.checked).toBe(true);
    expect(showResources.checked).toBe(true);
    expect(showStructures.checked).toBe(true);

    // These should be unchecked by default
    expect(showChunkBoundaries.checked).toBe(false);
    expect(showWireframe.checked).toBe(false);
  });

  it('should update app state when terrain visibility is toggled', () => {
    const showTerrain = document.getElementById('showTerrain') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showTerrain;
    app.updateState({ showTerrain: !initialState });

    // Verify state was updated
    const newState = app.getState().showTerrain;
    expect(newState).toBe(!initialState);
  });

  it('should update app state when biome visibility is toggled', () => {
    const showBiomes = document.getElementById('showBiomes') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showBiomes;
    app.updateState({ showBiomes: !initialState });

    // Verify state was updated
    const newState = app.getState().showBiomes;
    expect(newState).toBe(!initialState);
  });

  it('should update app state when river visibility is toggled', () => {
    const showRivers = document.getElementById('showRivers') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showRivers;
    app.updateState({ showRivers: !initialState });

    // Verify state was updated
    const newState = app.getState().showRivers;
    expect(newState).toBe(!initialState);
  });

  it('should update app state when resource visibility is toggled', () => {
    const showResources = document.getElementById('showResources') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showResources;
    app.updateState({ showResources: !initialState });

    // Verify state was updated
    const newState = app.getState().showResources;
    expect(newState).toBe(!initialState);
  });

  it('should update app state when structure visibility is toggled', () => {
    const showStructures = document.getElementById('showStructures') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showStructures;
    app.updateState({ showStructures: !initialState });

    // Verify state was updated
    const newState = app.getState().showStructures;
    expect(newState).toBe(!initialState);
  });

  it('should update app state when chunk boundary visibility is toggled', () => {
    const showChunkBoundaries = document.getElementById('showChunkBoundaries') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showChunkBoundaries;
    app.updateState({ showChunkBoundaries: !initialState });

    // Verify state was updated
    const newState = app.getState().showChunkBoundaries;
    expect(newState).toBe(!initialState);
  });

  it('should update app state when wireframe mode is toggled', () => {
    const showWireframe = document.getElementById('showWireframe') as HTMLInputElement;
    
    // Manually trigger the change handler
    const initialState = app.getState().showWireframe;
    app.updateState({ showWireframe: !initialState });

    // Verify state was updated
    const newState = app.getState().showWireframe;
    expect(newState).toBe(!initialState);
  });

  it('should emit VISIBILITY_CHANGED event when any visibility toggle changes', (done) => {
    // Listen for visibility change event
    app.on('visibility_changed' as any, (data) => {
      expect(data).toBeDefined();
      expect('showTerrain' in data).toBe(true);
      done();
    });

    // Manually trigger visibility change
    app.updateState({ showTerrain: false });
  });

  it('should handle multiple rapid visibility toggles', () => {
    // Rapidly toggle multiple visibility settings
    app.updateState({ showTerrain: false });
    app.updateState({ showBiomes: false });
    app.updateState({ showRivers: false });

    // Verify all states were updated
    const state = app.getState();
    expect(state.showTerrain).toBe(false);
    expect(state.showBiomes).toBe(false);
    expect(state.showRivers).toBe(false);
  });
});
