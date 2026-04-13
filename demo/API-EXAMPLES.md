# API Examples - Procedural World Engine Demo

Примеры использования API движка в демо приложении.

## Базовая инициализация

```javascript
import { ChunkManager, BiomeType, ResourceType, StructureType } from '../dist/index.js';

const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  maxCacheSize: 100,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  }
});

// Получить чанк
const chunk = chunkManager.getChunk(0, 0);
console.log(chunk.heightmap); // Float32Array высот
console.log(chunk.biomeMap);  // Uint8Array биомов
```

## 3D Noise (Объёмный шум)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  // Включить 3D noise
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5  // Масштаб по оси Z
  },
  
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  }
});

// 3D noise автоматически используется при генерации
const chunk = chunkManager.getChunk(0, 0);
```

## Enhanced Biomes (Улучшенные биомы)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  enhancedBiomeConfig: {
    // Базовые настройки
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
    
    // Плавные переходы
    enableTransitions: true,
    transitionWidth: 10,
    
    // Микро-биомы
    enableMicroBiomes: true,
    microBiomeFrequency: 0.1,
    microBiomeMaxSize: 20,
    
    // Высотные пояса
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75
  }
});

const chunk = chunkManager.getChunk(0, 0);

// Доступ к улучшенным данным биомов
if (chunk.enhancedBiomeData) {
  console.log('Transitions:', chunk.enhancedBiomeData.transitions);
  console.log('Micro-biomes:', chunk.enhancedBiomeData.microBiomes);
  console.log('Elevation bands:', chunk.enhancedBiomeData.elevationBands);
}
```

## Resources (Ресурсы)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  resourceConfig: {
    types: [
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
        type: ResourceType.WOOD,
        rarity: 0.4,
        biomes: [BiomeType.FOREST, BiomeType.TAIGA],
        minAmount: 15,
        maxAmount: 60
      }
    ],
    clusterScale: 20,
    densityThreshold: 0.6
  }
});

const chunk = chunkManager.getChunk(0, 0);

// Обработка ресурсов
chunk.resources.forEach(resource => {
  console.log(`Resource: ${resource.type} at (${resource.x}, ${resource.y})`);
  console.log(`Amount: ${resource.amount}`);
  
  // Визуализация в Three.js
  const worldX = chunkX * CHUNK_SIZE + resource.x;
  const worldZ = chunkY * CHUNK_SIZE + resource.y;
  const height = chunk.heightmap[resource.y * CHUNK_SIZE + resource.x] * HEIGHT_SCALE;
  
  const geometry = new THREE.SphereGeometry(resource.amount / 20, 8, 8);
  const material = new THREE.MeshStandardMaterial({ color: getResourceColor(resource.type) });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(worldX, height, worldZ);
  scene.add(mesh);
});
```

## Structures (Структуры)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } }
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
  }
});

const chunk = chunkManager.getChunk(0, 0);

// Обработка структур
chunk.structures.forEach(structure => {
  console.log(`Structure: ${structure.type} at (${structure.x}, ${structure.y})`);
  
  const worldX = chunkX * CHUNK_SIZE + structure.x;
  const worldZ = chunkY * CHUNK_SIZE + structure.y;
  const height = chunk.heightmap[structure.y * CHUNK_SIZE + structure.x] * HEIGHT_SCALE;
  
  let geometry;
  switch (structure.type) {
    case StructureType.VILLAGE:
      geometry = new THREE.BoxGeometry(3, 4, 3);
      break;
    case StructureType.TOWER:
      geometry = new THREE.CylinderGeometry(1, 1.5, 8, 8);
      break;
    default:
      geometry = new THREE.BoxGeometry(2, 4, 2);
  }
  
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(worldX, height + 2, worldZ);
  scene.add(mesh);
});
```

## LOD System (Уровни детализации)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  lodConfig: {
    distances: [2, 5],              // Пороги расстояния в чанках
    meshResolutions: [1.0, 0.5, 0.25],  // Множители разрешения
    featureDensities: [1.0, 0.5, 0.1]   // Множители плотности объектов
  }
});

// LOD автоматически применяется при генерации
const chunk = chunkManager.getChunk(5, 5);

// Проверка уровня LOD
console.log('LOD Level:', chunk.lodLevel); // HIGH, MEDIUM, или LOW

// Адаптация рендеринга под LOD
function createChunkMesh(chunk, lodLevel) {
  let resolution;
  switch (lodLevel) {
    case LODLevel.HIGH:
      resolution = CHUNK_SIZE - 1;
      break;
    case LODLevel.MEDIUM:
      resolution = Math.floor((CHUNK_SIZE - 1) * 0.5);
      break;
    case LODLevel.LOW:
      resolution = Math.floor((CHUNK_SIZE - 1) * 0.25);
      break;
  }
  
  const geometry = new THREE.PlaneGeometry(
    CHUNK_SIZE,
    CHUNK_SIZE,
    resolution,
    resolution
  );
  
  // ... остальной код рендеринга
}
```

## Incremental Generation (Поэтапная генерация)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16  // 16ms для 60fps
  }
});

// Начать инкрементальную генерацию
const partial = chunkManager.getChunkIncremental(0, 0);

console.log('Stage:', partial.stage); // TERRAIN, BIOMES, RIVERS, RESOURCES, STRUCTURES, COMPLETE
console.log('Progress:', partial.progress); // 0.0 - 1.0

// Продолжить генерацию в игровом цикле
function gameLoop() {
  const complete = chunkManager.continueGeneration(0, 0);
  
  if (complete) {
    console.log('Chunk generation complete!');
    const chunk = chunkManager.getChunk(0, 0);
    renderChunk(chunk);
  } else {
    // Отобразить частичные данные
    const partial = chunkManager.getChunkIncremental(0, 0);
    if (partial.stage >= GenerationStage.TERRAIN) {
      renderPartialTerrain(partial.data);
    }
  }
  
  requestAnimationFrame(gameLoop);
}
```

## World Serialization (Сохранение мира)

### JSON Format

```javascript
import { SerializationFormat } from '../dist/index.js';

// Сохранить мир
const savedWorld = chunkManager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: false  // Сохранить все чанки
});

console.log('Saved chunks:', savedWorld.chunks.length);
console.log('Checksum:', savedWorld.checksum);

// Экспорт в файл
const blob = new Blob([JSON.stringify(savedWorld, null, 2)], { 
  type: 'application/json' 
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'world.json';
a.click();
URL.revokeObjectURL(url);

// Загрузить мир
const newManager = new ChunkManager({ /* same config */ });
newManager.loadWorld(savedWorld);
```

### Binary Format

```javascript
// Сохранить в бинарном формате
const blob = chunkManager.exportWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  region: {
    minX: 0, minY: 0,
    maxX: 10, maxY: 10  // Экспорт региона
  }
});

// Скачать файл
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'world.bin';
a.click();
URL.revokeObjectURL(url);
```

## Modification Tracking (Отслеживание изменений)

```javascript
// Записать модификацию
chunkManager.recordModification(0, 0, {
  chunkX: 0,
  chunkY: 0,
  timestamp: Date.now(),
  modifiedTiles: new Set([0, 1, 2]),
  heightChanges: new Map([
    [0, 0.5],  // Установить высоту тайла 0 в 0.5
    [1, 0.6],
    [2, 0.7]
  ]),
  addedStructures: [],
  removedStructures: [{ x: 5, y: 5, type: StructureType.VILLAGE }]
});

// Сохранить только изменённые чанки
const savedWorld = chunkManager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: true
});

// При загрузке модификации автоматически применяются
newManager.loadWorld(savedWorld);
```

## Performance Monitoring (Мониторинг производительности)

```javascript
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  
  enablePerformanceMetrics: true,
  
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
    
    // Обновить UI
    updateProgressBar(stage, progress);
  }
});

// Получить статистику кеша
const stats = chunkManager.getCacheStats();
console.log(`Cache: ${stats.size}/${stats.maxSize}`);
console.log(`Hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)}%`);
```

## Coordinate Utilities (Утилиты координат)

```javascript
import { worldToChunk, chunkToWorld, worldToLocal, localToIndex } from '../dist/index.js';

// Мировые координаты → координаты чанка
const [chunkX, chunkY] = worldToChunk(100, 200, 32);
console.log(`Chunk: (${chunkX}, ${chunkY})`); // (3, 6)

// Координаты чанка → мировые координаты
const [worldX, worldY] = chunkToWorld(3, 6, 32);
console.log(`World: (${worldX}, ${worldY})`); // (96, 192)

// Мировые координаты → локальные координаты в чанке
const [localX, localY] = worldToLocal(100, 200, 32);
console.log(`Local: (${localX}, ${localY})`); // (4, 8)

// Локальные координаты → индекс в массиве
const index = localToIndex(4, 8, 32);
console.log(`Index: ${index}`); // 260

// Получить высоту в мировых координатах
function getHeightAt(worldX, worldY) {
  const [chunkX, chunkY] = worldToChunk(worldX, worldY, CHUNK_SIZE);
  const [localX, localY] = worldToLocal(worldX, worldY, CHUNK_SIZE);
  const index = localToIndex(localX, localY, CHUNK_SIZE);
  
  const chunk = chunkManager.getChunk(chunkX, chunkY);
  return chunk.heightmap[index];
}
```

## Display Modes (Режимы отображения)

```javascript
function getColorForDisplayMode(chunk, index, mode) {
  switch (mode) {
    case 'biomes':
      const biome = chunk.biomeMap[index];
      return biomeColors[biome];
    
    case 'height':
      const height = chunk.heightmap[index];
      return new THREE.Color().setHSL(0.6 - height * 0.6, 0.8, 0.3 + height * 0.4);
    
    case 'moisture':
      // Приблизительная влажность из биома
      const moistureBiome = chunk.biomeMap[index];
      let moisture = 0.5;
      if ([BiomeType.OCEAN, BiomeType.BEACH].includes(moistureBiome)) moisture = 1.0;
      if ([BiomeType.DESERT].includes(moistureBiome)) moisture = 0.1;
      return new THREE.Color().setHSL(0.55, moisture, 0.5);
    
    case 'temperature':
      const tempBiome = chunk.biomeMap[index];
      let temp = 0.5;
      if ([BiomeType.DESERT].includes(tempBiome)) temp = 1.0;
      if ([BiomeType.TUNDRA, BiomeType.MOUNTAIN].includes(tempBiome)) temp = 0.0;
      return new THREE.Color().setHSL(temp * 0.15, 0.8, 0.5);
  }
}

// Применить к мешу
const colors = new Float32Array(CHUNK_SIZE * CHUNK_SIZE * 3);
for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
  const color = getColorForDisplayMode(chunk, i, 'height');
  colors[i * 3] = color.r;
  colors[i * 3 + 1] = color.g;
  colors[i * 3 + 2] = color.b;
}
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
```

## Cache Management (Управление кешем)

```javascript
// Очистить кеш
chunkManager.clearCache();

// Получить размер кеша
const cacheSize = chunkManager.getCacheSize();
console.log(`Cache size: ${cacheSize}`);

// Получить статистику
const stats = chunkManager.getCacheStats();
console.log('Cache stats:', {
  size: stats.size,
  maxSize: stats.maxSize,
  hits: stats.hits,
  misses: stats.misses,
  evictions: stats.evictions
});

// Настроить размер кеша
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  maxCacheSize: 200  // Увеличить кеш до 200 чанков
});
```

## Dynamic Chunk Loading (Динамическая загрузка чанков)

```javascript
const chunkMeshes = new Map();
const RENDER_DISTANCE = 5;

function updateChunks(cameraPosition) {
  const playerChunkX = Math.floor(cameraPosition.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(cameraPosition.z / CHUNK_SIZE);
  
  const chunksToKeep = new Set();
  
  // Загрузить чанки в радиусе
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      const chunkX = playerChunkX + dx;
      const chunkZ = playerChunkZ + dz;
      const key = `${chunkX},${chunkZ}`;
      
      chunksToKeep.add(key);
      
      if (!chunkMeshes.has(key)) {
        const chunk = chunkManager.getChunk(chunkX, chunkZ);
        const mesh = createChunkMesh(chunk, chunkX, chunkZ);
        chunkMeshes.set(key, mesh);
        scene.add(mesh);
      }
    }
  }
  
  // Выгрузить дальние чанки
  for (const [key, mesh] of chunkMeshes.entries()) {
    if (!chunksToKeep.has(key)) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      chunkMeshes.delete(key);
    }
  }
}

// Вызывать в игровом цикле
function gameLoop() {
  updateChunks(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
```

## Error Handling (Обработка ошибок)

```javascript
try {
  const chunk = chunkManager.getChunk(0, 0);
  
  if (!chunk || !chunk.heightmap) {
    throw new Error('Invalid chunk data');
  }
  
  renderChunk(chunk);
} catch (error) {
  console.error('Failed to generate chunk:', error);
  showErrorToast('Chunk generation failed');
}

// Валидация конфигурации
function validateConfig(config) {
  if (!config.seed) {
    throw new Error('Seed is required');
  }
  
  if (config.chunkSize < 8 || config.chunkSize > 256) {
    throw new Error('Chunk size must be between 8 and 256');
  }
  
  if (config.terrainConfig.octaves < 1 || config.terrainConfig.octaves > 8) {
    throw new Error('Octaves must be between 1 and 8');
  }
}
```

---

Эти примеры покрывают все основные функции движка, используемые в демо. Используй их как референс для своих проектов!
