import * as THREE from 'three';
import {
  raycastTerrain as defaultRaycastTerrain,
  type RaycastHit,
} from '../utils/coordinates';
import type { ChunkMesh } from './ChunkMesh';

export type TerrainRaycastFunction = (
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  terrainMeshes: THREE.Mesh[],
  chunkSize: number,
  heightScale: number
) => RaycastHit | null;

export interface ViewerTerrainRaycasterOptions {
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  chunks: Iterable<ChunkMesh>;
  getContainer: () => HTMLElement | null;
  chunkSize?: number;
  heightScale?: number;
  raycastTerrain?: TerrainRaycastFunction;
}

export class ViewerTerrainRaycaster {
  private readonly camera: THREE.Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly chunks: Iterable<ChunkMesh>;
  private readonly getContainer: () => HTMLElement | null;
  private readonly chunkSize: number;
  private readonly heightScale: number;
  private readonly raycastTerrain: TerrainRaycastFunction;

  constructor(options: ViewerTerrainRaycasterOptions) {
    this.camera = options.camera;
    this.canvas = options.canvas;
    this.chunks = options.chunks;
    this.getContainer = options.getContainer;
    this.chunkSize = options.chunkSize ?? 32;
    this.heightScale = options.heightScale ?? 50;
    this.raycastTerrain = options.raycastTerrain ?? defaultRaycastTerrain;
  }

  raycast(screenX: number, screenY: number): RaycastHit | null {
    if (!this.getContainer()) {
      return null;
    }

    const terrainMeshes = this.getTerrainMeshes();
    if (terrainMeshes.length === 0) {
      return null;
    }

    return this.raycastTerrain(
      screenX,
      screenY,
      this.camera,
      this.canvas,
      terrainMeshes,
      this.chunkSize,
      this.heightScale
    );
  }

  private getTerrainMeshes(): THREE.Mesh[] {
    const terrainMeshes: THREE.Mesh[] = [];

    for (const chunk of this.chunks) {
      terrainMeshes.push(chunk.terrain);
    }

    return terrainMeshes;
  }
}
