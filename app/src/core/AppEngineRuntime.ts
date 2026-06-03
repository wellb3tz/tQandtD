import { ThreeWorldRendererAdapter } from '@engine/adapters/three';
import { ControlPanel } from '../ui/ControlPanel';
import { EconomyPanel } from '../ui/EconomyPanel';
import { Minimap } from '../ui/Minimap';
import { PerformanceMonitor } from '../ui/PerformanceMonitor';
import { StatisticsDisplay } from '../ui/StatisticsDisplay';
import { TerrainTooltip } from '../ui/TerrainTooltip';
import { WorldManager } from '../ui/WorldManager';
import { WorldViewer } from '../viewer/WorldViewer';
import type { WorldApp } from './WorldApp';
import { AppRuntimeLoop } from './AppRuntimeLoop';
import { bindWorldAppEvents } from './AppEventBindings';

export interface AppEngineRuntime {
  viewer: WorldViewer;
  renderer: ThreeWorldRendererAdapter;
  controlPanel: ControlPanel | null;
  worldManager: WorldManager;
  performanceMonitor: PerformanceMonitor;
  statisticsDisplay: StatisticsDisplay | null;
  economyPanel: EconomyPanel | null;
  minimap: Minimap | null;
  terrainTooltip: TerrainTooltip;
  runtimeLoop: AppRuntimeLoop;
}

export interface AppEngineRuntimeOptions {
  app: WorldApp;
  setViewerReady: (ready: boolean) => void;
}

export function createAppEngineRuntime(options: AppEngineRuntimeOptions): AppEngineRuntime | null {
  const { app, setViewerReady } = options;
  const viewerContainer = document.getElementById('viewer');
  if (!viewerContainer) return null;

  setViewerReady(false);

  const viewer = new WorldViewer();
  viewer.initialize(viewerContainer, app.getSeed());

  const renderer = new ThreeWorldRendererAdapter({ target: viewer });
  app.setRenderer(renderer);

  viewer.applyViewerSettings(app.getViewerSettings(), app.getLoadedChunksSnapshot());
  viewer.setStreamingViewDistance(app.getViewDistance(), app.getConfigSnapshot().chunkSize);

  let controlPanel: ControlPanel | null = null;
  const controlPanelContainer = document.getElementById('control-panel');
  if (controlPanelContainer) {
    controlPanel = new ControlPanel();
    controlPanel.initialize(controlPanelContainer, app);
  }

  const worldManager = new WorldManager();
  worldManager.initialize(app);

  const performanceMonitor = new PerformanceMonitor();
  performanceMonitor.initialize(document.body);

  let statisticsDisplay: StatisticsDisplay | null = null;
  const statisticsContainer = document.getElementById('statistics-display');
  if (statisticsContainer) {
    statisticsDisplay = new StatisticsDisplay();
    statisticsDisplay.initialize(statisticsContainer);
    statisticsDisplay.setApp(app);
  }

  let economyPanel: EconomyPanel | null = null;
  const economyContainer = document.getElementById('journey-economy-panel')
    ?? document.getElementById('economy-panel');
  if (economyContainer) {
    economyPanel = new EconomyPanel();
    economyPanel.initialize(economyContainer, app);
  }

  let minimap: Minimap | null = null;
  const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
  if (minimapCanvas) {
    minimap = new Minimap();
    minimap.initialize(
      minimapCanvas,
      app,
      () => viewer.getCameraHeading(),
      () => viewer.getCameraPosition()
    );
  }

  const terrainTooltip = new TerrainTooltip();
  terrainTooltip.initialize(app, viewer);

  const runtimeLoop = new AppRuntimeLoop({
    app,
    viewer,
    getPerformanceMonitor: () => performanceMonitor,
    getMinimap: () => minimap,
  });
  runtimeLoop.start();

  bindWorldAppEvents({
    app,
    getViewer: () => viewer,
    getRenderer: () => renderer,
    getPerformanceMonitor: () => performanceMonitor,
  });

  return {
    viewer,
    renderer,
    controlPanel,
    worldManager,
    performanceMonitor,
    statisticsDisplay,
    economyPanel,
    minimap,
    terrainTooltip,
    runtimeLoop,
  };
}
