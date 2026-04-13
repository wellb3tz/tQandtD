# Procedural World Engine - Advanced 3D Demo

Интерактивное 3D демо процедурного мира с полной поддержкой всех функций движка.

![Version](https://img.shields.io/badge/version-2.0-blue)
![Features](https://img.shields.io/badge/features-10+-green)
![Performance](https://img.shields.io/badge/performance-60fps-brightgreen)

## 🌟 Новые возможности

Это полностью обновлённое демо включает все последние функции движка:

- ✅ **3D Volumetric Noise** - объёмный шум для реалистичного ландшафта
- ✅ **Enhanced Biome System** - 8 биомов с переходами и микро-биомами
- ✅ **LOD System** - 3 уровня детализации для оптимизации
- ✅ **Incremental Generation** - поэтапная генерация для 60fps
- ✅ **Resource Clusters** - 5 типов ресурсов
- ✅ **Structure Placement** - 3 типа структур
- ✅ **River Networks** - генерация рек
- ✅ **World Serialization** - сохранение в JSON и бинарном формате
- ✅ **Performance Monitoring** - статистика в реальном времени
- ✅ **Multiple Display Modes** - 4 режима визуализации

## 🚀 Быстрый старт

```bash
# 1. Установи зависимости
npm install

# 2. Собери проект
npm run build

# 3. Запусти демо
npm run demo
```

Открой http://localhost:3000 в браузере.

**Подробная инструкция:** [QUICKSTART.md](QUICKSTART.md)

## 🎮 Управление

### Движение
- **WASD** - перемещение по горизонтали
- **Мышь** - осмотр (клик для захвата курсора)
- **Space** - подъём вверх
- **Shift** - спуск вниз
- **ESC** - освободить курсор

### Интерфейс
- Все настройки доступны в левой панели
- Секции можно сворачивать/разворачивать
- Изменения применяются после "Regenerate World"

## 📚 Документация

- **[QUICKSTART.md](QUICKSTART.md)** - Быстрый старт за 2 минуты
- **[FEATURES.md](FEATURES.md)** - Подробное описание всех функций
- **[API-EXAMPLES.md](API-EXAMPLES.md)** - Примеры использования API
- **[TERRAIN-TUNING.md](TERRAIN-TUNING.md)** - Настройка параметров ландшафта
- **[SEAMLESS-CHUNKS.md](SEAMLESS-CHUNKS.md)** - Техническое описание бесшовных чанков

## ✨ Основные функции

### 🎲 3D Noise
Объёмный шум для создания реалистичных форм рельефа с вертикальными вариациями.

### 🌿 Enhanced Biomes
- **8 типов биомов**: Ocean, Beach, Desert, Plains, Forest, Taiga, Tundra, Mountain
- **Плавные переходы** между биомами
- **Микро-биомы**: Оазисы, поляны, пруды, рощи
- **Высотные пояса** для гор: предгорья, склоны, вершины

### 📐 LOD System
Автоматическое снижение детализации для дальних чанков:
- **HIGH** (0-2 чанка): Полная детализация
- **MEDIUM** (2-5 чанков): 50% разрешения
- **LOW** (5+ чанков): 25% разрешения

### ⚡ Incremental Generation
Поэтапная генерация с временными бюджетами:
- 5 стадий: TERRAIN → BIOMES → RIVERS → RESOURCES → STRUCTURES
- Настраиваемый time budget (8-50ms)
- Поддержка 60fps

### 🎨 Display Modes
4 режима визуализации:
- **Biomes** - цвета биомов
- **Height Map** - карта высот
- **Moisture** - карта влажности
- **Temperature** - карта температуры

### 💎 Resources
5 типов ресурсов с кластерной генерацией:
- Iron, Gold, Coal, Stone, Wood

### 🏛️ Structures
3 типа структур с правилами размещения:
- Villages (деревни) - на равнинах
- Ruins (руины) - в лесах и пустынях
- Towers (башни) - в горах

### 💾 World Serialization
- JSON формат (читаемый)
- Binary формат (компактный)
- Компрессия (60-70% экономии)
- Отслеживание модификаций

## 📊 Производительность

- **Генерация чанка**: 20-50ms (цель: <100ms)
- **FPS**: 60fps при 3-5 чанках дистанции
- **Память**: ~46KB на чанк (32×32)
- **Кеш**: до 100 чанков в памяти

### Рекомендации

**Для слабых ПК:**
- Render Distance: 2-3
- LOD: включён
- Incremental: включён
- 3D Noise: выключен

**Для мощных ПК:**
- Render Distance: 6-8
- Все функции включены
- 3D Noise: включён

## 🎯 Интересные seed'ы

- **12345** - Сбалансированный мир (по умолчанию)
- **42** - Много гор и пустынь
- **777** - Большие океаны
- **1337** - Много лесов
- **9999** - Экстремальный рельеф

## 🔧 Технические детали

### Архитектура
- **Three.js** - 3D рендеринг
- **PointerLockControls** - управление камерой
- **ChunkManager** - управление генерацией
- **LRU Cache** - автоматическая выгрузка чанков

### Освещение
- Ambient Light - общее освещение
- Directional Light - солнечный свет с тенями
- Hemisphere Light - небесное освещение
- Shadow mapping: 2048×2048

## 📝 Примеры использования

### Базовая инициализация

```javascript
import { ChunkManager } from '../dist/index.js';

const manager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  terrainConfig: { /* ... */ },
  enhancedBiomeConfig: { /* ... */ }
});

const chunk = manager.getChunk(0, 0);
```

### Включение 3D Noise

```javascript
const manager = new ChunkManager({
  seed: 12345,
  noise3DConfig: {
    enable3D: true,
    zScale: 0.5
  }
});
```

### Сохранение мира

```javascript
const savedWorld = manager.saveWorld({
  format: SerializationFormat.JSON,
  compress: true
});
```

**Больше примеров:** [API-EXAMPLES.md](API-EXAMPLES.md)

## 🐛 Решение проблем

### Низкий FPS
1. Уменьши Render Distance
2. Включи LOD System
3. Отключи 3D Noise

### Чанки не загружаются
1. Проверь консоль (F12)
2. Убедись что `npm run build` выполнен
3. Перезапусти сервер

### Ошибка при сборке
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🔗 Дополнительные ресурсы

- [Документация движка](../README.md)
- [Примеры кода](../examples/)
- [Тесты](../tests/)

## 📄 Лицензия

MIT - используй свободно в своих проектах!

---

**Приятного исследования процедурных миров! 🌍✨**
