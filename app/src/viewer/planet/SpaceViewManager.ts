import * as THREE from 'three';
import { SeededRNG } from '@engine/core/rng';

export interface SpaceViewManagerOptions {
  scene: THREE.Scene;
  starCount?: number;
  starSeed?: number;
}

/**
 * Manages space background: starfield, sky dome visibility toggle.
 */
export class SpaceViewManager {
  private readonly scene: THREE.Scene;
  private stars: THREE.Points | null = null;
  private starCount: number;
  private originalBackground: THREE.Color | THREE.Texture | null = null;
  private originalFog: THREE.Fog | THREE.FogExp2 | null = null;

  constructor(options: SpaceViewManagerOptions) {
    this.scene = options.scene;
    this.starCount = options.starCount ?? 1500;
  }

  /**
   * Build the starfield. Call once after scene setup.
   */
  initialize(): void {
    if (this.stars) return;

    const rng = new SeededRNG(42);
    const positions = new Float32Array(this.starCount * 3);
    const colors = new Float32Array(this.starCount * 3);

    for (let i = 0; i < this.starCount; i++) {
      // Distribute stars on a large sphere shell
      const theta = rng.nextFloat() * Math.PI * 2;
      const phi = Math.acos(2 * rng.nextFloat() - 1);
      const radius = 800 + rng.nextFloat() * 400;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Star color: mostly white, some warm/cool tints
      const tint = rng.nextFloat();
      if (tint < 0.1) {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.6;
      } else if (tint < 0.2) {
        colors[i * 3] = 0.6;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.stars = new THREE.Points(geometry, material);
    this.stars.name = 'starfield';
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  /**
   * Enter space mode: show stars, darken background, remove fog.
   */
  enterSpace(): void {
    this.originalBackground = this.scene.background;
    this.originalFog = this.scene.fog;

    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = null;
    if (this.stars) this.stars.visible = true;
  }

  /**
   * Exit space mode: restore sky background and fog.
   */
  exitSpace(): void {
    this.scene.background = this.originalBackground ?? new THREE.Color(0x050810);
    this.scene.fog = this.originalFog;
    if (this.stars) this.stars.visible = false;
  }

  /**
   * Fade star opacity (0..1).
   */
  setStarOpacity(opacity: number): void {
    if (!this.stars) return;
    (this.stars.material as THREE.PointsMaterial).opacity = opacity;
  }

  dispose(): void {
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      (this.stars.material as THREE.PointsMaterial).dispose();
      this.stars = null;
    }
  }
}
