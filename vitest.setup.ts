import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const globalScope = globalThis as typeof globalThis & {
  self?: typeof globalThis;
  createImageBitmap?: (blob: Blob, options?: unknown) => Promise<{ width: number; height: number; close: () => void }>;
  ProgressEvent?: typeof ProgressEvent;
};

globalScope.self ??= globalScope;

globalScope.ProgressEvent ??= class VitestProgressEvent extends Event {
  readonly lengthComputable: boolean;
  readonly loaded: number;
  readonly total: number;

  constructor(type: string, eventInit: ProgressEventInit = {}) {
    super(type, eventInit);
    this.lengthComputable = eventInit.lengthComputable ?? false;
    this.loaded = eventInit.loaded ?? 0;
    this.total = eventInit.total ?? 0;
  }
};

const originalFetch = globalThis.fetch?.bind(globalThis);
const blobUrlStore = new Map<string, Blob>();
let blobUrlId = 0;

URL.createObjectURL = (blob: Blob) => {
  const url = `blob:vitest-spruce-${++blobUrlId}`;
  blobUrlStore.set(url, blob);
  return url;
};

URL.revokeObjectURL = (url: string) => {
  blobUrlStore.delete(url);
};

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = input instanceof Request ? input.url : input.toString();
  const storedBlob = blobUrlStore.get(url);
  if (storedBlob) {
    return new Response(storedBlob, { status: 200 });
  }

  if (url.includes('spruce.glb')) {
    const path = url.startsWith('file:')
      ? fileURLToPath(url)
      : resolve('app/public/models/spruce.glb');
    const bytes = await readFile(path);
    return new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'model/gltf-binary' },
    });
  }

  if (!originalFetch) {
    throw new Error(`No fetch implementation is available for ${url}`);
  }
  return originalFetch(input, init);
};

globalScope.createImageBitmap ??= async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { width, height } = readImageSize(bytes);
  return {
    width,
    height,
    close: () => {},
  };
};

function readImageSize(bytes: Uint8Array): { width: number; height: number } {
  if (isPng(bytes)) {
    return {
      width: readUint32(bytes, 16),
      height: readUint32(bytes, 20),
    };
  }

  if (isJpeg(bytes)) {
    return readJpegSize(bytes);
  }

  return { width: 1, height: 1 };
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 24
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }

    offset += 2 + Math.max(2, length);
  }

  return { width: 1, height: 1 };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]
  ) >>> 0;
}
