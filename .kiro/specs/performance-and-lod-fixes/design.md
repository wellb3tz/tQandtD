# Design: Исправление производительности и LOD системы

## Обзор

Этот документ описывает техническое решение для исправления двух критических проблем:
1. Недостаточная производительность (FPS < 60)
2. Сломанная LOD система (ошибки и некорректный рендеринг)

## Архитектура решения

### Компоненты, требующие изменений

1. **src/world/lod.ts** - LODManager
   - Исправить `applyLOD` для обновления размера чанка
   - Исправить `downsampleHeightmap` для корректной работы с seamless boundaries

2. **demo/src/viewer/WorldViewer.ts** - WorldViewer
   - Оптимизировать frustum culling
   - Улучшить производительность рендеринга
   - Добавить защиту от некорректных размеров heightmap

3. **demo/src/core/DemoApp.ts** - DemoApp
   - Убедиться, что LOD применяется корректно
   - Добавить мониторинг производительности

## Детальный дизайн исправлений

### Исправление 1: LOD система - обновление размера чанка

**Файл**: `src/world/lod.ts`

**Проблема**: После downsampling heightmap размер чанка не обновляется, что приводит к несоответствию между `data.size` и фактическим размером `data.heightmap`.

**Решение**:

```typescript
applyLOD(chunk: any, level: LODLevel): any {
  const resolution = this.getMeshResolution(level);
  const density = this.getFeatureDensity(level);

  if (level === LODLevel.HIGH) {
    return chunk;
  }

  // Вычислить новый размер после downsampling
  const newSize = Math.max(1, Math.floor(chunk.size * resolution));

  const lodChunk = {
    ...chunk,
    size: newSize, // КРИТИЧНО: обновить размер!
    heightmap: this.downsampleHeightmap(chunk.heightmap, chunk.size, resolution),
    resources: this.filterFeatures(chunk.resources, density, chunk.x * 1000 + chunk.y),
    structures: this.filterFeatures(chunk.structures, density, chunk.x * 2000 + chunk.y),
  };

  return lodChunk;
}
```

**Обоснование**: 
- `createTerrainMesh` использует `data.size` для вычисления количества вершин
- После downsampling фактический размер heightmap = `newSize x newSize`
- Обновление `data.size` гарантирует согласованность

### Исправление 2: LOD система - корректный downsampling для seamless boundaries

**Файл**: `src/world/lod.ts`

**Проблема**: Оригинальный heightmap имеет размер `(chunkSize + 1) x (chunkSize + 1)` для seamless boundaries. После downsampling нужно сохранить эту структуру.

**Решение**:

```typescript
private downsampleHeightmap(
  heightmap: Float32Array,
  size: number,
  resolution: number
): Float32Array {
  // size - это размер чанка (например, 32)
  // heightmap имеет размер (size + 1) x (size + 1) для seamless boundaries
  
  // Вычислить новый размер чанка
  const newSize = Math.max(1, Math.floor(size * resolution));
  
  // Heightmap должен иметь размер (newSize + 1) x (newSize + 1)
  const newVerticesPerSide = newSize + 1;
  const newHeightmap = new Float32Array(newVerticesPerSide * newVerticesPerSide);

  // Специальный случай для 1x1
  if (newSize === 1) {
    // Для 1x1 чанка нужен heightmap 2x2
    const centerIdx = Math.floor((size + 1) / 2) * (size + 1) + Math.floor((size + 1) / 2);
    newHeightmap[0] = heightmap[centerIdx];
    newHeightmap[1] = heightmap[centerIdx];
    newHeightmap[2] = heightmap[centerIdx];
    newHeightmap[3] = heightmap[centerIdx];
    return newHeightmap;
  }

  // Downsampling с билинейной интерполяцией
  const oldVerticesPerSide = size + 1;
  
  for (let y = 0; y < newVerticesPerSide; y++) {
    for (let x = 0; x < newVerticesPerSide; x++) {
      // Маппинг новых координат на старые
      const srcX = (x / newSize) * size;
      const srcY = (y / newSize) * size;

      // Билинейная интерполяция
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, size);
      const y1 = Math.min(y0 + 1, size);
      const fx = srcX - x0;
      const fy = srcY - y0;

      const h00 = heightmap[y0 * oldVerticesPerSide + x0];
      const h10 = heightmap[y0 * oldVerticesPerSide + x1];
      const h01 = heightmap[y1 * oldVerticesPerSide + x0];
      const h11 = heightmap[y1 * oldVerticesPerSide + x1];

      const h0 = h00 * (1 - fx) + h10 * fx;
      const h1 = h01 * (1 - fx) + h11 * fx;
      const h = h0 * (1 - fy) + h1 * fy;

      newHeightmap[y * newVerticesPerSide + x] = h;
    }
  }

  return newHeightmap;
}
```

**Обоснование**:
- Оригинальный heightmap: `(size + 1) x (size + 1)` вершин
- После downsampling: `(newSize + 1) x (newSize + 1)` вершин
- Это сохраняет seamless boundaries между чанками

### Исправление 3: WorldViewer - защита от некорректных размеров

**Файл**: `demo/src/viewer/WorldViewer.ts`

**Проблема**: Если LOD система работает некорректно, код рендеринга может обращаться к несуществующим индексам.

**Решение**: Добавить валидацию в `createTerrainMesh`:

```typescript
private createTerrainMesh(chunkX: number, chunkY: number, data: ChunkData, lodLevel?: number, partial: boolean = false, stage?: number): THREE.Mesh {
  const chunkSize = data.size;
  
  // ВАЛИДАЦИЯ: проверить, что heightmap имеет правильный размер
  const expectedHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
  if (data.heightmap.length !== expectedHeightmapSize) {
    console.error(
      `Heightmap size mismatch! Expected ${expectedHeightmapSize} (${chunkSize + 1}x${chunkSize + 1}), ` +
      `got ${data.heightmap.length}. Chunk: (${chunkX}, ${chunkY}), LOD: ${lodLevel}`
    );
    
    // Создать fallback heightmap с правильным размером
    const fallbackHeightmap = new Float32Array(expectedHeightmapSize);
    // Копировать доступные данные
    const copySize = Math.min(data.heightmap.length, expectedHeightmapSize);
    for (let i = 0; i < copySize; i++) {
      fallbackHeightmap[i] = data.heightmap[i];
    }
    data = { ...data, heightmap: fallbackHeightmap };
  }
  
  // Остальной код без изменений...
}
```

**Обоснование**: Защита от некорректных данных предотвращает крэши и помогает диагностировать проблемы.

### Исправление 4: Оптимизация frustum culling

**Файл**: `demo/src/viewer/WorldViewer.ts`

**Проблема**: Проверка frustum culling каждые 100ms слишком редкая для динамической камеры.

**Решение 1**: Уменьшить интервал до 16ms (каждый кадр):

```typescript
constructor() {
  // ...
  this.cullingCheckInterval = 16; // Проверять каждый кадр (60 FPS)
  // ...
}
```

**Решение 2** (альтернатива): Адаптивный интервал:

```typescript
private updateFrustumCulling(): void {
  if (!this.enableFrustumCulling) return;
  
  const activeCamera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
  
  // Вычислить скорость движения камеры
  const currentPos = activeCamera.position.clone();
  const deltaPos = currentPos.distanceTo(this.lastCameraPosition || currentPos);
  this.lastCameraPosition = currentPos.clone();
  
  // Адаптивный интервал: чаще проверять при быстром движении
  const adaptiveInterval = deltaPos > 1 ? 16 : 100; // 16ms если движется быстро, 100ms если медленно
  
  const now = performance.now();
  if (now - this.lastCullingCheck < adaptiveInterval) {
    return;
  }
  
  this.lastCullingCheck = now;
  
  // Обновить frustum
  this.frustumMatrix.multiplyMatrices(
    activeCamera.projectionMatrix,
    activeCamera.matrixWorldInverse
  );
  this.frustum.setFromProjectionMatrix(this.frustumMatrix);
  
  // Проверить каждый чанк
  for (const [key, chunkMesh] of this.chunkMeshes.entries()) {
    if (!chunkMesh.boundingBox) continue;
    
    const isVisible = this.frustum.intersectsBox(chunkMesh.boundingBox);
    
    if (chunkMesh.visible !== isVisible) {
      chunkMesh.visible = isVisible;
      this.updateChunkVisibility(chunkMesh, isVisible);
    }
  }
}

private updateChunkVisibility(chunkMesh: ChunkMesh, isVisible: boolean): void {
  chunkMesh.terrain.visible = isVisible && this.layerVisibility.get(RenderLayer.TERRAIN) !== false;
  
  if (chunkMesh.rivers) {
    chunkMesh.rivers.visible = isVisible && this.layerVisibility.get(RenderLayer.RIVERS) !== false;
  }
  
  if (chunkMesh.resources) {
    chunkMesh.resources.visible = isVisible && this.layerVisibility.get(RenderLayer.RESOURCES) !== false;
  }
  
  if (chunkMesh.structures) {
    chunkMesh.structures.visible = isVisible && this.layerVisibility.get(RenderLayer.STRUCTURES) !== false;
  }
  
  if (chunkMesh.boundaries) {
    chunkMesh.boundaries.visible = isVisible && this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES) !== false;
  }
}
```

**Обоснование**: 
- Решение 1 проще, но может быть избыточным
- Решение 2 более эффективно, но сложнее
- Рекомендуется начать с Решения 1

### Исправление 5: Оптимизация LOD для ресурсов и структур

**Файл**: `demo/src/viewer/WorldViewer.ts`

**Проблема**: Ресурсы и структуры рендерятся даже на LOW LOD, что снижает производительность.

**Решение**: Не рендерить ресурсы и структуры на LOW LOD:

```typescript
addChunk(chunkX: number, chunkY: number, data: ChunkData, partial: boolean = false, stage?: number): void {
  const key = this.getChunkKey(chunkX, chunkY);
  
  if (this.chunkMeshes.has(key)) {
    this.removeChunk(chunkX, chunkY);
  }
  
  const lodLevel = (data as any).lodLevel;
  
  const chunkMesh: ChunkMesh = {
    terrain: this.createTerrainMesh(chunkX, chunkY, data, lodLevel, partial, stage),
    visible: true
  };
  
  chunkMesh.terrain.geometry.computeBoundingBox();
  chunkMesh.boundingBox = chunkMesh.terrain.geometry.boundingBox!.clone();
  chunkMesh.boundingBox.applyMatrix4(chunkMesh.terrain.matrixWorld);
  
  this.scene.add(chunkMesh.terrain);
  
  // Рендерить реки только на HIGH и MEDIUM LOD
  if (!partial || (stage !== undefined && stage >= 2)) {
    if (this.layerVisibility.get(RenderLayer.RIVERS) && data.rivers && data.rivers.size > 0) {
      if (lodLevel === undefined || lodLevel <= 1) { // HIGH или MEDIUM
        chunkMesh.rivers = this.createRiverOverlay(chunkX, chunkY, data);
        this.scene.add(chunkMesh.rivers);
      }
    }
  }
  
  // Рендерить ресурсы только на HIGH LOD
  if (!partial || (stage !== undefined && stage >= 3)) {
    if (this.layerVisibility.get(RenderLayer.RESOURCES) && data.resources && data.resources.length > 0) {
      if (lodLevel === undefined || lodLevel === 0) { // Только HIGH
        chunkMesh.resources = this.createResourceMarkers(chunkX, chunkY, data);
        this.scene.add(chunkMesh.resources);
      }
    }
  }
  
  // Рендерить структуры только на HIGH и MEDIUM LOD
  if (!partial || (stage !== undefined && stage >= 4)) {
    if (this.layerVisibility.get(RenderLayer.STRUCTURES) && data.structures && data.structures.length > 0) {
      if (lodLevel === undefined || lodLevel <= 1) { // HIGH или MEDIUM
        chunkMesh.structures = this.createStructureMarkers(chunkX, chunkY, data);
        this.scene.add(chunkMesh.structures);
      }
    }
  }
  
  if (this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES)) {
    chunkMesh.boundaries = this.createChunkBoundaries(chunkX, chunkY, data);
    this.scene.add(chunkMesh.boundaries);
  }
  
  this.chunkMeshes.set(key, chunkMesh);
}
```

**Обоснование**: Дальние чанки (LOW LOD) не нуждаются в детальных ресурсах и структурах.

## Тестирование

### Unit тесты

1. **LOD система - размер чанка**
   - Тест: Проверить, что `applyLOD` обновляет `data.size`
   - Файл: `src/world/lod.test.ts`

2. **LOD система - размер heightmap**
   - Тест: Проверить, что downsampled heightmap имеет размер `(newSize + 1) x (newSize + 1)`
   - Файл: `src/world/lod.test.ts`

3. **WorldViewer - валидация heightmap**
   - Тест: Проверить, что `createTerrainMesh` обрабатывает некорректные размеры
   - Файл: `demo/src/viewer/WorldViewer.test.ts`

### Integration тесты

1. **LOD система - полный цикл**
   - Тест: Создать чанк, применить LOD, отрендерить
   - Проверить: Нет ошибок, ландшафт корректен
   - Файл: `demo/src/core/DemoApp.lod.integration.test.ts`

2. **Производительность - FPS**
   - Тест: Загрузить 25 чанков, измерить FPS
   - Проверить: FPS >= 60
   - Файл: `demo/src/core/DemoApp.performance.test.ts`

### Property-Based тесты

1. **Exploration Test - LOD размеры**
   ```typescript
   test('LOD downsampling preserves seamless boundaries structure', () => {
     fc.assert(
       fc.property(
         fc.integer({ min: 8, max: 64 }), // chunkSize
         fc.double({ min: 0.1, max: 1.0 }), // resolution
         (chunkSize, resolution) => {
           const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1));
           const lodManager = new LODManager({
             distances: [2, 5],
             meshResolutions: [1.0, 0.5, 0.25],
             featureDensities: [1.0, 0.5, 0.1]
           });
           
           const chunk = { size: chunkSize, heightmap, /* ... */ };
           const lodChunk = lodManager.applyLOD(chunk, LODLevel.MEDIUM);
           
           const expectedSize = Math.max(1, Math.floor(chunkSize * resolution));
           const expectedHeightmapSize = (expectedSize + 1) * (expectedSize + 1);
           
           // Проверка 1: размер чанка обновлен
           expect(lodChunk.size).toBe(expectedSize);
           
           // Проверка 2: размер heightmap корректен
           expect(lodChunk.heightmap.length).toBe(expectedHeightmapSize);
         }
       )
     );
   });
   ```

2. **Fix Verification Test - производительность**
   ```typescript
   test('Performance meets 60 FPS target with LOD enabled', async () => {
     const app = new DemoApp();
     await app.initialize();
     
     // Включить LOD
     app.updateEngineConfig({
       lodConfig: {
         distances: [2, 5],
         meshResolutions: [1.0, 0.5, 0.25],
         featureDensities: [1.0, 0.5, 0.1]
       }
     });
     
     // Загрузить 25 чанков
     await app.generateWorld(12345);
     await app.loadChunksAround(0, 0, 2);
     
     // Измерить FPS
     const fps = await measureFPS(app, 5000); // 5 секунд
     
     // Проверка: FPS >= 60
     expect(fps).toBeGreaterThanOrEqual(60);
   });
   ```

## Метрики успеха

1. **Функциональность**
   - ✅ LOD система работает без ошибок
   - ✅ Ландшафт отображается корректно на всех LOD уровнях
   - ✅ Нет ошибок в консоли

2. **Производительность**
   - ✅ FPS >= 60 при 9-25 чанках
   - ✅ FPS >= 45 при 49-100 чанках
   - ✅ Frustum culling снижает количество рендерящихся чанков на 30-50%

3. **Качество кода**
   - ✅ Все существующие тесты проходят
   - ✅ Новые тесты покрывают исправления
   - ✅ Код соответствует стандартам проекта

## Риски и митигация

1. **Риск**: Изменение размера чанка может сломать другие части кода
   - **Митигация**: Тщательное тестирование, поиск всех использований `data.size`

2. **Риск**: Слишком агрессивный frustum culling может вызвать мерцание
   - **Митигация**: Добавить margin для culling, тестировать на разных скоростях камеры

3. **Риск**: LOD переходы могут быть заметны
   - **Митигация**: Настроить расстояния LOD, возможно добавить плавные переходы

## Альтернативные решения

### Альтернатива 1: Не обновлять data.size, а использовать отдельное поле

```typescript
const lodChunk = {
  ...chunk,
  originalSize: chunk.size, // Сохранить оригинальный размер
  size: newSize, // Новый размер
  heightmap: this.downsampleHeightmap(chunk.heightmap, chunk.size, resolution),
};
```

**Плюсы**: Сохраняет оригинальную информацию
**Минусы**: Усложняет код, требует изменений во многих местах

### Альтернатива 2: Изменить createTerrainMesh для работы с любым размером

```typescript
private createTerrainMesh(...) {
  // Вычислить размер из heightmap
  const heightmapSize = Math.sqrt(data.heightmap.length);
  const chunkSize = Math.floor(heightmapSize) - 1;
  // ...
}
```

**Плюсы**: Более гибкий код
**Минусы**: Менее явный, может скрывать ошибки

**Выбор**: Рекомендуется основное решение (обновлять data.size), так как оно наиболее явное и простое.
