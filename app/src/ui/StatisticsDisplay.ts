/**
 * StatisticsDisplay - Binds to existing HTML elements and updates values.
 * Does NOT create or clear any markup - all structure is in index.html.
 */

import { WorldApp, AppState } from '../core/WorldApp';

export class StatisticsDisplay {
  private container: HTMLElement | null = null;
  private app: WorldApp | null = null;

  private chunkCountElement: HTMLElement | null = null;
  private lastLoadedChunkCount: number | null = null;

  initialize(container: HTMLElement): void {
    this.container = container;

    this.chunkCountElement = document.getElementById('stat-chunk-count');
  }

  updateChunkCount(count: number): void {
    if (this.chunkCountElement) this.chunkCountElement.textContent = count.toString();
  }

  refresh(): void {
    if (!this.app) return;
    this.updateChunkCount(this.app.getState().loadedChunkCount);
  }

  setApp(app: WorldApp): void {
    this.app = app;
    app.subscribeToState((state: AppState) => {
      if (state.loadedChunkCount !== this.lastLoadedChunkCount) {
        this.updateChunkCount(state.loadedChunkCount);
        this.lastLoadedChunkCount = state.loadedChunkCount;
      }
    });
  }

  show():    void { this.container?.classList.remove('hidden'); }
  hide():    void { this.container?.classList.add('hidden'); }
  dispose(): void { this.container = null; this.app = null; }
}
