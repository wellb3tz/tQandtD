import { AppError, ErrorCategory, ErrorSeverity, errorHandler } from '../utils/ErrorHandler';
import type { WorldViewer } from '../viewer/WorldViewer';
import type { WorldApp } from './WorldApp';
import { findSpawnPosition, warmUpInitialTerrain } from './worldStartup';
import {
  DEFAULT_JOURNEY_WORLD_SIZE_PRESET,
  isJourneyWorldSizePreset,
  type JourneyWorldSizePreset,
} from './journeyWorldSize';

export const MODE_SELECT_ACTIVE_CLASS = 'mode-select-active';
export const EDITOR_MODE_CLASS = 'world-editor-mode';
export const JOURNEY_MODE_CLASS = 'journey-mode';
export const FULLSCREEN_TRANSITION_CLASS = 'fullscreen-transitioning';

export type AppMode = 'world-editor' | 'journey';

export interface AppModeLifecycleOptions {
  getApp: () => WorldApp | null;
  getViewer: () => WorldViewer | null;
  initEngine: () => Promise<void>;
  cleanupEngine: () => void;
  resizeViewerToContainer: () => void;
  setViewerReady: (ready: boolean) => void;
  setWorldGenerationLoading: (visible: boolean) => void;
}

export interface ReturnToMenuOptions {
  preserveFullscreen?: boolean;
}

export class AppModeLifecycle {
  private readonly getApp: () => WorldApp | null;
  private readonly getViewer: () => WorldViewer | null;
  private readonly initEngine: () => Promise<void>;
  private readonly cleanupEngine: () => void;
  private readonly resizeViewerToContainer: () => void;
  private readonly setViewerReady: (ready: boolean) => void;
  private readonly setWorldGenerationLoading: (visible: boolean) => void;

  constructor(options: AppModeLifecycleOptions) {
    this.getApp = options.getApp;
    this.getViewer = options.getViewer;
    this.initEngine = options.initEngine;
    this.cleanupEngine = options.cleanupEngine;
    this.resizeViewerToContainer = options.resizeViewerToContainer;
    this.setViewerReady = options.setViewerReady;
    this.setWorldGenerationLoading = options.setWorldGenerationLoading;
  }

  async enterAppMode(mode: AppMode): Promise<void> {
    const modeSelect = document.getElementById('mode-select');
    const worldEditorModeBtn = document.getElementById('world-editor-mode-btn') as HTMLButtonElement | null;
    const journeyModeBtn = document.getElementById('journey-mode-btn') as HTMLButtonElement | null;

    worldEditorModeBtn?.setAttribute('disabled', 'true');
    journeyModeBtn?.setAttribute('disabled', 'true');

    try {
      modeSelect?.classList.add('hidden');
      document.body.classList.remove(MODE_SELECT_ACTIVE_CLASS);

      if (mode === 'journey') {
        document.body.classList.add(JOURNEY_MODE_CLASS);
      }

      if (mode === 'world-editor') {
        await this.enterWorldEditorMode();
        return;
      }

      await this.enterJourneyMode();
    } catch (error) {
      console.error('Failed to enter app mode:', error);
      this.cleanupEngine();
      document.body.classList.add(MODE_SELECT_ACTIVE_CLASS);
      document.body.classList.remove(JOURNEY_MODE_CLASS, EDITOR_MODE_CLASS, 'first-person-active', FULLSCREEN_TRANSITION_CLASS, 'economy-console-open', 'journey-minimap-expanded');
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
      this.setWorldGenerationLoading(false);
      worldEditorModeBtn?.removeAttribute('disabled');
      journeyModeBtn?.removeAttribute('disabled');
    }
  }

  returnToMenu(options: ReturnToMenuOptions = {}): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.cleanupEngine();

    document.body.classList.add(MODE_SELECT_ACTIVE_CLASS);
    document.body.classList.remove(EDITOR_MODE_CLASS, JOURNEY_MODE_CLASS, 'first-person-active', 'economy-console-open', 'journey-minimap-expanded');
    document.getElementById('mode-select')?.classList.remove('hidden');

    if (!options.preserveFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (!options.preserveFullscreen) {
      document.body.classList.remove('fullscreen-mode');
    }

    document.title = 'Project tQandtD';

    const worldEditorModeBtn = document.getElementById('world-editor-mode-btn') as HTMLButtonElement | null;
    const journeyModeBtn = document.getElementById('journey-mode-btn') as HTMLButtonElement | null;
    worldEditorModeBtn?.removeAttribute('disabled');
    journeyModeBtn?.removeAttribute('disabled');
  }

  private async enterWorldEditorMode(): Promise<void> {
    this.setWorldGenerationLoading(true);
    this.setViewerReady(false);
    await this.initEngine();
    this.requireApp().setJourneyWorldSize(null);
    this.getViewer()?.setMovementBounds(null);
    await warmUpInitialTerrain(this.requireApp(), this.requireViewer());
    this.setViewerReady(true);
    this.setWorldGenerationLoading(false);
    document.body.classList.remove(JOURNEY_MODE_CLASS, 'first-person-active', 'economy-console-open', 'journey-minimap-expanded');
    document.body.classList.add(EDITOR_MODE_CLASS);
    document.title = 'World Editor - tQandtD';
  }

  private async enterJourneyMode(): Promise<void> {
    document.body.classList.add(FULLSCREEN_TRANSITION_CLASS);
    document.body.classList.remove('economy-console-open', 'journey-minimap-expanded');
    this.setViewerReady(false);
    await requestBrowserFullscreen();
    await waitForFullscreenLayout();
    this.resizeViewerToContainer();
    this.setWorldGenerationLoading(true);
    await this.initEngine();

    const app = this.requireApp();
    const viewer = this.requireViewer();
    const journeySize = app.setJourneyWorldSize(getSelectedJourneyWorldSizePreset())
      ?? app.configureDefaultJourneyWorldSize();

    document.body.classList.remove(EDITOR_MODE_CLASS);
    document.body.classList.add('first-person-active');

    const randomSeed = Math.floor(Math.random() * 999999999) + 1;
    const seedInput = document.getElementById('seed-input') as HTMLInputElement | null;
    const statusSeed = document.getElementById('status-seed');
    if (seedInput) seedInput.value = randomSeed.toString();
    if (statusSeed) statusSeed.textContent = randomSeed.toString();

    await app.generateWorld(randomSeed);
    await warmUpInitialTerrain(app, viewer);

    viewer.setMovementBounds({
      minX: journeySize.bounds.minWorldX,
      maxX: journeySize.bounds.maxWorldX,
      minZ: journeySize.bounds.minWorldZ,
      maxZ: journeySize.bounds.maxWorldZ,
    });
    viewer.setCameraPosition(findSpawnPosition(app));
    viewer.setFirstPersonMode(true);
    await waitForFullscreenLayout();
    this.resizeViewerToContainer();
    document.body.classList.remove(FULLSCREEN_TRANSITION_CLASS);
    this.setViewerReady(true);
    document.title = 'Journey - tQandtD';
  }

  private requireApp(): WorldApp {
    const app = this.getApp();
    if (!app) throw new Error('Engine not initialized');
    return app;
  }

  private requireViewer(): WorldViewer {
    const viewer = this.getViewer();
    if (!viewer) throw new Error('Viewer not initialized');
    return viewer;
  }
}

function getSelectedJourneyWorldSizePreset(): JourneyWorldSizePreset {
  const selected = document.querySelector<HTMLInputElement>('input[name="journey-world-size"]:checked')?.value;
  return isJourneyWorldSizePreset(selected) ? selected : DEFAULT_JOURNEY_WORLD_SIZE_PRESET;
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
      requestAnimationFrame(() => resolve());
    });
  });
}
