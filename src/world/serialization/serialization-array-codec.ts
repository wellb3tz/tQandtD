import { deflate, inflate } from 'pako';

declare const Buffer: {
  from(data: Uint8Array): { toString(encoding: 'base64'): string };
  from(data: string, encoding: 'base64'): { toString(encoding: 'binary'): string };
};

export function float32ArrayToBase64(array: Float32Array, compress: boolean): string {
  return bytesToBase64(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), compress);
}

export function uint8ArrayToBase64(array: Uint8Array, compress: boolean): string {
  return bytesToBase64(array, compress);
}

export function uint16ArrayToBase64(array: Uint16Array, compress: boolean): string {
  return bytesToBase64(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), compress);
}

export function base64ToFloat32Array(base64: string): Float32Array {
  const bytes = maybeDecompress(base64StringToUint8Array(base64));
  if (bytes.byteOffset % 4 !== 0) {
    const aligned = new Uint8Array(bytes.length);
    aligned.set(bytes);
    return new Float32Array(aligned.buffer, 0, aligned.byteLength / 4);
  }
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return maybeDecompress(base64StringToUint8Array(base64));
}

export function base64ToUint16Array(base64: string): Uint16Array {
  const bytes = maybeDecompress(base64StringToUint8Array(base64));
  if (bytes.byteOffset % 2 !== 0) {
    const aligned = new Uint8Array(bytes.length);
    aligned.set(bytes);
    return new Uint16Array(aligned.buffer, 0, aligned.byteLength / 2);
  }
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

export function base64StringToUint8Array(base64: string): Uint8Array {
  const binaryString = typeof atob !== 'undefined'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index++) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

export function serializeFloat32ArrayBinary(array: Float32Array, compress: boolean): ArrayBuffer {
  return serializeTypedArrayBinary(
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    array.length,
    0x01,
    compress
  );
}

export function serializeUint8ArrayBinary(array: Uint8Array, compress: boolean): ArrayBuffer {
  return serializeTypedArrayBinary(array, array.length, 0x02, compress);
}

export function serializeUint16ArrayBinary(array: Uint16Array, compress: boolean): ArrayBuffer {
  return serializeTypedArrayBinary(
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    array.length,
    0x03,
    compress
  );
}

export function deserializeFloat32ArrayBinary(buffer: ArrayBuffer): Float32Array {
  const { data, length } = deserializeTypedArrayBinary(buffer, 0x01, 'Float32Array', 4);
  return new Float32Array(data.buffer, data.byteOffset, length);
}

export function deserializeUint8ArrayBinary(buffer: ArrayBuffer): Uint8Array {
  const { data } = deserializeTypedArrayBinary(buffer, 0x02, 'Uint8Array', 1);
  return data;
}

export function deserializeUint16ArrayBinary(buffer: ArrayBuffer): Uint16Array {
  const { data, length } = deserializeTypedArrayBinary(buffer, 0x03, 'Uint16Array', 2);
  return new Uint16Array(data.buffer, data.byteOffset, length);
}

function bytesToBase64(data: Uint8Array, compress: boolean): string {
  const bytes = compress ? deflate(data) : data;
  let binaryString = '';
  for (let index = 0; index < bytes.length; index++) {
    binaryString += String.fromCharCode(bytes[index]);
  }
  return typeof btoa !== 'undefined'
    ? btoa(binaryString)
    : Buffer.from(bytes).toString('base64');
}

function maybeDecompress(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 2 && bytes[0] === 0x78) {
    try {
      return inflate(bytes);
    } catch {
      return bytes;
    }
  }
  return bytes;
}

function serializeTypedArrayBinary(
  data: Uint8Array,
  length: number,
  typeMarker: number,
  compress: boolean
): ArrayBuffer {
  const encoded = compress ? deflate(data) : data;
  const headerSize = compress ? 10 : 6;
  const buffer = new ArrayBuffer(headerSize + encoded.length);
  const view = new DataView(buffer);
  view.setUint8(0, typeMarker);
  view.setUint8(1, compress ? 0x01 : 0x00);
  view.setUint32(2, length, true);
  if (compress) {
    view.setUint32(6, encoded.length, true);
  }
  new Uint8Array(buffer).set(encoded, headerSize);
  return buffer;
}

function deserializeTypedArrayBinary(
  buffer: ArrayBuffer,
  expectedMarker: number,
  typeName: string,
  bytesPerElement: number
): { data: Uint8Array; length: number } {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const marker = view.getUint8(0);
  if (marker !== expectedMarker) {
    throw new Error(`Invalid type marker for ${typeName}: 0x${marker.toString(16)}`);
  }

  const length = view.getUint32(2, true);
  if (view.getUint8(1) === 0x01) {
    const compressedLength = view.getUint32(6, true);
    const data = inflate(bytes.slice(10, 10 + compressedLength));
    return { data, length };
  }

  return { data: bytes.slice(6, 6 + length * bytesPerElement), length };
}

