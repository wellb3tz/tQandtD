/**
 * Minimap - dark top-down terrain overview of loaded chunks.
 * Draws per-tile biome and elevation shading plus the camera marker.
 */

import { WorldApp } from '../core/WorldApp';
import { getBiomeRgb255 } from './biomeDisplay';
import { TERRAIN_TILE_SIZE_METERS } from '@engine/index';

interface MinimapChunk {
  x: number;
  y: number;
  size: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
}

export class Minimap {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private app: WorldApp | null = null;
  private getHeading: (() => number) | null = null;
  private getCamPos: (() => { x: number; y: number; z: number }) | null = null;
  private lastDrawnChunks: unknown = null;

  private readonly CHUNK_SIZE = 32;
  private readonly WIDTH_PX = 224;
  private readonly HEIGHT_PX = 170;

  initialize(
    canvas: HTMLCanvasElement,
    app: WorldApp,
    getHeading: () => number,
    getCamPos: () => { x: number; y: number; z: number }
  ): void {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.app        = app;
    this.getHeading = getHeading;
    this.getCamPos  = getCamPos;

    canvas.width = this.WIDTH_PX;
    canvas.height = this.HEIGHT_PX;

    // Redraw the expensive chunk layer only when the loaded chunk map changes.
    app.subscribeToState((state) => {
      if (state.loadedChunks !== this.lastDrawnChunks) {
        this.draw();
      }
    });
  }

  draw(): void {
    if (!this.ctx || !this.canvas || !this.app) return;
    const ctx = this.ctx;
    const width = this.WIDTH_PX;
    const height = this.HEIGHT_PX;

    ctx.fillStyle = '#061119';
    ctx.fillRect(0, 0, width, height);

    const state = this.app.getState();
    const chunks = state.loadedChunks;
    this.lastDrawnChunks = chunks;
    if (chunks.size === 0) {
      ctx.fillStyle = 'rgba(205, 218, 226, 0.36)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No terrain', width / 2, height / 2);
      return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const chunk of chunks.values()) {
      minX = Math.min(minX, chunk.x); maxX = Math.max(maxX, chunk.x);
      minY = Math.min(minY, chunk.y); maxY = Math.max(maxY, chunk.y);
    }

    const spanTilesX = (maxX - minX + 1) * this.CHUNK_SIZE;
    const spanTilesY = (maxY - minY + 1) * this.CHUNK_SIZE;
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = spanTilesX;
    mapCanvas.height = spanTilesY;
    const mapCtx = mapCanvas.getContext('2d');
    if (!mapCtx) return;
    const pixels = mapCtx.createImageData(spanTilesX, spanTilesY);

    for (const chunk of chunks.values() as IterableIterator<MinimapChunk>) {
      this.paintChunk(pixels, spanTilesX, chunk, minX, minY);
    }
    mapCtx.putImageData(pixels, 0, 0);

    const scale = Math.max(width / spanTilesX, height / spanTilesY);
    const renderedWidth = spanTilesX * scale;
    const renderedHeight = spanTilesY * scale;
    const offX = (width - renderedWidth) / 2;
    const offY = (height - renderedHeight) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mapCanvas, offX, offY, renderedWidth, renderedHeight);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.28, width / 2, height / 2, width * 0.66);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(1, 7, 11, 0.43)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    if (this.getCamPos) {
      const cam = this.getCamPos();
      const tileX = cam.x / TERRAIN_TILE_SIZE_METERS;
      const tileY = cam.z / TERRAIN_TILE_SIZE_METERS;
      const cx = offX + (tileX - minX * this.CHUNK_SIZE) * scale;
      const cy = offY + (tileY - minY * this.CHUNK_SIZE) * scale;

      const heading = this.getHeading ? this.getHeading() : 0;
      const rad = heading * Math.PI / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#f2f6f8';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-6, 7);
      ctx.lineTo(0, 4);
      ctx.lineTo(6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(162, 177, 188, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }

  private paintChunk(
    pixels: ImageData,
    mapWidth: number,
    chunk: MinimapChunk,
    minChunkX: number,
    minChunkY: number
  ): void {
    const size = chunk.size || this.CHUNK_SIZE;
    const vertexSize = size + 1;
    const originX = (chunk.x - minChunkX) * this.CHUNK_SIZE;
    const originY = (chunk.y - minChunkY) * this.CHUNK_SIZE;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tileIndex = y * size + x;
        const heightIndex = y * vertexSize + x;
        const elevation = chunk.heightmap[heightIndex] ?? 0.3;
        const east = chunk.heightmap[heightIndex + 1] ?? elevation;
        const south = chunk.heightmap[heightIndex + vertexSize] ?? elevation;
        const relief = (elevation - east) * 1.8 + (elevation - south) * 2.2;
        const light = this.clamp(0.34 + elevation * 0.36 + relief, 0.2, 0.83);
        const [r, g, b] = getBiomeRgb255(chunk.biomeMap[tileIndex] ?? 0);
        const pixelIndex = ((originY + y) * mapWidth + originX + x) * 4;
        pixels.data[pixelIndex] = Math.round(r * light);
        pixels.data[pixelIndex + 1] = Math.round(g * light);
        pixels.data[pixelIndex + 2] = Math.round(b * light);
        pixels.data[pixelIndex + 3] = 255;
      }
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /** Returns biome name at canvas pixel (for tooltip on minimap hover) */
  getBiomeAtPixel(px: number, py: number): string | null {
    if (!this.app) return null;
    return null;
  }
}
