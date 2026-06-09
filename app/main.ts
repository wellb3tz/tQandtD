/**
 * Main entry point for the tQandtD world app
 * 
 * This browser client connects to the procedural world engine
 * through an interactive 3D visualization interface built with Three.js.
 */

// Import styles
import './styles.css';

import { WorldApp } from './src/core/WorldApp';
import { HelpModal } from './src/ui/HelpModal';
import { bindAppDomEvents } from './src/ui/AppDomBindings';
import { errorHandler, ErrorCategory, ErrorSeverity, AppError } from './src/utils/ErrorHandler';
import { AppModeLifecycle } from './src/core/AppModeLifecycle';
import { createAppEngineRuntime, type AppEngineRuntime } from './src/core/AppEngineRuntime';

// Global app instance
let app: WorldApp | null = null;
let engineRuntime: AppEngineRuntime | null = null;
let helpModal: HelpModal | null = null;
let modeLifecycle: AppModeLifecycle | null = null;
let worldGenerationLoading = false;

const VIEWER_READY_CLASS = 'viewer-ready';

document.addEventListener('DOMContentLoaded', async () => {
  document.title = 'Project tQandtD';

  // Check WebGL compatibility first (Requirement 18.4)
  const webglCheck = errorHandler.checkWebGLCompatibility();
  if (!webglCheck.supported) {
    errorHandler.handleError(new AppError(
      'WebGL not supported',
      ErrorCategory.WEBGL,
      ErrorSeverity.CRITICAL,
      false,
      webglCheck.message || 'WebGL is not supported in your browser.',
      undefined
    ));
    return;
  } else if (webglCheck.message) {
    // Show warning banner for limited WebGL support
    const warningBanner = document.createElement('div');
    warningBanner.className = 'webgl-warning';
    warningBanner.innerHTML = `
      ${webglCheck.message}
      <button class="webgl-warning-close" aria-label="Close warning">&times;</button>
    `;
    document.body.appendChild(warningBanner);
    
    warningBanner.querySelector('.webgl-warning-close')?.addEventListener('click', () => {
      warningBanner.remove();
    });
  }
  
  // Initialize help modal early (no engine dependency)
  helpModal = new HelpModal();
  helpModal.initialize();

  modeLifecycle = new AppModeLifecycle({
    getApp: () => app,
    getViewer: () => engineRuntime?.viewer ?? null,
    initEngine,
    cleanupEngine,
    resizeViewerToContainer,
    setViewerReady,
    setWorldGenerationLoading,
  });

  bindAppDomEvents({
    getApp: () => app,
    getViewer: () => engineRuntime?.viewer ?? null,
    getHelpModal: () => helpModal,
    getTerrainTooltip: () => engineRuntime?.terrainTooltip ?? null,
    getModeLifecycle: () => modeLifecycle,
    cleanupEngine,
    resizeViewerToContainer,
    setViewerReady,
    setWorldGenerationLoading,
  });
});

async function initEngine(): Promise<void> {
  if (app) return; // Already initialized

  try {
    app = new WorldApp();
    await app.initialize();
    engineRuntime = createAppEngineRuntime({ app, setViewerReady });
    engineRuntime?.runtimeLoop.setChunkStreamingPaused(worldGenerationLoading);
  } catch (error) {
    console.error('Failed to initialize application core:', error);
    setWorldGenerationLoading(false);
    cleanupEngine();
    
    errorHandler.handleError(new AppError(
      'Application initialization failed',
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.CRITICAL,
      false,
      'Failed to initialize the application. Please reload the page and try again.',
      error instanceof Error ? error : undefined
    ));
    throw error;
  }
}

function cleanupEngine(): void {
  engineRuntime?.runtimeLoop.stop();
  
  if (engineRuntime) {
    engineRuntime.terrainTooltip.dispose();
    engineRuntime.performanceMonitor.dispose();
    engineRuntime.economyPanel?.dispose();
    engineRuntime.viewer.dispose();
  }
  if (app) { app.destroy(); app = null; }
  
  engineRuntime = null;
  
  setViewerReady(false);
  setWorldGenerationLoading(false);
}

// Keep this entrypoint thin: new workflows belong in focused modules under app/src/core,
// app/src/ui, or app/src/viewer, then get wired here through explicit dependencies.
function resizeViewerToContainer(): void {
  const viewerContainer = document.getElementById('viewer');
  if (!viewerContainer || !engineRuntime) {
    return;
  }

  engineRuntime.viewer.resize(viewerContainer.clientWidth, viewerContainer.clientHeight);
}

function setViewerReady(ready: boolean): void {
  document.getElementById('viewer')?.classList.toggle(VIEWER_READY_CLASS, ready);
}

function setWorldGenerationLoading(visible: boolean): void {
  worldGenerationLoading = visible;
  engineRuntime?.runtimeLoop.setChunkStreamingPaused(visible);
  document.getElementById('loading-indicator')?.classList.toggle('hidden', !visible);
}
