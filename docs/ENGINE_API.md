# Engine API

This package is organized around stable public entrypoints. Application code should import from these entrypoints instead of reaching into `dist` internals.

## Entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `procedural-world-engine` | Main generation, serialization, runtime, config, and rendering helpers |
| `procedural-world-engine/config` | Default config creation, cloning, merging, and normalization |
| `procedural-world-engine/runtime` | Entity runtime, world session, scene state, input, movement, streaming, renderer sync |
| `procedural-world-engine/rendering` | Renderer-neutral geometry, overlays, foliage placement, render layers, render stats |
| `procedural-world-engine/worker` | Browser worker message handler |
| `procedural-world-engine/adapters/three` | Optional Three.js runtime adapter boundary |

## World Setup

Use `createDefaultWorldConfig` when possible. It fills every required nested section, merges partial overrides, and derives `noise3DConfig` from terrain settings.

```ts
import { ChunkManager, createDefaultWorldConfig } from 'procedural-world-engine';

const world = new ChunkManager(createDefaultWorldConfig({
  seed: 42,
  terrainConfig: {
    enable3D: true,
    zScale: 0.7,
  },
}));

const chunk = await world.getChunk(0, 0);
world.dispose();
```

## Sessions

`WorldSession` owns the active `ChunkManager`, loaded chunk set, optional scene state, optional renderer sync, save/load, regeneration, and config changes.

```ts
import { WorldSession, createDefaultWorldConfig } from 'procedural-world-engine';

const session = new WorldSession({
  config: createDefaultWorldConfig({ seed: 123 }),
  scene: { syncLoadedChunks: true },
});

await session.loadChunksAround(0, 0, 2);
console.log(session.getLoadedChunksSnapshot());
session.dispose();
```

## Renderer-Neutral Data

The rendering entrypoint returns plain arrays and placement data. Use it to build your own renderer without depending on Three.js.

```ts
import {
  buildTerrainGridGeometryData,
  TERRAIN_HEIGHT_SCALE_METERS,
  identifyOceanSurfaceTiles,
  buildOceanGeometryData,
} from 'procedural-world-engine/rendering';

const terrain = buildTerrainGridGeometryData(chunk, 0, 0, {
  heightScale: TERRAIN_HEIGHT_SCALE_METERS,
});
const oceanTiles = identifyOceanSurfaceTiles(chunk, 0.3);
const ocean = buildOceanGeometryData(oceanTiles, chunk, 0.3, {
  heightScale: TERRAIN_HEIGHT_SCALE_METERS,
});
```

## Three.js Adapter

Three.js is optional. The adapter is exposed as a separate subpath and is backed by a peer dependency.

```ts
import { ThreeWorldRendererAdapter } from 'procedural-world-engine/adapters/three';
```


