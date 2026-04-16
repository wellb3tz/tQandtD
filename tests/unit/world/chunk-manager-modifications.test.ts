/**
 * Unit tests for ChunkManager modification recording methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkManager, WorldConfig, StructureType } from '../../../src';

describe('ChunkManager - Modification Recording', () => {
  let chunkManager: ChunkManager;
  let config: WorldConfig;

  beforeEach(() => {
    config = {
      seed: 12345,
      chunkSize: 32,
      terrainConfig: {
        scale: 0.01,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        heightScale: 1.0,
        seaLevel: 0.4,
      },
      biomeConfig: {
        temperatureScale: 0.005,
        moistureScale: 0.005,
      },
      resourceConfig: {
        density: 0.01,
      },
      structureConfig: {
        minDistance: 5,
      },
      riverNetworkConfig: {
        sourceThreshold: 0.7,
        minLength: 10,
      },
    };

    chunkManager = new ChunkManager(config);
  });

  describe('recordTerrainEdit', () => {
    it('should record a single terrain edit', () => {
      const chunkX = 0;
      const chunkY = 0;
      const tileIndex = 10;
      const newHeight = 0.75;

      chunkManager.recordTerrainEdit(chunkX, chunkY, tileIndex, newHeight);

      // Access private modifications map through type assertion
      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.chunkX).toBe(chunkX);
      expect(modification.chunkY).toBe(chunkY);
      expect(modification.modifiedTiles.has(tileIndex)).toBe(true);
      expect(modification.heightChanges.get(tileIndex)).toBe(newHeight);
      expect(modification.addedStructures.length).toBe(0);
      expect(modification.removedStructures.length).toBe(0);
      expect(modification.timestamp).toBeGreaterThan(0);
    });

    it('should merge multiple terrain edits to the same chunk', () => {
      const chunkX = 0;
      const chunkY = 0;

      chunkManager.recordTerrainEdit(chunkX, chunkY, 10, 0.5);
      chunkManager.recordTerrainEdit(chunkX, chunkY, 20, 0.6);
      chunkManager.recordTerrainEdit(chunkX, chunkY, 30, 0.7);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification.modifiedTiles.size).toBe(3);
      expect(modification.heightChanges.size).toBe(3);
      expect(modification.heightChanges.get(10)).toBe(0.5);
      expect(modification.heightChanges.get(20)).toBe(0.6);
      expect(modification.heightChanges.get(30)).toBe(0.7);
    });

    it('should override previous height changes for the same tile', () => {
      const chunkX = 0;
      const chunkY = 0;
      const tileIndex = 10;

      chunkManager.recordTerrainEdit(chunkX, chunkY, tileIndex, 0.5);
      chunkManager.recordTerrainEdit(chunkX, chunkY, tileIndex, 0.8);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification.modifiedTiles.size).toBe(1);
      expect(modification.heightChanges.size).toBe(1);
      expect(modification.heightChanges.get(tileIndex)).toBe(0.8);
    });
  });

  describe('recordTerrainEdits', () => {
    it('should record multiple terrain edits at once', () => {
      const chunkX = 0;
      const chunkY = 0;
      const heightChanges = new Map([
        [10, 0.5],
        [20, 0.6],
        [30, 0.7],
      ]);

      chunkManager.recordTerrainEdits(chunkX, chunkY, heightChanges);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.modifiedTiles.size).toBe(3);
      expect(modification.heightChanges.size).toBe(3);
      expect(modification.heightChanges.get(10)).toBe(0.5);
      expect(modification.heightChanges.get(20)).toBe(0.6);
      expect(modification.heightChanges.get(30)).toBe(0.7);
    });

    it('should handle empty height changes map', () => {
      const chunkX = 0;
      const chunkY = 0;
      const heightChanges = new Map<number, number>();

      chunkManager.recordTerrainEdits(chunkX, chunkY, heightChanges);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.modifiedTiles.size).toBe(0);
      expect(modification.heightChanges.size).toBe(0);
    });

    it('should merge with existing terrain edits', () => {
      const chunkX = 0;
      const chunkY = 0;

      // First batch of edits
      const firstEdits = new Map([
        [10, 0.5],
        [20, 0.6],
      ]);
      chunkManager.recordTerrainEdits(chunkX, chunkY, firstEdits);

      // Second batch of edits
      const secondEdits = new Map([
        [30, 0.7],
        [40, 0.8],
      ]);
      chunkManager.recordTerrainEdits(chunkX, chunkY, secondEdits);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification.modifiedTiles.size).toBe(4);
      expect(modification.heightChanges.size).toBe(4);
    });
  });

  describe('recordStructureAddition', () => {
    it('should record a structure addition', () => {
      const chunkX = 0;
      const chunkY = 0;
      const structure = { x: 5, y: 10, type: StructureType.VILLAGE };

      chunkManager.recordStructureAddition(chunkX, chunkY, structure);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.addedStructures.length).toBe(1);
      expect(modification.addedStructures[0]).toEqual(structure);
      expect(modification.removedStructures.length).toBe(0);
      expect(modification.modifiedTiles.size).toBe(0);
      expect(modification.heightChanges.size).toBe(0);
    });

    it('should accumulate multiple structure additions', () => {
      const chunkX = 0;
      const chunkY = 0;

      chunkManager.recordStructureAddition(chunkX, chunkY, { x: 5, y: 10, type: StructureType.VILLAGE });
      chunkManager.recordStructureAddition(chunkX, chunkY, { x: 15, y: 20, type: StructureType.TOWER });

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification.addedStructures.length).toBe(2);
      expect(modification.addedStructures[0].type).toBe(StructureType.VILLAGE);
      expect(modification.addedStructures[1].type).toBe(StructureType.TOWER);
    });
  });

  describe('recordStructureRemoval', () => {
    it('should record a structure removal', () => {
      const chunkX = 0;
      const chunkY = 0;
      const structureIndex = 2;

      chunkManager.recordStructureRemoval(chunkX, chunkY, structureIndex);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.removedStructures.length).toBe(1);
      expect(modification.removedStructures[0]).toBe(structureIndex);
      expect(modification.addedStructures.length).toBe(0);
      expect(modification.modifiedTiles.size).toBe(0);
      expect(modification.heightChanges.size).toBe(0);
    });

    it('should accumulate multiple structure removals', () => {
      const chunkX = 0;
      const chunkY = 0;

      chunkManager.recordStructureRemoval(chunkX, chunkY, 0);
      chunkManager.recordStructureRemoval(chunkX, chunkY, 3);
      chunkManager.recordStructureRemoval(chunkX, chunkY, 5);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification.removedStructures.length).toBe(3);
      expect(modification.removedStructures).toEqual([0, 3, 5]);
    });
  });

  describe('recordStructureChanges', () => {
    it('should record both structure additions and removals', () => {
      const chunkX = 0;
      const chunkY = 0;
      const addedStructures = [
        { x: 5, y: 10, type: StructureType.VILLAGE },
        { x: 15, y: 20, type: StructureType.TOWER },
      ];
      const removedStructures = [0, 3];

      chunkManager.recordStructureChanges(chunkX, chunkY, addedStructures, removedStructures);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.addedStructures.length).toBe(2);
      expect(modification.removedStructures.length).toBe(2);
      expect(modification.addedStructures).toEqual(addedStructures);
      expect(modification.removedStructures).toEqual(removedStructures);
    });

    it('should handle empty additions and removals', () => {
      const chunkX = 0;
      const chunkY = 0;

      chunkManager.recordStructureChanges(chunkX, chunkY, [], []);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.addedStructures.length).toBe(0);
      expect(modification.removedStructures.length).toBe(0);
    });

    it('should merge with existing structure changes', () => {
      const chunkX = 0;
      const chunkY = 0;

      // First batch of changes
      chunkManager.recordStructureChanges(
        chunkX,
        chunkY,
        [{ x: 5, y: 10, type: StructureType.VILLAGE }],
        [0]
      );

      // Second batch of changes
      chunkManager.recordStructureChanges(
        chunkX,
        chunkY,
        [{ x: 15, y: 20, type: StructureType.TOWER }],
        [3]
      );

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification.addedStructures.length).toBe(2);
      expect(modification.removedStructures.length).toBe(2);
    });
  });

  describe('Combined modifications', () => {
    it('should handle terrain and structure modifications together', () => {
      const chunkX = 0;
      const chunkY = 0;

      // Record terrain edits
      chunkManager.recordTerrainEdit(chunkX, chunkY, 10, 0.5);
      chunkManager.recordTerrainEdit(chunkX, chunkY, 20, 0.6);

      // Record structure changes
      chunkManager.recordStructureAddition(chunkX, chunkY, { x: 5, y: 10, type: StructureType.VILLAGE });
      chunkManager.recordStructureRemoval(chunkX, chunkY, 0);

      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const modification = modifications.get(key);

      expect(modification).toBeDefined();
      expect(modification.modifiedTiles.size).toBe(2);
      expect(modification.heightChanges.size).toBe(2);
      expect(modification.addedStructures.length).toBe(1);
      expect(modification.removedStructures.length).toBe(1);
    });

    it('should track modifications for multiple chunks independently', () => {
      // Modify chunk (0, 0)
      chunkManager.recordTerrainEdit(0, 0, 10, 0.5);
      chunkManager.recordStructureAddition(0, 0, { x: 5, y: 10, type: StructureType.VILLAGE });

      // Modify chunk (1, 1)
      chunkManager.recordTerrainEdit(1, 1, 20, 0.6);
      chunkManager.recordStructureRemoval(1, 1, 0);

      const modifications = (chunkManager as any).modifications as Map<string, any>;

      const mod00 = modifications.get('0,0');
      const mod11 = modifications.get('1,1');

      expect(mod00).toBeDefined();
      expect(mod11).toBeDefined();
      expect(mod00.heightChanges.get(10)).toBe(0.5);
      expect(mod11.heightChanges.get(20)).toBe(0.6);
      expect(mod00.addedStructures.length).toBe(1);
      expect(mod11.removedStructures.length).toBe(1);
    });

    it('should update timestamp on each modification', () => {
      const chunkX = 0;
      const chunkY = 0;

      chunkManager.recordTerrainEdit(chunkX, chunkY, 10, 0.5);
      const modifications = (chunkManager as any).modifications as Map<string, any>;
      const key = `${chunkX},${chunkY}`;
      const firstTimestamp = modifications.get(key).timestamp;

      // Wait a bit to ensure timestamp changes
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      return delay(10).then(() => {
        chunkManager.recordTerrainEdit(chunkX, chunkY, 20, 0.6);
        const secondTimestamp = modifications.get(key).timestamp;

        expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
      });
    });
  });
});

