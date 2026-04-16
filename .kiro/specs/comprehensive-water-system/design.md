# Design Document: Comprehensive Water System

## Overview

The comprehensive water system introduces a separate water rendering layer that treats water as distinct entities from terrain. This design replaces the current approach where ocean biomes are rendered as colored terrain tiles and rivers appear as blue squares. The new system provides realistic water surfaces for oceans, rivers, and lakes with proper transparency, materials, and animations.

### Key Design Principles

1. **Separation of Concerns**: Water meshes are generated and managed independently from terrain meshes
2. **Layered Rendering**: Water renders as a separate layer above terrain but below structures
3. **Performance-First**: Geometry pooling, mesh merging, and LOD ensure 60fps with extensive water bodies
4. **Configurability**: Comprehensive configuration system for visual customization
5. **Seamless Integration**: Water meshes align perfectly at chunk boundaries

### Design Goals

- Eliminate visual artifacts from current ocean/river rendering
- Provide realistic water appearance with transparency and lighting
- Maintain performance targets (<16ms frame time)
- Support optional advanced features (wave animation, normal maps)
- Enable independent water layer management

## Architecture

### System Components

```
WaterSystem
├── WaterMeshGenerator
│   ├── OceanMeshGenerator
│   ├── RiverMeshGenerator
│   └── LakeMeshGenerator
├── WaterMaterialFactory
│   ├── createOceanMaterial()
│   ├── createRiverMaterial()
│   └── createLakeMaterial()
├── WaterLayerManager
│   ├── addWaterToChunk()
│   ├── removeWaterFromChunk()
│   └── updateWaterMeshes()
└── UnderwaterTerrainProcessor
    ├── adjustUnderwaterColors()
    └── applyDepthGradient()
```

### Integration Points

1. **WorldViewer**: Extended to manage separate water mesh collections
2. **ChunkData**: Already contains river and lake data; no changes needed
3. **BiomeSystem**: Used to determine underwater terrain base colors
4. **Materials Module**: Extended with water material factory functions

### Data Flow

```
ChunkData (heightmap, rivers, lakes)
    ↓
WaterMeshGenerator.generate()
    ↓
WaterMesh[] (ocean, river, lake meshes)
    ↓
WaterLayerManager.addToScene()
    ↓
Three.js Scene (rendered above terrain)
```

## Components and Interfaces

### WaterConfig Interface

```typescript
interface WaterConfig {
  // Global water settings
  enabled: boolean;
  seaLevel: number; // Default: 0.3
  
  // Ocean water settings
  ocean: {
    color: number; // Hex color (e.g., 0x1e90ff)
    opacity: number; // 0-1, default: 0.7
    shininess: number; // 0-100, default: 30
    enableWaves: boolean;
    waveHeight: number; // Default: 0.5
    waveSpeed: number; // Default: 0.5
    normalMap?: THREE.Texture;
  };
  
  // River water settings
  river: {
    color: number; // Hex color (e.g., 0x4682b4)
    opacity: number; // 0-1, default: 0.6
    shininess: number; // 0-100, default: 20
    enableFlowAnimation: boolean;
    flowSpeed: number; // Default: 1.0
  };
  
  // Lake water settings
  lake: {
    color: number; // Hex color (e.g., 0x1e90ff)
    opacity: number; // 0-1, default: 0.65
    shininess: number; // 0-100, default: 25
  };
  
  // Performance settings
  performance: {
    enableGeometryPooling: boolean;
    enableMeshMerging: boolean;
    enableLOD: boolean;
    enableFrustumCulling: boolean;
    useInstancedRendering: boolean;
  };
  
  // Rendering settings
  rendering: {
    waterOffset: number; // Y offset above terrain, default: 0.1
    underwaterDarkenFactor: number; // 0-1, default: 0.4 (40% darkening)
    underwaterDesaturationFactor: number; // 0-1, default: 0.5
    enableDepthGradient: boolean;
  };
}
```

### WaterMesh Interface

```typescript
interface WaterMesh {
  type: 'ocean' | 'river' | 'lake';
  mesh: THREE.Mesh;
  material: THREE.MeshPhongMaterial | THREE.MeshStandardMaterial;
  boundingBox: THREE.Box3;
  animationData?: {
    time: number;
    wavePhase: number;
  };
}
```

### WaterLayerData Interface

```typescript
interface WaterLayerData {
  ocean: WaterMesh[];
  rivers: WaterMesh[];
  lakes: WaterMesh[];
  group: THREE.Group; // Container for all water meshes in chunk
}
```

### Extended ChunkMesh Interface

```typescript
interface ChunkMesh {
  terrain: THREE.Mesh;
  water?: WaterLayerData; // New: separate water layer
  rivers?: THREE.Group; // Deprecated: old river visualization
  resources?: THREE.Group;
  structures?: THREE.Group;
  boundaries?: THREE.LineSegments;
  boundingBox?: THREE.Box3;
  visible?: boolean;
}
```

## Data Models

### Ocean Water Data Model

Ocean water is derived from heightmap data. No additional data structure needed beyond heightmap analysis.

```typescript
interface OceanTile {
  index: number; // Flat index in chunk
  terrainHeight: number; // Height from heightmap
  waterElevation: number; // Always seaLevel (0.3)
  underwaterDepth: number; // seaLevel - terrainHeight
}
```

### River Water Data Model

River water uses existing `RiverSegment` data from `RiverNetwork`.

```typescript
// Already exists in src/gen/rivers.ts
interface RiverSegment {
  index: number;
  flow: number;
  width: number;
  order: number;
  next: number;
}
```

### Lake Water Data Model

Lake water uses existing `Lake` data from `RiverNetwork`.

```typescript
// Already exists in src/gen/rivers.ts
interface Lake {
  tiles: Set<number>;
  elevation: number;
  outlet: number;
}
```

### Underwater Terrain Color Model

```typescript
interface UnderwaterColorAdjustment {
  originalColor: BiomeColor;
  adjustedColor: BiomeColor;
  depth: number; // Distance below sea level
  darkenFactor: number; // Applied darkening (0-1)
  desaturationFactor: number; // Applied desaturation (0-1)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Ocean Water Coverage Completeness

*For any* chunk with heightmap data, ocean water meshes SHALL cover exactly the set of tiles where height < seaLevel, and no other tiles.

**Validates: Requirements 1.2, 2.1, 2.3**

### Property 2: Water Mesh Independence

*For any* chunk, water meshes SHALL be generated independently from terrain meshes such that water can be added, removed, or updated without regenerating terrain.

**Validates: Requirements 1.1, 7.2, 7.3**

### Property 3: River Water Path Following

*For any* river network with segments, river water meshes SHALL exist for each segment and follow the network path with width proportional to flow data.

**Validates: Requirements 1.3, 3.1, 3.2**

### Property 4: Lake Water Coverage

*For any* lake with tiles and elevation, lake water meshes SHALL cover all lake tiles at the lake's elevation level.

**Validates: Requirements 1.4, 4.1, 4.2, 4.4**

### Property 5: Underwater Terrain Color Exclusion

*For any* terrain tile below seaLevel, the terrain mesh color SHALL NOT be the ocean biome color, but SHALL be derived from the underlying terrain biome (beach, plains, etc.).

**Validates: Requirements 1.5, 6.4, 6.5**

### Property 6: Ocean Water Seamless Boundaries

*For any* pair of adjacent chunks with ocean tiles at their shared boundary, the ocean water mesh vertices at the boundary SHALL have identical world coordinates and elevations.

**Validates: Requirements 2.4**

### Property 7: Underwater Color Darkening

*For any* underwater terrain tile, the terrain mesh color SHALL be darkened by a factor between 0.3 and 0.5 (30-50%) compared to the above-water biome color.

**Validates: Requirements 2.5, 6.1, 6.2**

### Property 8: Underwater Color Desaturation

*For any* underwater terrain tile, the terrain mesh color SHALL be desaturated to simulate depth, with desaturation factor proportional to depth below seaLevel.

**Validates: Requirements 2.5, 6.3**

### Property 9: River Water Terrain Elevation Matching

*For any* river segment at a given tile, the river water mesh elevation SHALL match the terrain heightmap elevation at that tile (plus waterOffset).

**Validates: Requirements 3.3, 9.1, 9.3**

### Property 10: River Width Smooth Transitions

*For any* sequence of connected river segments with varying flow values, the calculated widths SHALL transition smoothly such that the width difference between adjacent segments is bounded.

**Validates: Requirements 3.5**

### Property 11: Lake-River Connection Seamlessness

*For any* lake with an outlet river, the lake water mesh and river water mesh SHALL connect seamlessly at the outlet point with no gaps or overlaps.

**Validates: Requirements 4.5**

### Property 12: Water Material Configuration Reflection

*For any* WaterConfig with specified color, opacity, and shininess values, the generated water materials SHALL have properties that exactly match the configuration values.

**Validates: Requirements 5.2**

### Property 13: Depth-Based Gradient Application

*For any* underwater terrain tile, the color adjustment SHALL include a depth-based gradient where deeper tiles (further below seaLevel) are darker than shallower tiles.

**Validates: Requirements 6.6**

### Property 14: Water Elevation Correctness

*For any* water mesh (ocean, river, or lake), the water surface elevation SHALL be positioned correctly relative to terrain: ocean at seaLevel, rivers at terrain height, lakes at lake elevation, all offset by waterOffset to prevent z-fighting.

**Validates: Requirements 9.1, 9.4, 9.5**

### Property 15: Shoreline Transition Smoothness

*For any* boundary between water and land tiles, the transition SHALL be smooth with no abrupt elevation discontinuities or visual artifacts.

**Validates: Requirements 9.2, 9.6**

## Error Handling

### Invalid Configuration

```typescript
function validateWaterConfig(config: Partial<WaterConfig>): WaterConfig {
  // Validate and provide defaults
  if (config.ocean?.opacity !== undefined && 
      (config.ocean.opacity < 0 || config.ocean.opacity > 1)) {
    console.warn('Invalid ocean opacity, clamping to [0, 1]');
    config.ocean.opacity = Math.max(0, Math.min(1, config.ocean.opacity));
  }
  
  // Validate seaLevel
  if (config.seaLevel !== undefined && 
      (config.seaLevel < 0 || config.seaLevel > 1)) {
    console.warn('Invalid seaLevel, using default 0.3');
    config.seaLevel = 0.3;
  }
  
  // Return validated config with defaults
  return {
    enabled: config.enabled ?? true,
    seaLevel: config.seaLevel ?? 0.3,
    // ... other defaults
  };
}
```

### Missing Chunk Data

```typescript
function generateWaterForChunk(
  chunkData: ChunkData,
  config: WaterConfig
): WaterLayerData | null {
  // Handle missing heightmap
  if (!chunkData.heightmap || chunkData.heightmap.length === 0) {
    console.warn(`Chunk (${chunkData.x}, ${chunkData.y}) missing heightmap, skipping water generation`);
    return null;
  }
  
  // Handle missing river/lake data gracefully
  const rivers = chunkData.rivers || new Set<number>();
  const lakes = extractLakesFromChunk(chunkData) || [];
  
  // Generate water meshes
  return {
    ocean: generateOceanMeshes(chunkData, config),
    rivers: generateRiverMeshes(chunkData, rivers, config),
    lakes: generateLakeMeshes(chunkData, lakes, config),
    group: new THREE.Group()
  };
}
```

### Geometry Generation Failures

```typescript
function createOceanMesh(
  oceanTiles: OceanTile[],
  chunkData: ChunkData,
  config: WaterConfig
): THREE.Mesh | null {
  try {
    const geometry = buildOceanGeometry(oceanTiles, chunkData);
    const material = createOceanMaterial(config.ocean);
    return new THREE.Mesh(geometry, material);
  } catch (error) {
    console.error('Failed to create ocean mesh:', error);
    return null; // Graceful degradation
  }
}
```

### Resource Cleanup

```typescript
function disposeWaterLayer(waterLayer: WaterLayerData): void {
  // Dispose all ocean meshes
  for (const waterMesh of waterLayer.ocean) {
    waterMesh.mesh.geometry.dispose();
    if (Array.isArray(waterMesh.mesh.material)) {
      waterMesh.mesh.material.forEach(m => m.dispose());
    } else {
      waterMesh.mesh.material.dispose();
    }
  }
  
  // Dispose river and lake meshes similarly
  // ... (same pattern)
  
  // Clear arrays
  waterLayer.ocean.length = 0;
  waterLayer.rivers.length = 0;
  waterLayer.lakes.length = 0;
}
```

### Performance Degradation

```typescript
function checkPerformance(frameTime: number, config: WaterConfig): void {
  if (frameTime > 16) { // Exceeding 60fps target
    console.warn(`Frame time ${frameTime}ms exceeds target, consider:
      - Reducing water mesh complexity
      - Enabling LOD (config.performance.enableLOD)
      - Enabling frustum culling (config.performance.enableFrustumCulling)
      - Disabling wave animations (config.ocean.enableWaves)`);
  }
}
```

## Testing Strategy

### Unit Tests

Unit tests focus on specific components, edge cases, and API contracts:

1. **Water Material Factory Tests**
   - Verify material types (MeshPhongMaterial/MeshStandardMaterial)
   - Test configuration parameter application
   - Verify material property distinctness (ocean vs river vs lake)
   - Test optional features (normal maps, wave animation)

2. **Water Mesh Generator Tests**
   - Test ocean mesh generation for various heightmap configurations
   - Test river mesh generation for various river network structures
   - Test lake mesh generation for various lake shapes
   - Verify mesh independence from terrain generation
   - Test geometry pooling and reuse

3. **Underwater Terrain Processor Tests**
   - Test color darkening calculations
   - Test desaturation calculations
   - Test depth gradient application
   - Verify ocean biome color exclusion

4. **Water Layer Manager Tests**
   - Test adding water to chunks
   - Test removing water from chunks
   - Test updating water meshes
   - Test visibility toggling
   - Test resource disposal

5. **Configuration Tests**
   - Test WaterConfig validation
   - Test default value application
   - Test configuration parameter clamping
   - Test enable/disable flags

6. **Edge Case Tests**
   - Empty chunks (no water)
   - Chunks with only ocean
   - Chunks with only rivers
   - Chunks with only lakes
   - Chunks with all water types
   - Missing heightmap data
   - Invalid configuration values

### Property-Based Tests

Property-based tests verify universal correctness properties across randomized inputs using **fast-check**. Each test runs a minimum of 100 iterations.

**Test Configuration:**
- Library: fast-check 3.15+
- Iterations: 100 minimum per property
- Tag format: `Feature: comprehensive-water-system, Property {number}: {property_text}`

**Property Test Suite:**

1. **Property 1: Ocean Water Coverage Completeness**
   ```typescript
   // Feature: comprehensive-water-system, Property 1: Ocean Water Coverage Completeness
   fc.assert(
     fc.property(
       arbitraryHeightmap(),
       (heightmap) => {
         const oceanTiles = identifyOceanTiles(heightmap, seaLevel);
         const waterMeshes = generateOceanMeshes(heightmap, config);
         const coveredTiles = extractCoveredTiles(waterMeshes);
         return setsEqual(oceanTiles, coveredTiles);
       }
     ),
     { numRuns: 100 }
   );
   ```

2. **Property 2: Water Mesh Independence**
   ```typescript
   // Feature: comprehensive-water-system, Property 2: Water Mesh Independence
   fc.assert(
     fc.property(
       arbitraryChunkData(),
       (chunkData) => {
         const terrainMesh = generateTerrainMesh(chunkData);
         const waterLayer1 = generateWaterLayer(chunkData, config);
         const waterLayer2 = generateWaterLayer(chunkData, config);
         // Water generation should be deterministic and independent
         return waterLayersEqual(waterLayer1, waterLayer2) &&
                terrainMeshUnchanged(terrainMesh);
       }
     ),
     { numRuns: 100 }
   );
   ```

3. **Property 3: River Water Path Following**
   ```typescript
   // Feature: comprehensive-water-system, Property 3: River Water Path Following
   fc.assert(
     fc.property(
       arbitraryRiverNetwork(),
       (riverNetwork) => {
         const riverMeshes = generateRiverMeshes(riverNetwork, config);
         return riverMeshes.length === riverNetwork.segments.length &&
                allSegmentsCovered(riverNetwork, riverMeshes) &&
                widthsProportionalToFlow(riverNetwork, riverMeshes);
       }
     ),
     { numRuns: 100 }
   );
   ```

4. **Property 4: Lake Water Coverage**
   ```typescript
   // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
   fc.assert(
     fc.property(
       arbitraryLake(),
       (lake) => {
         const lakeMesh = generateLakeMesh(lake, config);
         const coveredTiles = extractCoveredTiles([lakeMesh]);
         return setsEqual(lake.tiles, coveredTiles) &&
                meshElevationEquals(lakeMesh, lake.elevation + waterOffset);
       }
     ),
     { numRuns: 100 }
   );
   ```

5. **Property 5: Underwater Terrain Color Exclusion**
   ```typescript
   // Feature: comprehensive-water-system, Property 5: Underwater Terrain Color Exclusion
   fc.assert(
     fc.property(
       arbitraryUnderwaterTerrain(),
       (terrain) => {
         const terrainMesh = generateTerrainMesh(terrain);
         const colors = extractMeshColors(terrainMesh);
         const oceanColor = BIOME_COLORS[BiomeType.OCEAN];
         return colors.every(color => !colorsEqual(color, oceanColor));
       }
     ),
     { numRuns: 100 }
   );
   ```

6. **Property 6: Ocean Water Seamless Boundaries**
   ```typescript
   // Feature: comprehensive-water-system, Property 6: Ocean Water Seamless Boundaries
   fc.assert(
     fc.property(
       arbitraryAdjacentChunks(),
       (chunks) => {
         const [chunk1, chunk2] = chunks;
         const water1 = generateOceanMeshes(chunk1, config);
         const water2 = generateOceanMeshes(chunk2, config);
         return boundaryVerticesAlign(water1, water2, chunk1, chunk2);
       }
     ),
     { numRuns: 100 }
   );
   ```

7. **Property 7: Underwater Color Darkening**
   ```typescript
   // Feature: comprehensive-water-system, Property 7: Underwater Color Darkening
   fc.assert(
     fc.property(
       arbitraryUnderwaterTile(),
       (tile) => {
         const originalColor = getBiomeColor(tile.biome);
         const adjustedColor = adjustUnderwaterColor(originalColor, tile.depth, config);
         const darkenFactor = calculateDarkenFactor(originalColor, adjustedColor);
         return darkenFactor >= 0.3 && darkenFactor <= 0.5;
       }
     ),
     { numRuns: 100 }
   );
   ```

8. **Property 8: Underwater Color Desaturation**
   ```typescript
   // Feature: comprehensive-water-system, Property 8: Underwater Color Desaturation
   fc.assert(
     fc.property(
       arbitraryUnderwaterTile(),
       (tile) => {
         const originalColor = getBiomeColor(tile.biome);
         const adjustedColor = adjustUnderwaterColor(originalColor, tile.depth, config);
         const originalSaturation = calculateSaturation(originalColor);
         const adjustedSaturation = calculateSaturation(adjustedColor);
         return adjustedSaturation < originalSaturation;
       }
     ),
     { numRuns: 100 }
   );
   ```

9. **Property 9: River Water Terrain Elevation Matching**
   ```typescript
   // Feature: comprehensive-water-system, Property 9: River Water Terrain Elevation Matching
   fc.assert(
     fc.property(
       arbitraryRiverSegment(),
       arbitraryHeightmap(),
       (segment, heightmap) => {
         const riverMesh = generateRiverMesh(segment, heightmap, config);
         const terrainHeight = heightmap[segment.index];
         const riverHeight = extractMeshElevation(riverMesh, segment.index);
         return Math.abs(riverHeight - (terrainHeight + waterOffset)) < 0.01;
       }
     ),
     { numRuns: 100 }
   );
   ```

10. **Property 10: River Width Smooth Transitions**
    ```typescript
    // Feature: comprehensive-water-system, Property 10: River Width Smooth Transitions
    fc.assert(
      fc.property(
        arbitraryConnectedRiverSegments(),
        (segments) => {
          const riverMeshes = generateRiverMeshes(segments, config);
          const widths = riverMeshes.map(m => extractMeshWidth(m));
          return allTransitionsSmooth(widths, maxWidthDifference);
        }
      ),
      { numRuns: 100 }
    );
    ```

11. **Property 11: Lake-River Connection Seamlessness**
    ```typescript
    // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
    fc.assert(
      fc.property(
        arbitraryLakeWithOutlet(),
        (lakeData) => {
          const lakeMesh = generateLakeMesh(lakeData.lake, config);
          const riverMesh = generateRiverMesh(lakeData.outlet, config);
          return meshesConnectSeamlessly(lakeMesh, riverMesh, lakeData.connectionPoint);
        }
      ),
      { numRuns: 100 }
    );
    ```

12. **Property 12: Water Material Configuration Reflection**
    ```typescript
    // Feature: comprehensive-water-system, Property 12: Water Material Configuration Reflection
    fc.assert(
      fc.property(
        arbitraryWaterConfig(),
        (config) => {
          const oceanMaterial = createOceanMaterial(config.ocean);
          return materialMatchesConfig(oceanMaterial, config.ocean);
        }
      ),
      { numRuns: 100 }
    );
    ```

13. **Property 13: Depth-Based Gradient Application**
    ```typescript
    // Feature: comprehensive-water-system, Property 13: Depth-Based Gradient Application
    fc.assert(
      fc.property(
        arbitraryUnderwaterTiles(),
        (tiles) => {
          const adjustedColors = tiles.map(t => adjustUnderwaterColor(
            getBiomeColor(t.biome), t.depth, config
          ));
          // Deeper tiles should be darker
          return tilesOrderedByDepth(tiles).every((tile, i) => {
            if (i === 0) return true;
            const prevColor = adjustedColors[i - 1];
            const currColor = adjustedColors[i];
            return calculateBrightness(currColor) <= calculateBrightness(prevColor);
          });
        }
      ),
      { numRuns: 100 }
    );
    ```

14. **Property 14: Water Elevation Correctness**
    ```typescript
    // Feature: comprehensive-water-system, Property 14: Water Elevation Correctness
    fc.assert(
      fc.property(
        arbitraryChunkWithAllWaterTypes(),
        (chunk) => {
          const waterLayer = generateWaterLayer(chunk, config);
          const oceanCorrect = waterLayer.ocean.every(m => 
            meshElevationEquals(m, seaLevel + waterOffset)
          );
          const riversCorrect = waterLayer.rivers.every(m =>
            riverElevationMatchesTerrain(m, chunk.heightmap, waterOffset)
          );
          const lakesCorrect = waterLayer.lakes.every(m =>
            lakeElevationMatchesData(m, chunk.lakes, waterOffset)
          );
          return oceanCorrect && riversCorrect && lakesCorrect;
        }
      ),
      { numRuns: 100 }
    );
    ```

15. **Property 15: Shoreline Transition Smoothness**
    ```typescript
    // Feature: comprehensive-water-system, Property 15: Shoreline Transition Smoothness
    fc.assert(
      fc.property(
        arbitraryShoreline(),
        (shoreline) => {
          const waterMesh = generateOceanMeshes(shoreline.chunk, config);
          const transitions = extractShorelineTransitions(waterMesh, shoreline);
          return allTransitionsSmooth(transitions, maxElevationDifference);
        }
      ),
      { numRuns: 100 }
    );
    ```

### Integration Tests

Integration tests verify end-to-end workflows and system interactions:

1. **Complete Water System Integration**
   - Generate chunk with all water types
   - Verify all water meshes are created and added to scene
   - Verify rendering order (terrain → water → structures)
   - Verify visibility controls work correctly

2. **Multi-Chunk Water Continuity**
   - Generate 3x3 grid of chunks with ocean
   - Verify seamless ocean surface across all boundaries
   - Generate chunks with cross-chunk rivers
   - Verify river continuity across boundaries

3. **Performance Integration**
   - Generate world with extensive water bodies
   - Measure frame time with various water configurations
   - Verify <16ms frame time target is maintained
   - Test LOD system with water meshes

4. **Configuration Integration**
   - Test various WaterConfig combinations
   - Verify configuration changes update existing water meshes
   - Test enable/disable water layer
   - Test wave animation performance impact

5. **Resource Management Integration**
   - Generate and remove chunks repeatedly
   - Verify no memory leaks from water meshes
   - Test chunk update scenarios
   - Verify proper disposal of water resources

### Performance Tests

Performance tests validate the <16ms frame time requirement:

1. **Water Mesh Complexity Benchmark**
   - Measure frame time with increasing water mesh counts
   - Test with 10, 50, 100, 500 chunks with water
   - Verify frame time stays below 16ms

2. **Optimization Feature Benchmarks**
   - Measure impact of geometry pooling
   - Measure impact of mesh merging
   - Measure impact of LOD system
   - Measure impact of frustum culling

3. **Wave Animation Performance**
   - Measure frame time with wave animation enabled
   - Test with various wave parameters
   - Verify acceptable performance degradation

### Test Organization

```
tests/
├── unit/
│   ├── water-material-factory.test.ts
│   ├── ocean-mesh-generator.test.ts
│   ├── river-mesh-generator.test.ts
│   ├── lake-mesh-generator.test.ts
│   ├── underwater-terrain-processor.test.ts
│   └── water-layer-manager.test.ts
├── property/
│   ├── water-coverage.property.test.ts
│   ├── water-independence.property.test.ts
│   ├── river-path-following.property.test.ts
│   ├── underwater-colors.property.test.ts
│   └── water-elevation.property.test.ts
├── integration/
│   ├── complete-water-system.integration.test.ts
│   ├── multi-chunk-continuity.integration.test.ts
│   └── water-configuration.integration.test.ts
└── performance/
    ├── water-mesh-complexity.bench.test.ts
    └── wave-animation.bench.test.ts
```

