import type { ChunkData } from './world/chunk';

/**
 * Serialized chunk data that can be transferred via postMessage.
 * TypedArrays are sent as ArrayBuffers so Worker postMessage can transfer
 * ownership instead of cloning large numeric arrays.
 */
export interface SerializedChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: ArrayBuffer | ArrayLike<number>;
  biomeMap: ArrayBuffer | ArrayLike<number>;
  sparseBiomeTypes: ArrayBuffer | ArrayLike<number>;
  sparseBiomeWeights: ArrayBuffer | ArrayLike<number>;
  sparseBiomeOffsets: ArrayBuffer | ArrayLike<number>;
  climateSnowLine?: number;
  climateTreeLine?: number;
  worldTemperatureOffset?: number;
  temperatureMap?: ArrayBuffer | ArrayLike<number>;
  /** Serialized lake bodies - tiles stored as plain number arrays */
  lakes: Array<{
    waterLevel: number;
    tiles: number[];
    maxDepth: number;
    minTerrainHeight?: number;
    state?: 'filled' | 'frozen' | 'dry';
  }>;
  rivers: Array<{
    riverId: string;
    pathId: string;
    isTributary: boolean;
    state?: 'flowing' | 'frozen' | 'dry';
    points: Array<{
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
    }>;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }>;
  resources: Array<{
    x: number;
    y: number;
    type: number;
    amount: number;
  }>;
  structures: Array<{
    x: number;
    y: number;
    type: number;
  }>;
}

function toTransferableBuffer(view: ArrayBufferView): ArrayBuffer {
  if (
    view.buffer instanceof ArrayBuffer &&
    view.byteOffset === 0 &&
    view.byteLength === view.buffer.byteLength
  ) {
    return view.buffer;
  }

  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes.buffer;
}

/**
 * Serializes ChunkData for transfer via postMessage.
 * Keeps TypedArray backing buffers transferable.
 */
export function serializeChunkData(chunk: ChunkData): SerializedChunkData {
  return {
    x: chunk.x,
    y: chunk.y,
    size: chunk.size,
    heightmap: toTransferableBuffer(chunk.heightmap),
    biomeMap: toTransferableBuffer(chunk.biomeMap),
    sparseBiomeTypes: toTransferableBuffer(chunk.sparseBiomeTypes),
    sparseBiomeWeights: toTransferableBuffer(chunk.sparseBiomeWeights),
    sparseBiomeOffsets: toTransferableBuffer(chunk.sparseBiomeOffsets),
    climateSnowLine: chunk.climateSnowLine,
    climateTreeLine: chunk.climateTreeLine,
    worldTemperatureOffset: chunk.worldTemperatureOffset,
    temperatureMap: chunk.temperatureMap ? toTransferableBuffer(chunk.temperatureMap) : undefined,
    lakes: (chunk.lakes ?? []).map(lake => ({
      waterLevel: lake.waterLevel,
      tiles: Array.from(lake.tiles),
      maxDepth: lake.maxDepth,
      minTerrainHeight: lake.minTerrainHeight,
      state: lake.state,
    })),
    rivers: (chunk.rivers ?? []).map(river => ({
      riverId: river.riverId,
      pathId: river.pathId,
      isTributary: river.isTributary,
      state: river.state,
      points: river.points.map(point => ({ ...point })),
      bounds: river.bounds,
    })),
    resources: chunk.resources.map(r => ({
      x: r.x,
      y: r.y,
      type: r.type,
      amount: r.amount,
    })),
    structures: chunk.structures.map(s => ({
      x: s.x,
      y: s.y,
      type: s.type,
    })),
  };
}

/**
 * Returns transferable buffers for a serialized chunk payload.
 */
export function getChunkTransferList(serialized: SerializedChunkData): Transferable[] {
  const transfer: Transferable[] = [];
  const maybeAdd = (value: ArrayBuffer | ArrayLike<number>): void => {
    if (value instanceof ArrayBuffer) {
      transfer.push(value);
    }
  };

  maybeAdd(serialized.heightmap);
  maybeAdd(serialized.biomeMap);
  maybeAdd(serialized.sparseBiomeTypes);
  maybeAdd(serialized.sparseBiomeWeights);
  maybeAdd(serialized.sparseBiomeOffsets);
  if (serialized.temperatureMap) {
    maybeAdd(serialized.temperatureMap);
  }

  return transfer;
}

/**
 * Deserializes chunk data received from worker.
 * Converts transferred ArrayBuffers or legacy arrays back to TypedArrays.
 */
export function deserializeChunkData(serialized: SerializedChunkData): ChunkData {
  return {
    x: serialized.x,
    y: serialized.y,
    size: serialized.size,
    heightmap: new Float32Array(serialized.heightmap),
    biomeMap: new Uint8Array(serialized.biomeMap),
    sparseBiomeTypes: new Uint8Array(serialized.sparseBiomeTypes),
    sparseBiomeWeights: new Float32Array(serialized.sparseBiomeWeights),
    sparseBiomeOffsets: new Uint16Array(serialized.sparseBiomeOffsets),
    climateSnowLine: serialized.climateSnowLine,
    climateTreeLine: serialized.climateTreeLine,
    worldTemperatureOffset: serialized.worldTemperatureOffset,
    temperatureMap: serialized.temperatureMap ? new Float32Array(serialized.temperatureMap) : undefined,
    lakes: (serialized.lakes ?? []).map(lake => ({
      waterLevel: lake.waterLevel,
      tiles: new Set(lake.tiles),
      maxDepth: lake.maxDepth,
      minTerrainHeight: lake.minTerrainHeight,
      state: lake.state,
    })),
    rivers: (serialized.rivers ?? []).map(river => ({
      riverId: river.riverId,
      pathId: river.pathId,
      isTributary: river.isTributary,
      state: river.state,
      points: river.points.map(point => ({ ...point })),
      bounds: river.bounds,
    })),
    resources: serialized.resources,
    structures: serialized.structures,
  };
}
