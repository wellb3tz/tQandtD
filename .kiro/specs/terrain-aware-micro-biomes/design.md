# Design Document: Terrain-Aware Micro-Biomes

## Overview

This feature corrects a mathematical bug in the `EnhancedBiomeSystem` micro-biome frequency
parameter, improves terrain-aware placement for all four micro-biome types, adds visual
feedback in the demo application, and provides comprehensive property-based tests to prevent
regression.

The core bug: `getMicroBiome` computes `threshold = 1.0 - microBiomeFrequency * 2`. Because
`NoiseEngine.fbm` returns values in **[-1, 1]**, a threshold of `1.0 - 0.5 * 2 = 0.0` at
maximum frequency means only noise values in `[0, 1]` pass — roughly half the possible
placements are silently discarded. At frequency `0.5` the user expects *maximum* density, but
the formula produces a threshold that still rejects ~50 % of candidates. The corrected formula
maps the `[0.0, 0.5]` frequency range to the full `[-1, 1]` noise range:

```
threshold = -1.0 + (1.0 - microBiomeFrequency) * 2   // simplified: 1.0 - microBiomeFrequency * 2 - 1.0
          = 1.0 - microBiomeFrequency * 2 - 1.0
          = -microBiomeFrequency * 2
```

At `frequency = 0.0` → `threshold = 0.0` (no noise value in `[-1, 0)` passes, but the
condition is `noiseValue >= threshold`, so threshold `0.0` still lets values in `[0, 1]` pass).
The correct mapping that blocks *all* placements at `0.0` and allows *all* at `0.5` is:

```
threshold = 1.0 - microBiomeFrequency * 4
```

- `frequency = 0.0` → `threshold = 1.0`  (no fBM value ever reaches 1.0, so zero placements)
- `frequency = 0.25` → `threshold = 0.0` (half the noise range passes)
- `frequency = 0.5` → `threshold = -1.0` (all noise values pass, maximum density)

This is the corrected formula adopted in this design.

---

## Architecture

The change is confined to three layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Library Core  (src/world/enhanced-biome.ts)                │
│  • Fix threshold formula in getMicroBiome()                 │
│  • Add useLegacyMicroBiomeThreshold flag                    │
│  • Expose depressionDepthThreshold / clearingGradientThreshold│
│    (already present; ensure defaults are applied)           │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Demo Application  (demo/src/)                              │
│  • ControlPanel: add frequency slider (0–0.5, step 0.01)   │
│                  add "Highlight Micro-Biomes" toggle        │
│  • StatisticsDisplay: add "Micro-Biomes Visible" counter    │
│  • WorldViewer: micro-biome colour tinting + debug overlay  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Tests  (src/world/enhanced-biome.test.ts)                  │
│  • Property-based tests via fast-check                      │
│  • Regression test for legacy threshold flag                │
└─────────────────────────────────────────────────────────────┘
```

No new files are required in the library core. The demo additions are additive (new UI
controls, new rendering path). The test additions extend the existing
`src/world/enhanced-biome.test.ts` file.

---

## Components and Interfaces

### 1. `EnhancedBiomeConfig` (src/world/enhanced-biome.ts)

Two new fields are added to the existing interface:

```typescript
export interface EnhancedBiomeConfig extends BiomeConfig {
  // ... existing fields ...

  /**
   * When true, uses the legacy (buggy) threshold formula
   * `threshold = 1.0 - microBiomeFrequency * 2` for backward compatibility
   * with worlds generated before this fix.
   *
   * @deprecated Will be removed in the next major version.
   *             Migrate to the corrected formula by setting this to false (default).
   */
  useLegacyMicroBiomeThreshold?: boolean;
}
```

The `depressionDepthThreshold` and `clearingGradientThreshold` fields already exist in the
interface; this feature ensures their defaults (`0.05` and `0.03`) are applied consistently
via the nullish-coalescing pattern already present in `getMicroBiome`.

### 2. `EnhancedBiomeSystem.getMicroBiome` (src/world/enhanced-biome.ts)

The threshold computation line changes from:

```typescript
const threshold = 1.0 - this.enhancedConfig.microBiomeFrequency * 2;
```

to:

```typescript
const threshold = this.enhancedConfig.useLegacyMicroBiomeThreshold === true
  ? 1.0 - this.enhancedConfig.microBiomeFrequency * 2          // legacy (buggy)
  : 1.0 - this.enhancedConfig.microBiomeFrequency * 4;         // corrected
```

The noise comparison changes from `noiseValue < threshold` (reject) to the equivalent
`noiseValue >= threshold` (accept) — the existing code already uses `< threshold` for
rejection, so the sign of the threshold is the only change needed.

### 3. Demo — `ControlPanel` (demo/src/ui/ControlPanel.ts)

Two new controls are added inside `createBiomeControls()`, conditional on
`enableMicroBiomes` being checked:

- **Micro-Biome Frequency slider**: `id="microBiomeFrequency"`, `min=0.0`, `max=0.5`,
  `step=0.01`, `defaultValue=0.1`. Displays current value to two decimal places.
- **Highlight Micro-Biomes checkbox**: `id="highlightMicroBiomes"`, `label="Highlight
  Micro-Biomes"`. Fires a callback that sets a flag on `WorldViewer`.

The existing `microBiomeFrequency` slider already exists in the panel with `min=0.01`; it
needs its `min` corrected to `0.0` and its `step` corrected to `0.01`.

### 4. Demo — `StatisticsDisplay` (demo/src/ui/StatisticsDisplay.ts)

A new "Micro-Biomes" section is added with a single statistic element:

```typescript
private microBiomeCountElement: HTMLElement | null = null;

// In createStatisticsUI():
this.createMicroBiomeSection();

// New method:
private createMicroBiomeSection(): void {
  const section = this.createSection('Micro-Biomes');
  this.microBiomeCountElement = this.createStatistic(section, 'Micro-Biomes Visible', '0');
  this.container?.appendChild(section);
}

// New public method:
updateMicroBiomeCount(count: number): void {
  if (this.microBiomeCountElement) {
    this.microBiomeCountElement.textContent = count.toString();
  }
}
```

### 5. Demo — `WorldViewer` (demo/src/viewer/WorldViewer.ts)

Two additions:

**Micro-biome colour tinting** — in `createTerrainMesh`, after the biome colour is resolved,
if the tile's `microBiome` field is set, apply a per-type colour shift:

```typescript
// Colour offsets per MicroBiomeType (applied additively, clamped to [0,1])
const MICRO_BIOME_TINT: Record<number, { r: number; g: number; b: number }> = {
  0: { r:  0.0, g:  0.25, b:  0.0 },  // OASIS:    greener
  1: { r:  0.0, g:  0.20, b:  0.0 },  // CLEARING: lighter green
  2: { r:  0.0, g:  0.0,  b:  0.30 }, // POND:     bluer
  3: { r:  0.15, g: 0.15, b:  0.0 },  // GROVE:    warmer
};
```

**Debug overlay** — a new `highlightMicroBiomes` boolean flag on `WorldViewer`. When true,
tiles with a micro-biome receive an additional bright overlay colour (e.g. yellow `#ffff00`
at 50 % blend) so they are immediately visible regardless of biome colour. A public method
`setHighlightMicroBiomes(enabled: boolean)` triggers a full chunk re-render.

The micro-biome count is tracked per-frame by counting coloured vertices and exposed via
`getMicroBiomeCount(): number`.

### 6. Examples — `micro-biome-tuning.ts` (examples/micro-biome-tuning.ts)

A new standalone example demonstrating three configuration presets. See Data Models section
for the preset definitions.

---

## Data Models

### Corrected Threshold Formula

| `microBiomeFrequency` | Legacy threshold | Corrected threshold | Noise values that pass |
|---|---|---|---|
| 0.00 | 1.00 | 1.00 | none (fBM max ≈ 1.0, never reached) |
| 0.10 | 0.80 | 0.60 | ~20 % of range |
| 0.25 | 0.50 | 0.00 | ~50 % of range |
| 0.40 | 0.20 | -0.60 | ~80 % of range |
| 0.50 | 0.00 | -1.00 | ~100 % of range |

The legacy formula at `frequency=0.5` produces `threshold=0.0`, passing only ~50 % of noise
values. The corrected formula at `frequency=0.5` produces `threshold=-1.0`, passing ~100 %.

### Terrain Condition Summary

| Micro-biome | Parent biome | Terrain condition |
|---|---|---|
| OASIS | DESERT | `(centerH - neighbourAvg) < -depressionDepthThreshold` |
| POND | PLAINS | `(centerH - neighbourAvg) < -depressionDepthThreshold` |
| CLEARING | FOREST | `gradient < clearingGradientThreshold` |
| GROVE | TUNDRA | `gradient < clearingGradientThreshold` |

### Example Presets (`examples/micro-biome-tuning.ts`)

```typescript
// Preset 1: Sparse Micro-Biomes
const sparseConfig: EnhancedBiomeConfig = {
  // ...base config...
  enableMicroBiomes: true,
  microBiomeFrequency: 0.05,
  depressionDepthThreshold: 0.08,
  clearingGradientThreshold: 0.02,
};

// Preset 2: Moderate Micro-Biomes
const moderateConfig: EnhancedBiomeConfig = {
  // ...base config...
  enableMicroBiomes: true,
  microBiomeFrequency: 0.15,
  depressionDepthThreshold: 0.05,
  clearingGradientThreshold: 0.03,
};

// Preset 3: Dense Micro-Biomes
const denseConfig: EnhancedBiomeConfig = {
  // ...base config...
  enableMicroBiomes: true,
  microBiomeFrequency: 0.40,
  depressionDepthThreshold: 0.03,
  clearingGradientThreshold: 0.05,
};
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions
of a system — essentially, a formal statement about what the system should do. Properties
serve as the bridge between human-readable specifications and machine-verifiable correctness
guarantees.*

### Property 1: Threshold is always in the valid noise range

*For any* `microBiomeFrequency` value in `[0.0, 0.5]`, the corrected threshold
`1.0 - microBiomeFrequency * 4` SHALL be in the range `[-1.0, 1.0]`, ensuring it is
comparable to fBM noise values.

**Validates: Requirements 1.1, 7.1**

### Property 2: Zero frequency produces no micro-biomes

*For any* world position `(x, y)` and any height function, when `microBiomeFrequency = 0.0`,
`getEnhancedBiome` SHALL return `microBiome = undefined`.

**Validates: Requirements 1.2, 7.2**

### Property 3: Frequency monotonicity

*For any* pair of frequency values `f1 < f2` in `[0.0, 0.5]`, the count of micro-biomes
placed over a fixed sample of world positions with terrain conditions that allow placement
SHALL satisfy `count(f2) >= count(f1)`.

**Validates: Requirements 1.4, 7.3, 7.4**

### Property 4: Depression-type micro-biomes only in depressions

*For any* world position and height function, if `getEnhancedBiome` returns
`microBiome = OASIS` or `microBiome = POND`, then
`(centerHeight - neighbourAvg) < -depressionDepthThreshold` SHALL hold.

**Validates: Requirements 2.3, 2.4, 8.1, 8.3**

### Property 5: Flat-terrain micro-biomes only on low-gradient terrain

*For any* world position and height function, if `getEnhancedBiome` returns
`microBiome = CLEARING` or `microBiome = GROVE`, then
`gradient < clearingGradientThreshold` SHALL hold.

**Validates: Requirements 3.3, 3.4, 8.2**

### Property 6: Micro-biome type matches parent biome

*For any* world position where a micro-biome is placed, the micro-biome type SHALL match
the parent biome according to the mapping: `DESERT → OASIS`, `PLAINS → POND`,
`FOREST → CLEARING`, `TUNDRA → GROVE`.

**Validates: Requirements 8.4**

### Property 7: Determinism

*For any* world position `(x, y)`, seed, and configuration, calling `getEnhancedBiome`
twice with identical inputs SHALL return the same `microBiome` value.

**Validates: Requirements 6.1**

### Property 8: Micro-biome colour contrast

*For any* micro-biome type and its parent biome colour, the rendered micro-biome colour
SHALL differ from the parent biome colour by at least 20 % (0.2 on a 0–1 scale) in at
least one RGB channel.

**Validates: Requirements 4.1**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `microBiomeFrequency` outside `[0.0, 0.5]` | Clamped silently in `getMicroBiome` to avoid threshold overflow; no exception thrown (matches existing pattern for other config values). |
| `depressionDepthThreshold` < 0 | Treated as 0 (all positions are potential depressions). |
| `clearingGradientThreshold` < 0 | Treated as 0 (no position is flat). |
| `getHeight` callback throws | Exception propagates to caller unchanged (existing behaviour). |
| `useLegacyMicroBiomeThreshold` absent | Defaults to `false` via `=== true` guard. |
| Demo: `highlightMicroBiomes` toggled while chunks loading | Flag is read per-frame during `createTerrainMesh`; in-flight chunks pick up the new value on their next render cycle. |

---

## Testing Strategy

### Unit / Example-Based Tests

Located in `src/world/enhanced-biome.test.ts` (extending the existing file):

- Verify `useLegacyMicroBiomeThreshold = true` produces the same threshold as the old
  formula for a fixed seed and position (regression guard, Requirement 9.5).
- Verify `depressionDepthThreshold` defaults to `0.05` when absent.
- Verify `clearingGradientThreshold` defaults to `0.03` when absent.
- Verify `microBiomeFrequency = 0.5` with corrected formula produces `threshold = -1.0`.
- Verify the parent-biome → micro-biome type mapping for each of the four biome types.

### Property-Based Tests (fast-check)

All property tests use `fc.assert` with `{ numRuns: 100 }` minimum. Located in
`src/world/enhanced-biome.test.ts`.

**Tag format**: `// Feature: terrain-aware-micro-biomes, Property N: <property text>`

| Property | Arbitraries | Assertion |
|---|---|---|
| P1: Threshold range | `fc.float({ min: 0, max: 0.5 })` | `threshold ∈ [-1, 1]` |
| P2: Zero frequency | `fc.float` (x, y), `fc.float` (height) | `microBiome === undefined` |
| P3: Monotonicity | `fc.tuple(fc.float({min:0,max:0.5}), fc.float({min:0,max:0.5}))` filtered `f1 < f2` | `count(f2) >= count(f1)` over 200 positions |
| P4: Depression gate | `fc.float` (x, y), custom depressed/non-depressed height arb | OASIS/POND only when depressed |
| P5: Gradient gate | `fc.float` (x, y), custom flat/steep height arb | CLEARING/GROVE only when flat |
| P6: Type mapping | `fc.float` (x, y), biome-specific height arb | type matches parent biome |
| P7: Determinism | `fc.integer` (seed), `fc.float` (x, y), `fc.float` (height) | two calls return same value |
| P8: Colour contrast | `fc.constantFrom(...MicroBiomeType values)` | ≥ 0.2 difference in one channel |

### Performance Test

A single benchmark in `src/world/enhanced-biome.test.ts` generates a 32×32 grid of
`getEnhancedBiome` calls with `microBiomeFrequency = 0.5` and all terrain checks enabled,
asserting total time < 100 ms (Requirement 6.3).

### Demo Integration

Manual verification checklist (not automated):
- Frequency slider at 0.0 → statistics panel shows 0 micro-biomes.
- Frequency slider at 0.5 → statistics panel shows > 0 micro-biomes over a 200-tile view.
- "Highlight Micro-Biomes" toggle → micro-biome tiles visually distinct.
- Slider value label updates to two decimal places on every change.
