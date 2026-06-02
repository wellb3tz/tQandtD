/**
 * Main entry point for the tQandtD world app
 * 
 * This browser client connects to the procedural world engine
 * through an interactive 3D visualization interface built with Three.js.
 */

// Import styles
import './styles.css';

import { TERRAIN_TILE_SIZE_METERS, FIRST_PERSON_EYE_HEIGHT_METERS, TERRAIN_HEIGHT_SCALE_METERS, BiomeType } from '@engine/index';
import { ThreeWorldRendererAdapter } from '@engine/adapters/three';
import { WorldApp, AppEvent } from './src/core/WorldApp';
import { ControlPanel } from './src/ui/ControlPanel';
import { WorldViewer } from './src/viewer/WorldViewer';
import { WorldManager } from './src/ui/WorldManager';
import { PerformanceMonitor } from './src/ui/PerformanceMonitor';
import { StatisticsDisplay } from './src/ui/StatisticsDisplay';
import { Minimap } from './src/ui/Minimap';
import { TerrainTooltip } from './src/ui/TerrainTooltip';
import { HelpModal } from './src/ui/HelpModal';
import { errorHandler, ErrorCategory, ErrorSeverity, AppError } from './src/utils/ErrorHandler';

// Global app instance
let app: WorldApp | null = null;
let controlPanelInstance: ControlPanel | null = null;
let worldViewer: WorldViewer | null = null;
let worldRenderer: ThreeWorldRendererAdapter | null = null;
let worldManager: WorldManager | null = null;
let performanceMonitor: PerformanceMonitor | null = null;
let statisticsDisplay: StatisticsDisplay | null = null;
let minimap: Minimap | null = null;
let terrainTooltip: TerrainTooltip | null = null;
let helpModal: HelpModal | null = null;

// Global timers for cleanup
let uiUpdateTimer: ReturnType<typeof setInterval> | null = null;
let chunkLoadTimer: ReturnType<typeof setTimeout> | null = null;
let performanceTimer: ReturnType<typeof setInterval> | null = null;

let engineRunning = false;
let rafId: number | null = null;

const HORIZON_STREAMING_BUFFER_CHUNKS = 2;
const VIEWER_READY_CLASS = 'viewer-ready';
const MODE_SELECT_ACTIVE_CLASS = 'mode-select-active';
const EDITOR_MODE_CLASS = 'world-editor-mode';
const JOURNEY_MODE_CLASS = 'journey-mode';
const FULLSCREEN_TRANSITION_CLASS = 'fullscreen-transitioning';

type AppMode = 'world-editor' | 'journey';

// Basic initialization
let isFullscreen = false;

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
  
  // Get DOM elements
  const generateBtn = document.getElementById('generate-btn');
  const seedInput = document.getElementById('seed-input') as HTMLInputElement;
  const toggleControlsBtn = document.getElementById('toggle-controls-btn');
  const toggleMonitorBtn = document.getElementById('toggle-monitor-btn');
  const helpBtn = document.getElementById('help-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const controlPanel = document.getElementById('control-panel');
  const rightPanel = document.getElementById('right-panel');
  const appHeader = document.querySelector('.app-header') as HTMLElement;
  const modeSelect = document.getElementById('mode-select');
  const worldEditorModeBtn = document.getElementById('world-editor-mode-btn') as HTMLButtonElement | null;
  const journeyModeBtn = document.getElementById('journey-mode-btn') as HTMLButtonElement | null;

  // Camera control buttons
  const resetCameraBtn = document.getElementById('reset-btn');
  const topDownBtn = document.getElementById('top-down-btn');
  const followTerrainBtn = document.getElementById('follow-terrain-btn');
  const firstPersonBtn = document.getElementById('first-person-btn');
  const planetModeBtn = document.getElementById('planet-mode-btn');

  // Random seed button
  document.getElementById('random-seed-btn')?.addEventListener('click', () => {
    const randomSeed = Math.floor(Math.random() * 999999) + 1;
    if (seedInput) seedInput.value = randomSeed.toString();
  });

  // Initialize help modal early (no engine dependency)
  helpModal = new HelpModal();
  helpModal.initialize();

  // Enable mode buttons now that basic checks passed
  worldEditorModeBtn?.removeAttribute('disabled');
  journeyModeBtn?.removeAttribute('disabled');

  // Mode selection handlers
  worldEditorModeBtn?.addEventListener('click', async () => {
    await enterAppMode('world-editor');
  });

  journeyModeBtn?.addEventListener('click', async () => {
    await enterAppMode('journey');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      if (!document.body.classList.contains(MODE_SELECT_ACTIVE_CLASS)) {
        returnToMenu();
      }
    }
    if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        document.body.classList.remove('fullscreen-mode');
        if (worldViewer) setTimeout(() => worldViewer!.resize(window.innerWidth, window.innerHeight), 100);
      }
    }
  });

  // Toggle control panel
  toggleControlsBtn?.addEventListener('click', () => {
    controlPanel?.classList.toggle('collapsed');
  });

  // Collapsible sections in control panel
  document.querySelectorAll('.section-header.clickable').forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.closest('.panel-section');
      if (section) {
        section.classList.toggle('collapsed');
      }
    });
  });
  
  // Toggle right panel (unified performance + statistics)
  toggleMonitorBtn?.addEventListener('click', () => {
    rightPanel?.classList.toggle('collapsed');
  });
  
  // Help button
  helpBtn?.addEventListener('click', () => {
    helpModal?.toggle();
  });
  
  // Fullscreen button
  const toggleFullscreen = () => {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      document.body.classList.add('fullscreen-mode');
      if (worldViewer) setTimeout(() => worldViewer!.resize(window.innerWidth, window.innerHeight), 100);
    } else {
      document.body.classList.remove('fullscreen-mode');
      if (worldViewer) setTimeout(() => worldViewer!.resize(window.innerWidth, window.innerHeight), 100);
    }
  };
  
  fullscreenBtn?.addEventListener('click', toggleFullscreen);
  
  // Auto-collapse side panels on narrow screens (requirement 17.5)
  const handleResponsiveLayout = () => {
    const width = window.innerWidth;
    const narrowScreenThreshold = 768; // pixels
    
    if (width < narrowScreenThreshold) {
      // Auto-collapse on narrow screens
      controlPanel?.classList.add('collapsed');
      rightPanel?.classList.add('collapsed');
    } else if (width >= 1200) {
      // Auto-expand the primary control rail on wide screens.
      controlPanel?.classList.remove('collapsed');
    }
    // For medium screens (768-1200), maintain current state
  };
  
  // Initial check on page load
  handleResponsiveLayout();
  
  // Handle window resize for responsive layout (requirement 17.5, 17.8)
  window.addEventListener('resize', () => {
    handleResponsiveLayout();
    resizeViewerToContainer();
  });

  document.addEventListener('fullscreenchange', () => {
    isFullscreen = document.fullscreenElement !== null;
    requestAnimationFrame(() => resizeViewerToContainer());
  });
  
  // Camera control buttons (requirement 14.5, 14.6, 14.7)
  resetCameraBtn?.addEventListener('click', () => {
    if (worldViewer) {
      worldViewer.resetCamera();
      // Remove active state from other buttons
      topDownBtn?.classList.remove('active');
      followTerrainBtn?.classList.remove('active');
      firstPersonBtn?.classList.remove('active');
      planetModeBtn?.classList.remove('active');
      document.body.classList.remove('first-person-active');
      errorHandler.showSuccessToast('Camera reset to default position');
    }
  });
  
  topDownBtn?.addEventListener('click', () => {
    if (worldViewer) {
      const isActive = topDownBtn.classList.contains('active');
      worldViewer.setOrthographicView(!isActive);
      
      if (!isActive) {
        topDownBtn.classList.add('active');
        followTerrainBtn?.classList.remove('active');
        firstPersonBtn?.classList.remove('active');
        planetModeBtn?.classList.remove('active');
        document.body.classList.remove('first-person-active');
        errorHandler.showSuccessToast('Top-down orthographic view enabled');
      } else {
        topDownBtn.classList.remove('active');
        errorHandler.showSuccessToast('Perspective view restored');
      }
    }
  });
  
  followTerrainBtn?.addEventListener('click', () => {
    if (worldViewer) {
      const isActive = followTerrainBtn.classList.contains('active');
      worldViewer.setFollowTerrainMode(!isActive);
      
      if (!isActive) {
        followTerrainBtn.classList.add('active');
        topDownBtn?.classList.remove('active');
        firstPersonBtn?.classList.remove('active');
        planetModeBtn?.classList.remove('active');
        document.body.classList.remove('first-person-active');
        errorHandler.showSuccessToast('Follow terrain mode enabled');
      } else {
        followTerrainBtn.classList.remove('active');
        errorHandler.showSuccessToast('Follow terrain mode disabled');
      }
    }
  });
  
  firstPersonBtn?.addEventListener('click', () => {
    if (worldViewer) {
      const isActive = firstPersonBtn.classList.contains('active');
      worldViewer.setFirstPersonMode(!isActive);
      
      if (!isActive) {
        firstPersonBtn.classList.add('active');
        topDownBtn?.classList.remove('active');
        followTerrainBtn?.classList.remove('active');
        planetModeBtn?.classList.remove('active');
        document.body.classList.add('first-person-active');
        errorHandler.showSuccessToast('First-person mode enabled. Click to look around, WASD to walk, Space to jump.');
      } else {
        firstPersonBtn.classList.remove('active');
        document.body.classList.remove('first-person-active');
        errorHandler.showSuccessToast('First-person mode disabled');
      }
    }
  });

  planetModeBtn?.addEventListener('click', () => {
    if (worldViewer) {
      worldViewer.enterPlanetMode();
      planetModeBtn.classList.add('active');
      topDownBtn?.classList.remove('active');
      followTerrainBtn?.classList.remove('active');
      firstPersonBtn?.classList.remove('active');
      document.body.classList.remove('first-person-active');
      errorHandler.showSuccessToast('Planet mode enabled');
    }
  });
  
  // Generate world button (requirement 2.1, 2.4, 2.6, 2.7)
  generateBtn?.addEventListener('click', async () => {
    if (!app) {
      errorHandler.showErrorToast('Application not initialized');
      return;
    }
    
    // Validate seed input (requirement 18.5)
    const seedValue = seedInput?.value || '12345';
    const seed = parseInt(seedValue);
    
    if (isNaN(seed)) {
      errorHandler.showErrorToast('Invalid seed value. Please enter a valid number.');
      seedInput?.classList.add('validation-error');
      return;
    }
    
    // Remove validation error class
    seedInput?.classList.remove('validation-error');
    
    // Show loading indicator (requirement 2.4)
    setWorldGenerationLoading(true);
    
    // Show progress bar for long operation (requirement 18.6)
    const progressId = errorHandler.showProgress('Generating world...', 0);
    
    // Disable generate button during generation
    if (generateBtn) {
      generateBtn.setAttribute('disabled', 'true');
      generateBtn.textContent = 'Generating...';
    }
    
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      setViewerReady(false);

      // Simulate progress updates
      let progress = 0;
      progressInterval = setInterval(() => {
        progress = Math.min(progress + 10, 90);
        errorHandler.updateProgress(progressId, progress);
      }, 200);
      
      // Generate world with deterministic seed (requirement 2.6, 2.7)
      await app.generateWorld(seed);
      if (worldViewer) {
        await warmUpInitialTerrain(app, worldViewer);
      }
      setViewerReady(true);
      
      // Complete progress
      clearInterval(progressInterval);
      progressInterval = null;
      errorHandler.updateProgress(progressId, 100, 'World generated!');
      
      setTimeout(() => {
        errorHandler.hideProgress(progressId);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to generate world:', error);
      errorHandler.hideProgress(progressId);
      errorHandler.handleError(new AppError(
        'World generation failed',
        ErrorCategory.GENERATION,
        ErrorSeverity.ERROR,
        true,
        'Failed to generate world. Please try again with a different seed or configuration.',
        error instanceof Error ? error : undefined
      ));
      setViewerReady(true);
    } finally {
      if (progressInterval !== null) {
        clearInterval(progressInterval);
      }

      // Hide loading indicator
      setWorldGenerationLoading(false);
      
      // Re-enable generate button
      if (generateBtn) {
        generateBtn.removeAttribute('disabled');
        generateBtn.textContent = 'Generate';
      }
    }
  });
  
  // Add seed input validation on input (requirement 18.5)
  seedInput?.addEventListener('input', () => {
    const value = seedInput.value;
    const seed = parseInt(value);
    
    if (value && isNaN(seed)) {
      seedInput.classList.add('validation-error');
      seedInput.title = 'Please enter a valid number';
    } else {
      seedInput.classList.remove('validation-error');
      seedInput.title = '';
    }
  });

  // Listen for planet clicked event from WorldViewer orbit mode
  window.addEventListener('planet-clicked', async (e: Event) => {
    const detail = (e as CustomEvent).detail as { lat: number; lon: number };
    if (!app || !worldViewer) return;

    // Start dive transition back to terrain first
    await worldViewer.startLandingTransition(detail.lat, detail.lon);
    planetModeBtn?.classList.remove('active');

    errorHandler.showSuccessToast('Landing on new world...');
    setWorldGenerationLoading(true);
    setViewerReady(false);

    try {
      await app.landOnPlanet(detail.lat, detail.lon);
      await warmUpInitialTerrain(app, worldViewer);
      setViewerReady(true);
      errorHandler.showSuccessToast(`Landed on new world! Seed: ${app.getSeed()}`);
    } catch (error) {
      console.error('Planet landing failed:', error);
      errorHandler.showErrorToast('Failed to land on planet. Please try again.');
    } finally {
      setWorldGenerationLoading(false);
      setViewerReady(true);
    }
  });

  // Clean up timers when the page closes.
  window.addEventListener('beforeunload', () => {
    cleanupEngine();
  });
});

async function initEngine(): Promise<void> {
  if (app) return; // Already initialized

  try {
    app = new WorldApp();
    await app.initialize();
    
    // Initialize WorldViewer
    const viewerContainer = document.getElementById('viewer');
    if (viewerContainer) {
      setViewerReady(false);
      worldViewer = new WorldViewer();
      worldViewer.initialize(viewerContainer, app!.getSeed());
      worldRenderer = new ThreeWorldRendererAdapter({ target: worldViewer });
      app.setRenderer(worldRenderer);
      
      // Apply initial visibility state from application core
      worldViewer.applyViewerSettings(app.getViewerSettings(), app.getLoadedChunksSnapshot());
      worldViewer.setStreamingViewDistance(app.getViewDistance(), app.getConfigSnapshot().chunkSize);
      
      // Render loop for FPS tracking and performance updates
      startRenderLoop();
      
      // State for intervals
      let lastCameraUpdate = 0;
      let lastChunkLoadCheck = 0;
      let lastPerformanceUpdate = 0;
      let lastUIUpdate = 0;
      let lastChunkLoadCameraPos: { x: number; z: number } | null = null;
      
      // 1. UI update interval (every 100ms)
      uiUpdateTimer = setInterval(() => {
        if (worldViewer && app) {
          const cameraPos = worldViewer.getCameraPosition();
          const now = performance.now();
          
          // Update camera position in app state.
          if (now - lastCameraUpdate >= 100) {
            app.updateCameraPosition(cameraPos);
            lastCameraUpdate = now;
          }
          
          // Update lightweight UI elements.
          if (now - lastUIUpdate >= 100) {
            // Update camera position display
            const cameraXDisplay = document.getElementById('camera-x');
            const cameraYDisplay = document.getElementById('camera-y');
            const cameraZDisplay = document.getElementById('camera-z');
            if (cameraXDisplay && cameraYDisplay && cameraZDisplay) {
              cameraXDisplay.textContent = cameraPos.x.toFixed(2);
              cameraYDisplay.textContent = cameraPos.y.toFixed(2);
              cameraZDisplay.textContent = cameraPos.z.toFixed(2);
            }
            // Update status bar position
            const statusPosition = document.getElementById('status-position');
            if (statusPosition) {
              statusPosition.textContent = `${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)}`;
            }
            // Update status bar chunks
            const statusChunks = document.getElementById('status-chunks');
            if (statusChunks && app) {
              statusChunks.textContent = app.getLoadedChunkCount().toString();
            }
            // Update compass: rotate needle opposite to camera yaw.
            const compassNeedle = document.getElementById('compass-needle');
            if (compassNeedle) {
              const heading = worldViewer.getCameraHeading();
              compassNeedle.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
            }
            
            lastUIUpdate = now;
          }
        }
      }, 100);
      
      // 2. Adaptive chunk loading - faster when moving, slower when idle.
      // Paused while in orbit / transition to avoid loading chunks for space positions.
      const scheduleChunkLoad = (delay = 100) => {
        chunkLoadTimer = setTimeout(() => {
          let nextInterval = 100;

          if (worldViewer && app) {
            // Skip chunk loading while in orbit or transitioning
            if (worldViewer.isOrbitalOrTransitioning()) {
              scheduleChunkLoad(200);
              return;
            }

            const cameraPos = worldViewer.getCameraPosition();

            // Determine how fast the camera is moving
            let distance = 0;
            if (lastChunkLoadCameraPos) {
              distance = Math.hypot(
                cameraPos.x - lastChunkLoadCameraPos.x,
                cameraPos.z - lastChunkLoadCameraPos.z
              );
            }
            lastChunkLoadCameraPos = { x: cameraPos.x, z: cameraPos.z };

            // Adaptive interval: fast movement -> 50ms, walking -> 100ms, idle -> 300ms
            if (distance > 0.15) {
              nextInterval = 50;   // Running
            } else if (distance > 0.03) {
              nextInterval = 100;  // Walking
            } else {
              nextInterval = 300;  // Idle
            }

            // Run chunk loading asynchronously to avoid blocking rendering.
            setTimeout(() => {
              const chunkSize = app!.getConfigSnapshot().chunkSize * TERRAIN_TILE_SIZE_METERS;
              const visualRadius = app!.getViewDistance();
              const loadRadius = getBufferedStreamingRadius(visualRadius);
              const cameraChunkX = Math.floor(cameraPos.x / chunkSize);
              const cameraChunkY = Math.floor(cameraPos.z / chunkSize);
              app!.loadChunksAround(cameraChunkX, cameraChunkY, loadRadius);
              const unloadDistance = loadRadius + 2;
              app!.unloadDistantChunks(cameraChunkX, cameraChunkY, unloadDistance);
            }, 0);

            lastChunkLoadCheck = performance.now();
          }

          scheduleChunkLoad(nextInterval);
        }, delay);
      };
      scheduleChunkLoad();
      
      // 3. Performance metrics interval (every 1000ms), executed asynchronously.
      performanceTimer = setInterval(() => {
        if (worldViewer && app) {
          const now = performance.now();
          
          if (now - lastPerformanceUpdate >= 1000) {
            // Run on the next event-loop tick.
            setTimeout(() => {
              // Get render stats from WorldViewer. This can be moderately expensive.
              const renderStats = worldViewer!.getRenderStats();
              
              // Calculate memory usage (approximate)
              const memoryUsage = app!.getApproximateMemoryUsage();
              
              // Update performance monitor
              if (performanceMonitor) {
                performanceMonitor.updateMemoryUsage(memoryUsage);
                performanceMonitor.updateRenderStats(renderStats.vertexCount, renderStats.drawCalls);
              }
              // Update status bar biome only when needed.
              const statusBiome = document.getElementById('status-biome');
              if (statusBiome && app) {
                const dominantBiome = app!.getDominantBiomeName();
                if (dominantBiome) {
                  statusBiome.textContent = dominantBiome;
                }
              }
              
              // Redraw minimap only when needed.
              if (minimap) {
                minimap.draw();
              }
              
              // Update worker pool statistics if enabled
              if (app!.isWorkerPoolEnabled()) {
                app!.updateWorkerPoolStats();
              }
            }, 0);
            
            lastPerformanceUpdate = now;
          }
        }
      }, 1000);
      
      // Initialize ControlPanel
      const controlPanelContainer = document.getElementById('control-panel');
      if (controlPanelContainer) {
        controlPanelInstance = new ControlPanel();
        controlPanelInstance.initialize(controlPanelContainer, app);
      }
      
      // Initialize WorldManager
      worldManager = new WorldManager();
      worldManager.initialize(app);
      
      // Initialize PerformanceMonitor (binds to existing elements by ID)
      performanceMonitor = new PerformanceMonitor();
      performanceMonitor.initialize(document.body);
      
      // Initialize StatisticsDisplay
      const statisticsContainer = document.getElementById('statistics-display');
      if (statisticsContainer) {
        statisticsDisplay = new StatisticsDisplay();
        statisticsDisplay.initialize(statisticsContainer);
        statisticsDisplay.setApp(app);
      }

      // Initialize Minimap
      const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
      if (minimapCanvas && worldViewer) {
        minimap = new Minimap();
        minimap.initialize(
          minimapCanvas,
          app,
          () => worldViewer!.getCameraHeading(),
          () => worldViewer!.getCameraPosition()
        );
      }

      // Initialize TerrainTooltip
      if (worldViewer) {
        terrainTooltip = new TerrainTooltip();
        terrainTooltip.initialize(app, worldViewer);
      }
      
      // Subscribe to state changes and update performance monitor
      app.subscribeToState((state) => {
        worldViewer?.setStreamingViewDistance(state.appSettings.viewDistance, state.config.chunkSize);

        if (performanceMonitor && app) {
          // Update generation time with breakdown
          const breakdown = {
            terrain: state.avgGenerationTime * 0.4, // Approximate breakdown
            biomes: state.avgGenerationTime * 0.2,
            resources: state.avgGenerationTime * 0.2,
            structures: state.avgGenerationTime * 0.2,
            total: state.avgGenerationTime
          };
          performanceMonitor.updateGenerationTime(state.avgGenerationTime, breakdown);
          
          // Update cache statistics
          const cacheStats = app.getCacheStats();
          performanceMonitor.updateCacheStats(cacheStats.hitRate, cacheStats.size, cacheStats.maxSize);
          
          // Update loaded chunks count
          performanceMonitor.updateLoadedChunks(app.getLoadedChunkCount());
          
          // Update worker pool statistics
          performanceMonitor.updateWorkerStats({
            activeWorkers: state.activeWorkers,
            queuedTasks: state.queuedTasks,
            completedTasks: state.completedTasks,
            avgWorkerTime: state.avgWorkerTime
          });
        }
      });
      
      // Listen to app events
      app.on(AppEvent.WORLD_GENERATED, (data) => {
        if (worldViewer) {
          worldViewer.clearChunks();
          worldViewer.clearFogOfWar();
        }
        // Update status bar seed
        const statusSeed = document.getElementById('status-seed');
        if (statusSeed) statusSeed.textContent = data.seed.toString();
        if (!document.body.classList.contains(JOURNEY_MODE_CLASS)) {
          errorHandler.showSuccessToast(`World generated with seed: ${data.seed}`);
        }
      });

      app.on(AppEvent.PLANET_LANDED, (data) => {
        if (worldViewer) {
          worldViewer.clearChunks();
          worldViewer.clearFogOfWar();
        }
        const statusSeed = document.getElementById('status-seed');
        if (statusSeed) statusSeed.textContent = data.seed.toString();
        errorHandler.showSuccessToast(`New world from lat ${data.lat.toFixed(2)}, lon ${data.lon.toFixed(2)}`);
      });
      
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        const renderSystem = app?.getWorldSession()?.scene.renderSystem;
        if (!data.partial && data.stage === undefined && renderSystem) {
          renderSystem.onChunkLoaded(data.chunk, { x: data.chunkX, y: data.chunkY });
        } else if (worldRenderer) {
          worldRenderer.addChunk(data.chunk, { x: data.chunkX, y: data.chunkY }, {
            partial: data.partial,
            stage: data.stage,
          });
        }
      });

      app.on(AppEvent.CHUNK_UPDATED, (data) => {
        if (worldRenderer) {
          worldRenderer.updateChunk(data.chunk, { x: data.chunkX, y: data.chunkY });
        }
      });
      
      app.on(AppEvent.CHUNK_UNLOADED, (data) => {
        const renderSystem = app?.getWorldSession()?.scene.renderSystem;
        if (!data.keepFogOfWar && renderSystem) {
          renderSystem.onChunkRemoved({ x: data.chunkX, y: data.chunkY });
        } else if (worldRenderer) {
          worldRenderer.removeChunk({ x: data.chunkX, y: data.chunkY }, {
            keepFogOfWar: data.keepFogOfWar || false,
          });
        }
      });

      app.on(AppEvent.VISIBILITY_CHANGED, (visibilityState) => {
        // Update WorldViewer layer visibility
        if (worldViewer && app && visibilityState) {
          const startTime = performance.now();
          worldViewer.applyViewerSettings(visibilityState, app.getLoadedChunksSnapshot());
          
          const endTime = performance.now();
          const updateTime = endTime - startTime;
          
          // Verify update occurred within 50ms (requirement 13.8)
          if (updateTime > 50) {
            console.warn(`Visibility update took ${updateTime.toFixed(2)}ms (exceeds 50ms requirement)`);
          }
        }
      });
      
      app.on(AppEvent.ERROR, (data) => {
        errorHandler.handleError(new AppError(
          data.message,
          ErrorCategory.GENERATION,
          ErrorSeverity.ERROR,
          true,
          data.message,
          data.error
        ));
      });
    }
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
  stopRenderLoop();
  
  if (uiUpdateTimer !== null) clearInterval(uiUpdateTimer);
  uiUpdateTimer = null;
  if (chunkLoadTimer !== null) clearTimeout(chunkLoadTimer);
  chunkLoadTimer = null;
  if (performanceTimer !== null) clearInterval(performanceTimer);
  performanceTimer = null;
  
  if (terrainTooltip) { terrainTooltip.dispose(); terrainTooltip = null; }
  if (performanceMonitor) { performanceMonitor.dispose(); performanceMonitor = null; }
  if (worldViewer) { worldViewer.dispose(); worldViewer = null; }
  if (app) { app.destroy(); app = null; }
  
  worldRenderer = null;
  controlPanelInstance = null;
  worldManager = null;
  statisticsDisplay = null;
  minimap = null;
  
  setViewerReady(false);
  setWorldGenerationLoading(false);
}

function startRenderLoop(): void {
  if (engineRunning) return;
  engineRunning = true;
  
  let frameCount = 0;
  let lastFPSUpdate = performance.now();
  let currentFPS = 60;
  
  const renderLoop = () => {
    if (!engineRunning) return;
    frameCount++;
    const now = performance.now();
    
    // Calculate FPS every second
    if (now - lastFPSUpdate >= 1000) {
      currentFPS = Math.round((frameCount * 1000) / (now - lastFPSUpdate));
      frameCount = 0;
      lastFPSUpdate = now;
      
      // Update FPS in app state
      if (app) {
        app.updateState({ fps: currentFPS });
      }
    }
    
    rafId = requestAnimationFrame(renderLoop);
  };
  rafId = requestAnimationFrame(renderLoop);
}

function stopRenderLoop(): void {
  engineRunning = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

async function enterAppMode(mode: AppMode): Promise<void> {
  const modeSelect = document.getElementById('mode-select');
  const worldEditorModeBtn = document.getElementById('world-editor-mode-btn') as HTMLButtonElement | null;
  const journeyModeBtn = document.getElementById('journey-mode-btn') as HTMLButtonElement | null;

  worldEditorModeBtn?.setAttribute('disabled', 'true');
  journeyModeBtn?.setAttribute('disabled', 'true');

  try {
    // Hide menu immediately so loading indicator is visible
    modeSelect?.classList.add('hidden');
    document.body.classList.remove(MODE_SELECT_ACTIVE_CLASS);

    if (mode === 'journey') {
      document.body.classList.add(JOURNEY_MODE_CLASS);
    }

    if (mode === 'world-editor') {
      setWorldGenerationLoading(true);
      setViewerReady(false);
      await initEngine();
      await warmUpInitialTerrain(app!, worldViewer!);
      setViewerReady(true);
      setWorldGenerationLoading(false);
      document.body.classList.remove(JOURNEY_MODE_CLASS, 'first-person-active');
      document.body.classList.add(EDITOR_MODE_CLASS);
      document.title = 'World Editor — tQandtD';
      return;
    }

    // Journey mode
    document.body.classList.add(FULLSCREEN_TRANSITION_CLASS);
    setViewerReady(false);
    await requestBrowserFullscreen();
    await waitForFullscreenLayout();
    resizeViewerToContainer();
    setWorldGenerationLoading(true);
    await initEngine();

    if (!app || !worldViewer) throw new Error('Engine not initialized');

    document.body.classList.remove(EDITOR_MODE_CLASS);
    document.body.classList.add('first-person-active');

    const seedInput = document.getElementById('seed-input') as HTMLInputElement | null;
    const statusSeed = document.getElementById('status-seed');
    const randomSeed = Math.floor(Math.random() * 999999999) + 1;
    if (seedInput) seedInput.value = randomSeed.toString();
    if (statusSeed) statusSeed.textContent = randomSeed.toString();

    await app.generateWorld(randomSeed);
    await warmUpInitialTerrain(app, worldViewer);

    const spawnPos = findSpawnPosition(app);
    worldViewer.setCameraPosition(spawnPos);
    worldViewer.setFirstPersonMode(true);
    await waitForFullscreenLayout();
    resizeViewerToContainer();
    document.body.classList.remove(FULLSCREEN_TRANSITION_CLASS);
    setViewerReady(true);
    document.title = 'Journey — tQandtD';
  } catch (error) {
    console.error('Failed to enter app mode:', error);
    cleanupEngine();
    document.body.classList.add(MODE_SELECT_ACTIVE_CLASS);
    document.body.classList.remove(JOURNEY_MODE_CLASS, EDITOR_MODE_CLASS, 'first-person-active', FULLSCREEN_TRANSITION_CLASS);
    modeSelect?.classList.remove('hidden');
    document.title = 'Project tQandtD';
    errorHandler.handleError(new AppError(
      'Mode launch failed',
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.ERROR,
      true,
      'Failed to start the selected mode. Please try again.',
      error instanceof Error ? error : undefined
    ));
  } finally {
    setWorldGenerationLoading(false);
    worldEditorModeBtn?.removeAttribute('disabled');
    journeyModeBtn?.removeAttribute('disabled');
  }
}

function returnToMenu(): void {
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  cleanupEngine();
  
  document.body.classList.add(MODE_SELECT_ACTIVE_CLASS);
  document.body.classList.remove(EDITOR_MODE_CLASS, JOURNEY_MODE_CLASS, 'first-person-active');
  
  const modeSelect = document.getElementById('mode-select');
  modeSelect?.classList.remove('hidden');
  
  // If fullscreen, exit
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  document.body.classList.remove('fullscreen-mode');
  
  document.title = 'Project tQandtD';
  
  // Reset button states
  const worldEditorModeBtn = document.getElementById('world-editor-mode-btn') as HTMLButtonElement | null;
  const journeyModeBtn = document.getElementById('journey-mode-btn') as HTMLButtonElement | null;
  worldEditorModeBtn?.removeAttribute('disabled');
  journeyModeBtn?.removeAttribute('disabled');
}

async function requestBrowserFullscreen(): Promise<void> {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
    return;
  }

  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Browsers can deny fullscreen depending on permissions or embedding.
    // The app shell still occupies the full viewport.
  }
}

function waitForFullscreenLayout(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function resizeViewerToContainer(): void {
  const viewerContainer = document.getElementById('viewer');
  if (!viewerContainer || !worldViewer) {
    return;
  }

  worldViewer.resize(viewerContainer.clientWidth, viewerContainer.clientHeight);
}

function getBufferedStreamingRadius(visualRadius: number): number {
  return visualRadius + HORIZON_STREAMING_BUFFER_CHUNKS;
}

function setViewerReady(ready: boolean): void {
  document.getElementById('viewer')?.classList.toggle(VIEWER_READY_CLASS, ready);
}

function setWorldGenerationLoading(visible: boolean): void {
  document.getElementById('loading-indicator')?.classList.toggle('hidden', !visible);
}

function findSpawnPosition(app: WorldApp): { x: number; y: number; z: number } {
  const loadedChunks = app.getLoadedChunksSnapshot();
  const config = app.getConfigSnapshot();
  const chunkSizeTiles = config.chunkSize;
  const seaLevelNorm = 0.3;
  const minHeight = seaLevelNorm + 0.05; // slightly above sea level
  const maxHeight = 0.75; // not on a mountain peak

  let best: { x: number; z: number; h: number } | null = null;
  let bestDistSq = Infinity;

  for (const [, chunk] of loadedChunks) {
    const size = chunk.size;
    const vertexSize = size + 1;
    for (let localY = 0; localY < size; localY++) {
      for (let localX = 0; localX < size; localX++) {
        const biome = chunk.biomeMap[localY * size + localX];
        if (biome === BiomeType.OCEAN) continue;
        const heightNorm = chunk.heightmap[localY * vertexSize + localX];
        if (heightNorm < minHeight || heightNorm > maxHeight) continue;
        const worldX = (chunk.x * size + localX) * TERRAIN_TILE_SIZE_METERS;
        const worldZ = (chunk.y * size + localY) * TERRAIN_TILE_SIZE_METERS;
        const distSq = worldX * worldX + worldZ * worldZ;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          best = { x: worldX, z: worldZ, h: heightNorm };
        }
      }
    }
  }

  if (!best) {
    // Fallback to center, slightly above sea level
    return {
      x: 0,
      y: (seaLevelNorm + 0.1) * TERRAIN_HEIGHT_SCALE_METERS + FIRST_PERSON_EYE_HEIGHT_METERS,
      z: 0,
    };
  }

  return {
    x: best.x,
    y: best.h * TERRAIN_HEIGHT_SCALE_METERS + FIRST_PERSON_EYE_HEIGHT_METERS,
    z: best.z,
  };
}

async function warmUpInitialTerrain(app: WorldApp, viewer: WorldViewer): Promise<void> {
  const cameraPos = viewer.getCameraPosition();
  const chunkSize = app.getConfigSnapshot().chunkSize * TERRAIN_TILE_SIZE_METERS;
  const cameraChunkX = Math.floor(cameraPos.x / chunkSize);
  const cameraChunkY = Math.floor(cameraPos.z / chunkSize);
  const loadRadius = getBufferedStreamingRadius(app.getViewDistance());

  await app.loadChunksAround(cameraChunkX, cameraChunkY, loadRadius);
  await viewer.flushPendingChunkBuilds();
}
