# River Corridor Redesign

## Goal

Replace the current river-as-blue-strip approach with a terrain-first river system that resembles carved mountain valleys and coastal river mouths. A river should be readable primarily through terrain deformation: valley walls, a recessed channel, wet/dark bed material, and only then a narrow water surface inside the channel.

The reference target is not a bright ribbon on top of terrain. It is a set of drainage corridors cut into hills and mountains, with water occupying the lowest part of the corridor.

## Problems With The Current System

- River water is rendered as a standalone spline strip, so it can look like a flat band placed over terrain.
- Terrain carving is too narrow and visually secondary compared with the water mesh.
- Tributaries are synthetic side paths, which creates parallel artificial channels.
- Width and depth are nearly constant, while natural rivers widen and deepen downstream.
- River paths do not come from a drainage field, so they do not reliably follow coherent valleys.
- Mesh and terrain deformation have already needed shared smoothing/taper helpers, which is a sign the water surface is driving the system instead of the terrain.

## New Model

Introduce `RiverCorridor` as the main representation. A corridor is not just a centerline; it describes the full deformation field around a river.

Each corridor point stores:

- `x`, `y`: world-space position.
- `height`: terrain sample before carving.
- `surfaceLevel`: water level inside the channel.
- `flow`: normalized downstream flow strength.
- `channelWidth`: width of the wet central bed.
- `valleyWidth`: width of the carved valley influence.
- `channelDepth`: depth of the central channel.
- `valleyDepth`: broader erosion depth for surrounding slopes.
- `flowX`, `flowY`: downstream direction.

Existing `RiverData` can either evolve to carry these fields or be replaced by a separate `RiverCorridorData` type. Prefer a distinct type if that keeps old and new behavior easier to compare during migration.

## Generation

For the first redesign pass, use a terrain-aware approximation rather than full hydrological simulation.

1. Select fewer source candidates from high terrain and hill/mountain shoulders.
2. Trace downhill routes using local height gradients, ocean attraction, and loop avoidance.
3. Reject routes that are too short, too parallel to an accepted route, or fail to reach ocean.
4. Merge/skip paths that enter an existing corridor instead of drawing fake parallel tributaries.
5. Compute flow from downstream distance and merged upstream contribution.
6. Expand width/depth downstream based on flow and slope.

Artificial tributary generation should be disabled in this redesign. Tributaries should only appear later from actual route merging or flow accumulation.

## Terrain Carving

Carving is the primary visual output.

For every terrain vertex near a corridor segment:

1. Measure normalized distance from centerline.
2. Apply a narrow channel profile at the center.
3. Apply a broader valley profile outside it.
4. Blend with a smooth falloff so the river cuts a valley rather than a rectangular trench.
5. Carve stronger where flow is higher and where the route is steeper.
6. Keep the water level below the banks and above the channel bed.

The cross-section should approximate:

- central channel: deep, narrow U/V cut;
- inner banks: steep enough to visually contain water;
- outer valley: broad, soft erosion fading into original terrain.

This means the terrain should still show a convincing dry river valley even if water rendering is disabled.

## Water Rendering

Water becomes secondary and must stay inside the carved central channel.

The river water mesh should be generated from corridor samples, but it must not be a full-width strip laid over terrain. It should:

- use `channelWidth`, not `valleyWidth`;
- sit below the bank height;
- taper at the source;
- blend or terminate cleanly at ocean;
- avoid rendering past the mouth into ocean;
- avoid square full-width caps;
- use a subdued freshwater material with opacity low enough to read the carved bed.

If a water segment cannot be placed inside the channel, it should be omitted rather than floating above terrain.

## Lakes And Ocean

This first redesign only requires rivers to terminate in ocean. Lake integration can remain future work.

At the ocean mouth:

- water mesh stops before ocean overdraw;
- terrain carving may continue slightly into the coastal edge to create an estuary cut;
- the visible river surface should merge visually with ocean material rather than overlap as a dark stripe.

## Demo Defaults

During visual development, the default river config may intentionally generate more rivers than final production defaults. The important visual constraints still apply:

- no standalone blue ribbons;
- water embedded in carved terrain;
- no fake parallel tributary bundles;
- deeper valleys than the current strip system.

## Testing

Add or update tests for:

- deterministic corridor generation from a fixed seed;
- route reaches ocean but renderable water does not extend into ocean;
- carving creates a deeper center channel and a broader valley falloff;
- water level is below banks and above bed;
- source and mouth taper avoid square caps;
- close parallel candidate paths are merged or rejected;
- disabled tributary generation produces no synthetic side ribbons;
- serialization/worker paths preserve new corridor fields.

## Migration Plan

The old river path and renderer can remain temporarily during implementation, but the target is to remove the old strip-based visual path from the demo.

Implementation should proceed in small slices:

1. Add corridor data types and helpers.
2. Generate corridor fields from existing route traces.
3. Replace terrain carving with corridor carving.
4. Replace water strip rendering with channel-contained water rendering.
5. Disable synthetic tributaries.
6. Tighten defaults and tests after visual inspection.

## Non-Goals

- Full rainfall simulation.
- Full hydraulic erosion over time.
- Lake-connected rivers.
- Animated water flow.
- Perfect real-world watershed accuracy.

Those can come later. The immediate goal is a visually believable river-valley system.


