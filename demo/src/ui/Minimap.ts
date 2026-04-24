/**
 * Minimap - 2D top-down canvas overview of loaded chunks.
 * Draws biome colors per chunk, camera position marker, and heading arrow.
 */

import { DemoApp } from '../core/DemoApp';
import { BIOME_COLORS } from '../viewer/materials';
import { BiomeType } from '../../../src/index';

const BIOME_NAMES: Record<number, string> = {
  0: 'Ocean', 1: 'Beach', 2: 'Desert', 3: 'Plains',
  4: 'Forest', 5: 'Taiga', 6: 'Tundra', 7: 'Mountain'
};

export class Minimap {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private app: DemoApp | null = null;
  private getHeading: (() => number) | null = null;
  private getCamPos: (() => { x: number; y: number; z: number }) | null = null;

  private readonly CHUNK_SIZE = 32;
  private readonly CELL_PX   = 6;   // pixels per chunk on minimap
  private readonly SIZE_PX   = 180; // canvas size

  initialize(
    canvas: HTMLCanvasElement,
    app: DemoApp,
    getHeading: () => number,
    getCamPos: () => { x: number; y: number; z: number }
  ): void {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.app        = app;
    this.getHeading = getHeading;
    this.getCamPos  = getCamPos;

    canvas.width  = this.SIZE_PX;
    canvas.height = this.SIZE_PX;

    // Redraw on state change
    app.subscribeToState(() => this.draw());
  }

  draw(): void {
    if (!this.ctx || !this.canvas || !this.app) return;
    const ctx  = this.ctx;
    const size = this.SIZE_PX;
    const cell = this.CELL_PX;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    ctx.fillRect(0, 0, size, size);

    const state = this.app.getState();
    const chunks = state.loadedChunks;
    if (chunks.size === 0) {
      ctx.fillStyle = 'rgba(74,222,128,0.3)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No world generated', size / 2, size / 2);
      return;
    }

    // Find bounds of loaded chunks
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const chunk of chunks.values()) {
      minX = Math.min(minX, chunk.x); maxX = Math.max(maxX, chunk.x);
      minY = Math.min(minY, chunk.y); maxY = Math.max(maxY, chunk.y);
    }

    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;

    // Scale so all chunks fit in canvas with padding
    const padding = 10;
    const availW  = size - padding * 2;
    const availH  = size - padding * 2;
    const scale   = Math.min(availW / (spanX * cell), availH / (spanY * cell), 1);
    const cellS   = Math.max(2, Math.floor(cell * scale));

    const totalW  = spanX * cellS;
    const totalH  = spanY * cellS;
    const offX    = padding + (availW - totalW) / 2;
    const offY    = padding + (availH - totalH) / 2;

    // Draw chunks
    for (const chunk of chunks.values()) {
      const px = offX + (chunk.x - minX) * cellS;
      const py = offY + (chunk.y - minY) * cellS;

      // Dominant biome color
      const biomeCount = new Map<number, number>();
      for (let i = 0; i < chunk.biomeMap.length; i++) {
        const b = chunk.biomeMap[i];
        biomeCount.set(b, (biomeCount.get(b) ?? 0) + 1);
      }
      let dominant = 0, maxCount = 0;
      biomeCount.forEach((cnt, b) => { if (cnt > maxCount) { maxCount = cnt; dominant = b; } });

      const col = BIOME_COLORS[dominant as BiomeType] ?? { r: 0.5, g: 0.5, b: 0.5 };
      const r   = Math.round(col.r * 255);
      const g   = Math.round(col.g * 255);
      const b   = Math.round(col.b * 255);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px, py, cellS - 1, cellS - 1);
    }

    // Camera position marker
    if (this.getCamPos) {
      const cam = this.getCamPos();
      const camChunkX = Math.floor(cam.x / this.CHUNK_SIZE);
      const camChunkY = Math.floor(cam.z / this.CHUNK_SIZE);

      const cx = offX + (camChunkX - minX) * cellS + cellS / 2;
      const cy = offY + (camChunkY - minY) * cellS + cellS / 2;

      // Heading arrow
      const heading = this.getHeading ? this.getHeading() : 0;
      const rad     = (heading - 90) * Math.PI / 180; // rotate so 0° = up
      const arrowLen = 8;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);

      // Arrow body
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, arrowLen);
      ctx.lineTo(0, -arrowLen);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(0, -arrowLen);
      ctx.lineTo(-3, -arrowLen + 5);
      ctx.lineTo(3, -arrowLen + 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Dot at camera position
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = 'rgba(74,222,128,0.25)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  /** Returns biome name at canvas pixel (for tooltip on minimap hover) */
  getBiomeAtPixel(px: number, py: number): string | null {
    if (!this.app) return null;
    // Reverse-map pixel to chunk — simplified, just return null for now
    return null;
  }
}
