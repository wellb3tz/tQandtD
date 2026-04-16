/**
 * River system stub
 * 
 * This file provides minimal type definitions for backward compatibility.
 * The actual river generation has been removed - only ocean water meshes are used.
 */

import { ChunkData } from '../world/chunk';

/**
 * Configuration for river network generation (stub - not used)
 */
export interface RiverNetworkConfig {
  /** Minimum elevation for river sources */
  sourceElevation: number;
  /** Minimum length for a river to be kept */
  minFlowLength: number;
  /** Width of river paths (in tiles) */
  flowWidth: number;
  /** Enable tributary generation */
  enableTributaries: boolean;
  /** Maximum tributary order */
  maxTributaryOrder: number;
  /** Tributary spawn probability (0-1) */
  tributaryProbability: number;
  /** Enable lake generation */
  enableLakes: boolean;
  /** Minimum depression depth for lake formation */
  lakeDepressionThreshold: number;
  /** Maximum lake size in tiles */
  maxLakeSize: number;
  /** Enable delta generation */
  enableDeltas: boolean;
  /** Delta branch count */
  deltaBranchCount: number;
  /** Delta spread angle in radians */
  deltaSpreadAngle: number;
  /** Minimum flow for river width calculation */
  minFlow: number;
  /** Maximum flow for river width calculation */
  maxFlow: number;
  /** Width scaling factor */
  widthScale: number;
}

/**
 * River segment with flow information (stub - not used)
 */
export interface RiverSegment {
  /** Flat index in chunk */
  index: number;
  /** Accumulated flow at this segment */
  flow: number;
  /** Calculated width at this segment */
  width: number;
  /** River order */
  order: number;
  /** Next segment index (-1 if terminus) */
  next: number;
}

/**
 * Lake data structure (stub - not used)
 */
export interface Lake {
  /** Set of tile indices forming the lake */
  tiles: Set<number>;
  /** Lake surface elevation */
  elevation: number;
  /** Outlet river segment index (-1 if no outlet) */
  outlet: number;
}

/**
 * River network data for a chunk (stub - not used)
 */
export interface RiverNetwork {
  /** All river segments */
  segments: RiverSegment[];
  /** Lakes in this chunk */
  lakes: Lake[];
  /** Map from tile index to segment index */
  tileToSegment: Map<number, number>;
}

/**
 * Stub river network generator that does nothing.
 * Rivers are not generated - only ocean water meshes are created in the demo.
 */
export class RiverNetworkGenerator {
  /**
   * Creates a new RiverNetworkGenerator (stub).
   * @param _config - River network generation parameters (ignored)
   */
  constructor(_config: RiverNetworkConfig) {
    // Stub - no initialization needed
  }

  /**
   * Generates rivers for a chunk (stub - returns empty set).
   * 
   * @param _chunkData - The chunk data containing heightmap (ignored)
   * @param _chunkSeed - Unique seed for this chunk (ignored)
   * @returns Empty set (no rivers generated)
   */
  generateRivers(_chunkData: ChunkData, _chunkSeed: number): Set<number> {
    // Return empty set - no rivers are generated
    return new Set<number>();
  }

  /**
   * Generates complete river network for a chunk (stub - returns empty network).
   * 
   * @param _chunkData - The chunk data containing heightmap (ignored)
   * @param _seed - Unique seed for this chunk (ignored)
   * @param _neighbors - Adjacent chunks (ignored)
   * @returns Empty river network
   */
  generateNetwork(
    _chunkData: ChunkData,
    _seed: number,
    _neighbors?: Map<string, ChunkData>
  ): RiverNetwork {
    // Return empty network - no rivers are generated
    return {
      segments: [],
      lakes: [],
      tileToSegment: new Map()
    };
  }
}
