# River System Design

## Goal

Add a deterministic river system that feels physically plausible without building a full watershed simulation. Rivers should originate above sea level, route downhill through terrain, carve their own beds, support simple tributaries, and terminate in the ocean. Lakes remain independent in the first version: rivers do not flow into lakes and lake generation does not depend on rivers.

## Chosen Approach

Use a hybrid approach: seeded rivers with local downhill routing. This keeps the feature close to the existing lake architecture while giving rivers enough terrain awareness to avoid looking like decorative lines.

Rejected alternatives:

- Pure decorative ribbons are too weak for this world because they would not explain their own channels.
- Full flow accumulation is more physically complete, but it is too large for the first version and riskier around chunk boundaries, caching, and performance.

## Architecture

Add a `RiverManager` alongside `LakeManager`.

`RiverManager` owns world-space river systems:

- deterministic source selection;
- downhill path tracing from source to ocean;
- simple tributary generation after a main channel is valid;
- cache and LRU-style lifecycle similar to lakes;
- chunk intersection queries for `ChunkManager`.

`ChunkManager` integrates rivers after terrain, biomes, and lakes:

1. Generate heightmap and biome data.
2. Generate or fetch lake data.
3. Generate or fetch river data.
4. Carve lake basins, then river channels.
5. Generate resources and structures after water features are known.

The renderer adds a third water category next to ocean and lake:

- `RiverMeshGenerator` builds river water geometry.
- `WaterLayerManager` stores and disposes ocean, lake, and river meshes.
- River water is chunk-local in rendering, but derived from world-space paths for boundary continuity.

## Generation

River candidates start from deterministic world-space source points. Sources prefer heights around `0.45-0.85` and biomes such as `MOUNTAIN`, `TAIGA`, `TUNDRA`, `FOREST`, and sometimes `PLAINS`. Sources are rejected in `OCEAN`, `BEACH`, and `DESERT`.

Main-channel routing is incremental:

- sample terrain and biome directly in world-space via callbacks;
- score nearby next steps by downhill slope, coarse ocean-seeking bias, route smoothness, and a small deterministic meander term;
- allow only limited uphill movement within a carving budget;
- use short lookahead so the route can avoid obvious local pits;
- mark the route valid only when it reaches `height <= seaLevel` or `BiomeType.OCEAN`;
- discard routes that loop, exceed `maxLength`, spend too much budget climbing, or fail to reach ocean.

Tributaries are added only after the main channel is valid. The first version supports `0-2` simple tributaries per river system. A tributary starts in nearby higher terrain, routes downhill with the same local rules, and becomes valid only if it connects to the main channel.

## Data Model

World-space data:

```ts
interface WorldRiverData {
  id: string;
  mainPath: RiverPoint[];
  tributaries: RiverPath[];
  source: { x: number; y: number };
  mouth: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

interface RiverPath {
  id: string;
  points: RiverPoint[];
  connectsToRiverId: string;
  connectsAtIndex: number;
}

interface RiverPoint {
  x: number;
  y: number;
  height: number;
  surfaceLevel: number;
  width: number;
  depth: number;
  flowX: number;
  flowY: number;
}
```

Chunk-local data:

```ts
interface RiverData {
  riverId: string;
  pathId: string;
  isTributary: boolean;
  points: RiverPoint[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}
```

`ChunkData` gains `rivers?: RiverData[]`. Serialization stores river points in JSON-safe arrays, similar to how lake tile sets are stored today.

## Terrain Carving

River carving operates on polyline distance, not square tile membership. For each heightmap vertex in or near the river bounds:

- find distance to the nearest river segment;
- lower the central channel toward `surfaceLevel - depth`;
- apply a smooth falloff through the bank zone;
- keep carving deterministic from world coordinates so adjacent chunks derive matching edge vertices;
- reconcile boundary vertices with the existing boundary consistency strategy.

Lakes carve before rivers. This first version does not connect river water to lake surfaces.

## Rendering

`RiverMeshGenerator` builds a strip following the river polyline. Width and surface level are sampled per point so the mesh can taper and slope downstream. The first material can reuse the existing water style with river-specific tint and opacity. Flow animation is out of scope for the first version.

Rendering requirements:

- no square river edges;
- continuous water across chunk boundaries;
- correct disposal and visibility with the existing water layer lifecycle;
- no disruption to ocean and lake rendering.

## Config

Add `RiverConfig` to `WorldConfig`:

- `enabled`;
- `sourceNoiseScale`;
- `sourceThreshold`;
- `minSourceElevation`;
- `maxSourceElevation`;
- `allowedSourceBiomes`;
- `maxLength`;
- `maxUphillBudget`;
- `minRiverLength`;
- `maxRiversPerRegion`;
- `maxTributaries`;
- `baseWidth`;
- `baseDepth`;
- `carveBankWidth`.

Defaults target medium density: rivers are visible in a typical explored area, but not everywhere.

## Error Handling

Rivers are optional like lakes. If river generation fails for a chunk, log a river-category warning, return no rivers for that chunk, and continue unless strict error recovery requires throwing. Invalid route candidates are normal generation outcomes and should not be logged as errors.

## Testing

Core tests:

- same seed and config produce identical rivers;
- generated main rivers reach ocean;
- invalid candidates are discarded;
- chunk-local river points stay within or near chunk bounds as intended for mesh/carving;
- carving lowers terrain near river centerlines with smooth banks;
- adjacent chunks keep matching boundary heights where rivers cross;
- serialization round-trips `rivers`;
- water layer creates and disposes river meshes without breaking ocean or lake meshes.

## Non-Goals For First Version

- Full watershed or flow accumulation simulation.
- Rivers flowing into lakes.
- Lake generation influenced by rivers.
- Erosion simulation over time.
- Dynamic water volume or flooding.


