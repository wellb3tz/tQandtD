/**
 * Serialization data structures for world persistence
 * 
 * This module defines interfaces and enums for serializing and deserializing
 * world data, supporting both JSON and binary formats with compression and
 * modification tracking.
 */

import { deflate, inflate } from 'pako';
import { ChunkData, Resource, Structure } from './chunk';
import type { LakeData } from '../gen/lakes';
import { WorldConfig } from './chunk-manager';
import { logger, LogCategory } from '../utils/logger';

/**
 * Read-only snapshot of ChunkManager state needed for serialization.
 * Replaces the previous `any` parameter, making the coupling explicit and
 * type-safe without exposing private implementation details.
 */
export interface ChunkManagerSnapshot {
  /** World seed */
  readonly config: WorldConfig;
  /** LRU cache: key → { chunk, lastAccessed } */
  readonly cache: ReadonlyMap<string, { chunk: ChunkData; lastAccessed: number }>;
  /** Modification records keyed by "chunkX,chunkY" */
  readonly modifications: ReadonlyMap<string, ChunkModification>;
  /** Monotonically increasing access counter (mutated by deserialize) */
  accessCounter: number;
  /** Records a modification back into the manager after deserialization */
  recordModification(chunkX: number, chunkY: number, mod: ChunkModification): void;
}

/**
 * Serialization format enumeration
 * 
 * Defines the available output formats for world serialization.
 */
export enum SerializationFormat {
  /** JSON format with base64-encoded binary data */
  JSON = 'json',
  /** Custom binary format with type markers */
  BINARY = 'binary',
}

/**
 * Serialization options
 * 
 * Configuration for controlling serialization behavior including format,
 * compression, and region selection.
 */
export interface SerializationOptions {
  /** Output format (JSON or binary) */
  format: SerializationFormat;
  
  /** Enable compression using zlib/deflate (default: true) */
  compress: boolean;
  
  /** Include only modified chunks (default: false) */
  modifiedOnly: boolean;
  
  /** Chunk region to export (undefined = all chunks) */
  region?: {
    /** Minimum chunk X coordinate (inclusive) */
    minX: number;
    /** Minimum chunk Y coordinate (inclusive) */
    minY: number;
    /** Maximum chunk X coordinate (inclusive) */
    maxX: number;
    /** Maximum chunk Y coordinate (inclusive) */
    maxY: number;
  };
}

/**
 * Modification record for chunk changes
 * 
 * Tracks all modifications made to a chunk after initial generation,
 * enabling delta compression and modification persistence.
 */
export interface ChunkModification {
  /** Chunk X coordinate */
  chunkX: number;
  
  /** Chunk Y coordinate */
  chunkY: number;
  
  /** Modification timestamp (milliseconds since epoch) */
  timestamp: number;
  
  /** Set of modified tile indices within the chunk */
  modifiedTiles: Set<number>;
  
  /** Height modifications as sparse map (tile index -> new height) */
  heightChanges: Map<number, number>;
  
  /** Structures added to the chunk */
  addedStructures: Structure[];
  
  /** Indices of structures removed from the chunk */
  removedStructures: number[];
}

/**
 * Serialized world data
 * 
 * Complete representation of a world state including all chunks,
 * configuration, and modifications, ready for storage or export.
 */
export interface SerializedWorld {
  /** Format version for compatibility checking (e.g., "1.0.0") */
  version: string;
  
  /** World seed used for procedural generation */
  seed: number;
  
  /** World configuration parameters */
  config: WorldConfig;
  
  /** Array of serialized chunks */
  chunks: SerializedChunk[];
  
  /** Array of modification records for changed chunks */
  modifications: ChunkModification[];
  
  /** CRC32 checksum for integrity validation */
  checksum: string;
}

/**
 * Serialized lake data — plain JSON-safe representation of LakeData.
 * `Set<number>` is stored as a plain number array.
 */
export interface SerializedLake {
  waterLevel: number;
  tiles: number[];
  maxDepth: number;
  minTerrainHeight?: number;
}

/**
 * Serialized chunk data
 * 
 * Compressed representation of a single chunk's data including terrain,
 * biomes, resources, structures, and lakes.
 */
export interface SerializedChunk {
  /** Chunk X coordinate */
  x: number;
  
  /** Chunk Y coordinate */
  y: number;
  
  /** Compressed heightmap data (ArrayBuffer for binary, base64 string for JSON) */
  heightmap: ArrayBuffer | string;
  
  /** Compressed biome map data (ArrayBuffer for binary, base64 string for JSON) */
  biomeMap: ArrayBuffer | string;
  
  /** Array of resources in the chunk */
  resources: Resource[];
  
  /** Array of structures in the chunk */
  structures: Structure[];

  /** Lake bodies detected in this chunk (may be empty) */
  lakes: SerializedLake[];
}

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
    const cache = chunkManager.cache as Map<string, any>;
    const chunks: SerializedChunk[] = [];

    // Filter chunks based on options
    for (const [, entry] of cache.entries()) {
      const chunk = entry.chunk;
      
      // Apply region filter if specified
      if (options.region) {
        const { minX, minY, maxX, maxY } = options.region;
        if (chunk.x < minX || chunk.x > maxX || chunk.y < minY || chunk.y > maxY) {
          continue;
        }
      }

      // Apply modifiedOnly filter if specified
      if (options.modifiedOnly) {
        // Check if chunk has modifications
        const key = `${chunk.x},${chunk.y}`;
        const hasModifications = chunkManager.modifications.has(key);
        if (!hasModifications) {
          continue;
        }
      }

      // Convert chunk to serialized format
      const serializedChunk = this.serializeChunkJSON(chunk, options.compress);
      chunks.push(serializedChunk);
    }

    // Serialize all modification records from ChunkManager
    const modifications = this.serializeModifications(chunkManager, options);

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
  private serializeChunkJSON(chunk: ChunkData, compress: boolean): SerializedChunk {
    const heightmapBase64 = this.float32ArrayToBase64(chunk.heightmap, compress);
    const biomeMapBase64 = this.uint8ArrayToBase64(chunk.biomeMap, compress);

    const lakes: SerializedLake[] = (chunk.lakes ?? []).map(lake => ({
      waterLevel: lake.waterLevel,
      tiles: Array.from(lake.tiles),
      maxDepth: lake.maxDepth,
      minTerrainHeight: lake.minTerrainHeight,
    }));

    return {
      x: chunk.x,
      y: chunk.y,
      heightmap: heightmapBase64,
      biomeMap: biomeMapBase64,
      resources: chunk.resources,
      structures: chunk.structures,
      lakes,
    };
  }

  /**
   * Serializes all modification records from ChunkManager
   * 
   * @param chunkManager - Chunk manager with modification data
   * @param options - Serialization options
   * @returns Array of serialized modification records
   * 
   * @remarks
   * Converts modification records from ChunkManager's modifications Map to
   * a serializable array format. Applies region filtering if specified.
   * Converts Set and Map objects to arrays for JSON compatibility.
   */
  private serializeModifications(chunkManager: ChunkManagerSnapshot, options: SerializationOptions): ChunkModification[] {
    const modifications: ChunkModification[] = [];
    const modificationsMap = chunkManager.modifications as Map<string, ChunkModification> | undefined;

    // Return empty array if no modifications exist
    if (!modificationsMap) {
      return modifications;
    }

    // Iterate through all modifications
    for (const [, modification] of modificationsMap.entries()) {
      // Apply region filter if specified
      if (options.region) {
        const { minX, minY, maxX, maxY } = options.region;
        if (modification.chunkX < minX || modification.chunkX > maxX ||
            modification.chunkY < minY || modification.chunkY > maxY) {
          continue;
        }
      }

      // Add modification to array (already in correct format)
      modifications.push(modification);
    }

    return modifications;
  }

  /**
   * Converts Float32Array to base64 string
   * 
   * @param array - Float32Array to convert
   * @param compress - Whether to compress the data
   * @returns Base64-encoded string
   */
  private float32ArrayToBase64(array: Float32Array, compress: boolean): string {
    // Convert Float32Array to Uint8Array (raw bytes)
    const uint8Array = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    
    if (compress) {
      // Compress using pako
      const compressed = this.compressUint8Array(uint8Array);
      return this.uint8ArrayToBase64String(compressed);
    } else {
      return this.uint8ArrayToBase64String(uint8Array);
    }
  }

  /**
   * Converts Uint8Array to base64 string
   * 
   * @param array - Uint8Array to convert
   * @param compress - Whether to compress the data
   * @returns Base64-encoded string
   */
  private uint8ArrayToBase64(array: Uint8Array, compress: boolean): string {
    if (compress) {
      const compressed = this.compressUint8Array(array);
      return this.uint8ArrayToBase64String(compressed);
    } else {
      return this.uint8ArrayToBase64String(array);
    }
  }

  /**
   * Converts Uint8Array to base64 string (no compression)
   * 
   * @param array - Uint8Array to convert
   * @returns Base64-encoded string
   */
  private uint8ArrayToBase64String(array: Uint8Array): string {
    // Convert Uint8Array to binary string
    let binaryString = '';
    for (let i = 0; i < array.length; i++) {
      binaryString += String.fromCharCode(array[i]);
    }
    
    // Convert binary string to base64
    // Use btoa for browser compatibility
    if (typeof btoa !== 'undefined') {
      return btoa(binaryString);
    } else {
      // Node.js environment
      // @ts-ignore - Buffer is available in Node.js
      return Buffer.from(array).toString('base64');
    }
  }

  /**
   * Compresses Uint8Array using pako
   * 
   * @param data - Data to compress
   * @returns Compressed data
   */
  private compressUint8Array(data: Uint8Array): Uint8Array {
    return deflate(data);
  }

  /**
   * CRC32 lookup table for fast checksum calculation
   */
  private static crc32Table: number[] | null = null;

  /**
   * Initializes the CRC32 lookup table
   */
  private initCRC32Table(): void {
    if (WorldSerializer.crc32Table !== null) {
      return;
    }

    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      table[i] = crc;
    }
    WorldSerializer.crc32Table = table;
  }

  /**
   * Calculates CRC32 checksum for a byte array
   * 
   * @param data - Byte array to checksum
   * @returns CRC32 checksum as unsigned 32-bit integer
   */
  private crc32(data: Uint8Array): number {
    this.initCRC32Table();
    const table = WorldSerializer.crc32Table!;

    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Serializes world data to binary format
   * 
   * @param chunkManager - Chunk manager with world data
   * @param options - Serialization options
   * @returns Serialized world data with binary ArrayBuffer data
   */
  private serializeBinary(chunkManager: ChunkManagerSnapshot, options: SerializationOptions): SerializedWorld {
    // Get all chunks from the cache
    const cache = chunkManager.cache as Map<string, any>;
    const chunks: SerializedChunk[] = [];

    // Filter chunks based on options
    for (const [, entry] of cache.entries()) {
      const chunk = entry.chunk;
      
      // Apply region filter if specified
      if (options.region) {
        const { minX, minY, maxX, maxY } = options.region;
        if (chunk.x < minX || chunk.x > maxX || chunk.y < minY || chunk.y > maxY) {
          continue;
        }
      }

      // Apply modifiedOnly filter if specified
      if (options.modifiedOnly) {
        // Check if chunk has modifications
        const key = `${chunk.x},${chunk.y}`;
        const hasModifications = chunkManager.modifications.has(key);
        if (!hasModifications) {
          continue;
        }
      }

      // Convert chunk to serialized binary format
      const serializedChunk = this.serializeChunkBinary(chunk, options.compress);
      chunks.push(serializedChunk);
    }

    // Serialize all modification records from ChunkManager
    const modifications = this.serializeModifications(chunkManager, options);

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
  private serializeChunkBinary(chunk: ChunkData, compress: boolean): SerializedChunk {
    const heightmapBuffer = this.serializeFloat32ArrayBinary(chunk.heightmap, compress);
    const biomeMapBuffer = this.serializeUint8ArrayBinary(chunk.biomeMap, compress);

    const lakes: SerializedLake[] = (chunk.lakes ?? []).map(lake => ({
      waterLevel: lake.waterLevel,
      tiles: Array.from(lake.tiles),
      maxDepth: lake.maxDepth,
      minTerrainHeight: lake.minTerrainHeight,
    }));

    return {
      x: chunk.x,
      y: chunk.y,
      heightmap: heightmapBuffer,
      biomeMap: biomeMapBuffer,
      resources: chunk.resources,
      structures: chunk.structures,
      lakes,
    };
  }

  /**
   * Serializes Float32Array to binary format with type marker
   * 
   * @param array - Float32Array to serialize
   * @param compress - Whether to compress the data
   * @returns ArrayBuffer with type marker and data
   */
  private serializeFloat32ArrayBinary(array: Float32Array, compress: boolean): ArrayBuffer {
    // Create buffer with type marker (1 byte) + length (4 bytes) + data
    const dataBytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    
    if (compress) {
      // Compress the data
      const compressed = this.compressUint8Array(dataBytes);
      
      // Create buffer: type marker (1) + compressed flag (1) + original length (4) + compressed length (4) + compressed data
      const buffer = new ArrayBuffer(1 + 1 + 4 + 4 + compressed.length);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      
      // Type marker: 0x01 = Float32Array
      view.setUint8(0, 0x01);
      // Compressed flag: 0x01 = compressed
      view.setUint8(1, 0x01);
      // Original length
      view.setUint32(2, array.length, true);
      // Compressed length
      view.setUint32(6, compressed.length, true);
      // Compressed data
      bytes.set(compressed, 10);
      
      return buffer;
    } else {
      // Create buffer: type marker (1) + compressed flag (1) + length (4) + data
      const buffer = new ArrayBuffer(1 + 1 + 4 + dataBytes.length);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      
      // Type marker: 0x01 = Float32Array
      view.setUint8(0, 0x01);
      // Compressed flag: 0x00 = not compressed
      view.setUint8(1, 0x00);
      // Length
      view.setUint32(2, array.length, true);
      // Data
      bytes.set(dataBytes, 6);
      
      return buffer;
    }
  }

  /**
   * Serializes Uint8Array to binary format with type marker
   * 
   * @param array - Uint8Array to serialize
   * @param compress - Whether to compress the data
   * @returns ArrayBuffer with type marker and data
   */
  private serializeUint8ArrayBinary(array: Uint8Array, compress: boolean): ArrayBuffer {
    if (compress) {
      // Compress the data
      const compressed = this.compressUint8Array(array);
      
      // Create buffer: type marker (1) + compressed flag (1) + original length (4) + compressed length (4) + compressed data
      const buffer = new ArrayBuffer(1 + 1 + 4 + 4 + compressed.length);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      
      // Type marker: 0x02 = Uint8Array
      view.setUint8(0, 0x02);
      // Compressed flag: 0x01 = compressed
      view.setUint8(1, 0x01);
      // Original length
      view.setUint32(2, array.length, true);
      // Compressed length
      view.setUint32(6, compressed.length, true);
      // Compressed data
      bytes.set(compressed, 10);
      
      return buffer;
    } else {
      // Create buffer: type marker (1) + compressed flag (1) + length (4) + data
      const buffer = new ArrayBuffer(1 + 1 + 4 + array.length);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      
      // Type marker: 0x02 = Uint8Array
      view.setUint8(0, 0x02);
      // Compressed flag: 0x00 = not compressed
      view.setUint8(1, 0x00);
      // Length
      view.setUint32(2, array.length, true);
      // Data
      bytes.set(array, 6);
      
      return buffer;
    }
  }

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
    if (!this.validateChecksum(data)) {
      throw new Error('Checksum validation failed. Data may be corrupted.');
    }

    // Determine format based on chunk data type
    const isJSON = data.chunks.length > 0 && typeof data.chunks[0].heightmap === 'string';

    // Deserialize chunks and restore to cache
    for (const serializedChunk of data.chunks) {
      const chunk = isJSON 
        ? this.deserializeChunkJSON(serializedChunk, data.config.chunkSize)
        : this.deserializeChunkBinary(serializedChunk, data.config.chunkSize);

      // Add chunk to cache
      this.addChunkToCache(chunkManager, chunk);
    }

    // Apply modifications to chunks (Requirement 14.5)
    this.applyModifications(data.modifications, chunkManager);

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
  private deserializeChunkJSON(serializedChunk: SerializedChunk, chunkSize: number): ChunkData {
    const heightmap = this.base64ToFloat32Array(serializedChunk.heightmap as string);
    const biomeMap = this.base64ToUint8Array(serializedChunk.biomeMap as string);

    const numBiomes = 13;
    const biomeWeights = new Float32Array(chunkSize * chunkSize * numBiomes);
    for (let i = 0; i < biomeMap.length; i++) {
      biomeWeights[i * numBiomes + biomeMap[i]] = 1.0;
    }

    const lakes: LakeData[] = (serializedChunk.lakes ?? []).map(sl => ({
      waterLevel: sl.waterLevel,
      tiles: new Set(sl.tiles),
      maxDepth: sl.maxDepth,
      minTerrainHeight: sl.minTerrainHeight,
    }));

    return {
      x: serializedChunk.x,
      y: serializedChunk.y,
      size: chunkSize,
      heightmap,
      biomeMap,
      biomeWeights,
      lakes,
      resources: serializedChunk.resources,
      structures: serializedChunk.structures,
    };
  }

  /**
   * Deserializes a single chunk from binary format
   * 
   * @param serializedChunk - Serialized chunk data with binary ArrayBuffer data
   * @param chunkSize - Size of the chunk
   * @returns Deserialized chunk data
   */
  private deserializeChunkBinary(serializedChunk: SerializedChunk, chunkSize: number): ChunkData {
    const heightmap = this.deserializeFloat32ArrayBinary(serializedChunk.heightmap as ArrayBuffer);
    const biomeMap = this.deserializeUint8ArrayBinary(serializedChunk.biomeMap as ArrayBuffer);

    const numBiomes = 13;
    const biomeWeights = new Float32Array(chunkSize * chunkSize * numBiomes);
    for (let i = 0; i < biomeMap.length; i++) {
      biomeWeights[i * numBiomes + biomeMap[i]] = 1.0;
    }

    const lakes: LakeData[] = (serializedChunk.lakes ?? []).map(sl => ({
      waterLevel: sl.waterLevel,
      tiles: new Set(sl.tiles),
      maxDepth: sl.maxDepth,
      minTerrainHeight: sl.minTerrainHeight,
    }));

    return {
      x: serializedChunk.x,
      y: serializedChunk.y,
      size: chunkSize,
      heightmap,
      biomeMap,
      biomeWeights,
      lakes,
      resources: serializedChunk.resources,
      structures: serializedChunk.structures,
    };
  }

  /**
   * Converts base64 string to Float32Array
   * 
   * @param base64 - Base64-encoded string
   * @returns Float32Array
   */
  private base64ToFloat32Array(base64: string): Float32Array {
    // Decode base64 to Uint8Array
    const uint8Array = this.base64StringToUint8Array(base64);

    // Check if data is compressed (heuristic: if first bytes look like deflate header)
    const isCompressed = uint8Array.length > 2 && uint8Array[0] === 0x78;

    let decompressed: Uint8Array;
    if (isCompressed) {
      // Decompress using pako
      decompressed = this.decompressUint8Array(uint8Array);
    } else {
      decompressed = uint8Array;
    }

    // Convert Uint8Array to Float32Array
    // Need to ensure proper alignment by copying to a new buffer if necessary
    if (decompressed.byteOffset % 4 !== 0) {
      // Buffer is not aligned, create a new aligned buffer
      const alignedBuffer = new Uint8Array(decompressed.length);
      alignedBuffer.set(decompressed);
      return new Float32Array(alignedBuffer.buffer, 0, alignedBuffer.byteLength / 4);
    } else {
      return new Float32Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength / 4);
    }
  }

  /**
   * Converts base64 string to Uint8Array
   * 
   * @param base64 - Base64-encoded string
   * @returns Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    // Decode base64 to Uint8Array
    const uint8Array = this.base64StringToUint8Array(base64);

    // Check if data is compressed
    const isCompressed = uint8Array.length > 2 && uint8Array[0] === 0x78;

    if (isCompressed) {
      // Decompress using pako
      return this.decompressUint8Array(uint8Array);
    } else {
      return uint8Array;
    }
  }

  /**
   * Converts base64 string to Uint8Array (no decompression)
   * 
   * @param base64 - Base64-encoded string
   * @returns Uint8Array
   */
  private base64StringToUint8Array(base64: string): Uint8Array {
    // Decode base64 to binary string
    let binaryString: string;
    if (typeof atob !== 'undefined') {
      // Browser environment
      binaryString = atob(base64);
    } else {
      // Node.js environment
      // @ts-ignore - Buffer is available in Node.js
      binaryString = Buffer.from(base64, 'base64').toString('binary');
    }

    // Convert binary string to Uint8Array
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }

    return uint8Array;
  }

  /**
   * Decompresses Uint8Array using pako
   * 
   * @param data - Compressed data
   * @returns Decompressed data
   */
  private decompressUint8Array(data: Uint8Array): Uint8Array {
    return inflate(data);
  }

  /**
   * Deserializes Float32Array from binary format
   * 
   * @param buffer - ArrayBuffer with type marker and data
   * @returns Float32Array
   */
  private deserializeFloat32ArrayBinary(buffer: ArrayBuffer): Float32Array {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Read type marker
    const typeMarker = view.getUint8(0);
    if (typeMarker !== 0x01) {
      throw new Error(`Invalid type marker for Float32Array: 0x${typeMarker.toString(16)}`);
    }

    // Read compressed flag
    const isCompressed = view.getUint8(1) === 0x01;

    if (isCompressed) {
      // Read original length and compressed length
      const compressedLength = view.getUint32(6, true);

      // Extract compressed data
      const compressedData = bytes.slice(10, 10 + compressedLength);

      // Decompress
      const decompressed = this.decompressUint8Array(compressedData);

      // Convert to Float32Array
      return new Float32Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength / 4);
    } else {
      // Read length
      const length = view.getUint32(2, true);

      // Extract data
      const data = bytes.slice(6, 6 + length * 4);

      // Convert to Float32Array
      return new Float32Array(data.buffer, data.byteOffset, length);
    }
  }

  /**
   * Deserializes Uint8Array from binary format
   * 
   * @param buffer - ArrayBuffer with type marker and data
   * @returns Uint8Array
   */
  private deserializeUint8ArrayBinary(buffer: ArrayBuffer): Uint8Array {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Read type marker
    const typeMarker = view.getUint8(0);
    if (typeMarker !== 0x02) {
      throw new Error(`Invalid type marker for Uint8Array: 0x${typeMarker.toString(16)}`);
    }

    // Read compressed flag
    const isCompressed = view.getUint8(1) === 0x01;

    if (isCompressed) {
      // Read original length and compressed length
      const compressedLength = view.getUint32(6, true);

      // Extract compressed data
      const compressedData = bytes.slice(10, 10 + compressedLength);

      // Decompress
      return this.decompressUint8Array(compressedData);
    } else {
      // Read length
      const length = view.getUint32(2, true);

      // Extract data
      return bytes.slice(6, 6 + length);
    }
  }

  /**
   * Adds a chunk to the chunk manager cache
   * 
   * @param chunkManager - Chunk manager instance
   * @param chunk - Chunk data to add
   */
  private addChunkToCache(chunkManager: ChunkManagerSnapshot, chunk: ChunkData): void {
    const cache = chunkManager.cache as Map<string, { chunk: ChunkData; lastAccessed: number }>;
    const key = `${chunk.x},${chunk.y}`;
    cache.set(key, {
      chunk,
      lastAccessed: ++chunkManager.accessCounter,
    });
  }

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
      const binaryData = this.serializeWorldToBinary(serializedWorld);
      
      // Create a Blob with the binary data
      return new Blob([binaryData], { type: 'application/octet-stream' });
    } else {
      throw new Error(`Unsupported serialization format: ${options.format}`);
    }
  }

  /**
   * Converts SerializedWorld to binary format for Blob creation
   * 
   * @param world - Serialized world data
   * @returns ArrayBuffer with binary representation
   * 
   * @remarks
   * Creates a custom binary format with:
   * - Header: magic number (4 bytes) + version string length (4 bytes) + version string
   * - Metadata: seed (8 bytes) + config JSON length (4 bytes) + config JSON
   * - Chunks: chunk count (4 bytes) + chunk data
   * - Modifications: modification count (4 bytes) + modification data
   * - Checksum: checksum string length (4 bytes) + checksum string
   */
  private serializeWorldToBinary(world: SerializedWorld): ArrayBuffer {
    // Calculate total size needed
    const encoder = new TextEncoder();
    const versionBytes = encoder.encode(world.version);
    const configBytes = encoder.encode(JSON.stringify(world.config));
    const checksumBytes = encoder.encode(world.checksum);
    
    // Calculate chunk data size
    let chunkDataSize = 0;
    for (const chunk of world.chunks) {
      // Each chunk: x (4) + y (4) + heightmap size (4) + heightmap + biomeMap size (4) + biomeMap
      // + resources JSON length (4) + resources JSON + structures JSON length (4) + structures JSON
      const heightmapBuffer = chunk.heightmap as ArrayBuffer;
      const biomeMapBuffer = chunk.biomeMap as ArrayBuffer;
      const resourcesBytes = encoder.encode(JSON.stringify(chunk.resources));
      const structuresBytes = encoder.encode(JSON.stringify(chunk.structures));
      const lakesBytes = encoder.encode(JSON.stringify(chunk.lakes ?? []));
      
      chunkDataSize += 4 + 4 + 4 + heightmapBuffer.byteLength + 4 + biomeMapBuffer.byteLength +
                       4 + resourcesBytes.length + 4 + structuresBytes.length +
                       4 + lakesBytes.length;
    }
    
    // Calculate modifications data size
    let modificationsDataSize = 0;
    for (const mod of world.modifications) {
      // Each modification: chunkX (4) + chunkY (4) + timestamp (8) + modifiedTiles count (4) + tiles data
      // + heightChanges count (4) + changes data + addedStructures JSON length (4) + JSON
      // + removedStructures count (4) + indices data
      const addedStructuresBytes = encoder.encode(JSON.stringify(mod.addedStructures));
      
      modificationsDataSize += 4 + 4 + 8 + 4 + mod.modifiedTiles.size * 4 +
                               4 + mod.heightChanges.size * 8 +
                               4 + addedStructuresBytes.length +
                               4 + mod.removedStructures.length * 4;
    }
    
    // Total size: magic (4) + version length (4) + version + seed (8) + config length (4) + config
    // + chunk count (4) + chunk data + modifications count (4) + modifications data
    // + checksum length (4) + checksum
    const totalSize = 4 + 4 + versionBytes.length + 8 + 4 + configBytes.length +
                     4 + chunkDataSize + 4 + modificationsDataSize +
                     4 + checksumBytes.length;
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    
    // Write magic number (0x57524C44 = "WRLD")
    view.setUint32(offset, 0x57524C44, true);
    offset += 4;
    
    // Write version
    view.setUint32(offset, versionBytes.length, true);
    offset += 4;
    bytes.set(versionBytes, offset);
    offset += versionBytes.length;
    
    // Write seed
    // Note: JavaScript numbers are 64-bit floats, but seeds are typically integers
    // We'll store as a 64-bit integer (split into two 32-bit parts)
    const seedHigh = Math.floor(world.seed / 0x100000000);
    const seedLow = world.seed >>> 0;
    view.setUint32(offset, seedHigh, true);
    offset += 4;
    view.setUint32(offset, seedLow, true);
    offset += 4;
    
    // Write config
    view.setUint32(offset, configBytes.length, true);
    offset += 4;
    bytes.set(configBytes, offset);
    offset += configBytes.length;
    
    // Write chunk count
    view.setUint32(offset, world.chunks.length, true);
    offset += 4;
    
    // Write chunks
    for (const chunk of world.chunks) {
      // Write chunk coordinates
      view.setInt32(offset, chunk.x, true);
      offset += 4;
      view.setInt32(offset, chunk.y, true);
      offset += 4;
      
      // Write heightmap
      const heightmapBuffer = chunk.heightmap as ArrayBuffer;
      view.setUint32(offset, heightmapBuffer.byteLength, true);
      offset += 4;
      bytes.set(new Uint8Array(heightmapBuffer), offset);
      offset += heightmapBuffer.byteLength;
      
      // Write biomeMap
      const biomeMapBuffer = chunk.biomeMap as ArrayBuffer;
      view.setUint32(offset, biomeMapBuffer.byteLength, true);
      offset += 4;
      bytes.set(new Uint8Array(biomeMapBuffer), offset);
      offset += biomeMapBuffer.byteLength;
      
      // Write resources
      const resourcesBytes = encoder.encode(JSON.stringify(chunk.resources));
      view.setUint32(offset, resourcesBytes.length, true);
      offset += 4;
      bytes.set(resourcesBytes, offset);
      offset += resourcesBytes.length;
      
      // Write structures
      const structuresBytes = encoder.encode(JSON.stringify(chunk.structures));
      view.setUint32(offset, structuresBytes.length, true);
      offset += 4;
      bytes.set(structuresBytes, offset);
      offset += structuresBytes.length;

      // Write lakes
      const lakesBytes = encoder.encode(JSON.stringify(chunk.lakes ?? []));
      view.setUint32(offset, lakesBytes.length, true);
      offset += 4;
      bytes.set(lakesBytes, offset);
      offset += lakesBytes.length;
    }
    
    // Write modifications count
    view.setUint32(offset, world.modifications.length, true);
    offset += 4;
    
    // Write modifications
    for (const mod of world.modifications) {
      // Write chunk coordinates
      view.setInt32(offset, mod.chunkX, true);
      offset += 4;
      view.setInt32(offset, mod.chunkY, true);
      offset += 4;
      
      // Write timestamp (as 64-bit integer)
      const timestampHigh = Math.floor(mod.timestamp / 0x100000000);
      const timestampLow = mod.timestamp >>> 0;
      view.setUint32(offset, timestampHigh, true);
      offset += 4;
      view.setUint32(offset, timestampLow, true);
      offset += 4;
      
      // Write modifiedTiles
      view.setUint32(offset, mod.modifiedTiles.size, true);
      offset += 4;
      for (const tile of mod.modifiedTiles) {
        view.setInt32(offset, tile, true);
        offset += 4;
      }
      
      // Write heightChanges
      view.setUint32(offset, mod.heightChanges.size, true);
      offset += 4;
      for (const [index, height] of mod.heightChanges) {
        view.setInt32(offset, index, true);
        offset += 4;
        view.setFloat32(offset, height, true);
        offset += 4;
      }
      
      // Write addedStructures
      const addedStructuresBytes = encoder.encode(JSON.stringify(mod.addedStructures));
      view.setUint32(offset, addedStructuresBytes.length, true);
      offset += 4;
      bytes.set(addedStructuresBytes, offset);
      offset += addedStructuresBytes.length;
      
      // Write removedStructures
      view.setUint32(offset, mod.removedStructures.length, true);
      offset += 4;
      for (const index of mod.removedStructures) {
        view.setInt32(offset, index, true);
        offset += 4;
      }
    }
    
    // Write checksum
    view.setUint32(offset, checksumBytes.length, true);
    offset += 4;
    bytes.set(checksumBytes, offset);
    offset += checksumBytes.length;
    
    return buffer;
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
    this.validateSerializedWorld(parsed);

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
      const uint8Array = this.base64StringToUint8Array(data);
      // Ensure we have an ArrayBuffer (not SharedArrayBuffer)
      if (uint8Array.buffer instanceof ArrayBuffer) {
        buffer = uint8Array.buffer;
      } else {
        buffer = uint8Array.slice(0).buffer;
      }
    }

    // Parse binary format
    return this.deserializeWorldFromBinary(buffer);
  }

  /**
   * Deserializes SerializedWorld from binary format
   * 
   * @param buffer - Binary data buffer
   * @returns Serialized world data
   */
  private deserializeWorldFromBinary(buffer: ArrayBuffer): SerializedWorld {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;

    // Read and validate magic number
    const magic = view.getUint32(offset, true);
    if (magic !== 0x57524C44) { // "WRLD"
      throw new Error('Invalid binary format: magic number mismatch');
    }
    offset += 4;

    // Read version
    const versionLength = view.getUint32(offset, true);
    offset += 4;
    const versionBytes = bytes.slice(offset, offset + versionLength);
    const version = new TextDecoder().decode(versionBytes);
    offset += versionLength;

    // Read seed
    const seedHigh = view.getUint32(offset, true);
    offset += 4;
    const seedLow = view.getUint32(offset, true);
    offset += 4;
    const seed = seedHigh * 0x100000000 + seedLow;

    // Read config
    const configLength = view.getUint32(offset, true);
    offset += 4;
    const configBytes = bytes.slice(offset, offset + configLength);
    const config = JSON.parse(new TextDecoder().decode(configBytes));
    offset += configLength;

    // Read chunk count
    const chunkCount = view.getUint32(offset, true);
    offset += 4;

    // Read chunks
    const chunks: SerializedChunk[] = [];
    for (let i = 0; i < chunkCount; i++) {
      // Read chunk coordinates
      const x = view.getInt32(offset, true);
      offset += 4;
      const y = view.getInt32(offset, true);
      offset += 4;

      // Read heightmap
      const heightmapSize = view.getUint32(offset, true);
      offset += 4;
      const heightmapBuffer = buffer.slice(offset, offset + heightmapSize);
      offset += heightmapSize;

      // Read biomeMap
      const biomeMapSize = view.getUint32(offset, true);
      offset += 4;
      const biomeMapBuffer = buffer.slice(offset, offset + biomeMapSize);
      offset += biomeMapSize;

      // Read resources
      const resourcesLength = view.getUint32(offset, true);
      offset += 4;
      const resourcesBytes = bytes.slice(offset, offset + resourcesLength);
      const resources = JSON.parse(new TextDecoder().decode(resourcesBytes));
      offset += resourcesLength;

      // Read structures
      const structuresLength = view.getUint32(offset, true);
      offset += 4;
      const structuresBytes = bytes.slice(offset, offset + structuresLength);
      const structures = JSON.parse(new TextDecoder().decode(structuresBytes));
      offset += structuresLength;

      // Read lakes
      const lakesLength = view.getUint32(offset, true);
      offset += 4;
      const lakesBytes = bytes.slice(offset, offset + lakesLength);
      const serializedLakes: SerializedLake[] = JSON.parse(new TextDecoder().decode(lakesBytes));
      offset += lakesLength;

      chunks.push({ x, y, heightmap: heightmapBuffer, biomeMap: biomeMapBuffer, resources, structures, lakes: serializedLakes });
    }

    // Read modifications count
    const modificationsCount = view.getUint32(offset, true);
    offset += 4;

    // Read modifications
    const modifications: ChunkModification[] = [];
    for (let i = 0; i < modificationsCount; i++) {
      // Read chunk coordinates
      const chunkX = view.getInt32(offset, true);
      offset += 4;
      const chunkY = view.getInt32(offset, true);
      offset += 4;

      // Read timestamp
      const timestampHigh = view.getUint32(offset, true);
      offset += 4;
      const timestampLow = view.getUint32(offset, true);
      offset += 4;
      const timestamp = timestampHigh * 0x100000000 + timestampLow;

      // Read modifiedTiles
      const modifiedTilesCount = view.getUint32(offset, true);
      offset += 4;
      const modifiedTiles = new Set<number>();
      for (let j = 0; j < modifiedTilesCount; j++) {
        modifiedTiles.add(view.getInt32(offset, true));
        offset += 4;
      }

      // Read heightChanges
      const heightChangesCount = view.getUint32(offset, true);
      offset += 4;
      const heightChanges = new Map<number, number>();
      for (let j = 0; j < heightChangesCount; j++) {
        const index = view.getInt32(offset, true);
        offset += 4;
        const height = view.getFloat32(offset, true);
        offset += 4;
        heightChanges.set(index, height);
      }

      // Read addedStructures
      const addedStructuresLength = view.getUint32(offset, true);
      offset += 4;
      const addedStructuresBytes = bytes.slice(offset, offset + addedStructuresLength);
      const addedStructures = JSON.parse(new TextDecoder().decode(addedStructuresBytes));
      offset += addedStructuresLength;

      // Read removedStructures
      const removedStructuresCount = view.getUint32(offset, true);
      offset += 4;
      const removedStructures: number[] = [];
      for (let j = 0; j < removedStructuresCount; j++) {
        removedStructures.push(view.getInt32(offset, true));
        offset += 4;
      }

      modifications.push({
        chunkX,
        chunkY,
        timestamp,
        modifiedTiles,
        heightChanges,
        addedStructures,
        removedStructures,
      });
    }

    // Read checksum
    const checksumLength = view.getUint32(offset, true);
    offset += 4;
    const checksumBytes = bytes.slice(offset, offset + checksumLength);
    const checksum = new TextDecoder().decode(checksumBytes);

    return {
      version,
      seed,
      config,
      chunks,
      modifications,
      checksum,
    };
  }

  /**
   * Validates SerializedWorld structure
   * 
   * @param data - Data to validate
   * @throws Error if validation fails
   */
  private validateSerializedWorld(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid serialized world: data must be an object');
    }

    if (typeof data.version !== 'string') {
      throw new Error('Invalid serialized world: version must be a string');
    }

    if (typeof data.seed !== 'number') {
      throw new Error('Invalid serialized world: seed must be a number');
    }

    if (!data.config || typeof data.config !== 'object') {
      throw new Error('Invalid serialized world: config must be an object');
    }

    if (!Array.isArray(data.chunks)) {
      throw new Error('Invalid serialized world: chunks must be an array');
    }

    if (!Array.isArray(data.modifications)) {
      throw new Error('Invalid serialized world: modifications must be an array');
    }

    if (typeof data.checksum !== 'string') {
      throw new Error('Invalid serialized world: checksum must be a string');
    }

    // Validate each chunk
    for (let i = 0; i < data.chunks.length; i++) {
      const chunk = data.chunks[i];
      if (typeof chunk.x !== 'number' || typeof chunk.y !== 'number') {
        throw new Error(`Invalid chunk at index ${i}: x and y must be numbers`);
      }
      if (!chunk.heightmap || !chunk.biomeMap) {
        throw new Error(`Invalid chunk at index ${i}: heightmap and biomeMap are required`);
      }
      if (!Array.isArray(chunk.resources) || !Array.isArray(chunk.structures)) {
        throw new Error(`Invalid chunk at index ${i}: resources and structures must be arrays`);
      }
      // Backward compatibility: rivers field is optional (removed but may exist in legacy data)
      // Don't validate rivers - it will be ignored during deserialization
    }
  }

  /**
   * Calculates CRC32 checksum for integrity validation
   * 
   * @param data - Serialized world data
   * @returns Checksum string
   * 
   * @remarks
   * Calculates CRC32 checksum over the serialized world data (excluding the checksum field itself).
   * CRC32 provides fast integrity validation for serialized data.
   */
  private calculateChecksum(data: SerializedWorld): string {
    // Create a copy of the data without the checksum field
    const dataForChecksum = {
      version: data.version,
      seed: data.seed,
      config: data.config,
      chunks: data.chunks,
      modifications: data.modifications,
    };

    // Convert to JSON string for consistent checksumming
    const jsonString = JSON.stringify(dataForChecksum);
    
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonString);

    // Calculate CRC32
    const crc = this.crc32(bytes);

    // Return as hex string
    return crc.toString(16).padStart(8, '0');
  }

  /**
   * Validates checksum for integrity verification
   * 
   * @param data - Serialized world data
   * @returns True if checksum is valid
   * 
   * @remarks
   * Validates that the data has not been corrupted during storage or transfer.
   * Recalculates the checksum and compares it with the stored checksum.
   */
  private validateChecksum(data: SerializedWorld): boolean {
    // Store the original checksum
    const originalChecksum = data.checksum;

    // Calculate the checksum for the data
    const calculatedChecksum = this.calculateChecksum(data);

    // Compare checksums
    return originalChecksum === calculatedChecksum;
  }

  /**
   * Applies modifications to chunks after deserialization
   * 
   * @param modifications - Array of chunk modifications to apply
   * @param chunkManager - Target chunk manager with cached chunks
   * 
   * @remarks
   * Applies all recorded modifications to regenerated chunks (Requirement 14.5).
   * This includes:
   * - Height changes: Updates heightmap at modified tile indices
   * - Structure additions: Adds new structures to the chunk
   * - Structure removals: Removes structures by index
   * - Timestamp preservation: Stores modification records in chunk manager
   * 
   * Modifications are applied in the order they appear in the array.
   * If a chunk is not in the cache, the modification is skipped with a warning.
   */
  private applyModifications(modifications: ChunkModification[], chunkManager: ChunkManagerSnapshot): void {
    // Process each modification record
    for (const modification of modifications) {
      // Get the chunk from cache
      const key = `${modification.chunkX},${modification.chunkY}`; // Match ChunkManager's cache key format
      const cacheEntry = chunkManager.cache.get(key);

      if (!cacheEntry) {
        logger.warn(LogCategory.CHUNK, `Cannot apply modifications to chunk (${modification.chunkX}, ${modification.chunkY}): chunk not in cache`);
        continue;
      }

      const chunk = cacheEntry.chunk;

      // Apply height changes to the heightmap
      for (const [tileIndex, newHeight] of modification.heightChanges) {
        if (tileIndex >= 0 && tileIndex < chunk.heightmap.length) {
          chunk.heightmap[tileIndex] = newHeight;
        } else {
          logger.warn(LogCategory.CHUNK, `Invalid tile index ${tileIndex} in height changes for chunk (${modification.chunkX}, ${modification.chunkY})`);
        }
      }

      // Apply structure removals (remove in reverse order to maintain indices)
      const sortedRemovals = [...modification.removedStructures].sort((a, b) => b - a);
      for (const structureIndex of sortedRemovals) {
        if (structureIndex >= 0 && structureIndex < chunk.structures.length) {
          chunk.structures.splice(structureIndex, 1);
        } else {
          logger.warn(LogCategory.CHUNK, `Invalid structure index ${structureIndex} in removals for chunk (${modification.chunkX}, ${modification.chunkY})`);
        }
      }

      // Apply structure additions
      for (const structure of modification.addedStructures) {
        chunk.structures.push(structure);
      }

      // Store modification record in chunk manager for future serialization
      chunkManager.recordModification(modification.chunkX, modification.chunkY, modification);
    }
  }
}
