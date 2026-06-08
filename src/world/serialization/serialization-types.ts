import type { Resource, Structure, ChunkData } from '../chunk';
import type { WorldConfig } from '../world-config';

export interface ChunkManagerSnapshot {
  readonly config: WorldConfig;
  readonly cache: ReadonlyMap<string, { chunk: ChunkData; lastAccessed: number }>;
  readonly modifications: ReadonlyMap<string, ChunkModification>;
  accessCounter: number;
  recordModification(chunkX: number, chunkY: number, mod: ChunkModification): void;
}

export enum SerializationFormat {
  JSON = 'json',
  BINARY = 'binary',
}

export interface SerializationOptions {
  format: SerializationFormat;
  compress: boolean;
  modifiedOnly?: boolean;
  region?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface ChunkModification {
  chunkX: number;
  chunkY: number;
  timestamp: number;
  modifiedTiles: Set<number>;
  heightChanges: Map<number, number>;
  addedStructures: Structure[];
  removedStructures: number[];
}

export interface SerializedWorld {
  version: string;
  seed: number;
  config: WorldConfig;
  chunks: SerializedChunk[];
  modifications: ChunkModification[];
  checksum: string;
}

export interface SerializedLake {
  waterLevel: number;
  tiles: number[];
  surfaceTiles?: number[];
  maxDepth: number;
  minTerrainHeight?: number;
  state?: 'filled' | 'frozen' | 'dry';
}

export interface SerializedRiverPoint {
  x: number;
  y: number;
  height: number;
  surfaceLevel: number;
  width: number;
  depth: number;
  flow?: number;
  channelWidth?: number;
  valleyWidth?: number;
  channelDepth?: number;
  valleyDepth?: number;
  flowX: number;
  flowY: number;
}

export interface SerializedRiver {
  riverId: string;
  pathId: string;
  isTributary: boolean;
  state?: 'flowing' | 'frozen' | 'dry';
  points: SerializedRiverPoint[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface SerializedChunk {
  x: number;
  y: number;
  heightmap: ArrayBuffer | string;
  biomeMap: ArrayBuffer | string;
  sparseBiomeTypes?: ArrayBuffer | string;
  sparseBiomeWeights?: ArrayBuffer | string;
  sparseBiomeOffsets?: ArrayBuffer | string;
  climateSnowLine?: number;
  climateTreeLine?: number;
  worldTemperatureOffset?: number;
  temperatureMap?: ArrayBuffer | string;
  resources: Resource[];
  structures: Structure[];
  lakes: SerializedLake[];
  rivers: SerializedRiver[];
}
