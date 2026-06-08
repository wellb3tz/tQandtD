/**
 * Minimap - dark top-down terrain overview of loaded chunks.
 * Draws per-tile biome and elevation shading plus the camera marker.
 */

import { WorldApp } from '../core/WorldApp';
import { getBiomeRgb255 } from './biomeDisplay';
import { TERRAIN_TILE_SIZE_METERS } from '@engine/index';
import type { LakeData } from '@engine/gen/lakes';
import type { RiverData } from '@engine/gen/rivers';

export interface MinimapChunk {
  x: number;
  y: number;
  size: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
  lakes?: LakeData[];
  rivers?: RiverData[];
}

interface MinimapWaterPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

const LAKE_WATER: MinimapWaterPixel = { r: 26, g: 96, b: 120, a: 224 };
const FROZEN_WATER: MinimapWaterPixel = { r: 126, g: 176, b: 188, a: 210 };
const DRY_WATER: MinimapWaterPixel = { r: 92, g: 80, b: 62, a: 142 };
const RIVER_WATER = '#1d7890';
const RIVER_FROZEN = '#9fcfd9';
const RIVER_DRY = 'rgba(116, 96, 70, 0.62)';
const UNLOADED_TILE_DARK: MinimapWaterPixel = { r: 8, g: 20, b: 23, a: 255 };
const UNLOADED_TILE_LIGHT: MinimapWaterPixel = { r: 12, g: 29, b: 33, a: 255 };

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
    const width = this.getCanvasDisplayWidth();
    const height = this.getCanvasDisplayHeight();

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

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
    paintMinimapUnloadedTerrain(pixels, spanTilesX);

    for (const chunk of chunks.values() as IterableIterator<MinimapChunk>) {
      this.paintChunk(pixels, spanTilesX, chunk, minX, minY);
    }
    for (const chunk of chunks.values() as IterableIterator<MinimapChunk>) {
      paintMinimapLakes(pixels, spanTilesX, chunk, minX, minY, this.CHUNK_SIZE);
    }
    mapCtx.putImageData(pixels, 0, 0);
    for (const chunk of chunks.values() as IterableIterator<MinimapChunk>) {
      paintMinimapRivers(mapCtx, chunk, minX, minY, this.CHUNK_SIZE);
    }

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

  private getCanvasDisplayWidth(): number {
    const measured = Math.round(this.canvas?.getBoundingClientRect().width ?? 0);
    return measured > 0 ? measured : this.WIDTH_PX;
  }

  private getCanvasDisplayHeight(): number {
    const measured = Math.round(this.canvas?.getBoundingClientRect().height ?? 0);
    return measured > 0 ? measured : this.HEIGHT_PX;
  }

  /** Returns biome name at canvas pixel (for tooltip on minimap hover) */
  getBiomeAtPixel(px: number, py: number): string | null {
    if (!this.app) return null;
    return null;
  }
}

export function paintMinimapLakes(
  pixels: ImageData,
  mapWidth: number,
  chunk: MinimapChunk,
  minChunkX: number,
  minChunkY: number,
  chunkSize = 32
): void {
  const size = chunk.size || chunkSize;
  const originX = (chunk.x - minChunkX) * chunkSize;
  const originY = (chunk.y - minChunkY) * chunkSize;

  for (const lake of chunk.lakes ?? []) {
    const tiles = lake.surfaceTiles ?? lake.tiles;
    const color = lake.state === 'frozen' ? FROZEN_WATER : lake.state === 'dry' ? DRY_WATER : LAKE_WATER;

    for (const tileIndex of tiles) {
      const x = tileIndex % size;
      const y = Math.floor(tileIndex / size);
      if (x < 0 || y < 0 || x >= size || y >= size) continue;

      blendPixel(pixels, ((originY + y) * mapWidth + originX + x) * 4, color);
    }
  }
}

export function paintMinimapUnloadedTerrain(pixels: ImageData, mapWidth: number): void {
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const color = (x + y) % 9 < 2 ? UNLOADED_TILE_LIGHT : UNLOADED_TILE_DARK;
      const pixelIndex = (y * mapWidth + x) * 4;
      pixels.data[pixelIndex] = color.r;
      pixels.data[pixelIndex + 1] = color.g;
      pixels.data[pixelIndex + 2] = color.b;
      pixels.data[pixelIndex + 3] = color.a;
    }
  }
}

function paintMinimapRivers(
  ctx: CanvasRenderingContext2D,
  chunk: MinimapChunk,
  minChunkX: number,
  minChunkY: number,
  chunkSize = 32
): void {
  const originX = (chunk.x - minChunkX) * chunkSize;
  const originY = (chunk.y - minChunkY) * chunkSize;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const river of chunk.rivers ?? []) {
    if (river.points.length < 2) continue;

    ctx.strokeStyle = river.state === 'frozen' ? RIVER_FROZEN : river.state === 'dry' ? RIVER_DRY : RIVER_WATER;
    ctx.globalAlpha = river.state === 'dry' ? 0.68 : 0.92;
    ctx.lineWidth = Math.max(1.15, averageRiverWidth(river) * 0.72);
    ctx.beginPath();
    ctx.moveTo(originX + river.points[0].x + 0.5, originY + river.points[0].y + 0.5);
    for (let i = 1; i < river.points.length; i++) {
      ctx.lineTo(originX + river.points[i].x + 0.5, originY + river.points[i].y + 0.5);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function averageRiverWidth(river: RiverData): number {
  let total = 0;
  for (const point of river.points) {
    total += Number.isFinite(point.width) ? point.width : 1;
  }
  return total / river.points.length;
}

function blendPixel(pixels: ImageData, pixelIndex: number, color: MinimapWaterPixel): void {
  const alpha = color.a / 255;
  pixels.data[pixelIndex] = Math.round(pixels.data[pixelIndex] * (1 - alpha) + color.r * alpha);
  pixels.data[pixelIndex + 1] = Math.round(pixels.data[pixelIndex + 1] * (1 - alpha) + color.g * alpha);
  pixels.data[pixelIndex + 2] = Math.round(pixels.data[pixelIndex + 2] * (1 - alpha) + color.b * alpha);
  pixels.data[pixelIndex + 3] = 255;
}
