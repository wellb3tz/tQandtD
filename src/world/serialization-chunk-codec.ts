import type { LakeData } from '../gen/lakes';
import type { RiverData, RiverPoint } from '../gen/rivers';
import type { ChunkData } from './chunk';
import {
  base64ToFloat32Array,
  base64ToUint16Array,
  base64ToUint8Array,
  deserializeFloat32ArrayBinary,
  deserializeUint16ArrayBinary,
  deserializeUint8ArrayBinary,
  float32ArrayToBase64,
  serializeFloat32ArrayBinary,
  serializeUint16ArrayBinary,
  serializeUint8ArrayBinary,
  uint16ArrayToBase64,
  uint8ArrayToBase64,
} from './serialization-array-codec';
import type { SerializedChunk, SerializedLake, SerializedRiver } from './serialization-types';

export function serializeChunkJSON(chunk: ChunkData, compress: boolean): SerializedChunk {
  return serializeChunk(chunk, {
    heightmap: float32ArrayToBase64(chunk.heightmap, compress),
    biomeMap: uint8ArrayToBase64(chunk.biomeMap, compress),
    sparseBiomeTypes: uint8ArrayToBase64(chunk.sparseBiomeTypes, compress),
    sparseBiomeWeights: float32ArrayToBase64(chunk.sparseBiomeWeights, compress),
    sparseBiomeOffsets: uint16ArrayToBase64(chunk.sparseBiomeOffsets, compress),
    temperatureMap: chunk.temperatureMap ? float32ArrayToBase64(chunk.temperatureMap, compress) : undefined,
  });
}

export function serializeChunkBinary(chunk: ChunkData, compress: boolean): SerializedChunk {
  return serializeChunk(chunk, {
    heightmap: serializeFloat32ArrayBinary(chunk.heightmap, compress),
    biomeMap: serializeUint8ArrayBinary(chunk.biomeMap, compress),
    sparseBiomeTypes: serializeUint8ArrayBinary(chunk.sparseBiomeTypes, compress),
    sparseBiomeWeights: serializeFloat32ArrayBinary(chunk.sparseBiomeWeights, compress),
    sparseBiomeOffsets: serializeUint16ArrayBinary(chunk.sparseBiomeOffsets, compress),
    temperatureMap: chunk.temperatureMap ? serializeFloat32ArrayBinary(chunk.temperatureMap, compress) : undefined,
  });
}

export function deserializeChunkJSON(serializedChunk: SerializedChunk, chunkSize: number): ChunkData {
  return deserializeChunk(
    serializedChunk,
    chunkSize,
    base64ToFloat32Array(serializedChunk.heightmap as string),
    base64ToUint8Array(serializedChunk.biomeMap as string),
    restoreSparseBiomeData(
    serializedChunk,
    value => base64ToUint8Array(value as string),
    value => base64ToFloat32Array(value as string),
    value => base64ToUint16Array(value as string)
    ),
    serializedChunk.temperatureMap
      ? base64ToFloat32Array(serializedChunk.temperatureMap as string)
      : undefined
  );
}

export function deserializeChunkBinary(serializedChunk: SerializedChunk, chunkSize: number): ChunkData {
  return deserializeChunk(
    serializedChunk,
    chunkSize,
    deserializeFloat32ArrayBinary(serializedChunk.heightmap as ArrayBuffer),
    deserializeUint8ArrayBinary(serializedChunk.biomeMap as ArrayBuffer),
    restoreSparseBiomeData(
      serializedChunk,
      value => deserializeUint8ArrayBinary(value as ArrayBuffer),
      value => deserializeFloat32ArrayBinary(value as ArrayBuffer),
      value => deserializeUint16ArrayBinary(value as ArrayBuffer)
    ),
    serializedChunk.temperatureMap
      ? deserializeFloat32ArrayBinary(serializedChunk.temperatureMap as ArrayBuffer)
      : undefined
  );
}

interface EncodedChunkArrays {
  heightmap: ArrayBuffer | string;
  biomeMap: ArrayBuffer | string;
  sparseBiomeTypes: ArrayBuffer | string;
  sparseBiomeWeights: ArrayBuffer | string;
  sparseBiomeOffsets: ArrayBuffer | string;
  temperatureMap?: ArrayBuffer | string;
}

interface SparseBiomeData {
  sparseBiomeTypes: Uint8Array;
  sparseBiomeWeights: Float32Array;
  sparseBiomeOffsets: Uint16Array;
}

function serializeChunk(chunk: ChunkData, arrays: EncodedChunkArrays): SerializedChunk {
  return {
    x: chunk.x,
    y: chunk.y,
    heightmap: arrays.heightmap,
    biomeMap: arrays.biomeMap,
    sparseBiomeTypes: arrays.sparseBiomeTypes,
    sparseBiomeWeights: arrays.sparseBiomeWeights,
    sparseBiomeOffsets: arrays.sparseBiomeOffsets,
    climateSnowLine: chunk.climateSnowLine,
    climateTreeLine: chunk.climateTreeLine,
    worldTemperatureOffset: chunk.worldTemperatureOffset,
    temperatureMap: arrays.temperatureMap,
    resources: chunk.resources,
    structures: chunk.structures,
    lakes: serializeLakes(chunk),
    rivers: serializeRivers(chunk),
  };
}

function deserializeChunk(
  serializedChunk: SerializedChunk,
  chunkSize: number,
  heightmap: Float32Array,
  biomeMap: Uint8Array,
  sparseBiomeData: SparseBiomeData,
  temperatureMap?: Float32Array
): ChunkData {
  return {
    x: serializedChunk.x,
    y: serializedChunk.y,
    size: chunkSize,
    heightmap,
    biomeMap,
    ...sparseBiomeData,
    climateSnowLine: serializedChunk.climateSnowLine,
    climateTreeLine: serializedChunk.climateTreeLine,
    worldTemperatureOffset: serializedChunk.worldTemperatureOffset,
    temperatureMap,
    lakes: deserializeLakes(serializedChunk),
    rivers: deserializeRivers(serializedChunk),
    resources: serializedChunk.resources,
    structures: serializedChunk.structures,
  };
}

function restoreSparseBiomeData(
  serializedChunk: SerializedChunk,
  readTypes: (value: ArrayBuffer | string) => Uint8Array,
  readWeights: (value: ArrayBuffer | string) => Float32Array,
  readOffsets: (value: ArrayBuffer | string) => Uint16Array
): SparseBiomeData {
  if (
    serializedChunk.sparseBiomeTypes !== undefined &&
    serializedChunk.sparseBiomeWeights !== undefined &&
    serializedChunk.sparseBiomeOffsets !== undefined
  ) {
    return {
      sparseBiomeTypes: readTypes(serializedChunk.sparseBiomeTypes),
      sparseBiomeWeights: readWeights(serializedChunk.sparseBiomeWeights),
      sparseBiomeOffsets: readOffsets(serializedChunk.sparseBiomeOffsets),
    };
  }

  const biomeMap = typeof serializedChunk.biomeMap === 'string'
    ? base64ToUint8Array(serializedChunk.biomeMap)
    : deserializeUint8ArrayBinary(serializedChunk.biomeMap);
  const types: number[] = [];
  const weights: number[] = [];
  const offsets: number[] = [];
  for (let index = 0; index < biomeMap.length; index++) {
    offsets.push(types.length);
    types.push(biomeMap[index]);
    weights.push(1.0);
  }
  return {
    sparseBiomeTypes: new Uint8Array(types),
    sparseBiomeWeights: new Float32Array(weights),
    sparseBiomeOffsets: new Uint16Array(offsets),
  };
}

function serializeLakes(chunk: ChunkData): SerializedLake[] {
  return (chunk.lakes ?? []).map(lake => ({
    waterLevel: lake.waterLevel,
    tiles: Array.from(lake.tiles),
    maxDepth: lake.maxDepth,
    minTerrainHeight: lake.minTerrainHeight,
    state: lake.state,
  }));
}

function serializeRivers(chunk: ChunkData): SerializedRiver[] {
  return (chunk.rivers ?? []).map(river => ({
    riverId: river.riverId,
    pathId: river.pathId,
    isTributary: river.isTributary,
    state: river.state,
    points: river.points.map(point => ({ ...point })),
    bounds: river.bounds,
  }));
}

function deserializeLakes(serializedChunk: SerializedChunk): LakeData[] {
  return (serializedChunk.lakes ?? []).map(lake => ({
    waterLevel: lake.waterLevel,
    tiles: new Set(lake.tiles),
    maxDepth: lake.maxDepth,
    minTerrainHeight: lake.minTerrainHeight,
    state: lake.state,
  }));
}

function deserializeRivers(serializedChunk: SerializedChunk): RiverData[] {
  return (serializedChunk.rivers ?? []).map(river => ({
    riverId: river.riverId,
    pathId: river.pathId,
    isTributary: river.isTributary,
    state: river.state,
    points: river.points.map((point: RiverPoint) => ({ ...point })),
    bounds: river.bounds,
  }));
}
