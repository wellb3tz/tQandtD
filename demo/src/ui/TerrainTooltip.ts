/**
 * TerrainTooltip - Shows terrain info (height, biome, coords) on mouse hover.
 * Uses WorldViewer.raycastTerrain() to get hit info, then looks up ChunkData.
 */

import { DemoApp } from '../core/DemoApp';
import { ChunkData } from '../../../src/index';

const BIOME_NAMES: Record<number, string> = {
  0: 'Ocean',      1: 'Beach',      2: 'Desert',     3: 'Plains',
  4: 'Forest',     5: 'Taiga',      6: 'Tundra',     7: 'Mountain',
  8: 'Savanna',    9: 'Swamp',      10: 'Rainforest', 11: 'Volcanic',
  12: 'Glacier'
};

const BIOME_COLORS: Record<number, string> = {
  0:  '#185090', 1:  '#EAD9A5', 2:  '#DEA85A', 3:  '#87BC41',
  4:  '#1E6E1E', 5:  '#285F46', 6:  '#B7C5B7', 7:  '#808080',
  8:  '#CDB750', 9:  '#3C5A32', 10: '#0A5018', 11: '#500A0A',
  12: '#D6EAF4'
};

/** Lake pseudo-biome display values */
const LAKE_NAME  = 'Lake';
const LAKE_COLOR = '#4fc3d4'; // matches DEFAULT_LAKE_RENDER_CONFIG shallow color

/**
 * Check whether a tile index falls inside any lake in the chunk.
 * Returns the lake water level if found, otherwise null.
 */
function getLakeAtTile(chunk: ChunkData, tileIndex: number): number | null {
  if (!chunk.lakes) return null;
  for (const lake of chunk.lakes) {
    if (lake.tiles.has(tileIndex)) return lake.waterLevel;
  }
  return null;
}

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
    try {
      this._update(clientX, clientY);
    } catch (e) {
      // Never let an error kill the RAF loop
      this.hide();
    }
  }

  private _update(clientX: number, clientY: number): void {
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

    // Chunk may not be loaded yet (e.g. right after world regeneration) — hide and wait
    if (!chunk) { this.hide(); return; }

    const tileIndex  = hit.localY * chunk.size + hit.localX;
    const lakeLevel  = getLakeAtTile(chunk, tileIndex);

    const biomeName  = lakeLevel !== null
      ? LAKE_NAME
      : (BIOME_NAMES[chunk.biomeMap[tileIndex]] ?? 'Unknown');
    const biomeColor = lakeLevel !== null
      ? LAKE_COLOR
      : (BIOME_COLORS[chunk.biomeMap[tileIndex]] ?? '#9ca3af');

    const height = hit.height.toFixed(2);
    const wx     = hit.point.x.toFixed(1);
    const wy     = hit.point.z.toFixed(1);

    // Extra row shown only for lakes: water level and depth
    const extraRow = lakeLevel !== null && chunk
      ? (() => {
          const terrainH = chunk.heightmap[hit.localY * (chunk.size + 1) + hit.localX];
          const depth = Math.max(0, lakeLevel - terrainH);
          return `<span>Water level</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${lakeLevel.toFixed(2)}</span>
                  <span>Depth</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${depth.toFixed(2)}</span>`;
        })()
      : '';

    this.el!.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;border-bottom:1px solid rgba(74,222,128,0.15);padding-bottom:5px">
        <span style="width:10px;height:10px;border-radius:50%;background:${biomeColor};flex-shrink:0;display:inline-block"></span>
        <span style="font-weight:700;color:#4ade80;letter-spacing:0.5px;text-transform:uppercase;font-size:10px">${biomeName}</span>
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;color:#9ca3af">
        <span>Height</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${height}</span>
        <span>Position</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${wx}, ${wy}</span>
        <span>Chunk</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${hit.chunkX}, ${hit.chunkY}</span>
        ${extraRow}
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
