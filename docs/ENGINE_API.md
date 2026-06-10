# Engine API

This package is organized around stable public entrypoints. Application code should import from these entrypoints instead of reaching into `dist` internals.

## Entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `tqandtd-project` | Main generation, serialization, runtime, config, and rendering helpers |
| `tqandtd-project/config` | Default config creation, cloning, merging, and normalization |
| `tqandtd-project/runtime` | Entity runtime, world session, scene state, input, movement, streaming, renderer sync |
| `tqandtd-project/rendering` | Renderer-neutral geometry, overlays, foliage placement, render layers, render stats |
| `tqandtd-project/worker` | Browser worker message handler |
| `tqandtd-project/adapters/three` | Optional Three.js runtime adapter boundary |

## World Setup

Use `createDefaultWorldConfig` when possible. It fills every required nested section, merges partial overrides, and derives `noise3DConfig` from terrain settings.

```ts
import { ChunkManager, createDefaultWorldConfig } from 'tqandtd-project';

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
import { WorldSession, createDefaultWorldConfig } from 'tqandtd-project';

const session = new WorldSession({
  worldConfig: createDefaultWorldConfig({ seed: 123 }),
  scene: {
    player: false,
    input: false,
    movement: false,
    streaming: false,
    renderer: false,
  },
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
} from 'tqandtd-project/rendering';

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
import { ThreeWorldRendererAdapter } from 'tqandtd-project/adapters/three';
```


