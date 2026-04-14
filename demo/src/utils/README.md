# Demo Utilities

Utility functions for the Comprehensive Engine Demo application.

## Coordinate Utilities (`coordinates.ts`)

Provides coordinate conversion and raycasting utilities for the WorldViewer component.

### Coordinate Systems

The demo uses multiple coordinate systems:

1. **World Coordinates**: Global position in the procedural world (integer or float)
2. **Chunk Coordinates**: Which chunk a position belongs to (integer)
3. **Local Coordinates**: Position within a specific chunk [0, chunkSize) (integer)
4. **Screen Coordinates**: 2D pixel coordinates on the canvas (integer)
5. **NDC (Normalized Device Coordinates)**: Normalized coordinates [-1, 1] (float)

### Key Functions

#### World-to-Screen Conversion

```typescript
worldToScreen(worldPos: Vector3, camera: THREE.Camera, canvas: HTMLCanvasElement): Vector2
```

Converts a 3D world position to 2D screen coordinates.

#### Screen-to-NDC Conversion

```typescript
screenToNDC(screenX: number, screenY: number, canvas: HTMLCanvasElement): Vector2
```

Converts screen pixel coordinates to normalized device coordinates.

#### Raycasting

```typescript
raycastTerrain(
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  terrainMeshes: THREE.Mesh[],
  chunkSize: number,
  heightScale?: number
): RaycastHit | null
```

Performs raycasting from screen coordinates to terrain meshes. Returns detailed hit information including:
- World position of hit
- Chunk coordinates
- Local coordinates within chunk
- Height value
- Distance from camera

**Use Case**: Terrain interaction, mouse picking, tool placement

#### Chunk Coordinate Utilities

```typescript
getChunkCoords(worldX: number, worldY: number, chunkSize: number): ChunkCoord
```

Converts world coordinates to chunk coordinates.

```typescript
getChunkBounds(chunkX: number, chunkY: number, chunkSize: number): Bounds
```

Calculates the world-space boundaries of a chunk.

```typescript
isInChunkBounds(worldX: number, worldY: number, chunkX: number, chunkY: number, chunkSize: number): boolean
```

Checks if a world position is within a specific chunk's boundaries.

```typescript
getChunksInRadius(centerChunkX: number, centerChunkY: number, radius: number): ChunkCoord[]
```

Returns all chunks within a given radius of a center chunk.

**Use Case**: Chunk loading/unloading based on camera position

```typescript
chunkDistance(chunk1: ChunkCoord, chunk2: ChunkCoord): number
```

Calculates Chebyshev distance between two chunks (max of x and y differences).

**Use Case**: LOD system, chunk priority sorting

#### Height Queries

```typescript
getHeightAtPosition(
  worldX: number,
  worldY: number,
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number
): number | null
```

Gets the exact height value at a world position from chunk heightmap data.

```typescript
getInterpolatedHeight(
  worldX: number,
  worldY: number,
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number
): number | null
```

Gets interpolated height using bilinear interpolation for smoother results.

**Use Case**: Smooth camera following, object placement

#### Normal Calculation

```typescript
getNormalAtPosition(
  worldX: number,
  worldY: number,
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number,
  heightScale?: number
): Vector3 | null
```

Calculates the surface normal at a world position using central differences.

**Use Case**: Lighting calculations, slope detection, object orientation

### Usage Examples

#### Example 1: Chunk Loading Based on Camera

```typescript
import { getChunkCoords, getChunksInRadius } from './utils/coordinates';

function loadChunksAroundCamera(cameraPos: Vector3, radius: number) {
  const chunkSize = 32;
  const centerChunk = getChunkCoords(cameraPos.x, cameraPos.z, chunkSize);
  const chunksToLoad = getChunksInRadius(centerChunk.chunkX, centerChunk.chunkY, radius);
  
  chunksToLoad.forEach(chunk => {
    if (!isChunkLoaded(chunk)) {
      loadChunk(chunk.chunkX, chunk.chunkY);
    }
  });
}
```

#### Example 2: Terrain Interaction

```typescript
import { raycastTerrain } from './utils/coordinates';

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  
  const hit = raycastTerrain(
    screenX,
    screenY,
    camera,
    canvas,
    terrainMeshes,
    32,
    50 // heightScale
  );
  
  if (hit) {
    console.log(`Clicked at chunk (${hit.chunkX}, ${hit.chunkY})`);
    console.log(`Local position: (${hit.localX}, ${hit.localY})`);
    console.log(`Height: ${hit.height}`);
    
    // Modify terrain at this position
    modifyTerrain(hit.chunkX, hit.chunkY, hit.localX, hit.localY);
  }
});
```

#### Example 3: Smooth Camera Following

```typescript
import { getInterpolatedHeight } from './utils/coordinates';

function updateCameraFollowTerrain(cameraPos: Vector3) {
  const chunkSize = 32;
  const chunk = getChunkCoords(cameraPos.x, cameraPos.z, chunkSize);
  const chunkData = getChunkData(chunk.chunkX, chunk.chunkY);
  
  if (chunkData) {
    const height = getInterpolatedHeight(
      cameraPos.x,
      cameraPos.z,
      chunkData,
      chunk.chunkX,
      chunk.chunkY
    );
    
    if (height !== null) {
      // Keep camera 10 units above terrain
      cameraPos.y = height * 50 + 10;
    }
  }
}
```

#### Example 4: Chunk Boundary Visualization

```typescript
import { getChunkBounds } from './utils/coordinates';

function createChunkBoundaryLines(chunkX: number, chunkY: number) {
  const bounds = getChunkBounds(chunkX, chunkY, 32);
  
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    bounds.minX, 0, bounds.minY,
    bounds.maxX, 0, bounds.minY,
    bounds.maxX, 0, bounds.maxY,
    bounds.minX, 0, bounds.maxY,
    bounds.minX, 0, bounds.minY,
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  return new THREE.Line(geometry, material);
}
```

### Testing

All coordinate utilities are thoroughly tested with 43 unit tests covering:
- Coordinate conversions
- Raycasting
- Chunk boundary calculations
- Height queries and interpolation
- Normal calculations
- Edge cases (negative coordinates, boundaries, etc.)

Run tests with:
```bash
npm test -- demo/src/utils/coordinates.test.ts
```

### Performance Considerations

- **Raycasting**: O(n) where n is the number of terrain meshes. Keep terrain meshes organized for efficient raycasting.
- **Chunk Distance**: O(1) - uses Chebyshev distance for fast calculation
- **Height Interpolation**: O(1) - bilinear interpolation with 4 samples
- **Normal Calculation**: O(1) - central differences with 4 samples

### Integration with WorldViewer

The coordinate utilities are designed to work seamlessly with the WorldViewer component:

1. **Raycasting** uses the same heightScale (default: 50) as terrain mesh generation
2. **Chunk coordinates** match the ChunkManager coordinate system
3. **Height queries** work directly with ChunkData from the engine
4. **Screen conversions** use Three.js camera and canvas for consistency

### Future Enhancements

Potential additions:
- Frustum culling utilities
- Spatial partitioning helpers
- Path finding on terrain
- Line-of-sight calculations
- Terrain slope utilities
