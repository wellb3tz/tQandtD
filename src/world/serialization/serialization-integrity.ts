import type { SerializedWorld } from './serialization-types';

let crc32Table: number[] | null = null;

export function validateSerializedWorld(data: any): void {
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

  for (let index = 0; index < data.chunks.length; index++) {
    const chunk = data.chunks[index];
    if (typeof chunk.x !== 'number' || typeof chunk.y !== 'number') {
      throw new Error(`Invalid chunk at index ${index}: x and y must be numbers`);
    }
    if (!chunk.heightmap || !chunk.biomeMap) {
      throw new Error(`Invalid chunk at index ${index}: heightmap and biomeMap are required`);
    }
    if (!Array.isArray(chunk.resources) || !Array.isArray(chunk.structures)) {
      throw new Error(`Invalid chunk at index ${index}: resources and structures must be arrays`);
    }
  }
}

export function calculateChecksum(data: SerializedWorld): string {
  const dataForChecksum = {
    version: data.version,
    seed: data.seed,
    config: data.config,
    chunks: data.chunks,
    modifications: data.modifications,
  };
  return crc32(new TextEncoder().encode(JSON.stringify(dataForChecksum)))
    .toString(16)
    .padStart(8, '0');
}

export function validateChecksum(data: SerializedWorld): boolean {
  return data.checksum === calculateChecksum(data);
}

function crc32(data: Uint8Array): number {
  initCRC32Table();
  const table = crc32Table!;
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < data.length; index++) {
    crc = table[(crc ^ data[index]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function initCRC32Table(): void {
  if (crc32Table !== null) {
    return;
  }

  const table: number[] = [];
  for (let index = 0; index < 256; index++) {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc;
  }
  crc32Table = table;
}

