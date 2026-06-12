import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const modelDir = path.join(repoRoot, 'app', 'public', 'models');
const sourceDir = path.join(modelDir, 'high-poly-source');

const modelConfigs = {
  'spruce.glb': { targetTriangles: 3000, normalWeight: 0.03, uvWeight: 12.0, targetError: 0.12 },
  'palm.glb': { targetTriangles: 3000, normalWeight: 0.03, uvWeight: 12.0, targetError: 0.12 },
  'shrub.glb': { targetTriangles: 3000, normalWeight: 0.03, uvWeight: 12.0, targetError: 0.12 },
  'mushroom.glb': { targetTriangles: 3000, normalWeight: 0.03, uvWeight: 12.0, targetError: 0.12 },
};

const requestedFiles = new Set(process.argv.slice(2));

const componentSizes = new Map([
  [5120, 1],
  [5121, 1],
  [5122, 2],
  [5123, 2],
  [5125, 4],
  [5126, 4],
]);

const componentCounts = new Map([
  ['SCALAR', 1],
  ['VEC2', 2],
  ['VEC3', 3],
  ['VEC4', 4],
  ['MAT2', 4],
  ['MAT3', 9],
  ['MAT4', 16],
]);

await MeshoptSimplifier.ready;
await mkdir(sourceDir, { recursive: true });

for (const [fileName, config] of Object.entries(modelConfigs)) {
  if (requestedFiles.size > 0 && !requestedFiles.has(fileName)) continue;

  const activePath = path.join(modelDir, fileName);
  const sourcePath = path.join(sourceDir, fileName);

  await ensureSourceBackup(activePath, sourcePath);
  const sourceBuffer = await readFile(sourcePath);
  const before = readGlb(sourceBuffer);
  const beforeStats = getMeshStats(before.json);
  const result = simplifyGlb(before, config);
  await writeFile(activePath, result.buffer);

  console.log(JSON.stringify({
    file: fileName,
    source: path.relative(repoRoot, sourcePath),
    bytesBefore: sourceBuffer.byteLength,
    bytesAfter: result.buffer.byteLength,
    trianglesBefore: beforeStats.triangles,
    trianglesAfter: result.stats.triangles,
    verticesBefore: beforeStats.vertices,
    verticesAfter: result.stats.vertices,
    targetTriangles: config.targetTriangles,
  }));
}

async function ensureSourceBackup(activePath, sourcePath) {
  try {
    await readFile(sourcePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await copyFile(activePath, sourcePath);
  }
}

function readGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Expected a binary GLB file');
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version ${version}`);
  }

  let offset = 12;
  let json;
  let bin = Buffer.alloc(0);

  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(chunk.toString('utf8').replace(/\u0000+$/g, '').trimEnd());
    } else if (chunkType === 0x004e4942) {
      bin = chunk;
    }
  }

  if (!json) throw new Error('GLB does not contain a JSON chunk');
  return { json, bin };
}

function simplifyGlb(glb, config) {
  const json = structuredClone(glb.json);
  const oldAccessors = glb.json.accessors ?? [];
  const oldBufferViews = glb.json.bufferViews ?? [];
  const bufferParts = [];
  const bufferViews = [];
  const accessors = [];

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if ((primitive.mode ?? 4) !== 4) {
        throw new Error('Only triangle mesh primitives are supported');
      }

      const oldPositionAccessorIndex = primitive.attributes?.POSITION;
      if (oldPositionAccessorIndex === undefined) {
        throw new Error('Primitive is missing POSITION data');
      }

      const positions = readAccessorAsFloatArray(glb, oldPositionAccessorIndex);
      const normals = primitive.attributes?.NORMAL !== undefined
        ? readAccessorAsFloatArray(glb, primitive.attributes.NORMAL)
        : null;
      const uvs = primitive.attributes?.TEXCOORD_0 !== undefined
        ? readAccessorAsFloatArray(glb, primitive.attributes.TEXCOORD_0)
        : null;
      const indices = primitive.indices !== undefined
        ? readAccessorAsIndexArray(glb, primitive.indices)
        : createSequentialIndices(oldAccessors[oldPositionAccessorIndex].count);

      const vertexCount = oldAccessors[oldPositionAccessorIndex].count;
      const attributes = packSimplifierAttributes(vertexCount, normals, uvs);
      const attributeWeights = [
        ...(normals ? [config.normalWeight, config.normalWeight, config.normalWeight] : []),
        ...(uvs ? [config.uvWeight, config.uvWeight] : []),
      ];
      const targetIndexCount = Math.max(3, config.targetTriangles * 3);
      const [simplified] = MeshoptSimplifier.simplifyWithAttributes(
        indices,
        positions,
        3,
        attributes,
        normals && uvs ? 5 : normals ? 3 : uvs ? 2 : 0,
        attributeWeights,
        null,
        targetIndexCount,
        config.targetError,
        ['LockBorder', 'Regularize'],
      );

      const compactIndices = new Uint32Array(simplified);
      const [remap, compactVertexCount] = MeshoptSimplifier.compactMesh(compactIndices);
      const compactPositions = remapFloatAttribute(positions, 3, remap, compactVertexCount);
      const compactNormals = normals ? remapFloatAttribute(normals, 3, remap, compactVertexCount) : null;
      const compactUvs = uvs ? remapFloatAttribute(uvs, 2, remap, compactVertexCount) : null;

      const positionAccessor = addFloatAccessor(bufferParts, bufferViews, accessors, compactPositions, 'VEC3', 34962);
      const attributesOut = { POSITION: positionAccessor };
      if (compactNormals) {
        attributesOut.NORMAL = addFloatAccessor(bufferParts, bufferViews, accessors, compactNormals, 'VEC3', 34962);
      }
      if (compactUvs) {
        attributesOut.TEXCOORD_0 = addFloatAccessor(bufferParts, bufferViews, accessors, compactUvs, 'VEC2', 34962);
      }

      primitive.attributes = attributesOut;
      primitive.indices = addIndexAccessor(bufferParts, bufferViews, accessors, compactIndices);
    }
  }

  for (const image of json.images ?? []) {
    if (image.bufferView === undefined) continue;
    const sourceView = oldBufferViews[image.bufferView];
    const sourceOffset = sourceView.byteOffset ?? 0;
    const bytes = glb.bin.subarray(sourceOffset, sourceOffset + sourceView.byteLength);
    image.bufferView = addBufferView(bufferParts, bufferViews, bytes);
  }

  const bin = concatAligned(bufferParts);
  json.bufferViews = bufferViews;
  json.accessors = accessors;
  json.buffers = [{ byteLength: bin.byteLength }];
  delete json.extensionsRequired;
  delete json.extensionsUsed;

  const buffer = writeGlb(json, bin);
  return { buffer, stats: getMeshStats(json) };
}

function packSimplifierAttributes(vertexCount, normals, uvs) {
  const stride = (normals ? 3 : 0) + (uvs ? 2 : 0);
  if (stride === 0) return new Float32Array();

  const attributes = new Float32Array(vertexCount * stride);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    let offset = vertex * stride;
    if (normals) {
      attributes[offset++] = normals[vertex * 3];
      attributes[offset++] = normals[vertex * 3 + 1];
      attributes[offset++] = normals[vertex * 3 + 2];
    }
    if (uvs) {
      attributes[offset++] = uvs[vertex * 2];
      attributes[offset++] = uvs[vertex * 2 + 1];
    }
  }
  return attributes;
}

function remapFloatAttribute(source, stride, remap, compactVertexCount) {
  const missing = 2 ** 32 - 1;
  const compact = new Float32Array(compactVertexCount * stride);

  for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
    const newIndex = remap[oldIndex];
    if (newIndex === missing) continue;
    for (let component = 0; component < stride; component++) {
      compact[newIndex * stride + component] = source[oldIndex * stride + component];
    }
  }

  return compact;
}

function addFloatAccessor(bufferParts, bufferViews, accessors, array, type, target) {
  const byteOffset = getCurrentAlignedLength(bufferParts);
  const bytes = Buffer.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  bufferParts.push(bytes);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target });
  const accessor = {
    bufferView: bufferViews.length - 1,
    byteOffset: 0,
    componentType: 5126,
    count: array.length / componentCounts.get(type),
    type,
  };
  if (type === 'VEC3') {
    const { min, max } = getMinMax(array, 3);
    accessor.min = min;
    accessor.max = max;
  }
  accessors.push(accessor);
  return accessors.length - 1;
}

function addIndexAccessor(bufferParts, bufferViews, accessors, indices) {
  const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
  const typed = maxIndex <= 65535 ? Uint16Array.from(indices) : Uint32Array.from(indices);
  const componentType = typed instanceof Uint16Array ? 5123 : 5125;
  const byteOffset = getCurrentAlignedLength(bufferParts);
  const bytes = Buffer.from(new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength));
  bufferParts.push(bytes);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target: 34963 });
  accessors.push({
    bufferView: bufferViews.length - 1,
    byteOffset: 0,
    componentType,
    count: typed.length,
    type: 'SCALAR',
    min: [0],
    max: [maxIndex],
  });
  return accessors.length - 1;
}

function addBufferView(bufferParts, bufferViews, bytes) {
  const byteOffset = getCurrentAlignedLength(bufferParts);
  bufferParts.push(Buffer.from(bytes));
  bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength });
  return bufferViews.length - 1;
}

function getCurrentAlignedLength(parts) {
  return parts.reduce((length, part) => align4(length) + part.byteLength, 0);
}

function concatAligned(parts) {
  const buffers = [];
  let offset = 0;

  for (const part of parts) {
    const aligned = align4(offset);
    if (aligned > offset) {
      buffers.push(Buffer.alloc(aligned - offset));
      offset = aligned;
    }
    buffers.push(part);
    offset += part.byteLength;
  }

  return Buffer.concat(buffers);
}

function writeGlb(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadded = padBuffer(jsonBytes, 0x20);
  const binPadded = padBuffer(bin, 0x00);
  const totalLength = 12 + 8 + jsonPadded.byteLength + 8 + binPadded.byteLength;
  const output = Buffer.alloc(totalLength);

  output.write('glTF', 0, 4, 'utf8');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonPadded.byteLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonPadded.copy(output, 20);
  const binHeaderOffset = 20 + jsonPadded.byteLength;
  output.writeUInt32LE(binPadded.byteLength, binHeaderOffset);
  output.writeUInt32LE(0x004e4942, binHeaderOffset + 4);
  binPadded.copy(output, binHeaderOffset + 8);
  return output;
}

function padBuffer(buffer, padByte) {
  const paddedLength = align4(buffer.byteLength);
  if (paddedLength === buffer.byteLength) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(paddedLength - buffer.byteLength, padByte)]);
}

function align4(value) {
  return (value + 3) & ~3;
}

function getMinMax(array, stride) {
  const min = Array.from({ length: stride }, () => Number.POSITIVE_INFINITY);
  const max = Array.from({ length: stride }, () => Number.NEGATIVE_INFINITY);

  for (let index = 0; index < array.length; index += stride) {
    for (let component = 0; component < stride; component++) {
      const value = array[index + component];
      min[component] = Math.min(min[component], value);
      max[component] = Math.max(max[component], value);
    }
  }

  return { min, max };
}

function readAccessorAsFloatArray(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const componentCount = componentCounts.get(accessor.type);
  const result = new Float32Array(accessor.count * componentCount);
  readAccessorComponents(glb, accessor, componentCount, (value, outputIndex) => {
    result[outputIndex] = value;
  });
  return result;
}

function readAccessorAsIndexArray(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const result = new Uint32Array(accessor.count);
  readAccessorComponents(glb, accessor, 1, (value, outputIndex) => {
    result[outputIndex] = value;
  });
  return result;
}

function readAccessorComponents(glb, accessor, componentCount, write) {
  const bufferView = glb.json.bufferViews[accessor.bufferView];
  const componentSize = componentSizes.get(accessor.componentType);
  const elementSize = componentSize * componentCount;
  const stride = bufferView.byteStride ?? elementSize;
  const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const view = new DataView(glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength);

  for (let element = 0; element < accessor.count; element++) {
    for (let component = 0; component < componentCount; component++) {
      const byteOffset = baseOffset + element * stride + component * componentSize;
      write(readComponent(view, byteOffset, accessor.componentType, accessor.normalized === true), element * componentCount + component);
    }
  }
}

function readComponent(view, byteOffset, componentType, normalized) {
  let value;
  switch (componentType) {
    case 5120:
      value = view.getInt8(byteOffset);
      return normalized ? Math.max(value / 127, -1) : value;
    case 5121:
      value = view.getUint8(byteOffset);
      return normalized ? value / 255 : value;
    case 5122:
      value = view.getInt16(byteOffset, true);
      return normalized ? Math.max(value / 32767, -1) : value;
    case 5123:
      value = view.getUint16(byteOffset, true);
      return normalized ? value / 65535 : value;
    case 5125:
      return view.getUint32(byteOffset, true);
    case 5126:
      return view.getFloat32(byteOffset, true);
    default:
      throw new Error(`Unsupported component type ${componentType}`);
  }
}

function createSequentialIndices(vertexCount) {
  return Uint32Array.from({ length: vertexCount }, (_, index) => index);
}

function getMeshStats(json) {
  let vertices = 0;
  let triangles = 0;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessorIndex = primitive.attributes?.POSITION;
      if (positionAccessorIndex !== undefined) {
        vertices += json.accessors?.[positionAccessorIndex]?.count ?? 0;
      }
      if (primitive.indices !== undefined) {
        triangles += Math.floor((json.accessors?.[primitive.indices]?.count ?? 0) / 3);
      } else if (positionAccessorIndex !== undefined) {
        triangles += Math.floor((json.accessors?.[positionAccessorIndex]?.count ?? 0) / 3);
      }
    }
  }

  return { vertices, triangles };
}
