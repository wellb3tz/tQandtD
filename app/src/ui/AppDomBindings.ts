import type { WorldApp } from '../core/WorldApp';
import type { AppModeLifecycle } from '../core/AppModeLifecycle';
import { JOURNEY_MODE_CLASS, MODE_SELECT_ACTIVE_CLASS } from '../core/AppModeLifecycle';
import { warmUpInitialTerrain } from '../core/worldStartup';
import type { WorldViewer } from '../viewer/WorldViewer';
import type { HelpModal } from './HelpModal';
import type { TerrainTooltip } from './TerrainTooltip';
import { AppError, ErrorCategory, ErrorSeverity, errorHandler } from '../utils/ErrorHandler';

export interface AppDomBindingsOptions {
  getApp: () => WorldApp | null;
  getViewer: () => WorldViewer | null;
  getHelpModal: () => HelpModal | null;
  getTerrainTooltip: () => TerrainTooltip | null;
  getModeLifecycle: () => AppModeLifecycle | null;
  cleanupEngine: () => void;
  resizeViewerToContainer: () => void;
  setViewerReady: (ready: boolean) => void;
  setWorldGenerationLoading: (visible: boolean) => void;
}

export function bindAppDomEvents(options: AppDomBindingsOptions): void {
  const generateBtn = document.getElementById('generate-btn');
  const seedInput = document.getElementById('seed-input') as HTMLInputElement | null;
  const toggleControlsBtn = document.getElementById('toggle-controls-btn');
  const toggleMonitorBtn = document.getElementById('toggle-monitor-btn');
  const helpBtn = document.getElementById('help-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const controlPanel = document.getElementById('control-panel');
  const rightPanel = document.getElementById('right-panel');
  const worldEditorModeBtn = document.getElementById('world-editor-mode-btn') as HTMLButtonElement | null;
  const journeyModeBtn = document.getElementById('journey-mode-btn') as HTMLButtonElement | null;

  const resetCameraBtn = document.getElementById('reset-btn');
  const topDownBtn = document.getElementById('top-down-btn');
  const followTerrainBtn = document.getElementById('follow-terrain-btn');
  const firstPersonBtn = document.getElementById('first-person-btn');
  const planetModeBtn = document.getElementById('planet-mode-btn');

  let isFullscreen = false;
  let economyConsoleOpen = false;

  document.getElementById('random-seed-btn')?.addEventListener('click', () => {
    const randomSeed = Math.floor(Math.random() * 999999) + 1;
    if (seedInput) seedInput.value = randomSeed.toString();
  });

  worldEditorModeBtn?.removeAttribute('disabled');
  journeyModeBtn?.removeAttribute('disabled');

  worldEditorModeBtn?.addEventListener('click', async () => {
    economyConsoleOpen = false;
    document.body.classList.remove('economy-console-open');
    await options.getModeLifecycle()?.enterAppMode('world-editor');
  });

  journeyModeBtn?.addEventListener('click', async () => {
    economyConsoleOpen = false;
    document.body.classList.remove('economy-console-open');
    await options.getModeLifecycle()?.enterAppMode('journey');
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      if (!document.body.classList.contains(MODE_SELECT_ACTIVE_CLASS)) {
        economyConsoleOpen = false;
        document.body.classList.remove('economy-console-open');
        options.getModeLifecycle()?.returnToMenu();
      }
    }
    if (e.code === 'Digit1' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      if (document.body.classList.contains(JOURNEY_MODE_CLASS)) {
        e.preventDefault();
        options.getTerrainTooltip()?.toggleEnabled();
      }
    }
    if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      if (document.body.classList.contains(JOURNEY_MODE_CLASS) && !isInteractiveTarget(e.target)) {
        e.preventDefault();
        economyConsoleOpen = !economyConsoleOpen;
        document.body.classList.toggle('economy-console-open', economyConsoleOpen);
        if (economyConsoleOpen && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
    }
    if (e.key === 'Escape') {
      if (economyConsoleOpen) {
        economyConsoleOpen = false;
        document.body.classList.remove('economy-console-open');
        e.preventDefault();
        return;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        document.body.classList.remove('fullscreen-mode');
        resizeViewerLater(options.getViewer);
      }
    }
  });

  toggleControlsBtn?.addEventListener('click', () => {
    controlPanel?.classList.toggle('collapsed');
  });

  document.querySelectorAll('.section-header.clickable').forEach((header) => {
    header.addEventListener('click', () => {
      header.closest('.panel-section')?.classList.toggle('collapsed');
    });
  });

  toggleMonitorBtn?.addEventListener('click', () => {
    rightPanel?.classList.toggle('collapsed');
  });

  helpBtn?.addEventListener('click', () => {
    options.getHelpModal()?.toggle();
  });

  fullscreenBtn?.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    document.body.classList.toggle('fullscreen-mode', isFullscreen);
    resizeViewerLater(options.getViewer);
  });

  const handleResponsiveLayout = () => {
    const width = window.innerWidth;

    if (width < 768) {
      controlPanel?.classList.add('collapsed');
      rightPanel?.classList.add('collapsed');
    } else if (width >= 1200) {
      controlPanel?.classList.remove('collapsed');
    }
  };

  handleResponsiveLayout();

  window.addEventListener('resize', () => {
    handleResponsiveLayout();
    options.resizeViewerToContainer();
  });

  document.addEventListener('fullscreenchange', () => {
    isFullscreen = document.fullscreenElement !== null;
    requestAnimationFrame(() => options.resizeViewerToContainer());
  });

  resetCameraBtn?.addEventListener('click', () => {
    const viewer = options.getViewer();
    if (!viewer) return;

    viewer.resetCamera();
    clearCameraModeButtons(topDownBtn, followTerrainBtn, firstPersonBtn, planetModeBtn);
    document.body.classList.remove('first-person-active');
    errorHandler.showSuccessToast('Camera reset to default position');
  });

  topDownBtn?.addEventListener('click', () => {
    const viewer = options.getViewer();
    if (!viewer) return;

    const isActive = topDownBtn.classList.contains('active');
    viewer.setOrthographicView(!isActive);

    if (!isActive) {
      topDownBtn.classList.add('active');
      clearCameraModeButtons(followTerrainBtn, firstPersonBtn, planetModeBtn);
      document.body.classList.remove('first-person-active');
      errorHandler.showSuccessToast('Top-down orthographic view enabled');
    } else {
      topDownBtn.classList.remove('active');
      errorHandler.showSuccessToast('Perspective view restored');
    }
  });

  followTerrainBtn?.addEventListener('click', () => {
    const viewer = options.getViewer();
    if (!viewer) return;

    const isActive = followTerrainBtn.classList.contains('active');
    viewer.setFollowTerrainMode(!isActive);

    if (!isActive) {
      followTerrainBtn.classList.add('active');
      clearCameraModeButtons(topDownBtn, firstPersonBtn, planetModeBtn);
      document.body.classList.remove('first-person-active');
      errorHandler.showSuccessToast('Follow terrain mode enabled');
    } else {
      followTerrainBtn.classList.remove('active');
      errorHandler.showSuccessToast('Follow terrain mode disabled');
    }
  });

  firstPersonBtn?.addEventListener('click', () => {
    const viewer = options.getViewer();
    if (!viewer) return;

    const isActive = firstPersonBtn.classList.contains('active');
    viewer.setFirstPersonMode(!isActive);

    if (!isActive) {
      firstPersonBtn.classList.add('active');
      clearCameraModeButtons(topDownBtn, followTerrainBtn, planetModeBtn);
      document.body.classList.add('first-person-active');
      errorHandler.showSuccessToast('First-person mode enabled. Click to look around, WASD to walk, Space to jump.');
    } else {
      firstPersonBtn.classList.remove('active');
      document.body.classList.remove('first-person-active');
      errorHandler.showSuccessToast('First-person mode disabled');
    }
  });

  planetModeBtn?.addEventListener('click', () => {
    const viewer = options.getViewer();
    if (!viewer) return;

    viewer.enterPlanetMode();
    planetModeBtn.classList.add('active');
    clearCameraModeButtons(topDownBtn, followTerrainBtn, firstPersonBtn);
    document.body.classList.remove('first-person-active');
    errorHandler.showSuccessToast('Planet mode enabled');
  });

  generateBtn?.addEventListener('click', async () => {
    await generateWorldFromSeed(generateBtn, seedInput, options);
  });

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

  window.addEventListener('planet-clicked', async (e: Event) => {
    const detail = (e as CustomEvent).detail as { lat: number; lon: number };
    await landOnPlanet(detail, planetModeBtn, options);
  });

  window.addEventListener('beforeunload', () => {
    options.cleanupEngine();
  });
}

function clearCameraModeButtons(...buttons: Array<HTMLElement | null>): void {
  buttons.forEach(button => button?.classList.remove('active'));
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest('input, select, textarea, button') !== null;
}

function resizeViewerLater(getViewer: () => WorldViewer | null): void {
  setTimeout(() => getViewer()?.resize(window.innerWidth, window.innerHeight), 100);
}

async function generateWorldFromSeed(
  generateBtn: HTMLElement,
  seedInput: HTMLInputElement | null,
  options: AppDomBindingsOptions
): Promise<void> {
  const app = options.getApp();
  if (!app) {
    errorHandler.showErrorToast('Application not initialized');
    return;
  }

  const seedValue = seedInput?.value || '12345';
  const seed = parseInt(seedValue);

  if (isNaN(seed)) {
    errorHandler.showErrorToast('Invalid seed value. Please enter a valid number.');
    seedInput?.classList.add('validation-error');
    return;
  }

  seedInput?.classList.remove('validation-error');
  options.setWorldGenerationLoading(true);

  const progressId = errorHandler.showProgress('Generating world...', 0);
  generateBtn.setAttribute('disabled', 'true');
  generateBtn.textContent = 'Generating...';

  let progressInterval: ReturnType<typeof setInterval> | null = null;

  try {
    options.setViewerReady(false);

    let progress = 0;
    progressInterval = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      errorHandler.updateProgress(progressId, progress);
    }, 200);

    await app.generateWorld(seed);

    const viewer = options.getViewer();
    if (viewer) {
      await warmUpInitialTerrain(app, viewer);
    }

    options.setViewerReady(true);
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
    options.setViewerReady(true);
  } finally {
    if (progressInterval !== null) {
      clearInterval(progressInterval);
    }

    options.setWorldGenerationLoading(false);
    generateBtn.removeAttribute('disabled');
    generateBtn.textContent = 'Generate';
  }
}

async function landOnPlanet(
  detail: { lat: number; lon: number },
  planetModeBtn: HTMLElement | null,
  options: AppDomBindingsOptions
): Promise<void> {
  const app = options.getApp();
  const viewer = options.getViewer();
  if (!app || !viewer) return;

  await viewer.startLandingTransition(detail.lat, detail.lon);
  planetModeBtn?.classList.remove('active');

  errorHandler.showSuccessToast('Landing on new world...');
  options.setWorldGenerationLoading(true);
  options.setViewerReady(false);

  try {
    await app.landOnPlanet(detail.lat, detail.lon);
    await warmUpInitialTerrain(app, viewer);
    options.setViewerReady(true);
    errorHandler.showSuccessToast(`Landed on new world! Seed: ${app.getSeed()}`);
  } catch (error) {
    console.error('Planet landing failed:', error);
    errorHandler.showErrorToast('Failed to land on planet. Please try again.');
  } finally {
    options.setWorldGenerationLoading(false);
    options.setViewerReady(true);
  }
}
