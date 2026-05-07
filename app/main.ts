/**
 * Main entry point for the tQandtD world app
 * 
 * This browser client connects to the procedural world engine
 * through an interactive 3D visualization interface built with Three.js.
 */

// Import styles
import './styles.css';

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

console.log('tQandtD project - Initializing...');

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
let chunkLoadTimer: ReturnType<typeof setInterval> | null = null;
let performanceTimer: ReturnType<typeof setInterval> | null = null;

// Basic initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, setting up world application...');
  
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
  const toggleStatisticsBtn = document.getElementById('toggle-statistics-btn');
  const hideMonitorBtn = document.getElementById('hide-monitor-btn');
  const hideStatisticsBtn = document.getElementById('hide-statistics-btn');
  const helpBtn = document.getElementById('help-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const controlPanel = document.getElementById('control-panel');
  const performanceMonitorElement = document.getElementById('performance-monitor');
  const worldStatisticsElement = document.getElementById('world-statistics');
  const appHeader = document.querySelector('.app-header') as HTMLElement;

  // Camera control buttons
  const resetCameraBtn = document.getElementById('reset-btn');
  const topDownBtn = document.getElementById('top-down-btn');
  const followTerrainBtn = document.getElementById('follow-terrain-btn');

  // Camera position display elements
  const cameraXDisplay = document.getElementById('camera-x');
  const cameraYDisplay = document.getElementById('camera-y');
  const cameraZDisplay = document.getElementById('camera-z');

  // Status bar elements
  const statusSeed     = document.getElementById('status-seed');
  const statusChunks   = document.getElementById('status-chunks');
  const statusBiome    = document.getElementById('status-biome');
  const statusPosition = document.getElementById('status-position');

  // Compass needle
  const compassNeedle = document.getElementById('compass-needle');

  // Random seed button
  document.getElementById('random-seed-btn')?.addEventListener('click', () => {
    const randomSeed = Math.floor(Math.random() * 999999) + 1;
    if (seedInput) seedInput.value = randomSeed.toString();
  });
  
  // Initialize application core
  try {
    app = new WorldApp();
    await app.initialize();
    
    // Initialize WorldViewer
    const viewerContainer = document.getElementById('viewer');
    if (viewerContainer) {
      worldViewer = new WorldViewer();
      worldViewer.initialize(viewerContainer);
      worldRenderer = new ThreeWorldRendererAdapter({ target: worldViewer });
      app.setRenderer(worldRenderer);
      console.log('WorldViewer initialized successfully');
      
      // Apply initial visibility state from application core
      worldViewer.applyViewerSettings(app.getViewerSettings(), app.getLoadedChunksSnapshot());
      
      // Track camera position for LOD updates and dynamic chunk loading
      let lastCameraUpdate = 0;
      let lastChunkLoadCheck = 0;
      let lastPerformanceUpdate = 0;
      let lastUIUpdate = 0;
      const cameraUpdateInterval = 100; // Update LOD every 100ms (requirement 7.6)
      const chunkLoadCheckInterval = 500; // Check for new chunks every 500ms
      const performanceUpdateInterval = 1000; // Update performance metrics every 1000ms.
      const uiUpdateInterval = 100; // Update UI every 100ms
      
      // FPS tracking
      let frameCount = 0;
      let lastFPSUpdate = performance.now();
      let currentFPS = 60;
      
      // Render loop for FPS tracking and performance updates
      const renderLoop = () => {
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
        
        requestAnimationFrame(renderLoop);
      };
      renderLoop();
      
      // Split work across intervals to avoid frame-time spikes.
      
      // 1. UI update interval (every 100ms)
      uiUpdateTimer = setInterval(() => {
        if (worldViewer && app) {
          const cameraPos = worldViewer.getCameraPosition();
          const now = performance.now();
          
          // Update camera position in app state.
          if (now - lastCameraUpdate >= cameraUpdateInterval) {
            app.updateCameraPosition(cameraPos);
            lastCameraUpdate = now;
          }
          
          // Update lightweight UI elements.
          if (now - lastUIUpdate >= uiUpdateInterval) {
            // Update camera position display
            if (cameraXDisplay && cameraYDisplay && cameraZDisplay) {
              cameraXDisplay.textContent = cameraPos.x.toFixed(2);
              cameraYDisplay.textContent = cameraPos.y.toFixed(2);
              cameraZDisplay.textContent = cameraPos.z.toFixed(2);
            }
            // Update status bar position
            if (statusPosition) {
              statusPosition.textContent = `${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)}`;
            }
            // Update status bar chunks
            if (statusChunks && app) {
              statusChunks.textContent = app.getLoadedChunkCount().toString();
            }
            // Update compass: rotate needle opposite to camera yaw.
            if (compassNeedle) {
              const heading = worldViewer.getCameraHeading();
              compassNeedle.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
            }
            
            lastUIUpdate = now;
          }
        }
      }, uiUpdateInterval);
      
      // 2. Chunk loading interval (every 500ms), executed asynchronously.
      chunkLoadTimer = setInterval(() => {
        if (worldViewer && app) {
          const now = performance.now();
          
          if (now - lastChunkLoadCheck >= chunkLoadCheckInterval) {
            // Run on the next event-loop tick to avoid blocking rendering.
            setTimeout(() => {
              const cameraPos = worldViewer!.getCameraPosition();
              const chunkSize = 32; // Default chunk size
              const loadRadius = app!.getViewDistance();
              
              // Convert camera world position to chunk coordinates
              const cameraChunkX = Math.floor(cameraPos.x / chunkSize);
              const cameraChunkY = Math.floor(cameraPos.z / chunkSize);
              
              // Load chunks around camera position
              app!.loadChunksAround(cameraChunkX, cameraChunkY, loadRadius);
              
              // Unload distant chunks to manage memory
              const unloadDistance = loadRadius + 2;
              app!.unloadDistantChunks(cameraChunkX, cameraChunkY, unloadDistance);
            }, 0);
            
            lastChunkLoadCheck = now;
          }
        }
      }, chunkLoadCheckInterval);
      
      // 3. Performance metrics interval (every 1000ms), executed asynchronously.
      performanceTimer = setInterval(() => {
        if (worldViewer && app) {
          const now = performance.now();
          
          if (now - lastPerformanceUpdate >= performanceUpdateInterval) {
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
      }, performanceUpdateInterval);
      
      // Clean up timers when the page closes.
      window.addEventListener('beforeunload', () => {
        if (uiUpdateTimer !== null) clearInterval(uiUpdateTimer);
        if (chunkLoadTimer !== null) clearInterval(chunkLoadTimer);
        if (performanceTimer !== null) clearInterval(performanceTimer);
        if (worldViewer) worldViewer.dispose();
        if (app) app.destroy();
      });
      
      // Handle window resize
      window.addEventListener('resize', () => {
        if (viewerContainer && worldViewer) {
          worldViewer.resize(viewerContainer.clientWidth, viewerContainer.clientHeight);
        }
      });
    }
    
    // Initialize ControlPanel
    const controlPanelContainer = document.getElementById('control-panel');
    if (controlPanelContainer) {
      controlPanelInstance = new ControlPanel();
      controlPanelInstance.initialize(controlPanelContainer, app);
      console.log('ControlPanel initialized successfully');
    }
    
    // Initialize WorldManager
    worldManager = new WorldManager();
    worldManager.initialize(app);
    console.log('WorldManager initialized successfully');
    
    // World statistics panel is always visible (part of overlay layout)
    
    // Initialize PerformanceMonitor
    const perfMonitorContainer = document.getElementById('performance-monitor');
    if (perfMonitorContainer) {
      performanceMonitor = new PerformanceMonitor();
      performanceMonitor.initialize(perfMonitorContainer);
      console.log('PerformanceMonitor initialized successfully');
    }
    
    // Initialize StatisticsDisplay
    const statisticsContainer = document.getElementById('statistics-display');
    if (statisticsContainer) {
      statisticsDisplay = new StatisticsDisplay();
      statisticsDisplay.initialize(statisticsContainer);
      statisticsDisplay.setApp(app);
      console.log('StatisticsDisplay initialized successfully');
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
      console.log('Minimap initialized successfully');
    }

    // Initialize TerrainTooltip
    if (worldViewer) {
      terrainTooltip = new TerrainTooltip();
      terrainTooltip.initialize(app, worldViewer);
      console.log('TerrainTooltip initialized successfully');
    }

    helpModal = new HelpModal();
    helpModal.initialize();
    
    // Subscribe to state changes and update performance monitor
    app.subscribeToState((state) => {
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
      if (statusSeed) statusSeed.textContent = data.seed.toString();
      errorHandler.showSuccessToast(`World generated with seed: ${data.seed}`);
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
        } else {
          console.log(`Visibility updated in ${updateTime.toFixed(2)}ms`);
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
    
    console.log('Application core initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application core:', error);
    
    // Clean up any timers that might have been created
    if (uiUpdateTimer !== null) clearInterval(uiUpdateTimer);
    if (chunkLoadTimer !== null) clearInterval(chunkLoadTimer);
    if (performanceTimer !== null) clearInterval(performanceTimer);
    
    errorHandler.handleError(new AppError(
      'Application initialization failed',
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.CRITICAL,
      false,
      'Failed to initialize the application. Please reload the page and try again.',
      error instanceof Error ? error : undefined
    ));
    return;
  }
  
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
  
  // Toggle performance monitor
  toggleMonitorBtn?.addEventListener('click', () => {
    performanceMonitorElement?.classList.toggle('hidden');
  });

  hideMonitorBtn?.addEventListener('click', () => {
    performanceMonitorElement?.classList.add('hidden');
  });

  toggleStatisticsBtn?.addEventListener('click', () => {
    worldStatisticsElement?.classList.toggle('hidden');
  });

  hideStatisticsBtn?.addEventListener('click', () => {
    worldStatisticsElement?.classList.add('hidden');
  });
  
  // Help button
  helpBtn?.addEventListener('click', () => {
    helpModal?.toggle();
  });
  
  // Fullscreen button - hide all UI elements (exit with ESC only)
  let isFullscreen = false;
  
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
  
  // ESC key to exit fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen) {
      toggleFullscreen();
    }
  });
  
  // Auto-collapse control panel and performance monitor on narrow screens (requirement 17.5)
  const handleResponsiveLayout = () => {
    const width = window.innerWidth;
    const narrowScreenThreshold = 768; // pixels
    
    if (width < narrowScreenThreshold) {
      // Auto-collapse on narrow screens
      controlPanel?.classList.add('collapsed');
      performanceMonitorElement?.classList.add('hidden');
      worldStatisticsElement?.classList.add('hidden');
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
  });
  
  // Camera control buttons (requirement 14.5, 14.6, 14.7)
  resetCameraBtn?.addEventListener('click', () => {
    if (worldViewer) {
      worldViewer.resetCamera();
      // Remove active state from other buttons
      topDownBtn?.classList.remove('active');
      followTerrainBtn?.classList.remove('active');
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
        errorHandler.showSuccessToast('Follow terrain mode enabled');
      } else {
        followTerrainBtn.classList.remove('active');
        errorHandler.showSuccessToast('Follow terrain mode disabled');
      }
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
    
    console.log(`Generating world with seed: ${seed}`);
    
    // Show loading indicator (requirement 2.4)
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.classList.remove('hidden');
    }
    
    // Show progress bar for long operation (requirement 18.6)
    const progressId = errorHandler.showProgress('Generating world...', 0);
    
    // Disable generate button during generation
    if (generateBtn) {
      generateBtn.setAttribute('disabled', 'true');
      generateBtn.textContent = 'Generating...';
    }
    
    try {
      // Simulate progress updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + 10, 90);
        errorHandler.updateProgress(progressId, progress);
      }, 200);
      
      // Generate world with deterministic seed (requirement 2.6, 2.7)
      await app.generateWorld(seed);
      
      // Complete progress
      clearInterval(progressInterval);
      errorHandler.updateProgress(progressId, 100, 'World generated!');
      
      setTimeout(() => {
        errorHandler.hideProgress(progressId);
      }, 1000);
      
      console.log(`World generated successfully with ${app.getLoadedChunkCount()} chunks`);
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
    } finally {
      // Hide loading indicator
      if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
      }
      
      // Re-enable generate button
      if (generateBtn) {
        generateBtn.removeAttribute('disabled');
        generateBtn.textContent = 'Generate World';
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
  
  console.log('World application initialized successfully');
});

