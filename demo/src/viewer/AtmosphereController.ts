import * as THREE from 'three';

const ATMOSPHERIC_BACKGROUND_STOPS = {
  sky: {
    top: 0x1d3433,
    bottom: 0x1d3433,
    fog: 0x1d3433,
    fogDensity: 0.00105,
  },
  ocean: {
    top: 0x050810,
    bottom: 0x101b1a,
    fog: 0x101b1a,
    fogDensity: 0.0016,
  },
} as const;

export const ATMOSPHERIC_OCEAN_PLANE_COLOR = 0x1d3433;
export const ATMOSPHERIC_OCEAN_PLANE_SPECULAR = 0x2e4a48;
export const LEGACY_SKY_BACKGROUND_COLOR = 0x87ceeb;
export const SUN_LIGHT_OFFSET = { x: 90, y: 138, z: 56 } as const;

const SUN_VISUAL_DISTANCE = 620;
const SUN_VISUAL_SIZE = 88;

export class AtmosphereController {
  private scene: THREE.Scene;
  private directionalLight: THREE.DirectionalLight;
  private backgroundTexture: THREE.Texture | null = null;
  private sunTexture: THREE.Texture | null = null;
  sunSprite: THREE.Sprite | null = null;

  constructor(
    scene: THREE.Scene,
    _ambientLight: THREE.AmbientLight,
    directionalLight: THREE.DirectionalLight
  ) {
    this.scene = scene;
    this.directionalLight = directionalLight;
    this.scene.add(this.directionalLight.target);
    this.addSunVisual();
    this.setBackgroundMode(false);
  }

  setBackgroundMode(skyMode: boolean): void {
    if (skyMode) {
      const background = ATMOSPHERIC_BACKGROUND_STOPS.sky;
      this.setAtmosphericBackground('sky');
      this.scene.fog = new THREE.FogExp2(background.fog, background.fogDensity);
    } else {
      this.setLegacyBlueBackground();
    }
  }

  updateSunAndShadowFocus(activeCamera: THREE.Camera): void {
    this.directionalLight.target.position.set(activeCamera.position.x, 0, activeCamera.position.z);
    this.directionalLight.position.set(
      activeCamera.position.x + SUN_LIGHT_OFFSET.x,
      SUN_LIGHT_OFFSET.y,
      activeCamera.position.z + SUN_LIGHT_OFFSET.z
    );
    this.directionalLight.target.updateMatrixWorld();
    this.directionalLight.updateMatrixWorld();
    this.syncSunVisualToDirectionalLight();
  }

  dispose(): void {
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose();
      this.backgroundTexture = null;
    }

    if (this.sunSprite) {
      this.scene.remove(this.sunSprite);
      (this.sunSprite.material as THREE.SpriteMaterial).dispose();
      this.sunSprite = null;
    }

    if (this.sunTexture) {
      this.sunTexture.dispose();
      this.sunTexture = null;
    }
  }

  private addSunVisual(): void {
    this.sunTexture = this.createSunSpriteTexture();
    const material = new THREE.SpriteMaterial({
      map: this.sunTexture,
      color: 0xffe8b0,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const sunSprite = new THREE.Sprite(material);
    sunSprite.name = 'directional-light-sun';
    sunSprite.castShadow = false;
    sunSprite.receiveShadow = false;
    sunSprite.renderOrder = 5;
    sunSprite.scale.set(SUN_VISUAL_SIZE, SUN_VISUAL_SIZE, 1);
    this.sunSprite = sunSprite;
    this.syncSunVisualToDirectionalLight();
    this.scene.add(sunSprite);
  }

  private syncSunVisualToDirectionalLight(): void {
    if (!this.sunSprite) {
      return;
    }
    const direction = this.directionalLight.position.clone().sub(this.directionalLight.target.position).normalize();
    this.sunSprite.position.copy(this.directionalLight.target.position).add(direction.multiplyScalar(SUN_VISUAL_DISTANCE));
  }

  private createSunSpriteTexture(): THREE.DataTexture {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    const center = (size - 1) / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const core = Math.max(0, 1 - distance * 1.25);
        const halo = Math.max(0, 1 - distance);
        const alpha = Math.min(1, core * 0.78 + Math.pow(halo, 2.2) * 0.32);
        const offset = (y * size + x) * 4;
        data[offset] = 255;
        data[offset + 1] = Math.round(222 + core * 28);
        data[offset + 2] = Math.round(150 + core * 55);
        data[offset + 3] = Math.round(alpha * 255);
      }
    }

    const texture = new THREE.DataTexture(data, size, size);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  private setLegacyBlueBackground(): void {
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose();
      this.backgroundTexture = null;
    }
    this.scene.background = new THREE.Color(LEGACY_SKY_BACKGROUND_COLOR);
    this.scene.fog = new THREE.FogExp2(LEGACY_SKY_BACKGROUND_COLOR, 0.0012);
  }

  private setAtmosphericBackground(mode: keyof typeof ATMOSPHERIC_BACKGROUND_STOPS): void {
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose();
    }
    this.backgroundTexture = this.createAtmosphericBackgroundTexture(mode);
    this.scene.background = this.backgroundTexture;
  }

  private createAtmosphericBackgroundTexture(mode: keyof typeof ATMOSPHERIC_BACKGROUND_STOPS): THREE.DataTexture {
    const stops = ATMOSPHERIC_BACKGROUND_STOPS[mode];
    const top = {
      r: (stops.top >> 16) & 0xff,
      g: (stops.top >> 8) & 0xff,
      b: stops.top & 0xff,
    };
    const bottom = {
      r: (stops.bottom >> 16) & 0xff,
      g: (stops.bottom >> 8) & 0xff,
      b: stops.bottom & 0xff,
    };
    const width = 96;
    const height = 64;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      const t = y / (height - 1);
      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);
        const n1 = this.smoothValueNoise(u * 3.2, t * 2.1, 31);
        const n2 = this.smoothValueNoise(u * 8.0 + 2.7, t * 5.5 + 1.8, 73);
        const n3 = this.smoothValueNoise(u * 18.0 + 9.1, t * 10.0 + 3.4, 137);
        const cloud = (n1 - 0.5) * 14 + (n2 - 0.5) * 7 + (n3 - 0.5) * 3;
        const band = Math.sin((t * 4.2 + u * 0.7) * Math.PI) * 1.4;
        const vignette = -Math.max(0, Math.abs(u - 0.5) - 0.28) * 18 - Math.max(0, t - 0.82) * 9;
        const offset = (y * width + x) * 4;
        data[offset] = Math.max(0, Math.min(255, Math.round(bottom.r + (top.r - bottom.r) * t + cloud + band + vignette)));
        data[offset + 1] = Math.max(0, Math.min(255, Math.round(bottom.g + (top.g - bottom.g) * t + cloud * 0.92 + band + vignette)));
        data[offset + 2] = Math.max(0, Math.min(255, Math.round(bottom.b + (top.b - bottom.b) * t + cloud * 0.86 + band * 0.85 + vignette)));
        data[offset + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, width, height);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    texture.userData.backgroundMode = mode;
    return texture;
  }

  private smoothValueNoise(x: number, y: number, seed: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const xf = x - x0;
    const yf = y - y0;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const a = this.hashUnit(x0, y0, seed);
    const b = this.hashUnit(x0 + 1, y0, seed);
    const c = this.hashUnit(x0, y0 + 1, seed);
    const d = this.hashUnit(x0 + 1, y0 + 1, seed);
    const topMix = a + (b - a) * sx;
    const bottomMix = c + (d - c) * sx;
    return topMix + (bottomMix - topMix) * sy;
  }

  private hashUnit(x: number, y: number, seed: number): number {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 19.19) * 43758.5453;
    return value - Math.floor(value);
  }
}
