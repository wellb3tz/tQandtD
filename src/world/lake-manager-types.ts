export type LakeState = 'filled' | 'frozen' | 'dry';

/**
 * A lake body that can span multiple chunks.
 * Uses world-space coordinates instead of chunk-local coordinates.
 */
export interface WorldLakeData {
  /** Unique identifier for this lake */
  id: string;
  /** Water surface elevation in [0, 1] heightmap space */
  waterLevel: number;
  /**
   * Set of world tile positions (encoded as "worldX,worldY" strings).
   * Each tile is in world coordinates, not chunk-local.
   */
  tiles: Set<string>;
  /** Maximum depth of the lake (waterLevel - min terrain height inside lake) */
  maxDepth: number;
  /** Minimum terrain height inside the lake (for consistent water positioning) */
  minTerrainHeight: number;
  /** Bounding box in world coordinates */
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  /** Climate-driven lake state; undefined when climate system is disabled. */
  state?: LakeState;
}
