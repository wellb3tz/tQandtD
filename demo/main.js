import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
  ChunkManager,
  BiomeType,
  ResourceType,
  StructureType,
  SerializationFormat,
  LODLevel
} from '../dist/index.js';

// ============================================================================
// Configuration
// ============================================================================

const CHUNK_SIZE = 32;
const HEIGHT_SCALE = 8; // Уменьшено с 20 для более плавного рельефа
let RENDER_DISTANCE = 3;

// ============================================================================
// Three.js Setup
// ============================================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(16, 40, 16);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('canvas'),
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================================================
// Lighting
// ============================================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 150, 100);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Hemisphere light for better ambient
const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x4a5f3a, 0.3);
scene.add(hemiLight);

// ============================================================================
// Controls
// ============================================================================

const controls = new PointerLockControls(camera, document.body);

document.body.addEventListener('click', () => {
  if (!document.querySelector('#ui:hover')) {
    controls.lock();
  }
});

// Movement
const moveSpeed = 0.5;
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

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
  
  // Update position display
  document.getElementById('position').textContent = 
    `${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}`;
}

// ============================================================================
// Biome Colors & Materials
// ============================================================================

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

const resourceColors = {
  [ResourceType.IRON]: 0xb91c1c,
  [ResourceType.GOLD]: 0xfbbf24,
  [ResourceType.COAL]: 0x1f2937,
  [ResourceType.STONE]: 0x9ca3af,
  [ResourceType.WOOD]: 0x92400e,
};

const structureColors = {
  [StructureType.VILLAGE]: 0x8B4513,
  [StructureType.RUINS]: 0x6b7280,
  [StructureType.TOWER]: 0x374151,
};

// ============================================================================
// World Manager
// ============================================================================

let chunkManager;
let currentConfig = {
  seed: 12345,
  enable3DNoise: false,
  zScale: 0.5,
  enableTransitions: true,
  enableMicroBiomes: true,
  enableElevationBands: true,
  enableLOD: false,
  enableIncremental: false,
  timeBudget: 16,
  displayMode: 'biomes',
  showResources: true,
  showStructures: true,
  showRivers: true,
};

function createWorldConfig() {
  const config = {
    seed: currentConfig.seed,
    chunkSize: CHUNK_SIZE,
    maxCacheSize: 100,
    terrainConfig: {
      baseScale: 0.025,        // Увеличено с 0.01 для более крупных форм
      octaves: 3,              // Уменьшено с 4 для более плавного рельефа
      persistence: 0.45,       // Уменьшено с 0.5 для меньшей детализации
      lacunarity: 2.0,
      warpStrength: 12,        // Уменьшено с 30 для меньшего искажения
      heightMultiplier: 1.0
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
        },
        {
          type: ResourceType.GOLD,
          rarity: 0.1,
          biomes: [BiomeType.MOUNTAIN, BiomeType.DESERT],
          minAmount: 3,
          maxAmount: 15
        },
        {
          type: ResourceType.COAL,
          rarity: 0.25,
          biomes: [BiomeType.MOUNTAIN, BiomeType.FOREST],
          minAmount: 8,
          maxAmount: 30
        },
        {
          type: ResourceType.WOOD,
          rarity: 0.4,
          biomes: [BiomeType.FOREST, BiomeType.TAIGA],
          minAmount: 15,
          maxAmount: 60
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
            { type: 'biome', params: { biomes: [BiomeType.PLAINS, BiomeType.DESERT] } },
            { type: 'slope', params: { maxSlope: 0.1 } }
          ]
        },
        {
          type: StructureType.RUINS,
          rarity: 0.8,
          rules: [
            { type: 'biome', params: { biomes: [BiomeType.FOREST, BiomeType.DESERT] } },
            { type: 'slope', params: { maxSlope: 0.15 } }
          ]
        },
        {
          type: StructureType.TOWER,
          rarity: 0.5,
          rules: [
            { type: 'biome', params: { biomes: [BiomeType.MOUNTAIN] } },
            { type: 'elevation', params: { minHeight: 0.6 } }
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
    },
    enablePerformanceMetrics: true
  };

  // Add 3D noise config
  if (currentConfig.enable3DNoise) {
    config.noise3DConfig = {
      enable3D: true,
      zScale: currentConfig.zScale
    };
  }

  // Add enhanced biome config
  config.enhancedBiomeConfig = {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    enableTransitions: currentConfig.enableTransitions,
    transitionWidth: 10,
    enableMicroBiomes: currentConfig.enableMicroBiomes,
    microBiomeFrequency: 0.1,
    microBiomeMaxSize: 20,
    enableElevationBands: currentConfig.enableElevationBands,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75
  };

  // Add LOD config
  if (currentConfig.enableLOD) {
    config.lodConfig = {
      distances: [2, 5],
      meshResolutions: [1.0, 0.5, 0.25],
      featureDensities: [1.0, 0.5, 0.1]
    };
  }

  // Add incremental config
  if (currentConfig.enableIncremental) {
    config.incrementalConfig = {
      enabled: true,
      timeBudgetMs: currentConfig.timeBudget
    };
  }

  return config;
}

function initWorld() {
  showLoading('Initializing world...');
  
  const config = createWorldConfig();
  chunkManager = new ChunkManager(config);
  
  hideLoading();
  showToast('World initialized!');
}

// ============================================================================
// Chunk Rendering
// ============================================================================

const chunkMeshes = new Map();
const chunkObjects = new Map(); // Store all objects per chunk

function getColorForDisplayMode(chunk, index, x, y) {
  const mode = currentConfig.displayMode;
  
  // For biome-based colors, we need to map vertex index to biome index
  // BiomeMap is still CHUNK_SIZE x CHUNK_SIZE, but vertices are (CHUNK_SIZE + 1) x (CHUNK_SIZE + 1)
  // Clamp coordinates to valid biome range
  const biomeX = Math.min(x, CHUNK_SIZE - 1);
  const biomeY = Math.min(y, CHUNK_SIZE - 1);
  const biomeIndex = biomeY * CHUNK_SIZE + biomeX;
  
  switch (mode) {
    case 'biomes':
      const biome = chunk.biomeMap[biomeIndex];
      return new THREE.Color(biomeColors[biome] || 0x808080);
    
    case 'height':
      const height = chunk.heightmap[index];
      return new THREE.Color().setHSL(0.6 - height * 0.6, 0.8, 0.3 + height * 0.4);
    
    case 'moisture':
      // Approximate moisture from biome
      const moistureBiome = chunk.biomeMap[biomeIndex];
      let moisture = 0.5;
      if ([BiomeType.OCEAN, BiomeType.BEACH].includes(moistureBiome)) moisture = 1.0;
      if ([BiomeType.DESERT].includes(moistureBiome)) moisture = 0.1;
      if ([BiomeType.FOREST, BiomeType.TAIGA].includes(moistureBiome)) moisture = 0.8;
      return new THREE.Color().setHSL(0.55, moisture, 0.5);
    
    case 'temperature':
      // Approximate temperature from biome
      const tempBiome = chunk.biomeMap[biomeIndex];
      let temp = 0.5;
      if ([BiomeType.DESERT].includes(tempBiome)) temp = 1.0;
      if ([BiomeType.TUNDRA, BiomeType.MOUNTAIN].includes(tempBiome)) temp = 0.0;
      if ([BiomeType.TAIGA].includes(tempBiome)) temp = 0.3;
      return new THREE.Color().setHSL(temp * 0.15, 0.8, 0.5);
    
    default:
      return new THREE.Color(0x808080);
  }
}

function createChunkMesh(chunkX, chunkY) {
  const key = `${chunkX},${chunkY}`;
  if (chunkMeshes.has(key)) return;

  const startTime = performance.now();
  
  const chunk = chunkManager.getChunk(chunkX, chunkY);
  
  if (!chunk || !chunk.heightmap || !chunk.biomeMap) {
    console.error('Invalid chunk data:', chunk);
    return;
  }

  // Create terrain mesh manually for seamless chunks
  const geometry = new THREE.BufferGeometry();
  
  // Calculate vertices ((CHUNK_SIZE + 1) x (CHUNK_SIZE + 1) grid for seamless boundaries)
  const vertexCount = CHUNK_SIZE + 1;
  const vertices = [];
  const colors = [];
  const indices = [];
  const uvs = [];
  
  // Create vertices - iterate from 0 to CHUNK_SIZE (inclusive) to match heightmap size
  for (let y = 0; y <= CHUNK_SIZE; y++) {
    for (let x = 0; x <= CHUNK_SIZE; x++) {
      const index = y * vertexCount + x;
      const height = chunk.heightmap[index] * HEIGHT_SCALE;
      
      // World position (важно для бесшовности)
      const worldX = x;
      const worldZ = y;
      
      vertices.push(worldX, height, worldZ);
      
      // Colors
      const color = getColorForDisplayMode(chunk, index, x, y);
      colors.push(color.r, color.g, color.b);
      
      // UVs
      uvs.push(x / CHUNK_SIZE, y / CHUNK_SIZE);
    }
  }
  
  // Create triangles - still create CHUNK_SIZE x CHUNK_SIZE quads (2 triangles each)
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const topLeft = y * vertexCount + x;
      const topRight = topLeft + 1;
      const bottomLeft = (y + 1) * vertexCount + x;
      const bottomRight = bottomLeft + 1;
      
      // Two triangles per quad
      indices.push(topLeft, bottomLeft, topRight);
      indices.push(topRight, bottomLeft, bottomRight);
    }
  }
  
  // Set attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    chunkX * CHUNK_SIZE,
    0,
    chunkY * CHUNK_SIZE
  );
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  scene.add(mesh);
  chunkMeshes.set(key, mesh);

  // Store all objects for this chunk
  const objects = [mesh];

  // Add rivers
  if (currentConfig.showRivers && chunk.rivers && chunk.rivers.length > 0) {
    chunk.rivers.forEach(river => {
      const riverGeometry = new THREE.PlaneGeometry(1, 1);
      const riverMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e40af,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const riverMesh = new THREE.Mesh(riverGeometry, riverMaterial);
      
      const worldX = chunkX * CHUNK_SIZE + river.x;
      const worldZ = chunkY * CHUNK_SIZE + river.y;
      const height = chunk.heightmap[river.y * vertexCount + river.x] * HEIGHT_SCALE;
      
      // Реки теперь в той же системе координат что и ландшафт (Y вверх)
      riverMesh.rotation.x = -Math.PI / 2;
      riverMesh.position.set(worldX, height + 0.1, worldZ);
      scene.add(riverMesh);
      objects.push(riverMesh);
    });
  }

  // Add resources
  if (currentConfig.showResources && chunk.resources && chunk.resources.length > 0) {
    chunk.resources.forEach(resource => {
      const worldX = chunkX * CHUNK_SIZE + resource.x;
      const worldZ = chunkY * CHUNK_SIZE + resource.y;
      const height = chunk.heightmap[resource.y * vertexCount + resource.x] * HEIGHT_SCALE;

      const size = Math.min(resource.amount / 20, 2);
      const resourceGeometry = new THREE.SphereGeometry(size * 0.5, 8, 8);
      const resourceMaterial = new THREE.MeshStandardMaterial({
        color: resourceColors[resource.type] || 0xff0000,
        metalness: 0.6,
        roughness: 0.4
      });
      const resourceMesh = new THREE.Mesh(resourceGeometry, resourceMaterial);
      resourceMesh.position.set(worldX, height + size * 0.5, worldZ);
      resourceMesh.castShadow = true;
      scene.add(resourceMesh);
      objects.push(resourceMesh);
    });
  }

  // Add structures
  if (currentConfig.showStructures && chunk.structures && chunk.structures.length > 0) {
    chunk.structures.forEach(structure => {
      const worldX = chunkX * CHUNK_SIZE + structure.x;
      const worldZ = chunkY * CHUNK_SIZE + structure.y;
      const height = chunk.heightmap[structure.y * vertexCount + structure.x] * HEIGHT_SCALE;

      let structureGeometry, structureHeight;
      
      switch (structure.type) {
        case StructureType.VILLAGE:
          structureGeometry = new THREE.BoxGeometry(3, 4, 3);
          structureHeight = 4;
          break;
        case StructureType.RUINS:
          structureGeometry = new THREE.CylinderGeometry(1.5, 2, 3, 8);
          structureHeight = 3;
          break;
        case StructureType.TOWER:
          structureGeometry = new THREE.CylinderGeometry(1, 1.5, 8, 8);
          structureHeight = 8;
          break;
        default:
          structureGeometry = new THREE.BoxGeometry(2, 4, 2);
          structureHeight = 4;
      }

      const structureMaterial = new THREE.MeshStandardMaterial({
        color: structureColors[structure.type] || 0x808080,
        roughness: 0.8,
        metalness: 0.2
      });
      const structureMesh = new THREE.Mesh(structureGeometry, structureMaterial);
      structureMesh.position.set(worldX, height + structureHeight / 2, worldZ);
      structureMesh.castShadow = true;
      structureMesh.receiveShadow = true;
      scene.add(structureMesh);
      objects.push(structureMesh);
    });
  }

  chunkObjects.set(key, objects);
  
  const genTime = performance.now() - startTime;
  document.getElementById('genTime').textContent = `${genTime.toFixed(1)}ms`;
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
  for (const [key, objects] of chunkObjects.entries()) {
    if (!chunksToKeep.has(key)) {
      objects.forEach(obj => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      chunkMeshes.delete(key);
      chunkObjects.delete(key);
    }
  }

  document.getElementById('chunkCount').textContent = chunkMeshes.size;
  
  if (chunkManager) {
    const stats = chunkManager.getCacheStats();
    document.getElementById('cacheSize').textContent = 
      `${stats.size}/${stats.maxSize}`;
  }
}

function clearAllChunks() {
  for (const [key, objects] of chunkObjects.entries()) {
    objects.forEach(obj => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
  chunkMeshes.clear();
  chunkObjects.clear();
}

// ============================================================================
// UI Handlers
// ============================================================================

// Collapsible sections
document.querySelectorAll('.collapsible').forEach(element => {
  element.addEventListener('click', () => {
    const targetId = element.dataset.target;
    const content = document.getElementById(targetId);
    
    element.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
  });
});

// Range inputs
document.getElementById('renderDistance').addEventListener('input', (e) => {
  RENDER_DISTANCE = parseInt(e.target.value);
  document.getElementById('renderDistValue').textContent = RENDER_DISTANCE;
});

document.getElementById('zScale').addEventListener('input', (e) => {
  currentConfig.zScale = parseFloat(e.target.value);
  document.getElementById('zScaleValue').textContent = currentConfig.zScale.toFixed(1);
});

document.getElementById('timeBudget').addEventListener('input', (e) => {
  currentConfig.timeBudget = parseInt(e.target.value);
  document.getElementById('timeBudgetValue').textContent = currentConfig.timeBudget;
});

// Checkboxes
document.getElementById('enable3DNoise').addEventListener('change', (e) => {
  currentConfig.enable3DNoise = e.target.checked;
});

document.getElementById('enableTransitions').addEventListener('change', (e) => {
  currentConfig.enableTransitions = e.target.checked;
});

document.getElementById('enableMicroBiomes').addEventListener('change', (e) => {
  currentConfig.enableMicroBiomes = e.target.checked;
});

document.getElementById('enableElevationBands').addEventListener('change', (e) => {
  currentConfig.enableElevationBands = e.target.checked;
});

document.getElementById('enableLOD').addEventListener('change', (e) => {
  currentConfig.enableLOD = e.target.checked;
});

document.getElementById('enableIncremental').addEventListener('change', (e) => {
  currentConfig.enableIncremental = e.target.checked;
});

document.getElementById('displayMode').addEventListener('change', (e) => {
  currentConfig.displayMode = e.target.value;
  clearAllChunks();
  updateChunks();
});

document.getElementById('showResources').addEventListener('change', (e) => {
  currentConfig.showResources = e.target.checked;
  clearAllChunks();
  updateChunks();
});

document.getElementById('showStructures').addEventListener('change', (e) => {
  currentConfig.showStructures = e.target.checked;
  clearAllChunks();
  updateChunks();
});

document.getElementById('showRivers').addEventListener('change', (e) => {
  currentConfig.showRivers = e.target.checked;
  clearAllChunks();
  updateChunks();
});

// Regenerate button
document.getElementById('regenerate').addEventListener('click', () => {
  const seed = parseInt(document.getElementById('seedInput').value) || 12345;
  currentConfig.seed = seed;

  clearAllChunks();
  if (chunkManager) {
    chunkManager.clearCache();
  }
  
  initWorld();
  updateChunks();
});

// Save world buttons
document.getElementById('saveWorld').addEventListener('click', () => {
  if (!chunkManager) return;
  
  showLoading('Saving world...');
  
  setTimeout(() => {
    const savedWorld = chunkManager.saveWorld({
      format: SerializationFormat.JSON,
      compress: true,
      modifiedOnly: false
    });
    
    const blob = new Blob([JSON.stringify(savedWorld, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-${currentConfig.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    hideLoading();
    showToast(`World saved! (${savedWorld.chunks.length} chunks)`);
  }, 100);
});

document.getElementById('saveWorldBinary').addEventListener('click', () => {
  if (!chunkManager) return;
  
  showLoading('Saving world (binary)...');
  
  setTimeout(() => {
    const blob = chunkManager.exportWorld({
      format: SerializationFormat.BINARY,
      compress: true
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-${currentConfig.seed}.bin`;
    a.click();
    URL.revokeObjectURL(url);
    
    hideLoading();
    showToast('World saved (binary)!');
  }, 100);
});

// Clear cache button
document.getElementById('clearCache').addEventListener('click', () => {
  if (!chunkManager) return;
  
  chunkManager.clearCache();
  clearAllChunks();
  showToast('Cache cleared!');
});

// ============================================================================
// UI Utilities
// ============================================================================

function showLoading(text = 'Loading...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ============================================================================
// Animation Loop
// ============================================================================

let lastTime = performance.now();
let frames = 0;

setInterval(() => {
  document.getElementById('fps').textContent = frames;
  frames = 0;
}, 1000);

function animate() {
  requestAnimationFrame(animate);

  updateMovement();
  updateChunks();

  renderer.render(scene, camera);
  frames++;
}

// ============================================================================
// Window Events
// ============================================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// Initialize
// ============================================================================

initWorld();
updateChunks();
animate();

console.log('🌍 Procedural World Engine Demo');
console.log('Features enabled:', {
  '3D Noise': currentConfig.enable3DNoise,
  'Enhanced Biomes': true,
  'LOD': currentConfig.enableLOD,
  'Incremental': currentConfig.enableIncremental
});
