# Задачи: Исправление производительности и LOD системы

- [x] 1. Написать exploration test для LOD системы
- [x] 2. Исправить LOD систему - обновление размера чанка
- [x] 3. Исправить downsampling для seamless boundaries
- [x] 4. Добавить валидацию heightmap в WorldViewer
- [x] 5. Оптимизировать frustum culling
- [x] 6. Оптимизировать LOD для ресурсов и структур
- [x] 7. Написать unit тесты для LOD системы
- [x] 8. Написать integration тест для LOD системы
- [x] 9. Написать performance тест
- [x] 10. Обновить документацию
- [x] 11. Ручное тестирование
- [x] 12. Финальная проверка и cleanup

---

## Задача 1: Написать exploration test для LOD системы

**Цель**: Подтвердить, что текущая LOD система ломает размеры heightmap

**Файл**: `tests/lod-exploration.test.ts`

**Описание**: 
Создать property-based тест, который проверяет, что после применения LOD:
- Размер heightmap соответствует ожидаемому
- Нет ошибок при рендеринге
- Ландшафт отображается корректно

**Ожидаемый результат**: Тест должен ПРОВАЛИТЬСЯ на текущем коде, подтверждая баг

**Критерии приемки**:
- Тест создан и запускается
- Тест проваливается на текущем коде
- Тест использует fast-check для property-based testing
- Тест проверяет различные комбинации размеров чанков и LOD уровней

---

## Задача 2: Исправить LOD систему - обновление размера чанка

**Цель**: Обновлять `data.size` после downsampling heightmap

**Файл**: `src/world/lod.ts`

**Описание**:
Изменить метод `applyLOD` для обновления размера чанка после downsampling:

```typescript
applyLOD(chunk: any, level: LODLevel): any {
  const resolution = this.getMeshResolution(level);
  const density = this.getFeatureDensity(level);

  if (level === LODLevel.HIGH) {
    return chunk;
  }

  const newSize = Math.max(1, Math.floor(chunk.size * resolution));

  const lodChunk = {
    ...chunk,
    size: newSize, // ДОБАВИТЬ ЭТО
    heightmap: this.downsampleHeightmap(chunk.heightmap, chunk.size, resolution),
    resources: this.filterFeatures(chunk.resources, density, chunk.x * 1000 + chunk.y),
    structures: this.filterFeatures(chunk.structures, density, chunk.x * 2000 + chunk.y),
  };

  return lodChunk;
}
```

**Критерии приемки**:
- `applyLOD` обновляет `data.size` на новый размер
- Все существующие тесты проходят
- Exploration test из задачи 1 теперь проходит (частично)

---

## Задача 3: Исправить downsampling для seamless boundaries

**Цель**: Обеспечить, что downsampled heightmap имеет размер `(newSize + 1) x (newSize + 1)`

**Файл**: `src/world/lod.ts`

**Описание**:
Изменить метод `downsampleHeightmap` для сохранения структуры seamless boundaries:

```typescript
private downsampleHeightmap(
  heightmap: Float32Array,
  size: number,
  resolution: number
): Float32Array {
  const newSize = Math.max(1, Math.floor(size * resolution));
  const newVerticesPerSide = newSize + 1; // +1 для seamless boundaries
  const newHeightmap = new Float32Array(newVerticesPerSide * newVerticesPerSide);

  if (newSize === 1) {
    // Специальный случай для 1x1 чанка (heightmap 2x2)
    const centerIdx = Math.floor((size + 1) / 2) * (size + 1) + Math.floor((size + 1) / 2);
    newHeightmap[0] = heightmap[centerIdx];
    newHeightmap[1] = heightmap[centerIdx];
    newHeightmap[2] = heightmap[centerIdx];
    newHeightmap[3] = heightmap[centerIdx];
    return newHeightmap;
  }

  const oldVerticesPerSide = size + 1;
  
  for (let y = 0; y < newVerticesPerSide; y++) {
    for (let x = 0; x < newVerticesPerSide; x++) {
      const srcX = (x / newSize) * size;
      const srcY = (y / newSize) * size;

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

**Критерии приемки**:
- Downsampled heightmap имеет размер `(newSize + 1) x (newSize + 1)`
- Билинейная интерполяция работает корректно
- Специальный случай для 1x1 чанка обрабатывается
- Exploration test из задачи 1 теперь полностью проходит

---

## Задача 4: Добавить валидацию heightmap в WorldViewer

**Цель**: Защитить от некорректных размеров heightmap

**Файл**: `demo/src/viewer/WorldViewer.ts`

**Описание**:
Добавить валидацию в начало метода `createTerrainMesh`:

```typescript
private createTerrainMesh(chunkX: number, chunkY: number, data: ChunkData, lodLevel?: number, partial: boolean = false, stage?: number): THREE.Mesh {
  const chunkSize = data.size;
  
  // ВАЛИДАЦИЯ
  const expectedHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
  if (data.heightmap.length !== expectedHeightmapSize) {
    console.error(
      `Heightmap size mismatch! Expected ${expectedHeightmapSize} (${chunkSize + 1}x${chunkSize + 1}), ` +
      `got ${data.heightmap.length}. Chunk: (${chunkX}, ${chunkY}), LOD: ${lodLevel}`
    );
    
    const fallbackHeightmap = new Float32Array(expectedHeightmapSize);
    const copySize = Math.min(data.heightmap.length, expectedHeightmapSize);
    for (let i = 0; i < copySize; i++) {
      fallbackHeightmap[i] = data.heightmap[i];
    }
    data = { ...data, heightmap: fallbackHeightmap };
  }
  
  // Остальной код...
}
```

**Критерии приемки**:
- Валидация добавлена в начало метода
- При несоответствии размеров выводится ошибка в консоль
- Создается fallback heightmap для предотвращения крэша
- Тест проверяет, что валидация работает

---

## Задача 5: Оптимизировать frustum culling

**Цель**: Уменьшить интервал проверки frustum culling для лучшей производительности

**Файл**: `demo/src/viewer/WorldViewer.ts`

**Описание**:
Изменить интервал проверки frustum culling с 100ms на 16ms:

```typescript
constructor() {
  // ...
  this.cullingCheckInterval = 16; // Проверять каждый кадр (60 FPS)
  // ...
}
```

**Критерии приемки**:
- Интервал изменен на 16ms
- Frustum culling работает каждый кадр
- Производительность не ухудшилась (проверить через тесты)
- Чанки скрываются/показываются плавно без мерцания

---

## Задача 6: Оптимизировать LOD для ресурсов и структур

**Цель**: Не рендерить ресурсы и структуры на LOW LOD

**Файл**: `demo/src/viewer/WorldViewer.ts`

**Описание**:
Изменить метод `addChunk` для условного рендеринга ресурсов и структур:

```typescript
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
```

**Критерии приемки**:
- Ресурсы рендерятся только на HIGH LOD
- Реки и структуры рендерятся на HIGH и MEDIUM LOD
- LOW LOD чанки не имеют ресурсов и структур
- Производительность улучшилась (проверить через тесты)

---

## Задача 7: Написать unit тесты для LOD системы

**Цель**: Покрыть тестами исправления LOD системы

**Файл**: `src/world/lod.test.ts`

**Описание**:
Создать unit тесты для:
1. Проверки обновления `data.size` в `applyLOD`
2. Проверки размера downsampled heightmap
3. Проверки билинейной интерполяции
4. Проверки специального случая для 1x1 чанка

**Критерии приемки**:
- Все тесты проходят
- Покрытие кода >= 80% для `lod.ts`
- Тесты проверяют различные LOD уровни и размеры чанков

---

## Задача 8: Написать integration тест для LOD системы

**Цель**: Проверить полный цикл работы LOD системы

**Файл**: `demo/src/core/DemoApp.lod.integration.test.ts`

**Описание**:
Создать integration тест, который:
1. Создает DemoApp с LOD конфигурацией
2. Генерирует мир
3. Загружает чанки с разными LOD уровнями
4. Проверяет, что нет ошибок
5. Проверяет, что ландшафт отображается корректно

**Критерии приемки**:
- Тест проходит
- Тест проверяет все LOD уровни (HIGH, MEDIUM, LOW)
- Тест проверяет, что нет ошибок в консоли
- Тест проверяет, что heightmap имеет правильный размер

---

## Задача 9: Написать performance тест

**Цель**: Проверить, что производительность соответствует требованиям

**Файл**: `demo/src/core/DemoApp.performance.test.ts`

**Описание**:
Создать performance тест, который:
1. Создает DemoApp с LOD конфигурацией
2. Загружает 25 чанков (5x5)
3. Измеряет FPS в течение 5 секунд
4. Проверяет, что FPS >= 60

**Критерии приемки**:
- Тест проходит
- FPS >= 60 при 25 чанках
- Тест измеряет реальный FPS (не симулированный)
- Тест проверяет frustum culling статистику

---

## Задача 10: Обновить документацию

**Цель**: Документировать изменения в LOD системе

**Файлы**: 
- `src/world/lod.ts` (JSDoc комментарии)
- `demo/src/viewer/PERFORMANCE.md` (обновить секцию про LOD)
- `README.md` (если нужно)

**Описание**:
Обновить документацию для отражения изменений:
1. Добавить комментарии к исправленным методам
2. Обновить PERFORMANCE.md с новыми метриками
3. Добавить примеры использования LOD системы

**Критерии приемки**:
- JSDoc комментарии обновлены
- PERFORMANCE.md содержит актуальную информацию
- Документация понятна и полезна для пользователей

---

## Задача 11: Ручное тестирование

**Цель**: Проверить исправления в реальном приложении

**Описание**:
1. Запустить demo приложение
2. Включить LOD систему через UI
3. Загрузить большое количество чанков (50+)
4. Проверить:
   - Нет ошибок в консоли
   - Ландшафт отображается корректно
   - FPS >= 60 (или близко к этому)
   - LOD уровни применяются корректно (визуально)
   - Frustum culling работает (чанки скрываются вне поля зрения)

**Критерии приемки**:
- Все проверки пройдены
- Нет визуальных артефактов
- Производительность приемлема
- Пользовательский опыт улучшился

---

## Задача 12: Финальная проверка и cleanup

**Цель**: Убедиться, что все исправления работают вместе

**Описание**:
1. Запустить все тесты
2. Проверить покрытие кода
3. Удалить временный/отладочный код
4. Проверить, что нет console.log (кроме валидации)
5. Проверить, что код соответствует стандартам проекта

**Критерии приемки**:
- Все тесты проходят
- Покрытие кода >= 80%
- Нет временного кода
- Код чистый и читаемый
- Все критерии приемки из bugfix.md выполнены
