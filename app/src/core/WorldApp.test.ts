import { describe, expect, it } from 'vitest';
import { AppEvent, WorldApp } from './WorldApp';

describe('WorldApp app/viewer settings', () => {
  it('updates viewer settings through the dedicated settings API', () => {
    const app = new WorldApp();
    const visibilityEvents: unknown[] = [];

    app.on(AppEvent.VISIBILITY_CHANGED, event => visibilityEvents.push(event));

    app.updateViewerSettings({ showWater: false, terrainTexturesEnabled: false });

    expect(app.getViewerSettings()).toMatchObject({
      showWater: false,
      terrainTexturesEnabled: false,
    });
    expect(app.getState().viewerSettings.showWater).toBe(false);
    expect(app.getState().viewerSettings.terrainTexturesEnabled).toBe(false);
    expect(visibilityEvents).toHaveLength(1);
    expect(visibilityEvents[0]).toMatchObject({
      showWater: false,
      terrainTexturesEnabled: false,
    });
  });

  it('keeps viewer settings as the source of truth for visibility', () => {
    const app = new WorldApp();

    app.updateViewerSettings({ showResources: true });

    expect(app.getViewerSettings().showResources).toBe(true);
    expect(app.getState().viewerSettings.showResources).toBe(true);
  });

  it('updates app settings through the dedicated settings API', () => {
    const app = new WorldApp();

    app.updateAppSettings({ viewDistance: 6 });

    expect(app.getViewDistance()).toBe(6);
    expect(app.getState().appSettings.viewDistance).toBe(6);
  });

  it('merges viewer-only water settings without dropping prior water values', () => {
    const app = new WorldApp();

    app.updateViewerSettings({ waterView: { ocean: { color: 0x112233 } } });
    app.updateViewerSettings({ waterView: { ocean: { opacity: 0.5 } } });
    app.updateViewerSettings({ waterView: { ocean: { enableWaves: false, waveHeight: 0.2 } } });

    expect(app.getViewerSettings().waterView?.ocean).toEqual({
      color: 0x112233,
      opacity: 0.5,
      enableWaves: false,
      waveHeight: 0.2,
    });
  });
});
