import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export const ATMOSPHERIC_OCEAN_PLANE_COLOR = 0x1d3433;
export const SUN_DISTANCE = 900;

export interface SkyParams {
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  elevation: number;
  azimuth: number;
}

export const DEFAULT_SKY_PARAMS: SkyParams = {
  turbidity: 1.0,
  rayleigh: 0.1,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.7,
  elevation: 30,
  azimuth: 0,
};

export class AtmosphereController {
  private scene: THREE.Scene;
  private directionalLight: THREE.DirectionalLight;
  private sky: Sky | null = null;
  private skyParams: SkyParams = { ...DEFAULT_SKY_PARAMS };

  private originalBackground: THREE.Color | null = null;
  private readonly shadowFocus = new THREE.Vector3();
  private readonly shadowFocusSnapDelta = new THREE.Vector3();
  private readonly shadowFocusRight = new THREE.Vector3();
  private readonly shadowFocusUp = new THREE.Vector3();
  private readonly shadowFocusForward = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    _ambientLight: THREE.AmbientLight,
    directionalLight: THREE.DirectionalLight
  ) {
    this.scene = scene;
    this.directionalLight = directionalLight;
    this.scene.add(this.directionalLight.target);
    this.initSky();
    this.updateDirectionalLightPosition();
  }

  private updateDirectionalLightPosition(): void {
    const sunDir = this.getSunDirection(new THREE.Vector3());

    const target = this.directionalLight.target.position;
    this.directionalLight.position.set(
      target.x + sunDir.x * SUN_DISTANCE,
      target.y + sunDir.y * SUN_DISTANCE,
      target.z + sunDir.z * SUN_DISTANCE
    );
  }

  private initSky(): void {
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.sky.name = 'sky-dome';
    this.scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = this.skyParams.turbidity;
    uniforms['rayleigh'].value = this.skyParams.rayleigh;
    uniforms['mieCoefficient'].value = this.skyParams.mieCoefficient;
    uniforms['mieDirectionalG'].value = this.skyParams.mieDirectionalG;
    uniforms['up'].value.set(0, 1, 0);

    this.updateSkySunPosition();

    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = null;
  }

  setSkyParams(params: Partial<SkyParams>): void {
    this.skyParams = { ...this.skyParams, ...params };
    if (!this.sky) return;

    const uniforms = this.sky.material.uniforms;
    if (params.turbidity !== undefined) uniforms['turbidity'].value = params.turbidity;
    if (params.rayleigh !== undefined) uniforms['rayleigh'].value = params.rayleigh;
    if (params.mieCoefficient !== undefined) uniforms['mieCoefficient'].value = params.mieCoefficient;
    if (params.mieDirectionalG !== undefined) uniforms['mieDirectionalG'].value = params.mieDirectionalG;
    if (params.elevation !== undefined || params.azimuth !== undefined) {
      this.updateSkySunPosition();
      this.updateDirectionalLightPosition();
    }
  }

  private updateSkySunPosition(): void {
    if (!this.sky) return;

    const sun = this.getSunDirection(new THREE.Vector3());

    this.sky.material.uniforms['sunPosition'].value.copy(sun);
  }

  updateSunAndShadowFocus(activeCamera: THREE.Camera): void {
    const focus = this.getStableShadowFocus(activeCamera);
    this.directionalLight.target.position.copy(focus);
    this.directionalLight.target.updateMatrixWorld();
    this.updateDirectionalLightPosition();
    this.directionalLight.updateMatrixWorld();
  }

  private getStableShadowFocus(activeCamera: THREE.Camera): THREE.Vector3 {
    this.shadowFocus.set(activeCamera.position.x, 0, activeCamera.position.z);

    const shadowCamera = this.directionalLight.shadow.camera;
    const shadowMapSize = this.directionalLight.shadow.mapSize;
    if (!(shadowCamera instanceof THREE.OrthographicCamera) || shadowMapSize.width <= 0 || shadowMapSize.height <= 0) {
      return this.shadowFocus;
    }

    const texelWidth = (shadowCamera.right - shadowCamera.left) / shadowMapSize.width;
    const texelHeight = (shadowCamera.top - shadowCamera.bottom) / shadowMapSize.height;
    if (texelWidth <= 0 || texelHeight <= 0) {
      return this.shadowFocus;
    }

    this.getSunDirection(this.shadowFocusForward).negate();
    this.shadowFocusRight.crossVectors(this.directionalLight.up, this.shadowFocusForward);
    if (this.shadowFocusRight.lengthSq() < 0.000001) {
      this.shadowFocusRight.set(1, 0, 0);
    } else {
      this.shadowFocusRight.normalize();
    }
    this.shadowFocusUp.crossVectors(this.shadowFocusForward, this.shadowFocusRight).normalize();

    const localX = this.shadowFocus.dot(this.shadowFocusRight);
    const localY = this.shadowFocus.dot(this.shadowFocusUp);
    const snappedX = Math.round(localX / texelWidth) * texelWidth;
    const snappedY = Math.round(localY / texelHeight) * texelHeight;

    this.shadowFocusSnapDelta
      .copy(this.shadowFocusRight).multiplyScalar(snappedX - localX)
      .addScaledVector(this.shadowFocusUp, snappedY - localY);

    return this.shadowFocus.add(this.shadowFocusSnapDelta);
  }

  private getSunDirection(target: THREE.Vector3): THREE.Vector3 {
    const phi = THREE.MathUtils.degToRad(90 - this.skyParams.elevation);
    const theta = THREE.MathUtils.degToRad(this.skyParams.azimuth);
    return target.setFromSphericalCoords(1, phi, theta).normalize();
  }

  /**
   * Toggle space mode: hide sky dome and darken background.
   */
  setSpaceMode(enabled: boolean): void {
    if (enabled) {
      if (this.sky) this.sky.visible = false;
      this.originalBackground = this.scene.background instanceof THREE.Color
        ? this.scene.background.clone()
        : null;
      this.scene.fog = null;
    } else {
      if (this.sky) this.sky.visible = true;
      if (this.originalBackground) {
        this.scene.background = this.originalBackground;
      }
      this.scene.fog = null;
    }
  }

  dispose(): void {
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.material.dispose();
      this.sky = null;
    }
  }
}
