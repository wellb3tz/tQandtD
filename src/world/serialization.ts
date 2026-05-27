/**
 * Serialization data structures for world persistence
 * 
 * This module defines interfaces and enums for serializing and deserializing
 * world data, supporting both JSON and binary formats with compression and
 * modification tracking.
 */

import type { ChunkData } from './chunk';
import { logger, LogCategory } from '../utils/logger';
import {
  base64StringToUint8Array,
} from './serialization-array-codec';
import { deserializeWorldFromBinary, serializeWorldToBinary } from './serialization-binary-container';
import {
  deserializeChunkBinary,
  deserializeChunkJSON,
  serializeChunkBinary,
  serializeChunkJSON,
} from './serialization-chunk-codec';
import {
  calculateChecksum as calculateSerializedWorldChecksum,
  validateChecksum,
  validateSerializedWorld,
} from './serialization-integrity';
import {
  addChunkToSnapshotCache,
  applyModifications,
  serializeModifications,
} from './serialization-modifications';
import {
  SerializationFormat,
  type ChunkManagerSnapshot,
  type SerializationOptions,
  type ChunkModification,
  type SerializedWorld,
  type SerializedLake,
  type SerializedRiver,
  type SerializedChunk,
} from './serialization-types';

export {
  SerializationFormat,
  type ChunkManagerSnapshot,
  type SerializationOptions,
  type ChunkModification,
  type SerializedWorld,
  type SerializedLake,
  type SerializedRiverPoint,
  type SerializedRiver,
  type SerializedChunk,
} from './serialization-types';

/**
 * WorldSerializer class for serializing and deserializing world data
 * 
 * Handles conversion of world state to/from JSON and binary formats with
 * compression support using pako (zlib/deflate) for browser compatibility.
 */
export class WorldSerializer {
  /**
   * Creates a new WorldSerializer instance
   */
  constructor() {
    // Constructor is intentionally empty - no state needed for now
    // Future enhancements may add configuration options here
  }

  /**
   * Serializes world data to specified format
   * 
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Serialized world data
   * 
   * @remarks
   * Supports JSON format (task 11.3) and binary format (task 11.4).
   * Handles compression, region filtering, and modification tracking.
   */
  serialize(chunkManager: ChunkManagerSnapshot, options: SerializationOptions): SerializedWorld {
    if (options.format === SerializationFormat.JSON) {
      return this.serializeJSON(chunkManager, options);
    } else if (options.format === SerializationFormat.BINARY) {
      return this.serializeBinary(chunkManager, options);
    } else {
      throw new Error(`Unsupported serialization format: ${options.format}`);
    }
  }

  /**
   * Serializes world data to JSON format
   * 
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Serialized world data with base64-encoded binary data
   */
  private serializeJSON(chunkManager: ChunkManagerSnapshot, options: SerializationOptions): SerializedWorld {
    // Get all chunks from the cache
    const chunks: SerializedChunk[] = [];

    // Filter chunks based on options
    for (const [, entry] of chunkManager.cache.entries()) {
      const chunk = entry.chunk;
      
      // Apply region filter if specified
      if (options.region) {
        const { minX, minY, maxX, maxY } = options.region;
        if (chunk.x < minX || chunk.x > maxX || chunk.y < minY || chunk.y > maxY) {
          continue;
        }
      }

      // Apply delta-snapshot filter if requested.
      if (options.modifiedOnly) {
        const key = `${chunk.x},${chunk.y}`;
        const hasModifications = chunkManager.modifications.has(key);
        if (!hasModifications) {
          continue;
        }
      }

      // Convert chunk to serialized format
      const serializedChunk = serializeChunkJSON(chunk, options.compress);
      chunks.push(serializedChunk);
    }

    // Serialize all modification records from ChunkManager
    const modifications = serializeModifications(chunkManager, options);

    // Create serialized world
    const serializedWorld: SerializedWorld = {
      version: '1.0.0',
      seed: chunkManager.config.seed,
      config: chunkManager.config,
      chunks,
      modifications,
      checksum: '', // Will be calculated after serialization
    };

    // Calculate checksum
    serializedWorld.checksum = this.calculateChecksum(serializedWorld);

    return serializedWorld;
  }

  /**
   * Serializes a single chunk to JSON format
   * 
   * @param chunk - Chunk data to serialize
   * @param compress - Whether to compress the data
   * @returns Serialized chunk with base64-encoded binary data
   */
  /**
   * Serializes world data to binary format
   * 
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Serialized world data with binary ArrayBuffer data
   */
  private serializeBinary(chunkManager: ChunkManagerSnapshot, options: SerializationOptions): SerializedWorld {
    // Get all chunks from the cache
    const chunks: SerializedChunk[] = [];

    // Filter chunks based on options
    for (const [, entry] of chunkManager.cache.entries()) {
      const chunk = entry.chunk;
      
      // Apply region filter if specified
      if (options.region) {
        const { minX, minY, maxX, maxY } = options.region;
        if (chunk.x < minX || chunk.x > maxX || chunk.y < minY || chunk.y > maxY) {
          continue;
        }
      }

      // Apply delta-snapshot filter if requested.
      if (options.modifiedOnly) {
        const key = `${chunk.x},${chunk.y}`;
        const hasModifications = chunkManager.modifications.has(key);
        if (!hasModifications) {
          continue;
        }
      }

      // Convert chunk to serialized binary format
      const serializedChunk = serializeChunkBinary(chunk, options.compress);
      chunks.push(serializedChunk);
    }

    // Serialize all modification records from ChunkManager
    const modifications = serializeModifications(chunkManager, options);

    // Create serialized world
    const serializedWorld: SerializedWorld = {
      version: '1.0.0',
      seed: chunkManager.config.seed,
      config: chunkManager.config,
      chunks,
      modifications,
      checksum: '', // Will be calculated after serialization
    };

    // Calculate checksum
    serializedWorld.checksum = this.calculateChecksum(serializedWorld);

    return serializedWorld;
  }

  /**
   * Serializes a single chunk to binary format
   * 
   * @param chunk - Chunk data to serialize
   * @param compress - Whether to compress the data
   * @returns Serialized chunk with binary ArrayBuffer data
   */
  /**
   * Deserializes world data and restores to chunk manager
   * 
   * @param data - Serialized world data
   * @param chunkManager - Target chunk manager
   * 
   * @remarks
   * Handles both JSON and binary formats. Validates version compatibility and checksum
   * before restoring chunks to the chunk manager cache. Applies modifications to
   * regenerated chunks to preserve user changes (Requirement 14.5).
   */
  deserialize(data: SerializedWorld, chunkManager: ChunkManagerSnapshot): void {
    // Validate version compatibility
    if (data.version !== '1.0.0') {
      throw new Error(`Unsupported serialization version: ${data.version}. Expected 1.0.0`);
    }

    // Validate checksum
    if (!validateChecksum(data)) {
      throw new Error('Checksum validation failed. Data may be corrupted.');
    }

    // Determine format based on chunk data type
    const isJSON = data.chunks.length > 0 && typeof data.chunks[0].heightmap === 'string';

    // Deserialize chunks and restore to cache
    for (const serializedChunk of data.chunks) {
      const chunk = isJSON 
        ? deserializeChunkJSON(serializedChunk, data.config.chunkSize)
        : deserializeChunkBinary(serializedChunk, data.config.chunkSize);

      // Add chunk to cache
      addChunkToSnapshotCache(chunkManager, chunk);
    }

    // Apply modifications to chunks (Requirement 14.5)
    applyModifications(data.modifications, chunkManager);

    // Update chunk manager configuration if needed
    // Note: We don't override the existing config, just ensure compatibility
    if (chunkManager.config.seed !== data.seed) {
      logger.warn(LogCategory.GENERAL, `Deserialized world seed (${data.seed}) differs from chunk manager seed (${chunkManager.config.seed})`);
    }
  }

  /**
   * Deserializes a single chunk from JSON format
   * 
   * @param serializedChunk - Serialized chunk data with base64-encoded binary data
   * @param chunkSize - Size of the chunk
   * @returns Deserialized chunk data
   */
  /**
   * Deserializes a single chunk from binary format
   * 
   * @param serializedChunk - Serialized chunk data with binary ArrayBuffer data
   * @param chunkSize - Size of the chunk
   * @returns Deserialized chunk data
   */
  /**
   * Exports world data to file-compatible format
   * 
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Blob or string for file export
   * 
   * @remarks
   * Uses the serialize() method to generate serialized data, then formats it
   * for file export. JSON format returns a string, binary format returns a Blob.
   * Supports selective region export and includes format version metadata.
   */
  export(chunkManager: ChunkManagerSnapshot, options: SerializationOptions): Blob | string {
    // Use the existing serialize method to generate serialized data
    const serializedWorld = this.serialize(chunkManager, options);

    if (options.format === SerializationFormat.JSON) {
      // For JSON format, return the JSON string
      return JSON.stringify(serializedWorld, null, 2);
    } else if (options.format === SerializationFormat.BINARY) {
      // For binary format, create a Blob with the serialized data
      // First, convert the SerializedWorld to a binary format
      const binaryData = serializeWorldToBinary(serializedWorld);
      
      // Create a Blob with the binary data
      return new Blob([binaryData], { type: 'application/octet-stream' });
    } else {
      throw new Error(`Unsupported serialization format: ${options.format}`);
    }
  }

  /**
   * Imports world data from file
   * 
   * @param data - File data (Blob or string)
   * @param format - Expected format
   * @returns Serialized world data
   * 
   * @remarks
   * Handles both JSON and binary formats. Validates format structure and
   * returns a SerializedWorld object that can be used with deserialize().
   * 
   * For JSON format:
   * - Accepts string input
   * - Parses JSON and validates structure
   * - Converts base64-encoded binary data back to proper format
   * 
   * For binary format:
   * - Accepts Blob input
   * - Reads binary data with type markers
   * - Reconstructs SerializedWorld from binary protocol
   */
  async import(data: Blob | string, format: SerializationFormat): Promise<SerializedWorld> {
    if (format === SerializationFormat.JSON) {
      return this.importJSON(data);
    } else if (format === SerializationFormat.BINARY) {
      return this.importBinary(data);
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }
  }

  /**
   * Imports world data from JSON format
   * 
   * @param data - JSON string or Blob containing JSON
   * @returns Serialized world data
   */
  private async importJSON(data: Blob | string): Promise<SerializedWorld> {
    let jsonString: string;

    // Handle Blob input
    if (data instanceof Blob) {
      jsonString = await data.text();
    } else {
      jsonString = data;
    }

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate structure
    validateSerializedWorld(parsed);

    // Convert modifications from plain objects to proper types
    const modifications: ChunkModification[] = parsed.modifications.map((mod: any) => ({
      chunkX: mod.chunkX,
      chunkY: mod.chunkY,
      timestamp: mod.timestamp,
      modifiedTiles: new Set(mod.modifiedTiles || []),
      heightChanges: new Map(Object.entries(mod.heightChanges || {}).map(([k, v]) => [parseInt(k), v as number])),
      addedStructures: mod.addedStructures || [],
      removedStructures: mod.removedStructures || [],
    }));

    // Return SerializedWorld with proper types
    return {
      version: parsed.version,
      seed: parsed.seed,
      config: parsed.config,
      chunks: parsed.chunks,
      modifications,
      checksum: parsed.checksum,
    };
  }

  /**
   * Imports world data from binary format
   * 
   * @param data - Binary Blob or string (base64)
   * @returns Serialized world data
   */
  private async importBinary(data: Blob | string): Promise<SerializedWorld> {
    let buffer: ArrayBuffer;

    // Handle Blob input
    if (data instanceof Blob) {
      const arrayBufferLike = await data.arrayBuffer();
      // Ensure we have an ArrayBuffer (not SharedArrayBuffer)
      if (arrayBufferLike instanceof ArrayBuffer) {
        buffer = arrayBufferLike;
      } else {
        // Convert SharedArrayBuffer to ArrayBuffer
        const uint8 = new Uint8Array(arrayBufferLike);
        buffer = uint8.slice(0).buffer;
      }
    } else {
      // Handle base64 string input
      const uint8Array = base64StringToUint8Array(data);
      // Ensure we have an ArrayBuffer (not SharedArrayBuffer)
      if (uint8Array.buffer instanceof ArrayBuffer) {
        buffer = uint8Array.buffer;
      } else {
        buffer = uint8Array.slice(0).buffer;
      }
    }

    // Parse binary format
    return deserializeWorldFromBinary(buffer);
  }

  private calculateChecksum(data: SerializedWorld): string {
    return calculateSerializedWorldChecksum(data);
  }

}
