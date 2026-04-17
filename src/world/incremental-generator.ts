import { PartialChunkData, GenerationStage, IncrementalConfig } from './chunk';
import { WorldConfig } from './chunk-manager';
import { TerrainGenerator } from '../gen/terrain';
import { BiomeSystem } from './biome';
import { RiverNetworkGenerator } from '../gen/rivers';
import { ResourceGenerator } from '../gen/resources';
import { StructurePlacer } from '../gen/structures';
import { chunkSeed } from '../core/hash';

/**
 * Manages incremental chunk generation with yielding for responsiveness.
 * Divides chunk generation into discrete stages that respect time budgets.
 */
export class IncrementalGenerator {
  private config: IncrementalConfig;
  private activeGenerations: Map<string, PartialChunkData>;
  private terrainGenerator: TerrainGenerator;
  private biomeSystem: BiomeSystem;
  private riverGenerator: RiverNetworkGenerator;
  private resourceGenerator: ResourceGenerator;
  private structurePlacer: StructurePlacer;
  private worldConfig: WorldConfig;

  /**
   * Creates a new IncrementalGenerator
   * @param config - Incremental generation configuration
   * @param worldConfig - World configuration
   * @param terrainGenerator - Terrain generator instance
   * @param biomeSystem - Biome system instance
   * @param riverGenerator - River generator instance
   * @param resourceGenerator - Resource generator instance
   * @param structurePlacer - Structure placer instance
   */
  constructor(
    config: IncrementalConfig,
    worldConfig: WorldConfig,
    terrainGenerator: TerrainGenerator,
    biomeSystem: BiomeSystem,
    riverGenerator: RiverNetworkGenerator,
    resourceGenerator: ResourceGenerator,
    structurePlacer: StructurePlacer
  ) {
    this.config = config;
    this.worldConfig = worldConfig;
    this.terrainGenerator = terrainGenerator;
    this.biomeSystem = biomeSystem;
    this.riverGenerator = riverGenerator;
    this.resourceGenerator = resourceGenerator;
    this.structurePlacer = structurePlacer;
    this.activeGenerations = new Map();
  }

  /**
   * Starts incremental generation for a chunk
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Partial chunk data (updated as generation progresses)
   */
  startGeneration(chunkX: number, chunkY: number): PartialChunkData {
    const key = this.getKey(chunkX, chunkY);

    // Check if generation is already active
    if (this.activeGenerations.has(key)) {
      return this.activeGenerations.get(key)!;
    }

    // Initialize partial chunk data
    const partial: PartialChunkData = {
      x: chunkX,
      y: chunkY,
      stage: GenerationStage.TERRAIN,
      completedStages: new Set<GenerationStage>(),
      data: {
        x: chunkX,
        y: chunkY,
        size: this.worldConfig.chunkSize,
      },
    };

    // Store in active generations map
    this.activeGenerations.set(key, partial);

    return partial;
  }

  /**
   * Continues generation for a chunk (call repeatedly until complete)
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns True if generation is complete
   */
  continueGeneration(chunkX: number, chunkY: number): boolean {
    const key = this.getKey(chunkX, chunkY);
    const partial = this.activeGenerations.get(key);

    if (!partial) {
      throw new Error(`No active generation for chunk (${chunkX}, ${chunkY})`);
    }

    // If already complete, return true
    if (partial.stage === GenerationStage.COMPLETE) {
      return true;
    }

    // Loop through stages while we have time budget
    let shouldContinue = true;
    while (shouldContinue && (partial.stage as number) !== GenerationStage.COMPLETE) {
      // Check if current stage is already complete
      if (partial.completedStages.has(partial.stage)) {
        // Stage already complete, advance to next stage immediately
        partial.stage++;
        
        // If all stages complete, return true
        if ((partial.stage as number) === GenerationStage.COMPLETE) {
          return true;
        }
        
        // Continue to next stage in the loop
        continue;
      }

      // Execute current stage
      // Returns true if within budget (continue), false if exceeded (yield)
      shouldContinue = this.executeStage(partial, partial.stage);
    }

    // Return true if complete, false if yielding
    return (partial.stage as number) === GenerationStage.COMPLETE;
  }

  /**
   * Gets current generation stage for a chunk
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Current generation stage or undefined if not generating
   */
  getStage(chunkX: number, chunkY: number): GenerationStage | undefined {
    const key = this.getKey(chunkX, chunkY);
    const partial = this.activeGenerations.get(key);
    return partial?.stage;
  }

  /**
   * Cancels incremental generation for a chunk
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   */
  cancelGeneration(chunkX: number, chunkY: number): void {
    const key = this.getKey(chunkX, chunkY);
    this.activeGenerations.delete(key);
  }

  /**
   * Executes a generation stage with time budget
   * @param partial - Partial chunk data
   * @param stage - Stage to execute
   * @returns True if stage completed within time budget
   */
  private executeStage(partial: PartialChunkData, stage: GenerationStage): boolean {
    const startTime = performance.now();

    switch (stage) {
      case GenerationStage.TERRAIN:
        return this.executeTerrainStage(partial, startTime);
      case GenerationStage.BIOMES:
        return this.executeBiomesStage(partial, startTime);
      case GenerationStage.RIVERS:
        return this.executeRiversStage(partial, startTime);
      case GenerationStage.RESOURCES:
        return this.executeResourcesStage(partial, startTime);
      case GenerationStage.STRUCTURES:
        return this.executeStructuresStage(partial, startTime);
      default:
        return true;
    }
  }

  /**
   * Executes terrain generation stage
   * @param partial - Partial chunk data
   * @param startTime - Stage start time
   * @returns True if within budget (continue to next stage), false if exceeded (yield)
   */
  private executeTerrainStage(partial: PartialChunkData, startTime: number): boolean {
    // Generate heightmap using TerrainGenerator with chunk coordinates for seamless boundaries
    // Use world seed (not chunk seed) to ensure seamless boundaries across chunks
    partial.data.heightmap = this.terrainGenerator.generateHeightmap(
      this.worldConfig.seed,
      this.worldConfig.chunkSize,
      partial.x,
      partial.y
    );
    
    // Mark stage as complete
    partial.completedStages.add(GenerationStage.TERRAIN);
    
    // Advance to next stage
    partial.stage = GenerationStage.BIOMES;
    
    // Check time budget
    const elapsed = performance.now() - startTime;
    
    // Return true if within budget (continue), false if exceeded (yield)
    return elapsed < this.config.timeBudgetMs;
  }

  /**
   * Executes biome generation stage
   * @param partial - Partial chunk data
   * @param startTime - Stage start time
   * @returns True if within budget (continue to next stage), false if exceeded (yield)
   */
  private executeBiomesStage(partial: PartialChunkData, startTime: number): boolean {
    if (!partial.data.heightmap) {
      throw new Error('Heightmap must be generated before biomes');
    }

    const size = this.worldConfig.chunkSize;
    const heightmap = partial.data.heightmap;
    
    // Initialize arrays on first call
    if (!partial.data.biomeMap) {
      partial.data.biomeMap = new Uint8Array(size * size);
    }
    if (!partial.data.biomeWeights) {
      // Calculate number of biome types for weights array
      const numBiomes = 8; // BiomeType enum has 8 values (0-7)
      partial.data.biomeWeights = new Float32Array(size * size * numBiomes);
    }
    
    const biomeMap = partial.data.biomeMap;
    const biomeWeights = partial.data.biomeWeights;
    const numBiomes = 8;

    // Convert chunk coordinates to world coordinates
    const worldX = partial.x * size;
    const worldY = partial.y * size;

    // Heightmap has (size+1) x (size+1) vertices for seamless boundaries
    const vertexCount = size + 1;

    // Create height sampling callback
    const getHeight = (worldPosX: number, worldPosY: number): number => {
      // Convert world coordinates to chunk coordinates
      const targetChunkX = Math.floor(worldPosX / size);
      const targetChunkY = Math.floor(worldPosY / size);
      
      // If sampling from current chunk, use heightmap directly
      if (targetChunkX === partial.x && targetChunkY === partial.y) {
        const localX = worldPosX - worldX;
        const localY = worldPosY - worldY;
        // Check if within heightmap bounds (0 to size inclusive for vertices)
        if (localX >= 0 && localX <= size && localY >= 0 && localY <= size) {
          return heightmap[localY * vertexCount + localX];
        }
      }
      
      // For neighboring chunks, generate height on-demand using terrain generator
      return this.terrainGenerator.getHeightAt(worldPosX, worldPosY, this.worldConfig.seed);
    };

    // Resume from saved position or start from beginning
    const startY = partial.biomesProgress?.currentY || 0;
    const startX = partial.biomesProgress?.currentX || 0;

    // Generate biomes for the chunk with intra-stage yielding
    for (let y = startY; y < size; y++) {
      for (let x = (y === startY ? startX : 0); x < size; x++) {
        const index = y * size + x;
        // Sample height from heightmap (using vertex coordinates)
        const height = heightmap[y * vertexCount + x];
        
        // Get world position for this tile
        const wx = worldX + x;
        const wy = worldY + y;

        // Determine biome at this position
        const biome = this.biomeSystem.getBiome(wx, wy, height);
        biomeMap[index] = biome;

        // Get biome blend weights
        const weights = this.biomeSystem.getBiomeWeights(wx, wy, getHeight);
        
        // Store weights in the array
        const weightOffset = index * numBiomes;
        for (let b = 0; b < numBiomes; b++) {
          biomeWeights[weightOffset + b] = weights.get(b) || 0;
        }

        // Check budget every 4 tiles for fine-grained yielding
        if ((y * size + x) % 4 === 0) {
          const elapsed = performance.now() - startTime;
          if (elapsed >= this.config.timeBudgetMs) {
            // Save progress and yield
            partial.biomesProgress = { currentY: y, currentX: x + 1 };
            return false; // Yield - exceeded budget
          }
        }
      }
    }

    // All biomes generated - clear progress and mark complete
    delete partial.biomesProgress;
    
    // Mark stage as complete
    partial.completedStages.add(GenerationStage.BIOMES);
    
    // Advance to next stage
    partial.stage = GenerationStage.RIVERS;
    
    // Check time budget
    const elapsed = performance.now() - startTime;
    
    // Return true if within budget (continue), false if exceeded (yield)
    return elapsed < this.config.timeBudgetMs;
  }

  /**
   * Executes river generation stage
   * @param partial - Partial chunk data
   * @param startTime - Stage start time
   * @returns True if within budget (continue to next stage), false if exceeded (yield)
   */
  private executeRiversStage(partial: PartialChunkData, startTime: number): boolean {
    if (!partial.data.heightmap || !partial.data.biomeMap) {
      throw new Error('Heightmap and biomes must be generated before rivers');
    }

    // Generate unique seed for this chunk
    const seed = chunkSeed(this.worldConfig.seed, partial.x, partial.y);
    
    // Create a temporary ChunkData object for river generation
    const tempChunk = {
      x: partial.x,
      y: partial.y,
      size: this.worldConfig.chunkSize,
      heightmap: partial.data.heightmap,
      biomeMap: partial.data.biomeMap,
      biomeWeights: partial.data.biomeWeights!,
      resources: [],
      structures: [],
      rivers: new Set<number>(),
    };
    
    // Generate rivers using RiverGenerator
    partial.data.rivers = this.riverGenerator.generateRivers(tempChunk, seed);
    
    // Mark stage as complete
    partial.completedStages.add(GenerationStage.RIVERS);
    
    // Advance to next stage
    partial.stage = GenerationStage.RESOURCES;
    
    // Check time budget
    const elapsed = performance.now() - startTime;
    
    // Return true if within budget (continue), false if exceeded (yield)
    return elapsed < this.config.timeBudgetMs;
  }

  /**
   * Executes resource generation stage
   * @param partial - Partial chunk data
   * @param startTime - Stage start time
   * @returns True if within budget (continue to next stage), false if exceeded (yield)
   */
  private executeResourcesStage(partial: PartialChunkData, startTime: number): boolean {
    if (!partial.data.heightmap || !partial.data.biomeMap) {
      throw new Error('Heightmap and biomes must be generated before resources');
    }

    // Generate unique seed for this chunk
    const seed = chunkSeed(this.worldConfig.seed, partial.x, partial.y);
    
    // Create a temporary ChunkData object for resource generation
    const tempChunk = {
      x: partial.x,
      y: partial.y,
      size: this.worldConfig.chunkSize,
      heightmap: partial.data.heightmap,
      biomeMap: partial.data.biomeMap,
      biomeWeights: partial.data.biomeWeights!,
      resources: [],
      structures: [],
      rivers: partial.data.rivers || new Set<number>(),
    };
    
    // Generate resources using ResourceGenerator
    partial.data.resources = this.resourceGenerator.generateResources(tempChunk, seed);
    
    // Mark stage as complete
    partial.completedStages.add(GenerationStage.RESOURCES);
    
    // Advance to next stage
    partial.stage = GenerationStage.STRUCTURES;
    
    // Check time budget
    const elapsed = performance.now() - startTime;
    
    // Return true if within budget (continue), false if exceeded (yield)
    return elapsed < this.config.timeBudgetMs;
  }

  /**
   * Executes structure generation stage
   * @param partial - Partial chunk data
   * @param startTime - Stage start time
   * @returns True if within budget (continue to next stage), false if exceeded (yield)
   */
  private executeStructuresStage(partial: PartialChunkData, startTime: number): boolean {
    if (!partial.data.heightmap || !partial.data.biomeMap) {
      throw new Error('Heightmap and biomes must be generated before structures');
    }

    // Generate unique seed for this chunk
    const seed = chunkSeed(this.worldConfig.seed, partial.x, partial.y);
    
    // Create a temporary ChunkData object for structure generation
    const tempChunk = {
      x: partial.x,
      y: partial.y,
      size: this.worldConfig.chunkSize,
      heightmap: partial.data.heightmap,
      biomeMap: partial.data.biomeMap,
      biomeWeights: partial.data.biomeWeights!,
      resources: partial.data.resources || [],
      structures: [],
      rivers: partial.data.rivers || new Set<number>(),
    };
    
    // Generate structures using StructurePlacer
    partial.data.structures = this.structurePlacer.generateStructures(tempChunk, seed);
    
    // Mark stage as complete
    partial.completedStages.add(GenerationStage.STRUCTURES);
    
    // Advance to next stage (COMPLETE)
    partial.stage = GenerationStage.COMPLETE;
    
    // Check time budget
    const elapsed = performance.now() - startTime;
    
    // Return true if within budget (continue), false if exceeded (yield)
    return elapsed < this.config.timeBudgetMs;
  }

  /**
   * Generates a key for chunk coordinates
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Key string
   */
  private getKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }
}
