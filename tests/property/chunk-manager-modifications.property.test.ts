import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';
import { ChunkModification } from '../../src/world/serialization';
import { Structure } from '../../src/world/chunk';

describe('ChunkManager Modification Tracking Property Tests', () => {
  // Generator for valid WorldConfig
  const worldConfigArb = fc.record({
    seed: fc.integer(),
    chunkSize: fc.integer({ min: 4, max: 64 }),
    terrainConfig: fc.record({
      baseScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
      octaves: fc.integer({ min: 1, max: 8 }),
      persistence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
      lacunarity: fc.float({ min: Math.fround(1.5), max: Math.fround(4.0), noNaN: true }),
      warpStrength: fc.float({ min: 0, max: 20, noNaN: true }),
      heightMultiplier: fc.float({ min: Math.fround(0.5), max: Math.fround(2.0), noNaN: true }),
    }),
    biomeConfig: fc.record({
      temperatureScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
      moistureScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
      blendRadius: fc.float({ min: 1, max: 10, noNaN: true }),
    }),
    resourceConfig: fc.record({
      types: fc.constant([]),
      clusterScale: fc.float({ min: Math.fround(10), max: Math.fround(50), noNaN: true }),
      densityThreshold: fc.float({ min: Math.fround(0.3), max: Math.fround(0.8), noNaN: true }),
    }),
    structureConfig: fc.record({
      types: fc.constant([]),
      minDistance: fc.float({ min: Math.fround(5), max: Math.fround(20), noNaN: true }),
      maxAttempts: fc.integer({ min: 10, max: 50 }),
    }),
    riverNetworkConfig: fc.record({
      sourceElevation: fc.float({ min: Math.fround(0.5), max: Math.fround(0.9), noNaN: true }),
      minFlowLength: fc.integer({ min: 3, max: 20 }),
      flowWidth: fc.integer({ min: 1, max: 3 }),
    }),
  });

  // Generator for terrain edits (tile index and new height)
  const terrainEditArb = (chunkSize: number) => fc.record({
    tileIndex: fc.integer({ min: 0, max: chunkSize * chunkSize - 1 }),
    newHeight: fc.float({ min: 0, max: 1, noNaN: true }),
  });

  // Generator for structure additions
  const structureArb = fc.record({
    x: fc.integer({ min: 0, max: 100 }),
    y: fc.integer({ min: 0, max: 100 }),
    type: fc.integer({ min: 0, max: 5 }), // Assuming 6 structure types
  });

  // Feature: 3d-world-generation-enhancements, Property 23: Modification Tracking Completeness
  // **Validates: Requirements 14.2, 14.3, 14.4**
  test('all terrain modifications are tracked in the modifications map', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        fc.array(fc.record({
          tileIndex: fc.integer({ min: 0, max: 63 * 63 }), // Max for largest chunk
          newHeight: fc.float({ min: 0, max: 1, noNaN: true }),
        }), { minLength: 1, maxLength: 10 }),
        (config, chunkX, chunkY, edits) => {
          const manager = new ChunkManager(config);
          
          // Filter edits to be within chunk bounds
          const validEdits = edits.filter(e => e.tileIndex < config.chunkSize * config.chunkSize);
          fc.pre(validEdits.length > 0);
          
          // Record terrain edits
          for (const edit of validEdits) {
            manager.recordTerrainEdit(chunkX, chunkY, edit.tileIndex, edit.newHeight);
          }
          
          // Access the modifications map (using type assertion to access private field)
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          const key = `${chunkX},${chunkY}`;
          const modification = modifications.get(key);
          
          // Verify modification was recorded
          expect(modification).toBeDefined();
          expect(modification!.chunkX).toBe(chunkX);
          expect(modification!.chunkY).toBe(chunkY);
          
          // Build expected state: last edit for each tile wins
          const expectedHeights = new Map<number, number>();
          for (const edit of validEdits) {
            expectedHeights.set(edit.tileIndex, edit.newHeight);
          }
          
          // Verify all edited tiles are tracked
          expect(modification!.modifiedTiles.size).toBe(expectedHeights.size);
          for (const [tileIndex, expectedHeight] of expectedHeights) {
            expect(modification!.modifiedTiles.has(tileIndex)).toBe(true);
            expect(modification!.heightChanges.get(tileIndex)).toBe(expectedHeight);
          }
          
          // Verify timestamp is set
          expect(modification!.timestamp).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all structure additions are tracked in the modifications map', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        fc.array(structureArb, { minLength: 1, maxLength: 5 }),
        (config, chunkX, chunkY, structures) => {
          const manager = new ChunkManager(config);
          
          // Record structure additions
          for (const structure of structures) {
            manager.recordStructureAddition(chunkX, chunkY, structure as Structure);
          }
          
          // Access the modifications map
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          const key = `${chunkX},${chunkY}`;
          const modification = modifications.get(key);
          
          // Verify modification was recorded
          expect(modification).toBeDefined();
          expect(modification!.chunkX).toBe(chunkX);
          expect(modification!.chunkY).toBe(chunkY);
          
          // Verify all structures are tracked
          expect(modification!.addedStructures.length).toBe(structures.length);
          for (let i = 0; i < structures.length; i++) {
            expect(modification!.addedStructures[i].x).toBe(structures[i].x);
            expect(modification!.addedStructures[i].y).toBe(structures[i].y);
            expect(modification!.addedStructures[i].type).toBe(structures[i].type);
          }
          
          // Verify timestamp is set
          expect(modification!.timestamp).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all structure removals are tracked in the modifications map', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 1, maxLength: 5 }),
        (config, chunkX, chunkY, structureIndices) => {
          const manager = new ChunkManager(config);
          
          // Record structure removals
          for (const index of structureIndices) {
            manager.recordStructureRemoval(chunkX, chunkY, index);
          }
          
          // Access the modifications map
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          const key = `${chunkX},${chunkY}`;
          const modification = modifications.get(key);
          
          // Verify modification was recorded
          expect(modification).toBeDefined();
          expect(modification!.chunkX).toBe(chunkX);
          expect(modification!.chunkY).toBe(chunkY);
          
          // Verify all removals are tracked
          expect(modification!.removedStructures.length).toBe(structureIndices.length);
          for (let i = 0; i < structureIndices.length; i++) {
            expect(modification!.removedStructures[i]).toBe(structureIndices[i]);
          }
          
          // Verify timestamp is set
          expect(modification!.timestamp).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('multiple modifications to the same chunk are merged correctly', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        fc.array(fc.record({
          tileIndex: fc.integer({ min: 0, max: 63 * 63 }),
          newHeight: fc.float({ min: 0, max: 1, noNaN: true }),
        }), { minLength: 2, maxLength: 10 }),
        fc.array(structureArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 3 }),
        (config, chunkX, chunkY, terrainEdits, addedStructures, removedIndices) => {
          const manager = new ChunkManager(config);
          
          // Filter edits to be within chunk bounds
          const validEdits = terrainEdits.filter(e => e.tileIndex < config.chunkSize * config.chunkSize);
          fc.pre(validEdits.length >= 2);
          
          // Record terrain edits
          for (const edit of validEdits) {
            manager.recordTerrainEdit(chunkX, chunkY, edit.tileIndex, edit.newHeight);
          }
          
          // Record structure additions
          for (const structure of addedStructures) {
            manager.recordStructureAddition(chunkX, chunkY, structure as Structure);
          }
          
          // Record structure removals
          for (const index of removedIndices) {
            manager.recordStructureRemoval(chunkX, chunkY, index);
          }
          
          // Access the modifications map
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          const key = `${chunkX},${chunkY}`;
          const modification = modifications.get(key);
          
          // Verify all modifications are merged into a single record
          expect(modification).toBeDefined();
          expect(modification!.chunkX).toBe(chunkX);
          expect(modification!.chunkY).toBe(chunkY);
          
          // Verify terrain edits are merged (later edits override earlier ones for same tile)
          const uniqueTileIndices = new Set(validEdits.map(e => e.tileIndex));
          expect(modification!.modifiedTiles.size).toBe(uniqueTileIndices.size);
          
          // Verify the last edit for each tile is preserved
          const lastEditByTile = new Map<number, number>();
          for (const edit of validEdits) {
            lastEditByTile.set(edit.tileIndex, edit.newHeight);
          }
          for (const [tileIndex, height] of lastEditByTile) {
            expect(modification!.heightChanges.get(tileIndex)).toBe(height);
          }
          
          // Verify all structures are tracked
          expect(modification!.addedStructures.length).toBe(addedStructures.length);
          expect(modification!.removedStructures.length).toBe(removedIndices.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('batch terrain edits are tracked correctly', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        fc.array(fc.record({
          tileIndex: fc.integer({ min: 0, max: 63 * 63 }),
          newHeight: fc.float({ min: 0, max: 1, noNaN: true }),
        }), { minLength: 1, maxLength: 20 }),
        (config, chunkX, chunkY, edits) => {
          const manager = new ChunkManager(config);
          
          // Filter edits to be within chunk bounds
          const validEdits = edits.filter(e => e.tileIndex < config.chunkSize * config.chunkSize);
          fc.pre(validEdits.length > 0);
          
          // Create height changes map
          const heightChanges = new Map<number, number>();
          for (const edit of validEdits) {
            heightChanges.set(edit.tileIndex, edit.newHeight);
          }
          
          // Record batch terrain edits
          manager.recordTerrainEdits(chunkX, chunkY, heightChanges);
          
          // Access the modifications map
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          const key = `${chunkX},${chunkY}`;
          const modification = modifications.get(key);
          
          // Verify modification was recorded
          expect(modification).toBeDefined();
          expect(modification!.chunkX).toBe(chunkX);
          expect(modification!.chunkY).toBe(chunkY);
          
          // Verify all tiles are tracked
          expect(modification!.modifiedTiles.size).toBe(heightChanges.size);
          for (const [tileIndex, height] of heightChanges) {
            expect(modification!.modifiedTiles.has(tileIndex)).toBe(true);
            expect(modification!.heightChanges.get(tileIndex)).toBe(height);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('batch structure changes are tracked correctly', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        fc.array(structureArb, { minLength: 1, maxLength: 5 }),
        fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 5 }),
        (config, chunkX, chunkY, addedStructures, removedIndices) => {
          const manager = new ChunkManager(config);
          
          // Record batch structure changes
          manager.recordStructureChanges(
            chunkX,
            chunkY,
            addedStructures as Structure[],
            removedIndices
          );
          
          // Access the modifications map
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          const key = `${chunkX},${chunkY}`;
          const modification = modifications.get(key);
          
          // Verify modification was recorded
          expect(modification).toBeDefined();
          expect(modification!.chunkX).toBe(chunkX);
          expect(modification!.chunkY).toBe(chunkY);
          
          // Verify all structures are tracked
          expect(modification!.addedStructures.length).toBe(addedStructures.length);
          expect(modification!.removedStructures.length).toBe(removedIndices.length);
          
          for (let i = 0; i < addedStructures.length; i++) {
            expect(modification!.addedStructures[i].x).toBe(addedStructures[i].x);
            expect(modification!.addedStructures[i].y).toBe(addedStructures[i].y);
          }
          
          for (let i = 0; i < removedIndices.length; i++) {
            expect(modification!.removedStructures[i]).toBe(removedIndices[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('modifications to different chunks are tracked separately', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX1
        fc.integer({ min: -100, max: 100 }), // chunkY1
        fc.integer({ min: -100, max: 100 }), // chunkX2
        fc.integer({ min: -100, max: 100 }), // chunkY2
        fc.integer({ min: 0, max: 63 * 63 }), // tileIndex1
        fc.integer({ min: 0, max: 63 * 63 }), // tileIndex2
        fc.float({ min: 0, max: 1, noNaN: true }), // height1
        fc.float({ min: 0, max: 1, noNaN: true }), // height2
        (config, chunkX1, chunkY1, chunkX2, chunkY2, tileIndex1, tileIndex2, height1, height2) => {
          // Ensure different chunks
          fc.pre(chunkX1 !== chunkX2 || chunkY1 !== chunkY2);
          
          // Ensure tile indices are within bounds
          fc.pre(tileIndex1 < config.chunkSize * config.chunkSize);
          fc.pre(tileIndex2 < config.chunkSize * config.chunkSize);
          
          const manager = new ChunkManager(config);
          
          // Record modifications to different chunks
          manager.recordTerrainEdit(chunkX1, chunkY1, tileIndex1, height1);
          manager.recordTerrainEdit(chunkX2, chunkY2, tileIndex2, height2);
          
          // Access the modifications map
          const modifications = (manager as any).modifications as Map<string, ChunkModification>;
          
          // Verify both chunks have separate modification records
          const key1 = `${chunkX1},${chunkY1}`;
          const key2 = `${chunkX2},${chunkY2}`;
          
          const mod1 = modifications.get(key1);
          const mod2 = modifications.get(key2);
          
          expect(mod1).toBeDefined();
          expect(mod2).toBeDefined();
          
          // Verify they are separate records
          expect(mod1!.chunkX).toBe(chunkX1);
          expect(mod1!.chunkY).toBe(chunkY1);
          expect(mod2!.chunkX).toBe(chunkX2);
          expect(mod2!.chunkY).toBe(chunkY2);
          
          // Verify each has its own modifications
          expect(mod1!.heightChanges.get(tileIndex1)).toBe(height1);
          expect(mod2!.heightChanges.get(tileIndex2)).toBe(height2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

