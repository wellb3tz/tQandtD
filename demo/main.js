import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ChunkManager, BiomeType, ResourceType, StructureType } from 'procedural-world-engine';

// World configuration
let currentSeed = 12345;
const CHUNK_SIZE = 32;
const RENDER_DISTANCE = 3; // chunks in each direction
const HEIGHT_SCALE = 20;

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 0);

const renderer = new THREE.WebGLRenderer({ 
  canvas: document.getElementById('canvas'),
  antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Controls
const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => {
  controls.lock();
});

// Movement
const moveSpeed = 0.5;
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

function updateMovement() {
  if (!controls.isLocked) return;
  
  const direction = new THREE.Vector3();
  
  if (keys['KeyW']) direction.z -= 1;
  if (keys['KeyS']) direction.z += 1;
  if (keys['KeyA']) direction.x -= 1;
  if (keys['KeyD']) direction.x += 1;
  if (keys['Space']) camera.position.y += moveSpeed;
  if (keys['ShiftLeft']) camera.position.y -= moveSpeed;
  
  direction.normalize();
  direction.applyQuaternion(camera.quaternion);
  direction.y = 0;
  
  camera.position.add(direction.multiplyScalar(moveSpeed));
}

// Biome colors
const biomeColors = {
  [BiomeType.OCEAN]: 0x1e3a8a,
  [BiomeType.BEACH]: 0xfef3c7,
  [BiomeType.DESERT]: 0xfbbf24,
  [BiomeType.PLAINS]: 0x84cc16,
  [BiomeType.FOREST]: 0x15803d,
  [BiomeType.TAIGA]: 0x065f46,
  [BiomeType.TUNDRA]: 0xe0f2fe,
  [BiomeType.MOUNTAIN]: 0x78716c,
};

// Chunk manager
let chunkManager;

function initWorld(seed) {
  currentSeed = seed;
  chunkManager = new ChunkManager({
    seed: currentSeed,
    chunkSize: CHUNK_SIZE,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 5
    },
    resourceConfig: {
      types: [
        {
          type: ResourceType.STONE,
          rarity: 0.3,
          biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
          minAmount: 10,
          maxAmount: 50
        },
        {
          type: ResourceType.IRON,
          rarity: 0.2,
          biomes: [BiomeType.MOUNTAIN],
          minAmount: 5,
          maxAmount: 20
        }
      ],
      clusterScale: 20,
      densityThreshold: 0.6
    },
    structureConfig: {
      types: [
        {
          type: StructureType.VILLAGE,
          rarity: 1.0,
          rules: [
            { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
            { type: 'slope', params: { maxSlope: 0.1 } }
          ]
        }
      ],
      minDistance: 10,
      maxAttempts: 30
    },
    riverConfig: {
      sourceElevation: 0.7,
      minFlowLength: 10,
      flowWidth: 2
    }
  });
}

// Chunk mesh cache
const chunkMeshes = new Map();

function createChunkMesh(chunkX, chunkY) {
  const key = `${chunkX},${chunkY}`;
  if (chunkMeshes.has(key)) return;

  const chunk = chunkManager.getChunk(chunkX, chunkY);
  
  // Debug: check chunk data
  if (!chunk || !chunk.heightmap || !chunk.biomeMap) {
    console.error('Invalid chunk data:', chunk);
    return;
  }
  
  const geometry = new THREE.PlaneGeometry(
    CHUNK_SIZE, 
    CHUNK_SIZE, 
    CHUNK_SIZE - 1, 
    CHUNK_SIZE - 1
  );
  
  const positions = geometry.attributes.position.array;
  const colors = new Float32Array(positions.length);
  
  for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
    const height = chunk.heightmap[i] * HEIGHT_SCALE;
    positions[i * 3 + 2] = height;
    
    const biome = chunk.biomeMap[i];
    const color = new THREE.Color(biomeColors[biome] || 0x808080);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(
    chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
    0,
    chunkY * CHUNK_SIZE + CHUNK_SIZE / 2
  );
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  
  scene.add(mesh);
  chunkMeshes.set(key, mesh);
  
  // Add structures
  chunk.structures.forEach(structure => {
    const worldX = chunkX * CHUNK_SIZE + structure.x;
    const worldZ = chunkY * CHUNK_SIZE + structure.y;
    const height = chunk.heightmap[structure.y * CHUNK_SIZE + structure.x] * HEIGHT_SCALE;
    
    const structureGeometry = new THREE.BoxGeometry(2, 4, 2);
    const structureMaterial = new THREE.MeshStandardMaterial({ 
      color: structure.type === StructureType.VILLAGE ? 0x8B4513 : 0x808080 
    });
    const structureMesh = new THREE.Mesh(structureGeometry, structureMaterial);
    structureMesh.position.set(worldX, height + 2, worldZ);
    structureMesh.castShadow = true;
    scene.add(structureMesh);
  });
}

function updateChunks() {
  const playerChunkX = Math.floor(camera.position.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(camera.position.z / CHUNK_SIZE);
  
  const chunksToKeep = new Set();
  
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      const chunkX = playerChunkX + dx;
      const chunkZ = playerChunkZ + dz;
      const key = `${chunkX},${chunkZ}`;
      chunksToKeep.add(key);
      
      if (!chunkMeshes.has(key)) {
        createChunkMesh(chunkX, chunkZ);
      }
    }
  }
  
  // Remove far chunks
  for (const [key, mesh] of chunkMeshes.entries()) {
    if (!chunksToKeep.has(key)) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      chunkMeshes.delete(key);
    }
  }
  
  document.getElementById('chunkCount').textContent = chunkMeshes.size;
}

// FPS counter
let lastTime = performance.now();
let frames = 0;
setInterval(() => {
  document.getElementById('fps').textContent = frames;
  frames = 0;
}, 1000);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  updateMovement();
  updateChunks();
  
  renderer.render(scene, camera);
  frames++;
}

// UI handlers
document.getElementById('regenerate').addEventListener('click', () => {
  const seed = parseInt(document.getElementById('seedInput').value) || 12345;
  
  // Clear existing chunks
  for (const [key, mesh] of chunkMeshes.entries()) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  chunkMeshes.clear();
  
  initWorld(seed);
  updateChunks();
});

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
initWorld(currentSeed);
updateChunks();
animate();
