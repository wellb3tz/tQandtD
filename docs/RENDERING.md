# Rendering Helpers

The `tqandtd-project/rendering` entrypoint contains renderer-neutral helpers. These helpers do not create DOM nodes, WebGL objects, or Three.js classes. They return plain data that can be consumed by any renderer.

## Terrain

`buildTerrainGridGeometryData` builds a chunk grid:

- `positions`: `Float32Array`, XYZ triples
- `uvs`: `Float32Array`, UV pairs
- `indices`: `Uint32Array`, triangle indices
- metadata such as `vertexCount`, `worldXBase`, and heightmap normalization flags

## Water

Water helpers identify tiles and build clipped surface geometry:

- `identifyOceanSurfaceTiles`
- `identifyLakeSurfaceTiles`
- `buildOceanGeometryData`
- `buildLakeGeometryData`
- `buildRiverGeometryData`

## Foliage

`planFoliagePlacements` returns deterministic tree, shrub, and terrain-prop placements for a chunk. Rendering code decides how to turn those placements into meshes, sprites, particles, or instances.

## Overlays

Chunk overlay helpers return line and marker data:

- `buildChunkBoundaryLineData`
- `buildResourceMarkerPlacements`
- `buildStructureMarkerPlacements`
- `getResourceMarkerColor`
- `getStructureMarkerColor`

## Render State

Visibility and stats helpers work with structural objects:

- `RenderLayer`
- `applyChunkVisibility`
- `applyRenderLayerVisibility`
- `calculateRenderStats`
- `RenderStatsCache`

These helpers are intentionally small and generic so renderer adapters can share behavior without inheriting the app's scene classes.


