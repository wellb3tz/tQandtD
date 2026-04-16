# Ocean Mesh Boundary Alignment

## Overview

This document explains how ocean water meshes achieve seamless alignment at chunk boundaries, ensuring no gaps or overlaps in the water surface across adjacent chunks.

## The Challenge

When generating water meshes for multiple chunks, we need to ensure that:
1. Vertices at chunk boundaries have **identical world coordinates**
2. Vertices at chunk boundaries have **identical elevations**
3. The alignment works automatically without explicit coordination between chunks

## The Solution

### Local Coordinate System

The `buildOceanGeometry()` function uses **local integer coordinates** for vertex positioning:

```typescript
// For a tile at local position (localX, localY)
const x0 = localX;      // e.g., 0, 1, 2, ..., size-1
const y0 = localY;
const x1 = localX + 1;  // e.g., 1, 2, 3, ..., size
const y1 = localY + 1;

// Vertices are positioned at these local coordinates
positions.push(
  x0, waterElevation, y0,  // top-left
  x1, waterElevation, y0,  // top-right
  x0, waterElevation, y1,  // bottom-left
  x1, waterElevation, y1   // bottom-right
);
```

### World Coordinate Conversion

When Three.js renders the mesh, it applies the chunk's world position offset:

```typescript
// Chunk mesh is positioned at world coordinates
mesh.position.set(chunkX * chunkSize, 0, chunkY * chunkSize);

// Local vertex coordinate (x, y, z) becomes world coordinate:
worldX = chunkX * chunkSize + x
worldY = y  // elevation is absolute
worldZ = chunkY * chunkSize + z
```

### Automatic Boundary Alignment

This coordinate system ensures automatic alignment:

**Example: Horizontal Boundary**
- Chunk (0, 0) right edge: localX = size → worldX = 0 * size + size = **size**
- Chunk (1, 0) left edge: localX = 0 → worldX = 1 * size + 0 = **size**
- ✅ Both edges map to the same world coordinate!

**Example: Vertical Boundary**
- Chunk (0, 0) bottom edge: localZ = size → worldZ = 0 * size + size = **size**
- Chunk (0, 1) top edge: localZ = 0 → worldZ = 1 * size + 0 = **size**
- ✅ Both edges map to the same world coordinate!

**Example: Corner**
- Chunk (0, 0) bottom-right: (size, size) → world (size, size)
- Chunk (1, 0) bottom-left: (0, size) → world (size, size)
- Chunk (0, 1) top-right: (size, 0) → world (size, size)
- Chunk (1, 1) top-left: (0, 0) → world (size, size)
- ✅ All four chunks share the same corner coordinate!

### Elevation Consistency

All ocean water vertices use the same elevation:

```typescript
const waterElevation = config.seaLevel + config.rendering.waterOffset;
```

This ensures:
- All ocean surfaces are perfectly flat
- Boundary vertices have identical Y coordinates
- No elevation discontinuities at chunk boundaries

## Key Properties

### Property 1: Coordinate Determinism
For any chunk coordinate (cx, cy) and local coordinate (lx, ly):
```
worldX = cx * size + lx
worldZ = cy * size + ly
```

This formula is deterministic and produces identical results for boundary vertices regardless of which chunk generates them.

### Property 2: Integer Coordinates
Using integer local coordinates (0, 1, 2, ..., size) ensures:
- No floating-point precision errors
- Exact coordinate matching at boundaries
- Consistent results across different hardware

### Property 3: Elevation Uniformity
All ocean vertices use `seaLevel + waterOffset`:
- Prevents z-fighting with terrain
- Ensures seamless water surface
- Consistent across all chunks

## Testing

The boundary alignment is validated by three test suites:

### 1. Unit Tests (`OceanMeshGenerator.test.ts`)
- Basic geometry generation
- Vertex positioning
- Elevation correctness

### 2. Boundary Tests (`OceanMeshGenerator.boundary.test.ts`)
- Horizontal boundary alignment
- Vertical boundary alignment
- Corner alignment
- Partial ocean coverage
- Elevation consistency

### 3. Integration Tests (`OceanMeshGenerator.integration.test.ts`)
- Multi-chunk ocean continuity (3x3 grid)
- Mixed ocean and land scenarios
- Realistic scenarios (archipelago, coastal)
- Edge cases (single tile, checkerboard)

## Implementation Notes

### No Explicit Coordination Required
Chunks don't need to communicate with each other. The coordinate system ensures automatic alignment.

### Works with Partial Ocean Coverage
Even when only some tiles at a boundary are ocean, the vertices that do exist will align perfectly.

### Compatible with Chunk Loading/Unloading
Chunks can be loaded and unloaded in any order without affecting boundary alignment.

### Performance Benefits
- No need to check adjacent chunks
- No need to merge geometries across chunks
- Each chunk is completely independent

## Validation

To verify boundary alignment in your own code:

```typescript
// Get vertices in world coordinates
function getWorldVertices(geometry, chunkX, chunkY, chunkSize) {
  const positions = geometry.getAttribute('position');
  const vertices = [];
  
  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localY = positions.getY(i);
    const localZ = positions.getZ(i);
    
    vertices.push({
      x: chunkX * chunkSize + localX,
      y: localY,
      z: chunkY * chunkSize + localZ
    });
  }
  
  return vertices;
}

// Check that boundary vertices match
const chunk1Vertices = getWorldVertices(geometry1, 0, 0, size);
const chunk2Vertices = getWorldVertices(geometry2, 1, 0, size);

// Find vertices at x = size (the boundary)
const boundary1 = chunk1Vertices.filter(v => v.x === size);
const boundary2 = chunk2Vertices.filter(v => v.x === size);

// Verify they match
for (const v1 of boundary1) {
  const match = boundary2.find(v2 => 
    v2.x === v1.x && v2.y === v1.y && v2.z === v1.z
  );
  console.assert(match, 'Boundary vertex should match');
}
```

## Conclusion

The ocean mesh boundary alignment is achieved through:
1. **Local integer coordinates** for vertex positioning
2. **Deterministic world coordinate conversion** using chunk offsets
3. **Uniform elevation** across all ocean vertices
4. **No explicit coordination** between chunks

This design ensures seamless water surfaces across chunk boundaries with minimal complexity and maximum performance.
