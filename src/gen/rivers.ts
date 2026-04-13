import { SeededRNG } from '../core/rng';
import { ChunkData } from '../world/chunk';

/**
 * Configuration for river generation
 */
export interface RiverConfig {
  /** Minimum elevation for river sources */
  sourceElevation: number;
  /** Minimum length for a river to be kept */
  minFlowLength: number;
  /** Width of river paths (in tiles) */
  flowWidth: number;
}

/**
 * Enhanced river configuration for network generation
 */
export interface RiverNetworkConfig extends RiverConfig {
  /** Enable tributary generation (default: true) */
  enableTributaries: boolean;
  /** Maximum tributary order (1 = no tributaries, 2 = tributaries of main rivers, etc.) */
  maxTributaryOrder: number;
  /** Tributary spawn probability (0-1, default: 0.3) */
  tributaryProbability: number;
  
  /** Enable lake generation (default: true) */
  enableLakes: boolean;
  /** Minimum depression depth for lake formation (default: 0.05) */
  lakeDepressionThreshold: number;
  /** Maximum lake size in tiles (default: 100) */
  maxLakeSize: number;
  
  /** Enable delta generation (default: true) */
  enableDeltas: boolean;
  /** Delta branch count (default: 3) */
  deltaBranchCount: number;
  /** Delta spread angle in radians (default: Math.PI / 3) */
  deltaSpreadAngle: number;
  
  /** Minimum flow for river width calculation (default: 1.0) */
  minFlow: number;
  /** Maximum flow for river width calculation (default: 100.0) */
  maxFlow: number;
  /** Width scaling factor (default: 0.5) */
  widthScale: number;
}

/**
 * River segment with flow information
 */
export interface RiverSegment {
  /** Flat index in chunk */
  index: number;
  /** Accumulated flow at this segment */
  flow: number;
  /** Calculated width at this segment */
  width: number;
  /** River order (1 = main river, 2 = tributary, etc.) */
  order: number;
  /** Next segment index (-1 if terminus) */
  next: number;
}

/**
 * Lake data structure
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
 * River network data for a chunk
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
 * Generates rivers using downhill flow algorithm.
 * Rivers follow the steepest descent based on heightmap.
 */
export class RiverGenerator {
  private config: RiverConfig;

  /**
   * Creates a new RiverGenerator with the given configuration.
   * @param config - River generation parameters
   */
  constructor(config: RiverConfig) {
    this.config = config;
  }

  /**
   * Generates rivers for a chunk.
   * @param chunkData - The chunk data containing heightmap
   * @param chunkSeed - Unique seed for this chunk
   * @returns Set of flat indices representing river tiles
   */
  generateRivers(chunkData: ChunkData, chunkSeed: number): Set<number> {
    const { heightmap, size } = chunkData;
    const rng = new SeededRNG(chunkSeed);
    const allRiverTiles = new Set<number>();

    // Find potential river sources (high elevation tiles)
    const sources = this.findRiverSources(heightmap, size, rng);

    // Trace each river from its source
    for (const sourceIndex of sources) {
      const riverPath = this.traceRiverPath(heightmap, size, sourceIndex);

      // Only keep rivers that meet minimum length requirement
      if (riverPath.length >= this.config.minFlowLength) {
        // Apply flow width to widen the river
        const widenedPath = this.widenRiverPath(riverPath, size);
        widenedPath.forEach(index => allRiverTiles.add(index));
      }
    }

    return allRiverTiles;
  }

  /**
   * Finds potential river source positions at high elevations.
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param rng - Random number generator
   * @returns Array of flat indices for river sources
   */
  private findRiverSources(
    heightmap: Float32Array,
    size: number,
    rng: SeededRNG
  ): number[] {
    const sources: number[] = [];

    // Sample a few random positions and check if they're high enough
    const numAttempts = Math.floor(size * size * 0.05); // 5% of tiles

    for (let i = 0; i < numAttempts; i++) {
      const x = rng.nextInt(0, size);
      const y = rng.nextInt(0, size);
      const index = y * size + x;

      if (heightmap[index] >= this.config.sourceElevation) {
        sources.push(index);
      }
    }

    return sources;
  }

  /**
   * Traces a river path from a source using downhill flow.
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param sourceIndex - Starting position flat index
   * @returns Array of flat indices representing the river path
   */
  private traceRiverPath(
    heightmap: Float32Array,
    size: number,
    sourceIndex: number
  ): number[] {
    const path: number[] = [];
    const visited = new Set<number>();
    let currentIndex = sourceIndex;

    // Ocean level threshold (from design doc)
    const oceanLevel = 0.3;

    while (true) {
      // Mark current position as part of river
      path.push(currentIndex);
      visited.add(currentIndex);

      const currentHeight = heightmap[currentIndex];

      // Termination condition 1: Reached ocean level
      if (currentHeight < oceanLevel) {
        break;
      }

      // Find steepest descent among 8 neighbors
      const nextIndex = this.findSteepestDescent(
        heightmap,
        size,
        currentIndex,
        visited
      );

      // Termination condition 2: Local minimum (no lower neighbors)
      if (nextIndex === -1) {
        break;
      }

      currentIndex = nextIndex;
    }

    return path;
  }

  /**
   * Finds the neighbor with the steepest descent.
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param currentIndex - Current position flat index
   * @param visited - Set of already visited indices
   * @returns Flat index of steepest neighbor, or -1 if none found
   */
  private findSteepestDescent(
    heightmap: Float32Array,
    size: number,
    currentIndex: number,
    visited: Set<number>
  ): number {
    const x = currentIndex % size;
    const y = Math.floor(currentIndex / size);
    const currentHeight = heightmap[currentIndex];

    let steepestIndex = -1;
    let steepestDescent = 0;

    // Check all 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;

        // Check bounds
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

        const neighborIndex = ny * size + nx;

        // Skip if already visited
        if (visited.has(neighborIndex)) continue;

        const neighborHeight = heightmap[neighborIndex];
        const descent = currentHeight - neighborHeight;

        // Find steepest descent (must be downhill)
        if (descent > steepestDescent) {
          steepestDescent = descent;
          steepestIndex = neighborIndex;
        }
      }
    }

    return steepestIndex;
  }

  /**
   * Widens a river path by adding adjacent tiles.
   * @param path - Original river path
   * @param size - Chunk size
   * @returns Set of flat indices including widened river
   */
  private widenRiverPath(path: number[], size: number): Set<number> {
    const widened = new Set<number>();

    for (const index of path) {
      widened.add(index);

      // Add adjacent tiles based on flow width
      if (this.config.flowWidth > 1) {
        const x = index % size;
        const y = Math.floor(index / size);

        const radius = Math.floor(this.config.flowWidth / 2);

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              widened.add(ny * size + nx);
            }
          }
        }
      }
    }

    return widened;
  }
}

/**
 * Enhanced river network generator with tributaries, lakes, and deltas.
 * Replaces basic RiverGenerator with multi-pass generation pipeline.
 */
export class RiverNetworkGenerator {
  private config: RiverNetworkConfig;

  /**
   * Creates a new RiverNetworkGenerator with the given configuration.
   * @param config - River network generation parameters
   */
  constructor(config: RiverNetworkConfig) {
    this.config = config;
  }

  /**
   * Generates complete river network for a chunk using multi-pass pipeline.
   * Pipeline stages: lakes → main rivers → tributaries → flow calculation → width calculation → deltas
   * 
   * @param chunkData - The chunk data containing heightmap
   * @param seed - Unique seed for this chunk
   * @param neighbors - Adjacent chunks for cross-chunk river continuity (optional)
   * @returns River network data with segments, lakes, and tile mapping
   */
  generateNetwork(
    chunkData: ChunkData,
    seed: number,
    _neighbors?: Map<string, ChunkData>
  ): RiverNetwork {
    const { heightmap, size } = chunkData;
    
    // Initialize empty network
    const network: RiverNetwork = {
      segments: [],
      lakes: [],
      tileToSegment: new Map()
    };

    // Multi-pass generation pipeline
    
    // Pass 1: Find and create lakes in depressions
    if (this.config.enableLakes) {
      network.lakes = this.findLakes(heightmap, size);
    }

    // Pass 2: Generate main rivers from high elevation sources
    const mainRivers = this.generateMainRivers(chunkData, seed, network.lakes);
    network.segments.push(...mainRivers);

    // Pass 2b: Create lake outlets for lakes with sufficient volume
    if (this.config.enableLakes && network.lakes.length > 0) {
      this.createLakeOutlets(network.lakes, chunkData, seed, network.segments);
    }

    // Pass 3: Generate tributaries that flow into main rivers
    if (this.config.enableTributaries && mainRivers.length > 0) {
      const tributaries = this.generateTributaries(mainRivers, chunkData, seed);
      network.segments.push(...tributaries);
    }

    // Pass 4: Calculate accumulated flow for all segments
    network.segments = this.calculateFlow(network.segments);

    // Pass 5: Calculate width based on flow
    for (const segment of network.segments) {
      segment.width = this.calculateWidth(segment.flow);
    }

    // Pass 5b: Smooth width transitions
    this.smoothWidths(network.segments);

    // Pass 6: Generate deltas where rivers meet ocean
    if (this.config.enableDeltas) {
      const deltaSegments: RiverSegment[] = [];
      for (const segment of network.segments) {
        // Check if this segment is at ocean level and is a terminus
        if (segment.next === -1 && heightmap[segment.index] < 0.3) {
          const deltas = this.generateDelta(segment, chunkData);
          deltaSegments.push(...deltas);
        }
      }
      network.segments.push(...deltaSegments);
    }

    // Build tile-to-segment mapping for quick lookups
    for (let i = 0; i < network.segments.length; i++) {
      network.tileToSegment.set(network.segments[i].index, i);
    }

    return network;
  }

  /**
   * Finds depressions in terrain for lake placement.
   * Uses flood-fill algorithm to identify closed depressions below threshold.
   * 
   * @param heightmap - Chunk heightmap
   * @param size - Chunk size
   * @returns Array of lake data structures
   */
  private findLakes(heightmap: Float32Array, size: number): Lake[] {
    const lakes: Lake[] = [];
    const visited = new Set<number>();
    const oceanLevel = 0.3; // Ocean level threshold from design doc
    
    // Iterate through all tiles to find potential depression starting points
    for (let i = 0; i < size * size; i++) {
      // Skip if already visited or at/below ocean level
      if (visited.has(i) || heightmap[i] <= oceanLevel) {
        continue;
      }
      
      // Check if this tile is a local minimum (potential depression)
      if (this.isLocalMinimum(heightmap, size, i)) {
        // Flood fill to find the extent of the depression
        const depression = this.floodFillDepression(heightmap, size, i, visited);
        
        // Check if depression meets criteria for lake formation
        if (this.isValidLake(depression, heightmap, size)) {
          // Find the lowest point in the depression for lake elevation
          let minElevation = Infinity;
          for (const tileIndex of depression) {
            minElevation = Math.min(minElevation, heightmap[tileIndex]);
          }
          
          // Create lake object
          const lake: Lake = {
            tiles: depression,
            elevation: minElevation,
            outlet: -1 // Will be set later when rivers are generated
          };
          
          lakes.push(lake);
        }
      }
    }
    
    return lakes;
  }
  
  /**
   * Checks if a tile is a local minimum (lower than all neighbors).
   * 
   * @param heightmap - Chunk heightmap
   * @param size - Chunk size
   * @param index - Tile index to check
   * @returns True if tile is a local minimum
   */
  private isLocalMinimum(heightmap: Float32Array, size: number, index: number): boolean {
    const x = index % size;
    const y = Math.floor(index / size);
    const currentHeight = heightmap[index];
    
    // Check all 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        // Skip out of bounds
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        
        const neighborIndex = ny * size + nx;
        const neighborHeight = heightmap[neighborIndex];
        
        // If any neighbor is lower, this is not a local minimum
        if (neighborHeight < currentHeight) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Flood fills a depression starting from a local minimum.
   * Uses a priority queue to fill up to the lowest outlet point.
   * 
   * @param heightmap - Chunk heightmap
   * @param size - Chunk size
   * @param startIndex - Starting tile index (local minimum)
   * @param visited - Global visited set to track processed tiles
   * @returns Set of tile indices forming the depression
   */
  private floodFillDepression(
    heightmap: Float32Array,
    size: number,
    startIndex: number,
    visited: Set<number>
  ): Set<number> {
    const depression = new Set<number>();
    const queue: number[] = [startIndex];
    const localVisited = new Set<number>();
    localVisited.add(startIndex);
    
    // Start with the minimum elevation
    const startHeight = heightmap[startIndex];
    let fillLevel = startHeight;
    
    // Find the spill point (lowest point where water would overflow)
    // We need to find the minimum elevation of all boundary tiles
    const boundaryHeights: number[] = [];
    
    // First pass: explore the depression to find boundaries
    const exploreQueue: number[] = [startIndex];
    const exploreVisited = new Set<number>();
    exploreVisited.add(startIndex);
    
    while (exploreQueue.length > 0) {
      const currentIndex = exploreQueue.shift()!;
      const x = currentIndex % size;
      const y = Math.floor(currentIndex / size);
      const currentHeight = heightmap[currentIndex];
      
      // Check all 4 cardinal neighbors
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Check bounds - edge of chunk is a boundary
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
          boundaryHeights.push(currentHeight);
          continue;
        }
        
        const neighborIndex = ny * size + nx;
        
        if (exploreVisited.has(neighborIndex)) continue;
        
        const neighborHeight = heightmap[neighborIndex];
        
        // If neighbor is lower or similar height, it's part of the depression
        if (neighborHeight <= startHeight + this.config.lakeDepressionThreshold) {
          exploreVisited.add(neighborIndex);
          exploreQueue.push(neighborIndex);
        } else {
          // This is a boundary - record its height
          boundaryHeights.push(neighborHeight);
        }
      }
    }
    
    // Fill level is the minimum boundary height
    if (boundaryHeights.length > 0) {
      fillLevel = Math.min(...boundaryHeights);
    }
    
    // Second pass: fill depression up to fill level
    while (queue.length > 0) {
      const currentIndex = queue.shift()!;
      const x = currentIndex % size;
      const y = Math.floor(currentIndex / size);
      const currentHeight = heightmap[currentIndex];
      
      // Add to depression if below fill level
      if (currentHeight <= fillLevel) {
        depression.add(currentIndex);
        visited.add(currentIndex);
      }
      
      // Check all 4 cardinal neighbors
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Skip out of bounds
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        
        const neighborIndex = ny * size + nx;
        
        if (localVisited.has(neighborIndex)) continue;
        
        const neighborHeight = heightmap[neighborIndex];
        
        // Add neighbor if it's below fill level
        if (neighborHeight <= fillLevel) {
          localVisited.add(neighborIndex);
          queue.push(neighborIndex);
        }
      }
    }
    
    return depression;
  }
  
  /**
   * Validates if a depression should become a lake.
   * Checks size constraints and biome restrictions.
   * 
   * @param depression - Set of tile indices forming the depression
   * @param heightmap - Chunk heightmap
   * @param size - Chunk size
   * @returns True if depression should become a lake
   */
  private isValidLake(
    depression: Set<number>,
    heightmap: Float32Array,
    _size: number
  ): boolean {
    // Check minimum size (at least 2 tiles)
    if (depression.size < 2) {
      return false;
    }
    
    // Check maximum size constraint
    if (depression.size > this.config.maxLakeSize) {
      return false;
    }
    
    // Check that depression is not at ocean level
    const oceanLevel = 0.3;
    for (const tileIndex of depression) {
      if (heightmap[tileIndex] <= oceanLevel) {
        return false;
      }
    }
    
    // Check depth - depression should be deep enough
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    for (const tileIndex of depression) {
      const height = heightmap[tileIndex];
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
    }
    
    const depth = maxHeight - minHeight;
    if (depth < this.config.lakeDepressionThreshold) {
      return false;
    }
    
    return true;
  }

  /**
   * Generates main rivers from high elevation sources.
   * Uses downhill flow algorithm similar to basic RiverGenerator.
   * 
   * @param chunkData - Chunk data
   * @param seed - Random seed
   * @param lakes - Array of lakes to check for termination
   * @returns Array of river segments for main rivers
   */
  private generateMainRivers(chunkData: ChunkData, seed: number, lakes: Lake[] = []): RiverSegment[] {
    const { heightmap, size } = chunkData;
    const rng = new SeededRNG(seed);
    const segments: RiverSegment[] = [];
    // const oceanLevel = 0.3; // Reserved for future use

    // Find potential river sources (high elevation tiles)
    const numAttempts = Math.floor(size * size * 0.05); // 5% of tiles
    const sources: number[] = [];

    for (let i = 0; i < numAttempts; i++) {
      const x = rng.nextInt(0, size);
      const y = rng.nextInt(0, size);
      const index = y * size + x;

      if (heightmap[index] >= this.config.sourceElevation) {
        sources.push(index);
      }
    }

    // Trace each river from its source
    for (const sourceIndex of sources) {
      const path = this.traceRiverPathForNetwork(heightmap, size, sourceIndex, lakes);

      // Only keep rivers that meet minimum length requirement
      if (path.length >= this.config.minFlowLength) {
        // Convert path to river segments
        for (let i = 0; i < path.length; i++) {
          const index = path[i];
          const next = i < path.length - 1 ? path[i + 1] : -1;

          segments.push({
            index,
            flow: 1.0, // Base flow, will be calculated later
            width: 1.0, // Will be calculated later
            order: 1, // Main river
            next
          });
        }
      }
    }

    return segments;
  }

  /**
   * Creates outlet rivers for lakes with sufficient water volume.
   * 
   * @param lakes - Array of lakes
   * @param chunkData - Chunk data
   * @param seed - Random seed
   * @param segments - Existing river segments to append outlets to
   */
  private createLakeOutlets(
    lakes: Lake[],
    chunkData: ChunkData,
    _seed: number,
    segments: RiverSegment[]
  ): void {
    const { heightmap, size } = chunkData;
    // const rng = new SeededRNG(seed + 2000); // Reserved for future use

    for (const lake of lakes) {
      // Only create outlets for lakes with sufficient volume (size > 20 tiles)
      // This is a higher threshold to ensure only significant lakes get outlets
      if (lake.tiles.size <= 20) {
        continue;
      }

      // Find the lowest point on the lake boundary
      let lowestBoundaryIndex = -1;
      let lowestBoundaryHeight = Infinity;

      for (const tileIndex of lake.tiles) {
        const x = tileIndex % size;
        const y = Math.floor(tileIndex / size);

        // Check neighbors to find boundary
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;

            if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

            const neighborIndex = ny * size + nx;

            // If neighbor is not in lake, this is a boundary
            if (!lake.tiles.has(neighborIndex)) {
              const neighborHeight = heightmap[neighborIndex];
              if (neighborHeight < lowestBoundaryHeight) {
                lowestBoundaryHeight = neighborHeight;
                lowestBoundaryIndex = neighborIndex;
              }
            }
          }
        }
      }

      // Create outlet river from lowest boundary point
      if (lowestBoundaryIndex !== -1) {
        const outletPath = this.traceRiverPathForNetwork(heightmap, size, lowestBoundaryIndex, []);

        if (outletPath.length >= this.config.minFlowLength) {
          const outletStartIndex = segments.length;

          // Convert path to river segments
          for (let i = 0; i < outletPath.length; i++) {
            const index = outletPath[i];
            const next = i < outletPath.length - 1 ? outletPath[i + 1] : -1;

            segments.push({
              index,
              flow: 1.0, // Base flow, will be calculated later
              width: 1.0, // Will be calculated later
              order: 1, // Main river (outlet is treated as main river)
              next
            });
          }

          // Record outlet in lake
          lake.outlet = outletStartIndex;
        }
      }
    }
  }

  /**
   * Traces a river path from a source using downhill flow.
   * Similar to RiverGenerator.traceRiverPath but returns indices only.
   * Terminates at lake boundaries if lakes are present.
   * 
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param sourceIndex - Starting position flat index
   * @param lakes - Array of lakes to check for termination
   * @returns Array of flat indices representing the river path
   */
  private traceRiverPathForNetwork(
    heightmap: Float32Array,
    size: number,
    sourceIndex: number,
    lakes: Lake[] = []
  ): number[] {
    const path: number[] = [];
    const visited = new Set<number>();
    let currentIndex = sourceIndex;
    const oceanLevel = 0.3;

    // Build set of lake tiles for quick lookup
    const lakeTiles = new Set<number>();
    for (const lake of lakes) {
      for (const tileIndex of lake.tiles) {
        lakeTiles.add(tileIndex);
      }
    }

    while (true) {
      path.push(currentIndex);
      visited.add(currentIndex);

      const currentHeight = heightmap[currentIndex];

      // Termination condition 1: Reached ocean level
      if (currentHeight < oceanLevel) {
        break;
      }

      // Termination condition 2: Reached a lake
      if (lakeTiles.has(currentIndex) && path.length > 1) {
        break;
      }

      // Find steepest descent among 8 neighbors
      const x = currentIndex % size;
      const y = Math.floor(currentIndex / size);
      let steepestIndex = -1;
      let steepestDescent = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

          const neighborIndex = ny * size + nx;

          if (visited.has(neighborIndex)) continue;

          const neighborHeight = heightmap[neighborIndex];
          const descent = currentHeight - neighborHeight;

          if (descent > steepestDescent) {
            steepestDescent = descent;
            steepestIndex = neighborIndex;
          }
        }
      }

      // Termination condition 3: Local minimum (no lower neighbors)
      if (steepestIndex === -1) {
        break;
      }

      currentIndex = steepestIndex;
    }

    return path;
  }

  /**
   * Generates tributaries for existing rivers.
   * Finds potential tributary sources and connects them to nearby main rivers.
   * 
   * @param mainRivers - Existing river segments
   * @param chunkData - Chunk data
   * @param seed - Random seed
   * @returns Array of tributary segments
   */
  private generateTributaries(
    mainRivers: RiverSegment[],
    chunkData: ChunkData,
    seed: number
  ): RiverSegment[] {
    const { heightmap, size } = chunkData;
    const rng = new SeededRNG(seed + 1000); // Offset seed for tributaries
    const tributaries: RiverSegment[] = [];
    const oceanLevel = 0.3;

    // Build a set of main river tile indices for quick lookup
    const mainRiverTiles = new Set<number>();
    for (const segment of mainRivers) {
      mainRiverTiles.add(segment.index);
    }

    // Find potential tributary sources near main rivers
    const numAttempts = Math.floor(size * size * 0.03); // 3% of tiles

    for (let i = 0; i < numAttempts; i++) {
      // Check probability
      if (rng.nextFloat() > this.config.tributaryProbability) {
        continue;
      }

      const x = rng.nextInt(0, size);
      const y = rng.nextInt(0, size);
      const index = y * size + x;

      // Skip if already part of main river
      if (mainRiverTiles.has(index)) {
        continue;
      }

      // Source should be at moderate elevation (lower than main river sources)
      const elevation = heightmap[index];
      if (elevation < this.config.sourceElevation * 0.7 || elevation < oceanLevel) {
        continue;
      }

      // Check if there's a main river nearby (within search radius)
      const searchRadius = Math.floor(size * 0.3); // 30% of chunk size
      let nearMainRiver = false;

      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

          const neighborIndex = ny * size + nx;
          if (mainRiverTiles.has(neighborIndex)) {
            nearMainRiver = true;
            break;
          }
        }
        if (nearMainRiver) break;
      }

      if (!nearMainRiver) {
        continue;
      }

      // Trace tributary path
      const path = this.traceTributaryPath(heightmap, size, index, mainRiverTiles);

      // Only keep tributaries that meet minimum length and merge with main river
      if (path.indices.length >= this.config.minFlowLength && path.mergedWithMain) {
        // Convert path to river segments
        for (let j = 0; j < path.indices.length; j++) {
          const segmentIndex = path.indices[j];
          const next = j < path.indices.length - 1 ? path.indices[j + 1] : -1;

          tributaries.push({
            index: segmentIndex,
            flow: 1.0, // Base flow, will be calculated later
            width: 1.0, // Will be calculated later
            order: 2, // Tributary
            next
          });
        }
      }
    }

    return tributaries;
  }

  /**
   * Traces a tributary path toward a main river.
   * 
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param sourceIndex - Starting position flat index
   * @param mainRiverTiles - Set of main river tile indices
   * @returns Object with path indices and merge status
   */
  private traceTributaryPath(
    heightmap: Float32Array,
    size: number,
    sourceIndex: number,
    mainRiverTiles: Set<number>
  ): { indices: number[]; mergedWithMain: boolean } {
    const path: number[] = [];
    const visited = new Set<number>();
    let currentIndex = sourceIndex;
    const oceanLevel = 0.3;
    const mergeDistance = 2; // Tiles within this distance can merge

    while (true) {
      path.push(currentIndex);
      visited.add(currentIndex);

      // Check if we've reached a main river (merge condition)
      const x = currentIndex % size;
      const y = Math.floor(currentIndex / size);

      for (let dy = -mergeDistance; dy <= mergeDistance; dy++) {
        for (let dx = -mergeDistance; dx <= mergeDistance; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

          const neighborIndex = ny * size + nx;
          if (mainRiverTiles.has(neighborIndex)) {
            return { indices: path, mergedWithMain: true };
          }
        }
      }

      const currentHeight = heightmap[currentIndex];

      // Termination condition 1: Reached ocean level
      if (currentHeight < oceanLevel) {
        return { indices: path, mergedWithMain: false };
      }

      // Find steepest descent among 8 neighbors
      let steepestIndex = -1;
      let steepestDescent = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

          const neighborIndex = ny * size + nx;

          if (visited.has(neighborIndex)) continue;

          const neighborHeight = heightmap[neighborIndex];
          const descent = currentHeight - neighborHeight;

          if (descent > steepestDescent) {
            steepestDescent = descent;
            steepestIndex = neighborIndex;
          }
        }
      }

      // Termination condition 2: Local minimum (no lower neighbors)
      if (steepestIndex === -1) {
        return { indices: path, mergedWithMain: false };
      }

      currentIndex = steepestIndex;
    }
  }

  /**
   * Calculates accumulated flow for all river segments.
   * Uses topological sort to process segments from upstream to downstream.
   * 
   * @param segments - All river segments
   * @returns Updated segments with flow values
   */
  private calculateFlow(segments: RiverSegment[]): RiverSegment[] {
    if (segments.length === 0) {
      return segments;
    }

    // Build adjacency list and in-degree map
    const graph = new Map<number, number[]>(); // index -> list of downstream indices
    const inDegree = new Map<number, number>(); // index -> count of upstream segments
    const indexToSegment = new Map<number, RiverSegment>();

    // Initialize
    for (const segment of segments) {
      indexToSegment.set(segment.index, segment);
      if (!inDegree.has(segment.index)) {
        inDegree.set(segment.index, 0);
      }
      if (!graph.has(segment.index)) {
        graph.set(segment.index, []);
      }
    }

    // Build graph
    for (const segment of segments) {
      if (segment.next !== -1) {
        // Add edge from current to next
        const downstream = graph.get(segment.index) || [];
        downstream.push(segment.next);
        graph.set(segment.index, downstream);

        // Increment in-degree of next segment
        const nextDegree = inDegree.get(segment.next) || 0;
        inDegree.set(segment.next, nextDegree + 1);
      }
    }

    // Topological sort using Kahn's algorithm
    const queue: number[] = [];
    const sorted: number[] = [];

    // Find all source nodes (in-degree = 0)
    for (const [index, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(index);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const currentIndex = queue.shift()!;
      sorted.push(currentIndex);

      // Process downstream neighbors
      const downstream = graph.get(currentIndex) || [];
      for (const nextIndex of downstream) {
        const degree = inDegree.get(nextIndex)!;
        inDegree.set(nextIndex, degree - 1);

        if (degree - 1 === 0) {
          queue.push(nextIndex);
        }
      }
    }

    // Check for cycles
    if (sorted.length !== segments.length) {
      // Cycle detected - break cycles by resetting flow
      console.warn('River network contains cycles, flow calculation may be inaccurate');
      for (const segment of segments) {
        segment.flow = 1.0;
      }
      return segments;
    }

    // Calculate flow in topological order
    const flowMap = new Map<number, number>();

    // Initialize all segments with base flow
    for (const segment of segments) {
      flowMap.set(segment.index, 1.0);
    }

    // Build upstream map for easier lookup
    const upstreamMap = new Map<number, number[]>();
    for (const segment of segments) {
      if (segment.next !== -1) {
        const upstream = upstreamMap.get(segment.next) || [];
        upstream.push(segment.index);
        upstreamMap.set(segment.next, upstream);
      }
    }

    // Process in topological order (upstream to downstream)
    for (const index of sorted) {
      const segment = indexToSegment.get(index);
      if (!segment) continue;

      // Calculate flow as sum of all upstream contributions
      const upstream = upstreamMap.get(index);
      if (upstream && upstream.length > 0) {
        let totalFlow = 0;
        for (const upstreamIndex of upstream) {
          totalFlow += flowMap.get(upstreamIndex) || 1.0;
        }
        flowMap.set(index, totalFlow);
      }
      // else: source segment, keep base flow of 1.0
    }

    // Update segment flow values
    for (const segment of segments) {
      segment.flow = flowMap.get(segment.index) || 1.0;
    }

    return segments;
  }

  /**
   * Calculates river width based on accumulated flow.
   * Uses logarithmic scaling: width = widthScale * log(flow + 1)
   * 
   * @param flow - Accumulated flow value
   * @returns River width in tiles
   */
  private calculateWidth(flow: number): number {
    const { widthScale, minFlow, maxFlow } = this.config;
    
    // Clamp flow to valid range
    const clampedFlow = Math.max(minFlow, Math.min(maxFlow, flow));
    
    // Logarithmic scaling for natural-looking width progression
    const width = widthScale * Math.log(clampedFlow + 1);
    
    // Ensure minimum width of at least 0.5 tiles
    return Math.max(0.5, width);
  }

  /**
   * Smooths width transitions between adjacent river segments.
   * Uses moving average to prevent abrupt width changes.
   * 
   * @param segments - River segments to smooth
   */
  private smoothWidths(segments: RiverSegment[]): void {
    if (segments.length === 0) {
      return;
    }

    // Build adjacency map for quick neighbor lookup
    const nextMap = new Map<number, RiverSegment>();
    const prevMap = new Map<number, RiverSegment>();

    for (const segment of segments) {
      if (segment.next !== -1) {
        // Find the segment with index = segment.next
        const nextSegment = segments.find(s => s.index === segment.next);
        if (nextSegment) {
          nextMap.set(segment.index, nextSegment);
          prevMap.set(nextSegment.index, segment);
        }
      }
    }

    // Apply smoothing using weighted average
    const smoothingFactor = 0.3; // How much to blend with neighbors
    const newWidths = new Map<number, number>();

    for (const segment of segments) {
      let smoothedWidth = segment.width;
      let count = 1;

      // Include upstream neighbor
      const prev = prevMap.get(segment.index);
      if (prev) {
        smoothedWidth += prev.width * smoothingFactor;
        count += smoothingFactor;
      }

      // Include downstream neighbor
      const next = nextMap.get(segment.index);
      if (next) {
        smoothedWidth += next.width * smoothingFactor;
        count += smoothingFactor;
      }

      newWidths.set(segment.index, smoothedWidth / count);
    }

    // Apply smoothed widths
    for (const segment of segments) {
      const smoothed = newWidths.get(segment.index);
      if (smoothed !== undefined) {
        segment.width = smoothed;
      }
    }
  }

  /**
   * Generates delta formation where river meets ocean.
   * Creates branching channels in a fan pattern spreading toward the ocean.
   * 
   * @param riverSegment - River segment at ocean boundary
   * @param chunkData - Chunk data
   * @returns Array of delta branch segments
   */
  private generateDelta(riverSegment: RiverSegment, chunkData: ChunkData): RiverSegment[] {
    const { heightmap, size } = chunkData;
    const deltaSegments: RiverSegment[] = [];
    const oceanLevel = 0.3;

    // Get the direction of flow from the parent segment
    const parentX = riverSegment.index % size;
    const parentY = Math.floor(riverSegment.index / size);

    // Determine flow direction (toward ocean)
    let flowDirX = 0;
    let flowDirY = 0;

    // Sample nearby tiles to find ocean direction
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = parentX + dx;
        const ny = parentY + dy;

        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

        const neighborIndex = ny * size + nx;
        if (heightmap[neighborIndex] < oceanLevel) {
          flowDirX += dx;
          flowDirY += dy;
        }
      }
    }

    // Normalize flow direction
    const flowMag = Math.sqrt(flowDirX * flowDirX + flowDirY * flowDirY);
    if (flowMag > 0) {
      flowDirX /= flowMag;
      flowDirY /= flowMag;
    } else {
      // Default to downward flow
      flowDirY = 1;
    }

    // Calculate base angle from flow direction
    const baseAngle = Math.atan2(flowDirY, flowDirX);

    // Create branching channels
    const branchCount = this.config.deltaBranchCount;
    const spreadAngle = this.config.deltaSpreadAngle;

    for (let i = 0; i < branchCount; i++) {
      // Calculate branch angle
      const angleOffset = (i - (branchCount - 1) / 2) * (spreadAngle / (branchCount - 1 || 1));
      const branchAngle = baseAngle + angleOffset;

      // Trace branch path
      const branchPath = this.traceDeltaBranch(
        heightmap,
        size,
        riverSegment.index,
        branchAngle,
        riverSegment.flow / branchCount
      );

      // Convert path to segments
      for (let j = 0; j < branchPath.length; j++) {
        const index = branchPath[j];
        const next = j < branchPath.length - 1 ? branchPath[j + 1] : -1;

        deltaSegments.push({
          index,
          flow: riverSegment.flow / branchCount, // Distribute flow among branches
          width: 1.0, // Will be calculated based on flow
          order: riverSegment.order + 1, // Delta channels are one order higher
          next
        });
      }
    }

    return deltaSegments;
  }

  /**
   * Traces a delta branch in a specific direction.
   * 
   * @param heightmap - Chunk heightmap
   * @param size - Chunk size
   * @param startIndex - Starting position
   * @param angle - Direction angle in radians
   * @param flow - Flow for this branch
   * @returns Array of tile indices forming the branch
   */
  private traceDeltaBranch(
    heightmap: Float32Array,
    size: number,
    startIndex: number,
    angle: number,
    _flow: number
  ): number[] {
    const path: number[] = [];
    const visited = new Set<number>();
    let currentIndex = startIndex;
    const oceanLevel = 0.3;
    const maxLength = 10; // Maximum delta branch length

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    while (path.length < maxLength) {
      path.push(currentIndex);
      visited.add(currentIndex);

      const currentHeight = heightmap[currentIndex];

      // Termination: reached deep ocean
      if (currentHeight < oceanLevel - 0.1) {
        break;
      }

      // Find next tile in the direction of flow
      const x = currentIndex % size;
      const y = Math.floor(currentIndex / size);

      let bestIndex = -1;
      let bestScore = -Infinity;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

          const neighborIndex = ny * size + nx;

          if (visited.has(neighborIndex)) continue;

          // Score based on alignment with desired direction and downhill
          const alignmentX = dx;
          const alignmentY = dy;
          const alignment = alignmentX * dirX + alignmentY * dirY;

          const neighborHeight = heightmap[neighborIndex];
          const descent = currentHeight - neighborHeight;

          // Prefer tiles that align with direction and go downhill
          const score = alignment * 2 + descent;

          if (score > bestScore) {
            bestScore = score;
            bestIndex = neighborIndex;
          }
        }
      }

      if (bestIndex === -1) {
        break;
      }

      currentIndex = bestIndex;
    }

    return path;
  }

  /**
   * Merges tributary into main river.
   * Updates main river's flow to include tributary contribution.
   * Reserved for future implementation.
   * 
   * @param _tributary - Tributary segment (reserved for future use)
   * @param mainRiver - Main river segment
   * @returns Updated main river with increased flow
   */
  // @ts-expect-error - Reserved for future implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private mergeTributary(_tributary: RiverSegment, mainRiver: RiverSegment): RiverSegment {
    // Placeholder implementation - will be implemented in subsequent tasks
    // This is the foundation for task 5.5 (tributary merging)
    
    // Basic merge: add tributary flow to main river
    // mainRiver.flow += tributary.flow;
    return mainRiver;
  }
}
