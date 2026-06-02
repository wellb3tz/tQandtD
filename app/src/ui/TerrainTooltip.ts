/**
 * TerrainTooltip - Shows terrain info (height, biome, coords) on mouse hover.
 * Uses WorldViewer.raycastTerrain() to get hit info, then looks up ChunkData.
 */

import { WorldApp } from '../core/WorldApp';
import { JOURNEY_MODE_CLASS } from '../core/AppModeLifecycle';
import { TERRAIN_HEIGHT_SCALE_METERS, type ChunkData } from '@engine/index';
import { getBiomeCssColor, getBiomeDisplayName } from './biomeDisplay';
import { calculateVertexSurfaceWeights, type TerrainSurfaceWeights } from '../viewer/TerrainAttributeBuilder';
import type { TerrainSurfaceKey } from '../viewer/terrain-geometry-types';

const LAKE_NAME  = 'Lake';
const LAKE_COLOR = '#4fc3d4'; // matches DEFAULT_LAKE_RENDER_CONFIG shallow color
const MINIMAP_TOOLTIP_GAP_PX = 10;
const MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX = 14;

const SURFACE_DISPLAY_NAMES: Record<TerrainSurfaceKey, string> = {
  plains: 'Plains',
  desert: 'Desert',
  beach: 'Beach',
  mountainRock: 'Mountain Rock',
  snow: 'Snow',
  forestFloor: 'Forest Floor',
  dryGrass: 'Dry Grass',
  swampMud: 'Swamp Mud',
  volcanicRock: 'Volcanic Rock',
  ice: 'Ice',
  riverbed: 'Riverbed',
};

function formatMeters(value: number, fractionDigits: number): string {
  return `${value.toFixed(fractionDigits)} m`;
}

/**
 * Check whether a tile index falls inside any lake in the chunk.
 * Returns the lake water level if found, otherwise null.
 */
function getLakeAtTile(chunk: ChunkData, tileIndex: number): number | null {
  if (!chunk.lakes) return null;
  for (const lake of chunk.lakes) {
    if (hasTile(lake.tiles, tileIndex)) return lake.waterLevel;
  }
  return null;
}

function hasTile(tiles: unknown, tileIndex: number): boolean {
  if (tiles instanceof Set) return tiles.has(tileIndex);
  if (Array.isArray(tiles)) return tiles.includes(tileIndex);
  const typedTiles = tiles as { includes?: unknown };
  if (ArrayBuffer.isView(tiles) && typeof typedTiles.includes === 'function') {
    return (typedTiles as { includes: (value: number) => boolean }).includes(tileIndex);
  }
  return false;
}

export function formatSurfaceSummary(weights: TerrainSurfaceWeights): string {
  const ranked = (Object.entries(weights) as Array<[TerrainSurfaceKey, number]>)
    .filter(([, weight]) => weight > 0.01)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (ranked.length === 0) {
    return SURFACE_DISPLAY_NAMES.plains;
  }

  return ranked
    .map(([surface, weight]) => {
      const label = SURFACE_DISPLAY_NAMES[surface];
      return weight >= 0.995 ? label : `${label} ${Math.round(weight * 100)}%`;
    })
    .join(' / ');
}

export class TerrainTooltip {
  private el: HTMLElement | null = null;
  private app: WorldApp | null = null;
  private viewer: any = null;
  private visible = false;
  private enabled = true;
  private rafId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private dirty = false;
  private viewerEl: HTMLElement | null = null;
  private readonly handleMouseMove = (e: MouseEvent) => this.onMouseMove(e);
  private readonly handleMouseLeave = () => this.onMouseLeave();

  initialize(app: WorldApp, viewer: any): void {
    this.app    = app;
    this.viewer = viewer;

    this.el = document.createElement('div');
    this.el.id = 'terrain-tooltip';
    this.el.style.cssText = `
      position: fixed;
      z-index: 60;
      pointer-events: none;
      display: none;
      background: rgba(10,14,20,0.5);
      border: 1px solid rgba(180,83,9,0.18);
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

    this.viewerEl = document.getElementById('viewer');
    if (this.viewerEl) {
      this.viewerEl.addEventListener('mousemove', this.handleMouseMove);
      this.viewerEl.addEventListener('mouseleave', this.handleMouseLeave);
    }

    this.startLoop();
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.enabled) {
      this.hide();
      return;
    }

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
      if (this.enabled && this.shouldTrackViewerCenter()) {
        this.updateAtViewerCenter();
      } else if (this.dirty) {
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

  private updateAtViewerCenter(): void {
    const viewerEl = this.viewerEl ?? document.getElementById('viewer');
    if (!viewerEl) return;

    const rect = viewerEl.getBoundingClientRect();
    this.update(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  private shouldTrackViewerCenter(): boolean {
    return document.body.classList.contains(JOURNEY_MODE_CLASS) || document.pointerLockElement === this.viewerEl;
  }

  private _update(clientX: number, clientY: number): void {
    if (!this.enabled) { this.hide(); return; }
    if (!this.viewer || !this.app) return;

    const viewerEl = document.getElementById('viewer');
    if (!viewerEl) return;

    const rect   = viewerEl.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const hit = this.viewer.raycastTerrain(canvasX, canvasY);
    if (!hit) { this.hide(); return; }

    if (this.shouldTrackViewerCenter() && !this.getVisibleMinimapRect()) {
      this.hide();
      return;
    }

    const state = this.app.getState();
    const key   = `${hit.chunkX},${hit.chunkY}`;
    const chunk = (hit.chunkData ?? state.loadedChunks.get(key)) as ChunkData | undefined;

    // Chunk may not be loaded yet (e.g. right after world regeneration) - hide and wait
    if (!chunk) { this.hide(); return; }

    const tileIndex  = hit.localY * chunk.size + hit.localX;
    const lakeLevel  = getLakeAtTile(chunk, tileIndex);

    const biomeName  = lakeLevel !== null
      ? LAKE_NAME
      : getBiomeDisplayName(chunk.biomeMap[tileIndex]);
    const biomeColor = lakeLevel !== null
      ? LAKE_COLOR
      : getBiomeCssColor(chunk.biomeMap[tileIndex]);
    const surfaceSummary = formatSurfaceSummary(calculateVertexSurfaceWeights(chunk, hit.localX, hit.localY));

    const height = formatMeters(hit.height * TERRAIN_HEIGHT_SCALE_METERS, 2);
    const wx     = formatMeters(hit.point.x, 1);
    const wy     = formatMeters(hit.point.z, 1);

    const extraRow = lakeLevel !== null && chunk
      ? (() => {
          const terrainH = chunk.heightmap[hit.localY * (chunk.size + 1) + hit.localX];
          const depth = Math.max(0, lakeLevel - terrainH);
          return `<span>Water level</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${formatMeters(lakeLevel * TERRAIN_HEIGHT_SCALE_METERS, 2)}</span>
                  <span>Depth</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${formatMeters(depth * TERRAIN_HEIGHT_SCALE_METERS, 2)}</span>`;
        })()
      : '';

    this.el!.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;border-bottom:1px solid rgba(180,83,9,0.15);padding-bottom:5px">
        <span style="width:10px;height:10px;border-radius:50%;background:${biomeColor};flex-shrink:0;display:inline-block"></span>
        <div style="min-width:0">
          <div style="font-weight:700;color:#b45309;letter-spacing:0.5px;text-transform:uppercase;font-size:10px">${biomeName}</div>
          <div style="color:#cbd5e1;font-size:10px;line-height:1.35;white-space:normal">Surface: ${surfaceSummary}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;color:#9ca3af">
        <span>Height</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${height}</span>
        <span>Position</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${wx}, ${wy}</span>
        <span>Chunk</span><span style="color:#e5e7eb;font-family:'Courier New',monospace">${hit.chunkX}, ${hit.chunkY}</span>
        ${extraRow}
      </div>
    `;

    this.el!.style.display = 'block';
    this.positionNearMinimap();
    this.visible = true;
  }

  private positionNearMinimap(): void {
    if (!this.el) return;

    this.el.style.transform = 'none';
    const tooltipWidth = this.el.offsetWidth || 180;
    const tooltipHeight = this.el.offsetHeight || 100;
    const minimapRect = this.getVisibleMinimapRect();

    if (minimapRect) {
      const left = Math.max(
        MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX,
        minimapRect.left - tooltipWidth - MINIMAP_TOOLTIP_GAP_PX
      );
      const top = clamp(
        minimapRect.top,
        MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX,
        window.innerHeight - tooltipHeight - MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX
      );

      this.el.style.left = `${left}px`;
      this.el.style.top = `${top}px`;
      return;
    }

    this.el.style.left = `${MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX}px`;
    this.el.style.top = `${Math.max(
      MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX,
      window.innerHeight - tooltipHeight - MINIMAP_TOOLTIP_VIEWPORT_MARGIN_PX
    )}px`;
  }

  private getVisibleMinimapRect(): DOMRect | null {
    const minimapEl = document.querySelector('.minimap-container') as HTMLElement | null;
    if (!minimapEl) return null;

    const style = window.getComputedStyle(minimapEl);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return null;
    }

    const rect = minimapEl.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  private hide(): void {
    if (this.el) this.el.style.display = 'none';
    this.visible = false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.hide();
      this.dirty = false;
    } else if (this.shouldTrackViewerCenter()) {
      this.updateAtViewerCenter();
    }
  }

  toggleEnabled(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.viewerEl) {
      this.viewerEl.removeEventListener('mousemove', this.handleMouseMove);
      this.viewerEl.removeEventListener('mouseleave', this.handleMouseLeave);
      this.viewerEl = null;
    }
    this.el?.remove();
    this.el = null;
    this.app = null;
    this.viewer = null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
