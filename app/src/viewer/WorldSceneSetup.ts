import * as THREE from 'three';
import {
  AtmosphereController,
  DEFAULT_SKY_PARAMS,
  SUN_DISTANCE,
} from './AtmosphereController';

const SUN_SHADOW_HALF_EXTENT = 3840;
const SUN_SHADOW_CAMERA_FAR = 18000;

export interface WorldSceneObjects {
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  atmosphereController: AtmosphereController;
}

export function setupWorldScene(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): WorldSceneObjects {
  configureRenderer(renderer);

  const ambientLight = new THREE.AmbientLight(0xb5cad6, 0.45);
  scene.add(ambientLight);

  const directionalLight = createSunLight();
  scene.add(directionalLight);

  const atmosphereController = new AtmosphereController(scene, ambientLight, directionalLight);

  const fillLight = new THREE.DirectionalLight(0xc2d7eb, 0.22);
  fillLight.position.set(-60, 40, -40);
  scene.add(fillLight);

  return { ambientLight, directionalLight, atmosphereController };
}

function configureRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
}

function createSunLight(): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xffe2b8, 1.12);

  const phi = THREE.MathUtils.degToRad(90 - DEFAULT_SKY_PARAMS.elevation);
  const theta = THREE.MathUtils.degToRad(DEFAULT_SKY_PARAMS.azimuth);
  const sunDir = new THREE.Vector3();
  sunDir.setFromSphericalCoords(1, phi, theta);
  light.position.set(
    sunDir.x * SUN_DISTANCE,
    sunDir.y * SUN_DISTANCE,
    sunDir.z * SUN_DISTANCE
  );

  light.castShadow = true;
  light.shadow.camera.left = -SUN_SHADOW_HALF_EXTENT;
  light.shadow.camera.right = SUN_SHADOW_HALF_EXTENT;
  light.shadow.camera.top = SUN_SHADOW_HALF_EXTENT;
  light.shadow.camera.bottom = -SUN_SHADOW_HALF_EXTENT;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = SUN_SHADOW_CAMERA_FAR;
  light.shadow.mapSize.width = 4096;
  light.shadow.mapSize.height = 4096;
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.035;
  light.shadow.camera.updateProjectionMatrix();
  return light;
}
