import type {
  ChunkModification,
  SerializedChunk,
  SerializedLake,
  SerializedRiver,
  SerializedWorld,
} from './serialization-types';

const WORLD_BINARY_MAGIC = 0x57524C44; // "WRLD"
const WORLD_BINARY_CHUNK_META_MARKER = 0x434D4554; // "CMET"

export function serializeWorldToBinary(world: SerializedWorld): ArrayBuffer {
  const encoder = new TextEncoder();
  const versionBytes = encoder.encode(world.version);
  const configBytes = encodeJSON(encoder, world.config);
  const checksumBytes = encoder.encode(world.checksum);
  const chunkSize = world.chunks.reduce((size, chunk) => size + getSerializedChunkSize(chunk, encoder), 0);
  const modificationsSize = world.modifications.reduce((size, mod) => size + getModificationSize(mod, encoder), 0);
  const totalSize = 4 + 4 + versionBytes.length + 8 + 4 + configBytes.length +
    4 + chunkSize + 4 + modificationsSize + 4 + checksumBytes.length;
  const writer = new BinaryWriter(totalSize);

  writer.writeUint32(WORLD_BINARY_MAGIC);
  writer.writeBytesWithLength(versionBytes);
  writer.writeUint64(world.seed);
  writer.writeBytesWithLength(configBytes);
  writer.writeUint32(world.chunks.length);
  for (const chunk of world.chunks) {
    writeChunk(writer, chunk, encoder);
  }
  writer.writeUint32(world.modifications.length);
  for (const modification of world.modifications) {
    writeModification(writer, modification, encoder);
  }
  writer.writeBytesWithLength(checksumBytes);
  return writer.buffer;
}

export function deserializeWorldFromBinary(buffer: ArrayBuffer): SerializedWorld {
  const reader = new BinaryReader(buffer);
  if (reader.readUint32() !== WORLD_BINARY_MAGIC) {
    throw new Error('Invalid binary format: magic number mismatch');
  }

  const version = reader.readString();
  const seed = reader.readUint64();
  const config = reader.readJSON();
  const chunks: SerializedChunk[] = [];
  const chunkCount = reader.readUint32();
  for (let index = 0; index < chunkCount; index++) {
    chunks.push(readChunk(reader));
  }

  const modifications: ChunkModification[] = [];
  const modificationsCount = reader.readUint32();
  for (let index = 0; index < modificationsCount; index++) {
    modifications.push(readModification(reader));
  }

  return {
    version,
    seed,
    config,
    chunks,
    modifications,
    checksum: reader.readString(),
  };
}

function getSerializedChunkSize(chunk: SerializedChunk, encoder: TextEncoder): number {
  const meta = encodeJSON(encoder, getChunkMeta(chunk));
  return 4 + 4 +
    getBufferSize(chunk.heightmap) + getBufferSize(chunk.biomeMap) +
    getJSONSize(chunk.resources, encoder) + getJSONSize(chunk.structures, encoder) +
    getJSONSize(chunk.lakes ?? [], encoder) + getJSONSize(chunk.rivers ?? [], encoder) +
    4 + 4 + meta.length +
    getOptionalBufferSize(chunk.temperatureMap) +
    getOptionalBufferSize(chunk.sparseBiomeTypes) +
    getOptionalBufferSize(chunk.sparseBiomeWeights) +
    getOptionalBufferSize(chunk.sparseBiomeOffsets);
}

function getModificationSize(modification: ChunkModification, encoder: TextEncoder): number {
  return 4 + 4 + 8 +
    4 + modification.modifiedTiles.size * 4 +
    4 + modification.heightChanges.size * 8 +
    getJSONSize(modification.addedStructures, encoder) +
    4 + modification.removedStructures.length * 4;
}

function writeChunk(writer: BinaryWriter, chunk: SerializedChunk, encoder: TextEncoder): void {
  writer.writeInt32(chunk.x);
  writer.writeInt32(chunk.y);
  writer.writeBuffer(chunk.heightmap as ArrayBuffer);
  writer.writeBuffer(chunk.biomeMap as ArrayBuffer);
  writer.writeJSON(chunk.resources, encoder);
  writer.writeJSON(chunk.structures, encoder);
  writer.writeJSON(chunk.lakes ?? [], encoder);
  writer.writeJSON(chunk.rivers ?? [], encoder);
  writer.writeUint32(WORLD_BINARY_CHUNK_META_MARKER);
  writer.writeJSON(getChunkMeta(chunk), encoder);
  writer.writeOptionalBuffer(chunk.temperatureMap);
  writer.writeOptionalBuffer(chunk.sparseBiomeTypes);
  writer.writeOptionalBuffer(chunk.sparseBiomeWeights);
  writer.writeOptionalBuffer(chunk.sparseBiomeOffsets);
}

function readChunk(reader: BinaryReader): SerializedChunk {
  const x = reader.readInt32();
  const y = reader.readInt32();
  const heightmap = reader.readBuffer();
  const biomeMap = reader.readBuffer();
  const resources = reader.readJSON();
  const structures = reader.readJSON();
  const lakes: SerializedLake[] = reader.readJSON();
  const rivers: SerializedRiver[] = reader.readJSON();
  let meta: Pick<SerializedChunk, 'climateSnowLine' | 'climateTreeLine' | 'worldTemperatureOffset'> = {};
  let temperatureMap: ArrayBuffer | undefined;
  let sparseBiomeTypes: ArrayBuffer | undefined;
  let sparseBiomeWeights: ArrayBuffer | undefined;
  let sparseBiomeOffsets: ArrayBuffer | undefined;

  if (reader.peekUint32() === WORLD_BINARY_CHUNK_META_MARKER) {
    reader.readUint32();
    meta = reader.readJSON();
    temperatureMap = reader.readOptionalBuffer();
    sparseBiomeTypes = reader.readOptionalBuffer();
    sparseBiomeWeights = reader.readOptionalBuffer();
    sparseBiomeOffsets = reader.readOptionalBuffer();
  }

  return {
    x,
    y,
    heightmap,
    biomeMap,
    sparseBiomeTypes,
    sparseBiomeWeights,
    sparseBiomeOffsets,
    ...meta,
    temperatureMap,
    resources,
    structures,
    lakes,
    rivers,
  };
}

function writeModification(writer: BinaryWriter, modification: ChunkModification, encoder: TextEncoder): void {
  writer.writeInt32(modification.chunkX);
  writer.writeInt32(modification.chunkY);
  writer.writeUint64(modification.timestamp);
  writer.writeUint32(modification.modifiedTiles.size);
  for (const tile of modification.modifiedTiles) {
    writer.writeInt32(tile);
  }
  writer.writeUint32(modification.heightChanges.size);
  for (const [index, height] of modification.heightChanges) {
    writer.writeInt32(index);
    writer.writeFloat32(height);
  }
  writer.writeJSON(modification.addedStructures, encoder);
  writer.writeUint32(modification.removedStructures.length);
  for (const index of modification.removedStructures) {
    writer.writeInt32(index);
  }
}

function readModification(reader: BinaryReader): ChunkModification {
  const chunkX = reader.readInt32();
  const chunkY = reader.readInt32();
  const timestamp = reader.readUint64();
  const modifiedTiles = new Set<number>();
  const tileCount = reader.readUint32();
  for (let index = 0; index < tileCount; index++) {
    modifiedTiles.add(reader.readInt32());
  }
  const heightChanges = new Map<number, number>();
  const heightChangeCount = reader.readUint32();
  for (let index = 0; index < heightChangeCount; index++) {
    heightChanges.set(reader.readInt32(), reader.readFloat32());
  }
  const addedStructures = reader.readJSON();
  const removedStructures: number[] = [];
  const removedCount = reader.readUint32();
  for (let index = 0; index < removedCount; index++) {
    removedStructures.push(reader.readInt32());
  }
  return { chunkX, chunkY, timestamp, modifiedTiles, heightChanges, addedStructures, removedStructures };
}

function getChunkMeta(chunk: SerializedChunk): object {
  return {
    climateSnowLine: chunk.climateSnowLine,
    climateTreeLine: chunk.climateTreeLine,
    worldTemperatureOffset: chunk.worldTemperatureOffset,
  };
}

function encodeJSON(encoder: TextEncoder, value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function getJSONSize(value: unknown, encoder: TextEncoder): number {
  return 4 + encodeJSON(encoder, value).length;
}

function getBufferSize(value: ArrayBuffer | string): number {
  return 4 + (value as ArrayBuffer).byteLength;
}

function getOptionalBufferSize(value: ArrayBuffer | string | undefined): number {
  return 4 + (value instanceof ArrayBuffer ? value.byteLength : 0);
}

class BinaryWriter {
  readonly buffer: ArrayBuffer;
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private offset = 0;

  constructor(size: number) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
  }

  writeUint32(value: number): void {
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  writeInt32(value: number): void {
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat32(value: number): void {
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  writeUint64(value: number): void {
    this.writeUint32(Math.floor(value / 0x100000000));
    this.writeUint32(value >>> 0);
  }

  writeBytesWithLength(value: Uint8Array): void {
    this.writeUint32(value.length);
    this.bytes.set(value, this.offset);
    this.offset += value.length;
  }

  writeJSON(value: unknown, encoder: TextEncoder): void {
    this.writeBytesWithLength(encodeJSON(encoder, value));
  }

  writeBuffer(value: ArrayBuffer): void {
    this.writeBytesWithLength(new Uint8Array(value));
  }

  writeOptionalBuffer(value: ArrayBuffer | string | undefined): void {
    if (value instanceof ArrayBuffer) {
      this.writeBuffer(value);
    } else {
      this.writeUint32(0);
    }
  }
}

class BinaryReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private readonly decoder = new TextDecoder();
  private offset = 0;

  constructor(private readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  peekUint32(): number {
    return this.view.getUint32(this.offset, true);
  }

  readUint32(): number {
    const value = this.peekUint32();
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readUint64(): number {
    return this.readUint32() * 0x100000000 + this.readUint32();
  }

  readBytes(): Uint8Array {
    const length = this.readUint32();
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readString(): string {
    return this.decoder.decode(this.readBytes());
  }

  readJSON<T = any>(): T {
    return JSON.parse(this.readString()) as T;
  }

  readBuffer(): ArrayBuffer {
    const length = this.readUint32();
    const value = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readOptionalBuffer(): ArrayBuffer | undefined {
    const length = this.readUint32();
    if (length === 0) {
      return undefined;
    }
    const value = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}

