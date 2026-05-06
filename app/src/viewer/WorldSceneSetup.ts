import * as THREE from 'three';
import {
  AtmosphereController,
  ATMOSPHERIC_OCEAN_PLANE_COLOR,
  ATMOSPHERIC_OCEAN_PLANE_SPECULAR,
  LEGACY_SKY_BACKGROUND_COLOR,
  SUN_LIGHT_OFFSET,
} from './AtmosphereController';

export interface WorldSceneObjects {
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  atmosphereController: AtmosphereController;
  backgroundOceanMesh: THREE.Mesh;
}

export function setupWorldScene(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): WorldSceneObjects {
  configureRenderer(renderer);

  const backgroundOceanMesh = createBackgroundOceanMesh();
  scene.add(backgroundOceanMesh);

  const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
  scene.add(ambientLight);

  const directionalLight = createSunLight();
  scene.add(directionalLight);

  const atmosphereController = new AtmosphereController(scene, ambientLight, directionalLight);

  const fillLight = new THREE.DirectionalLight(0xb0c8e8, 0.15);
  fillLight.position.set(-60, 40, -40);
  scene.add(fillLight);

  return { ambientLight, directionalLight, atmosphereController, backgroundOceanMesh };
}

export function setBackgroundOceanMode(backgroundOceanMesh: THREE.Mesh | null, skyMode: boolean): void {
  if (!backgroundOceanMesh) return;

  backgroundOceanMesh.visible = false;
  const material = backgroundOceanMesh.material as THREE.MeshPhongMaterial;
  material.color.set(skyMode ? ATMOSPHERIC_OCEAN_PLANE_COLOR : LEGACY_SKY_BACKGROUND_COLOR);
  material.specular.set(skyMode ? ATMOSPHERIC_OCEAN_PLANE_SPECULAR : LEGACY_SKY_BACKGROUND_COLOR);
  material.shininess = skyMode ? 18 : 22;
}

function configureRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.81;
}

function createBackgroundOceanMesh(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(20000, 20000);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshPhongMaterial({
    color: ATMOSPHERIC_OCEAN_PLANE_COLOR,
    transparent: false,
    shininess: 40,
    specular: new THREE.Color(ATMOSPHERIC_OCEAN_PLANE_SPECULAR),
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'background-ocean';
  mesh.position.set(0, -200, 0);
  mesh.renderOrder = 0;
  mesh.visible = false;
  return mesh;
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
