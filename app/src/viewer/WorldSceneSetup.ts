import * as THREE from 'three';
import {
  AtmosphereController,
  SUN_LIGHT_OFFSET,
} from './AtmosphereController';

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

  const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
  scene.add(ambientLight);

  const directionalLight = createSunLight();
  scene.add(directionalLight);

  const atmosphereController = new AtmosphereController(scene, ambientLight, directionalLight);

  const fillLight = new THREE.DirectionalLight(0xb0c8e8, 0.15);
  fillLight.position.set(-60, 40, -40);
  scene.add(fillLight);

  return { ambientLight, directionalLight, atmosphereController };
}

function configureRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.81;
}

function createSunLight(): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xffe2b8, 1.12);
  light.position.set(SUN_LIGHT_OFFSET.x, SUN_LIGHT_OFFSET.y, SUN_LIGHT_OFFSET.z);
  light.castShadow = true;
  light.shadow.camera.left = -200;
  light.shadow.camera.right = 200;
  light.shadow.camera.top = 200;
  light.shadow.camera.bottom = -200;
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  light.shadow.bias = -0.0005;
  return light;
}
