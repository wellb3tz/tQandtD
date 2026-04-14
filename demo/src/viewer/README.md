# Viewer Module

This module contains the 3D visualization components for the comprehensive engine demo.

## Components

### WorldViewer

The main 3D visualization component that renders the procedural world using Three.js.

**Features:**
- Terrain mesh rendering with heightmap data
- Biome-based vertex coloring with smooth transitions
- River, resource, and structure overlays
- Chunk boundary visualization
- Camera controls (orbit, pan, zoom)
- Layer visibility toggles
- Wireframe mode

**Usage:**
```typescript
import { WorldViewer, RenderLayer } from './WorldViewer';

const viewer = new WorldViewer();
viewer.initialize(containerElement);

// Add chunks
viewer.addChunk(0, 0, chunkData);

// Toggle visibility
viewer.setVisibility(RenderLayer.BIOMES, true);
viewer.setWireframeMode(false);

// Camera control
viewer.resetCamera();
```

### Materials

Biome color mapping and material utilities for terrain rendering.

**Features:**
- Comprehensive biome color palette
- Smooth color blending based on biome weights
- Grayscale conversion for biome layer toggling
- Color interpolation utilities
- Material creation helpers

**Biome Colors:**
- Ocean: Deep blue (#4169E1)
- Beach: Sandy yellow (#F0E68C)
- Desert: Golden sand (#DAA520)
- Plains: Light green (#90EE90)
- Forest: Forest green (#228B22)
- Taiga: Dark green (#326432)
- Tundra: Icy blue-gray (#B0C4DE)
- Mountain: Gray stone (#708090)

**Usage:**
```typescript
import {
  getBiomeColor,
  blendBiomeColors,
  calculateBlendedColor,
  createTerrainMaterial
} from './materials';

// Get single biome color
const color = getBiomeColor(BiomeType.FOREST);

// Blend multiple biomes
const weights = new Map([
  [BiomeType.FOREST, 0.6],
  [BiomeType.PLAINS, 0.4]
]);
const blended = blendBiomeColors(weights);

// Calculate blended color from chunk data
const color = calculateBlendedColor(
  chunkData.biomeWeights,
  index,
  numBiomes
);

// Create terrain material
const material = createTerrainMaterial(wireframe);
```

## Biome Color Blending

The materials module implements smooth biome transitions using weighted color blending:

1. **Biome Weights**: The engine generates biome blend weights for each position, representing the influence of nearby biomes
2. **Color Extraction**: Extract weights for all biomes at a position
3. **Weighted Blending**: Blend biome colors using their weights as coefficients
4. **Vertex Colors**: Apply blended colors to terrain mesh vertices

This creates smooth, natural-looking transitions between different biome types without visible seams.

## Testing

All components have comprehensive unit tests:

- `WorldViewer.test.ts`: Basic WorldViewer functionality
- `WorldViewer.visibility.test.ts`: Layer visibility and toggling
- `materials.test.ts`: Color mapping and blending

Run tests:
```bash
npm test -- demo/src/viewer/
```

## Performance Considerations

- **Vertex Colors**: Colors are baked into vertex attributes for efficient rendering
- **Material Reuse**: Single material instance per chunk with vertex colors
- **Lazy Updates**: Visibility changes only update affected chunks
- **Efficient Blending**: Biome weights are pre-calculated by the engine

## Future Enhancements

- Shader-based biome blending for even smoother transitions
- Texture mapping for biome-specific details
- Normal map generation from heightmap
- Dynamic LOD for terrain meshes
- Atmospheric effects (fog, sky gradient)
