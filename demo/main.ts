/**
 * Main entry point for the Comprehensive Engine Demo
 * 
 * This demo application showcases all features of the procedural world generation engine
 * through an interactive 3D visualization interface built with Three.js.
 */

import { DemoApp, AppEvent, TerrainTool } from './src/core/DemoApp';
import { ControlPanel } from './src/ui/ControlPanel';
import { WorldViewer, RenderLayer } from './src/viewer/WorldViewer';
import { TerrainEditor } from './src/editor/TerrainEditor';
import { WorldManager } from './src/ui/WorldManager';
import { HelpModal } from './src/ui/HelpModal';
import { errorHandler, ErrorCategory, ErrorSeverity, DemoError } from './src/utils/ErrorHandler';

console.log('Procedural World Engine Demo - Initializing...');

// Global app instance
let app: DemoApp | null = null;
let controlPanelInstance: ControlPanel | null = null;
let worldViewer: WorldViewer | null = null;
let terrainEditor: TerrainEditor | null = null;
let worldManager: WorldManager | null = null;
let helpModal: HelpModal | null = null;

// Basic initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, setting up demo application...');
  
  // Check WebGL compatibility first (Requirement 18.4)
  const webglCheck = errorHandler.checkWebGLCompatibility();
  if (!webglCheck.supported) {
    errorHandler.handleError(new DemoError(
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
  const performanceMonitor = document.getElementById('performance-monitor');
  const appHeader = document.querySelector('.app-header') as HTMLElement;
  const worldManagerPanel = document.getElementById('world-manager');
  
  // Camera control buttons
  const resetCameraBtn = document.getElementById('reset-camera-btn');
  const topDownBtn = document.getElementById('top-down-btn');
  const followTerrainBtn = document.getElementById('follow-terrain-btn');
  
  // Camera position display elements
  const cameraXDisplay = document.getElementById('camera-x');
  const cameraYDisplay = document.getElementById('camera-y');
  const cameraZDisplay = document.getElementById('camera-z');
  
  // Initialize DemoApp
  try {
    app = new DemoApp();
    await app.initialize();
    
    // Initialize WorldViewer
    const viewerContainer = document.getElementById('viewer');
    if (viewerContainer) {
      worldViewer = new WorldViewer();
      worldViewer.initialize(viewerContainer);
      console.log('WorldViewer initialized successfully');
      
      // Apply initial visibility state from DemoApp
      const initialState = app.getState();
      worldViewer.setVisibility(RenderLayer.TERRAIN, initialState.showTerrain);
      worldViewer.setVisibility(RenderLayer.BIOMES, initialState.showBiomes);
      worldViewer.setWaterVisibility(initialState.showWater);
      worldViewer.setVisibility(RenderLayer.RESOURCES, initialState.showResources);
      worldViewer.setVisibility(RenderLayer.STRUCTURES, initialState.showStructures);
      worldViewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, initialState.showChunkBoundaries);
      worldViewer.setWireframeMode(initialState.showWireframe);
      
      // Initialize TerrainEditor
      terrainEditor = new TerrainEditor();
      terrainEditor.initialize(app, worldViewer);
      console.log('TerrainEditor initialized successfully');
      
      // Track camera position for LOD updates and dynamic chunk loading
      let lastCameraUpdate = 0;
      let lastChunkLoadCheck = 0;
      const cameraUpdateInterval = 100; // Update LOD every 100ms (requirement 7.6)
      const chunkLoadCheckInterval = 500; // Check for new chunks every 500ms
      
      setInterval(() => {
        if (worldViewer && app) {
          const cameraPos = worldViewer.getCameraPosition();
          const now = performance.now();
          
          // Only update if enough time has passed
          if (now - lastCameraUpdate >= cameraUpdateInterval) {
            app.updateCameraPosition(cameraPos);
            lastCameraUpdate = now;
          }
          
          // Check if we need to load new chunks based on camera position (requirement 2.3, 14.9)
          if (now - lastChunkLoadCheck >= chunkLoadCheckInterval) {
            const chunkSize = 32; // Default chunk size
            const loadRadius = app.getState().viewDistance; // Get view distance from state
            
            // Convert camera world position to chunk coordinates
            const cameraChunkX = Math.floor(cameraPos.x / chunkSize);
            const cameraChunkY = Math.floor(cameraPos.z / chunkSize);
            
            // Load chunks around camera position
            app.loadChunksAround(cameraChunkX, cameraChunkY, loadRadius);
            
            // Unload distant chunks to manage memory
            const unloadDistance = loadRadius + 2; // Unload chunks beyond load radius + 2
            app.unloadDistantChunks(cameraChunkX, cameraChunkY, unloadDistance);
            
            lastChunkLoadCheck = now;
          }
          
          // Update camera position display (requirement 14.8)
          if (cameraXDisplay && cameraYDisplay && cameraZDisplay) {
            cameraXDisplay.textContent = cameraPos.x.toFixed(2);
            cameraYDisplay.textContent = cameraPos.y.toFixed(2);
            cameraZDisplay.textContent = cameraPos.z.toFixed(2);
          }
          
          // Continue incremental generation if enabled
          app.continueIncrementalGeneration();
          
          // Update worker pool statistics if enabled
          if (app.getState().workerPoolEnabled) {
            app.updateWorkerPoolStats();
          }
        }
      }, cameraUpdateInterval);
      
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
      controlPanelInstance.initialize(controlPanelContainer, app, terrainEditor);
      console.log('ControlPanel initialized successfully');
    }
    
    // Initialize WorldManager
    worldManager = new WorldManager();
    worldManager.initialize(app);
    console.log('WorldManager initialized successfully');
    
    // Make world manager panel visible
    const worldManagerPanel = document.getElementById('world-manager');
    if (worldManagerPanel) {
      worldManagerPanel.classList.remove('hidden');
    }
    
    // Initialize HelpModal (requirement 20.1, 20.2)
    helpModal = new HelpModal();
    helpModal.initialize();
    console.log('HelpModal initialized successfully');
    
    // Subscribe to state changes
    app.subscribeToState((state) => {
      updateMetric('chunks-value', state.loadedChunkCount.toString());
      updateMetric('gen-time-value', `${state.avgGenerationTime.toFixed(2)} ms`);
      updateMetric('cache-value', `${(state.cacheHitRate * 100).toFixed(1)}%`);
      
      // Update LOD statistics
      updateMetric('lod-high-value', state.lodHighCount.toString());
      updateMetric('lod-medium-value', state.lodMediumCount.toString());
      updateMetric('lod-low-value', state.lodLowCount.toString());
      
      // Update worker pool statistics
      updateMetric('active-workers-value', state.activeWorkers.toString());
      updateMetric('queued-tasks-value', state.queuedTasks.toString());
      updateMetric('completed-tasks-value', state.completedTasks.toString());
      updateMetric('avg-worker-time-value', `${state.avgWorkerTime.toFixed(2)} ms`);
      
      // Update incremental generation statistics
      updateMetric('chunks-in-progress-value', state.chunksInProgress.size.toString());
      
      // Display stage names for chunks in progress
      const stageNames = ['TERRAIN', 'BIOMES', 'RIVERS', 'RESOURCES', 'STRUCTURES', 'COMPLETE'];
      const stageList = Array.from(state.chunksInProgress.entries())
        .map(([key, stage]) => `${key}: ${stageNames[stage] || 'UNKNOWN'}`)
        .join(', ');
      updateMetric('gen-stage-value', stageList || 'None');
    });
    
    // Set up terrain editing mouse events
    if (viewerContainer && worldViewer && terrainEditor) {
      let isMouseDown = false;
      
      viewerContainer.addEventListener('mousedown', (e) => {
        if (e.button === 0 && app && app.getState().selectedTool !== TerrainTool.NONE) {
          isMouseDown = true;
          // Get canvas-relative coordinates
          const canvas = worldViewer?.getCanvas();
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            app.handleTerrainClick(canvasX, canvasY, worldViewer, terrainEditor);
          }
        }
      });
      
      viewerContainer.addEventListener('mousemove', (e) => {
        if (app && worldViewer && terrainEditor) {
          // Get canvas-relative coordinates
          const canvas = worldViewer.getCanvas();
          const rect = canvas.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;
          
          // Update brush preview
          app.handleMouseMove(canvasX, canvasY, worldViewer, terrainEditor);
          
          // Apply brush if mouse is down
          if (isMouseDown && app.getState().selectedTool !== TerrainTool.NONE) {
            app.handleTerrainClick(canvasX, canvasY, worldViewer, terrainEditor);
          }
        }
      });
      
      viewerContainer.addEventListener('mouseup', () => {
        isMouseDown = false;
      });
      
      viewerContainer.addEventListener('mouseleave', () => {
        isMouseDown = false;
        if (terrainEditor) {
          terrainEditor.hideBrushPreview();
        }
      });
    }
    
    // Listen to app events
    app.on(AppEvent.WORLD_GENERATED, (data) => {
      errorHandler.showSuccessToast(`World generated with seed: ${data.seed}`);
    });
    
    app.on(AppEvent.CHUNK_LOADED, (data) => {
      // Add chunk to viewer
      if (worldViewer) {
        worldViewer.addChunk(data.chunkX, data.chunkY, data.chunk, data.partial, data.stage);
      }
    });
    
    app.on(AppEvent.CHUNK_UNLOADED, (data) => {
      // Remove chunk from viewer
      if (worldViewer) {
        worldViewer.removeChunk(data.chunkX, data.chunkY);
      }
    });
    
    app.on(AppEvent.VISIBILITY_CHANGED, (visibilityState) => {
      // Update WorldViewer layer visibility
      if (worldViewer) {
        const startTime = performance.now();
        
        // Map state properties to RenderLayer enum
        if ('showTerrain' in visibilityState) {
          worldViewer.setVisibility(RenderLayer.TERRAIN, visibilityState.showTerrain);
        }
        if ('showBiomes' in visibilityState) {
          worldViewer.setVisibility(RenderLayer.BIOMES, visibilityState.showBiomes);
        }
        if ('showWater' in visibilityState) {
          worldViewer.setWaterVisibility(visibilityState.showWater);
        }
        if ('showResources' in visibilityState) {
          worldViewer.setVisibility(RenderLayer.RESOURCES, visibilityState.showResources);
        }
        if ('showStructures' in visibilityState) {
          worldViewer.setVisibility(RenderLayer.STRUCTURES, visibilityState.showStructures);
        }
        if ('showChunkBoundaries' in visibilityState) {
          worldViewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, visibilityState.showChunkBoundaries);
        }
        if ('showWireframe' in visibilityState) {
          worldViewer.setWireframeMode(visibilityState.showWireframe);
        }
        
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
      errorHandler.handleError(new DemoError(
        data.message,
        ErrorCategory.GENERATION,
        ErrorSeverity.ERROR,
        true,
        data.message,
        data.error
      ));
    });
    
    // Listen for water configuration changes from ControlPanel
    window.addEventListener('waterConfigChanged', ((event: CustomEvent) => {
      if (worldViewer) {
        const { waterType, property, value } = event.detail;
        const currentConfig = worldViewer.getWaterConfig();
        const updatedConfig = {
          ...currentConfig,
          [waterType]: {
            ...currentConfig[waterType],
            [property]: value
          }
        };
        worldViewer.setWaterConfig(updatedConfig);
        
        // Update all visible chunks to apply new water configuration
        const state = app?.getState();
        if (state) {
          state.loadedChunks.forEach((chunkData, key) => {
            const [chunkX, chunkY] = key.split(',').map(Number);
            worldViewer.updateChunk(chunkX, chunkY, chunkData);
          });
        }
      }
    }) as EventListener);
    
    console.log('DemoApp initialized successfully');
  } catch (error) {
    console.error('Failed to initialize DemoApp:', error);
    errorHandler.handleError(new DemoError(
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
  
  // Toggle performance monitor
  toggleMonitorBtn?.addEventListener('click', () => {
    performanceMonitor?.classList.toggle('hidden');
  });
  
  // Help button (requirement 20.1, 20.2)
  helpBtn?.addEventListener('click', () => {
    if (helpModal) {
      helpModal.show();
    }
  });
  
  // Fullscreen button - hide all UI elements (exit with ESC only)
  let isFullscreen = false;
  
  const toggleFullscreen = () => {
    isFullscreen = !isFullscreen;
    
    if (isFullscreen) {
      // Hide all UI elements
      appHeader?.classList.add('hidden');
      controlPanel?.classList.add('hidden');
      performanceMonitor?.classList.add('hidden');
      worldManagerPanel?.classList.add('hidden');
      document.querySelector('.camera-controls-overlay')?.classList.add('hidden');
      
      // Add fullscreen class to body
      document.body.classList.add('fullscreen-mode');
      
      // Resize viewer to fill screen
      if (worldViewer) {
        setTimeout(() => {
          worldViewer.resize(window.innerWidth, window.innerHeight);
        }, 100);
      }
    } else {
      // Show UI elements
      appHeader?.classList.remove('hidden');
      controlPanel?.classList.remove('hidden');
      performanceMonitor?.classList.remove('hidden');
      worldManagerPanel?.classList.remove('hidden');
      document.querySelector('.camera-controls-overlay')?.classList.remove('hidden');
      
      // Remove fullscreen class from body
      document.body.classList.remove('fullscreen-mode');
      
      // Resize viewer back to normal
      if (worldViewer) {
        const viewerContainer = document.getElementById('viewer');
        if (viewerContainer) {
          setTimeout(() => {
            worldViewer.resize(viewerContainer.clientWidth, viewerContainer.clientHeight);
          }, 100);
        }
      }
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
      performanceMonitor?.classList.add('hidden');
    } else if (width >= 1200) {
      // Auto-expand on wide screens
      controlPanel?.classList.remove('collapsed');
      performanceMonitor?.classList.remove('hidden');
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
      
      console.log(`World generated successfully with ${app.getState().loadedChunkCount} chunks`);
    } catch (error) {
      console.error('Failed to generate world:', error);
      errorHandler.hideProgress(progressId);
      errorHandler.handleError(new DemoError(
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
  
  // Initialize placeholder values in performance monitor
  updateMetric('fps-value', '60');
  updateMetric('vertices-value', '0');
  updateMetric('gen-time-value', '0 ms');
  updateMetric('chunks-value', '0');
  updateMetric('memory-value', '0 MB');
  updateMetric('cache-value', '0%');
  updateMetric('lod-high-value', '0');
  updateMetric('lod-medium-value', '0');
  updateMetric('lod-low-value', '0');
  updateMetric('active-workers-value', '0');
  updateMetric('queued-tasks-value', '0');
  updateMetric('completed-tasks-value', '0');
  updateMetric('avg-worker-time-value', '0 ms');
  updateMetric('chunks-in-progress-value', '0');
  updateMetric('gen-stage-value', 'None');
  
  console.log('Demo application initialized successfully');
});

/**
 * Update a metric display value
 */
function updateMetric(elementId: string, value: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}
