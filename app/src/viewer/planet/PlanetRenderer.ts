import * as THREE from 'three';
import { PlanetTextureGenerator } from './PlanetTextureGenerator';

export interface PlanetRendererOptions {
  scene: THREE.Scene;
  seed: number;
  radius?: number;
  position?: THREE.Vector3;
}

export interface PlanetHitResult {
  lat: number;   // -PI/2 .. PI/2
  lon: number;   // -PI .. PI
  point: THREE.Vector3;
}

/**
 * Renders a procedural planet sphere with atmosphere glow.
 * Supports raycasting to determine clicked lat/lon coordinates.
 */
export class PlanetRenderer {
  private readonly scene: THREE.Scene;
  private readonly seed: number;
  private readonly radius: number;
  private readonly position: THREE.Vector3;
  private planetMesh: THREE.Mesh | null = null;
  private cloudMesh: THREE.Mesh | null = null;
  private atmosphereMesh: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private visible = false;

  constructor(options: PlanetRendererOptions) {
    this.scene = options.scene;
    this.seed = options.seed;
    this.radius = options.radius ?? 150;
    this.position = options.position ?? new THREE.Vector3(0, 0, 0);
  }

  /**
   * Whether the planet meshes have been built.
   */
  isInitialized(): boolean {
    return this.planetMesh !== null;
  }

  /**
   * Build the planet and atmosphere meshes. Safe to call multiple times (idempotent).
   */
  initialize(): void {
    if (this.planetMesh) return;

    const generator = new PlanetTextureGenerator(this.seed);
    const {
      texture,
      heightMap,
      normalMap,
      roughnessMap,
      cloudTexture,
    } = generator.generate(1024, 512);
    const planetTexture = this.createCanvasTexture(texture, true);
    const planetHeightMap = this.createCanvasTexture(heightMap, false);
    const planetNormalMap = this.createCanvasTexture(normalMap, false);
    const planetRoughnessMap = this.createCanvasTexture(roughnessMap, false);
    const planetCloudTexture = this.createCanvasTexture(cloudTexture, true);

    // Planet sphere
    const geometry = new THREE.SphereGeometry(this.radius, 192, 96);
    const material = new THREE.MeshStandardMaterial({
      map: planetTexture,
      displacementMap: planetHeightMap,
      displacementScale: this.radius * 0.038,
      displacementBias: -this.radius * 0.012,
      normalMap: planetNormalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: planetRoughnessMap,
      roughness: 0.7,
      metalness: 0.0,
    });
    this.planetMesh = new THREE.Mesh(geometry, material);
    this.planetMesh.position.copy(this.position);
    this.planetMesh.name = 'planet-surface';
    this.planetMesh.visible = false;
    this.scene.add(this.planetMesh);

    const cloudGeometry = new THREE.SphereGeometry(this.radius * 1.018, 160, 80);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: planetCloudTexture,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0,
      alphaTest: 0.025,
    });
    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.cloudMesh.position.copy(this.position);
    this.cloudMesh.name = 'planet-clouds';
    this.cloudMesh.visible = false;
    this.cloudMesh.renderOrder = 1;
    this.scene.add(this.cloudMesh);

    // Atmosphere glow (slightly larger sphere with fresnel-like transparency)
    const atmGeometry = new THREE.SphereGeometry(this.radius * 1.08, 64, 32);
    const atmMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        c: { value: 0.52 },
        p: { value: 3.2 },
        glowColor: { value: new THREE.Color(0x5aa7ff) },
        viewVector: { value: new THREE.Vector3(0, 0, 1) },
      },
      vertexShader: `
        uniform vec3 viewVector;
        uniform float c;
        uniform float p;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(c - dot(vNormal, vNormel), p);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          float alpha = clamp(intensity * 0.85, 0.0, 0.75);
          vec3 glow = glowColor * alpha;
          gl_FragColor = vec4(glow, alpha);
        }
      `,
    });
    this.atmosphereMesh = new THREE.Mesh(atmGeometry, atmMaterial);
    this.atmosphereMesh.position.copy(this.position);
    this.atmosphereMesh.name = 'planet-atmosphere';
    this.atmosphereMesh.visible = false;
    this.scene.add(this.atmosphereMesh);
  }

  /**
   * Update the atmosphere shader view vector based on active camera position.
   */
  updateAtmosphere(camera: THREE.Camera): void {
    if (!this.atmosphereMesh) return;
    const mat = this.atmosphereMesh.material as THREE.ShaderMaterial;
    const viewVector = new THREE.Vector3().subVectors(
      camera.position,
      this.atmosphereMesh.position
    ).normalize();
    mat.uniforms.viewVector.value = viewVector;

    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.00035;
    }
  }

  /**
   * Show the planet and atmosphere.
   */
  show(): void {
    this.visible = true;
    if (this.planetMesh) this.planetMesh.visible = true;
    if (this.cloudMesh) this.cloudMesh.visible = true;
    if (this.atmosphereMesh) this.atmosphereMesh.visible = true;
  }

  /**
   * Hide the planet and atmosphere.
   */
  hide(): void {
    this.visible = false;
    if (this.planetMesh) this.planetMesh.visible = false;
    if (this.cloudMesh) this.cloudMesh.visible = false;
    if (this.atmosphereMesh) this.atmosphereMesh.visible = false;
  }

  /**
   * Set planet opacity (affects both planet and atmosphere).
   */
  setOpacity(opacity: number): void {
    if (this.planetMesh) {
      const mat = this.planetMesh.material as THREE.MeshStandardMaterial;
      mat.transparent = opacity < 1.0;
      mat.opacity = opacity;
    }
    if (this.cloudMesh) {
      const mat = this.cloudMesh.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = 0.58 * opacity;
    }
    if (this.atmosphereMesh) {
      const mat = this.atmosphereMesh.material as THREE.ShaderMaterial;
      mat.uniforms.c.value = 0.52 * opacity;
    }
  }

  /**
   * Scale the planet (useful for zoom-in transition).
   */
  setScale(scale: number): void {
    if (this.planetMesh) this.planetMesh.scale.setScalar(scale);
    if (this.cloudMesh) this.cloudMesh.scale.setScalar(scale);
    if (this.atmosphereMesh) this.atmosphereMesh.scale.setScalar(scale);
  }

  /**
   * Raycast from screen coordinates to the planet surface.
   * Returns lat/lon in radians if hit, null otherwise.
   */
  raycast(
    screenX: number,
    screenY: number,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement
  ): PlanetHitResult | null {
    if (!this.planetMesh || !this.visible) return null;

    const ndc = new THREE.Vector2(
      (screenX / canvas.clientWidth) * 2 - 1,
      -(screenY / canvas.clientHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, camera);
    const intersects = this.raycaster.intersectObject(this.planetMesh);

    if (intersects.length === 0) return null;

    const point = intersects[0].point.clone().sub(this.position);
    const r = point.length();
    if (r < 0.001) return null;

    const lat = Math.asin(Math.max(-1, Math.min(1, point.y / r)));
    const lon = Math.atan2(point.z, point.x);

    return { lat, lon, point: intersects[0].point };
  }

  /**
   * Whether the planet is currently visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  private createCanvasTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    if (srgb) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    return texture;
  }

  dispose(): void {
    if (this.planetMesh) {
      this.scene.remove(this.planetMesh);
      this.planetMesh.geometry.dispose();
      const material = this.planetMesh.material as THREE.MeshStandardMaterial;
      material.map?.dispose();
      material.displacementMap?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.dispose();
      this.planetMesh = null;
    }
    if (this.cloudMesh) {
      this.scene.remove(this.cloudMesh);
      this.cloudMesh.geometry.dispose();
      const material = this.cloudMesh.material as THREE.MeshStandardMaterial;
      material.map?.dispose();
      material.dispose();
      this.cloudMesh = null;
    }
    if (this.atmosphereMesh) {
      this.scene.remove(this.atmosphereMesh);
      this.atmosphereMesh.geometry.dispose();
      (this.atmosphereMesh.material as THREE.ShaderMaterial).dispose();
      this.atmosphereMesh = null;
    }
  }
}
