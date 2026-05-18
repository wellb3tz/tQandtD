import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export const ATMOSPHERIC_OCEAN_PLANE_COLOR = 0x1d3433;
export const SUN_DISTANCE = 200;

export interface SkyParams {
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  elevation: number;
  azimuth: number;
}

export const DEFAULT_SKY_PARAMS: SkyParams = {
  turbidity: 2,
  rayleigh: 0.5,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.7,
  elevation: 45,
  azimuth: 150,
};

export class AtmosphereController {
  private scene: THREE.Scene;
  private directionalLight: THREE.DirectionalLight;
  private sky: Sky | null = null;
  private skyParams: SkyParams = { ...DEFAULT_SKY_PARAMS };

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
    const phi = THREE.MathUtils.degToRad(90 - this.skyParams.elevation);
    const theta = THREE.MathUtils.degToRad(this.skyParams.azimuth);

    const sunDir = new THREE.Vector3();
    sunDir.setFromSphericalCoords(1, phi, theta);

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

    // Dark base background so the Sky dome is visible behind the terrain
    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = new THREE.FogExp2(0x050810, 0.0012);
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

    const phi = THREE.MathUtils.degToRad(90 - this.skyParams.elevation);
    const theta = THREE.MathUtils.degToRad(this.skyParams.azimuth);

    const sun = new THREE.Vector3();
    sun.setFromSphericalCoords(1, phi, theta);

    this.sky.material.uniforms['sunPosition'].value.copy(sun);
  }

  updateSunAndShadowFocus(activeCamera: THREE.Camera): void {
    this.directionalLight.target.position.set(activeCamera.position.x, 0, activeCamera.position.z);
    this.directionalLight.target.updateMatrixWorld();
    this.updateDirectionalLightPosition();
    this.directionalLight.updateMatrixWorld();
  }

  dispose(): void {
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.material.dispose();
      this.sky = null;
    }
  }
}
