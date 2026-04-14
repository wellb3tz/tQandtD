# DemoApp Core Module

This module contains the core application logic for the Comprehensive Engine Demo.

## Overview

The `DemoApp` class is the central coordinator for the demo application. It manages:

- **Application State**: Centralized state management with reactive updates
- **ChunkManager Integration**: Coordinates with the procedural world generation engine
- **Chunk Loading**: Handles loading and unloading of world chunks
- **Event System**: Provides event-based communication between components
- **Statistics**: Aggregates and tracks world generation statistics

## Architecture

```
┌─────────────────────────────────────────┐
│            DemoApp                      │
├─────────────────────────────────────────┤
│                                         │
│  State Management                       │
│  ├─ AppState                           │
│  ├─ Subscribers (reactive updates)     │
│  └─ State update methods               │
│                                         │
│  ChunkManager Integration               │
│  ├─ World generation                   │
│  ├─ Chunk loading/unloading            │
│  └─ Configuration management           │
│                                         │
│  Event System                           │
│  ├─ Event listeners                    │
│  ├─ Event emission                     │
│  └─ Component communication            │
│                                         │
│  Statistics                             │
│  ├─ Biome distribution                 │
│  ├─ Resource counts                    │
│  └─ Performance metrics                │
│                                         │
└─────────────────────────────────────────┘
```

## Usage

### Basic Initialization

```typescript
import { DemoApp } from './src/core/DemoApp';

// Create and initialize app
const app = new DemoApp();
await app.initialize();
```

### State Management

```typescript
// Subscribe to state changes
const unsubscribe = app.subscribeToState((state) => {
  console.log('Loaded chunks:', state.loadedChunkCount);
  console.log('Average generation time:', state.avgGenerationTime);
});

// Update state
app.updateState({
  brushSize: 10,
  brushStrength: 2.0
});

// Get current state
const state = app.getState();
console.log('Current seed:', state.config.seed);

// Unsubscribe when done
unsubscribe();
```

### World Generation

```typescript
// Generate world with specific seed
await app.generateWorld(12345);

// Load chunks around a position
await app.loadChunksAround(0, 0, 2); // Load 5x5 grid

// Unload distant chunks
app.unloadDistantChunks(0, 0, 3); // Keep only chunks within distance 3
```

### Event System

```typescript
import { AppEvent } from './src/core/DemoApp';

// Listen to world generation events
app.on(AppEvent.WORLD_GENERATED, (data) => {
  console.log('World generated with seed:', data.seed);
});

// Listen to chunk loading events
app.on(AppEvent.CHUNK_LOADED, (data) => {
  console.log('Chunk loaded:', data.chunkX, data.chunkY);
});

// Listen to errors
app.on(AppEvent.ERROR, (data) => {
  console.error('Error:', data.message, data.error);
});
```

### Configuration Updates

```typescript
// Update engine configuration
app.updateEngineConfig({
  seed: 99999,
  terrainConfig: {
    baseScale: 0.02,
    octaves: 6
  }
});
```

## API Reference

### DemoApp Class

#### Methods

- `initialize(): Promise<void>` - Initialize the application
- `getState(): Readonly<AppState>` - Get current application state
- `updateState(partial: Partial<AppState>): void` - Update state with partial updates
- `subscribeToState(callback: StateChangeCallback): Unsubscribe` - Subscribe to state changes
- `generateWorld(seed: number): Promise<void>` - Generate new world with seed
- `loadChunksAround(centerX: number, centerY: number, radius: number): Promise<void>` - Load chunks in radius
- `unloadDistantChunks(centerX: number, centerY: number, maxDistance: number): void` - Unload distant chunks
- `updateEngineConfig(config: Partial<WorldConfig>): void` - Update engine configuration
- `on(event: AppEvent, callback: EventCallback): Unsubscribe` - Register event listener
- `destroy(): void` - Clean up resources

### AppState Interface

```typescript
interface AppState {
  // Engine state
  chunkManager: ChunkManager | null;
  loadedChunks: Map<string, ChunkData>;
  config: WorldConfig;
  
  // UI state
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  selectedTool: TerrainTool;
  brushSize: number;
  brushStrength: number;
  
  // Visibility toggles
  showTerrain: boolean;
  showBiomes: boolean;
  showRivers: boolean;
  showResources: boolean;
  showStructures: boolean;
  showChunkBoundaries: boolean;
  showWireframe: boolean;
  
  // Performance metrics
  fps: number;
  avgGenerationTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  loadedChunkCount: number;
  renderedVertexCount: number;
  
  // Statistics
  biomeDistribution: Map<BiomeType, number>;
  resourceCounts: Map<ResourceType, number>;
  structureCounts: Map<StructureType, number>;
  riverCount: number;
  avgHeight: number;
  minHeight: number;
  maxHeight: number;
}
```

### AppEvent Enum

```typescript
enum AppEvent {
  CHUNK_LOADED = 'chunk_loaded',
  CHUNK_UNLOADED = 'chunk_unloaded',
  WORLD_GENERATED = 'world_generated',
  CONFIG_CHANGED = 'config_changed',
  STATE_CHANGED = 'state_changed',
  ERROR = 'error'
}
```

## Design Patterns

### State Management Pattern

DemoApp uses a centralized state management pattern with reactive updates:

1. **Single Source of Truth**: All application state is stored in one place
2. **Immutable Updates**: State updates create new state objects
3. **Reactive Subscriptions**: Components subscribe to state changes
4. **Automatic Notifications**: Subscribers are notified on every state update

### Event-Driven Architecture

The event system enables loose coupling between components:

1. **Event Emission**: DemoApp emits events for important actions
2. **Event Listeners**: Components register listeners for specific events
3. **Decoupled Communication**: Components don't need direct references
4. **Error Isolation**: Errors in listeners don't affect other listeners

## Testing

The module includes comprehensive unit tests covering:

- Initialization and lifecycle
- State management and subscriptions
- World generation and chunk loading
- Chunk unloading and distance management
- Configuration updates
- Event system functionality
- Statistics aggregation
- Resource cleanup

Run tests with:

```bash
npm test demo/src/core/DemoApp.test.ts
```

## Requirements Coverage

This implementation satisfies the following requirements from the spec:

- **Requirement 2.1**: Generate new world with current parameters
- **Requirement 2.2**: Generate initial 3x3 grid of chunks around origin
- **Requirement 2.3**: Automatically load adjacent chunks when navigating
- **Requirement 2.5**: Update Viewer with new chunks after generation

## Future Enhancements

Potential improvements for future iterations:

1. **Async Chunk Loading**: Use Web Workers for parallel chunk generation
2. **Chunk Streaming**: Progressive loading for large worlds
3. **State Persistence**: Save/restore application state
4. **Undo/Redo**: Track state history for undo/redo functionality
5. **Performance Optimization**: Implement chunk pooling and reuse
