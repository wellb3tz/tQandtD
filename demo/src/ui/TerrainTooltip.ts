/**
 * TerrainTooltip - Shows terrain info (height, biome, coords) on mouse hover.
 * Uses WorldViewer.raycastTerrain() to get hit info, then looks up ChunkData.
 */

import { DemoApp } from '../core/DemoApp';
import { ChunkData } from '../../../src/index';

const BIOME_NAMES: Record<number, string> = {
  0: 'Ocean', 1: 'Beach', 2: 'Desert', 3: 'Plains',
  4: 'Forest', 5: 'Taiga', 6: 'Tundra', 7: 'Mountain'
};

const BIOME_COLORS: Record<number, string> = {
  0: '#4169E1', 1: '#F0E68C', 2: '#DAA520', 3: '#90EE90',
  4: '#228B22', 5: '#326432', 6: '#B0C4DE', 7: '#708090'
};

export class TerrainTooltip {
  private el: HTMLElement | null = null;
  private app: DemoApp | null = null;
  private viewer: any = null;
  private visible = false;
  private rafId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private dirty = false;

  initialize(app: DemoApp, viewer: any): void {
    this.app    = app;
    this.viewer = viewer;

    // Create tooltip element
    this.el = document.createElement('div');
    this.el.id = 'terrain-tooltip';
    this.el.style.cssText = `
      position: fixed;
      z-index: 60;
      pointer-events: none;
      display: none;
      background: rgba(10,14,20,0.5);
      border: 1px solid rgba(74,222,128,0.18);
      border-radius: 6px;
      padding: 8px 12px;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      color: #e5e7eb;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      min-width: 160px;
      line-height: 1.6;
    `;
    document.body.appendChild(this.el);

    // Attach mouse events to the viewer canvas
    const viewerEl = document.getElementById('viewer');
    if (viewerEl) {
      viewerEl.addEventListener('mousemove', this.onMouseMove.bind(this));
      viewerEl.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    }

    // Render loop for tooltip updates
    this.startLoop();
  }

  private onMouseMove(e: MouseEvent): void {
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.dirty = true;
  }

  private onMouseLeave(): void {
    this.hide();
    this.dirty = false;
  }

  private startLoop(): void {
    const loop = () => {
      if (this.dirty) {
        this.dirty = false;
        this.update(this.lastX, this.lastY);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private update(clientX: number, clientY: number): void {
    if (!this.viewer || !this.app) return;

    const viewerEl = document.getElementById('viewer');
    if (!viewerEl) return;

    const rect   = viewerEl.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const hit = this.viewer.raycastTerrain(canvasX, canvasY);
    if (!hit) { this.hide(); return; }

    // Look up chunk data
    const state = this.app.getState();
    const key   = `${hit.chunkX},${hit.chunkY}`;
    const chunk = state.loadedChunks.get(key) as ChunkData | undefined;

    const biomeName  = chunk
      ? (BIOME_NAMES[chunk.biomeMap[hit.localY * chunk.size + hit.localX]] ?? 'Unknown')
      : 'Unknown';
    const biomeColor = chunk
      ? (BIOME_COLORS[chunk.biomeMap[hit.localY * chunk.size + hit.localX]] ?? '#9ca3af')
      : '#9ca3af';

    const height = hit.height.toFixed(2);
    const wx     = hit.point.x.toFixed(1);
    const wy     = hit.point.z.toFixed(1);

    this.el!.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;border-bottom:1px solid rgba(74,222,128,0.15);padding-bottom:5px">
        <span style="width:10px;height:10px;border-radius:50%;background:${biomeColor};flex-shrink:0;display:inline-block"></span>
        <span style="font-weight:700;color:#4ade80;letter-spacing:0.5px;text-transform:uppercase;font-size:10px">${biomeName}</span>
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;color:#9ca3af">
        <span>Height</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${height}</span>
        <span>Position</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${wx}, ${wy}</span>
        <span>Chunk</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${hit.chunkX}, ${hit.chunkY}</span>
      </div>
    `;

    // Position tooltip near cursor, avoid screen edges
    const margin = 16;
    const tw = 180, th = 100;
    let tx = clientX + margin;
    let ty = clientY + margin;
    if (tx + tw > window.innerWidth)  tx = clientX - tw - margin;
    if (ty + th > window.innerHeight) ty = clientY - th - margin;

    this.el!.style.left    = `${tx}px`;
    this.el!.style.top     = `${ty}px`;
    this.el!.style.display = 'block';
    this.visible = true;
  }

  private hide(): void {
    if (this.el) this.el.style.display = 'none';
    this.visible = false;
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.el?.remove();
  }
}
