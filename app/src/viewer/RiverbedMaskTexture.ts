import * as THREE from 'three';
import { getRiverChannelWidth, type ChunkData, type RiverPoint } from '@engine/index';

export const RIVERBED_MASK_TEXTURE_SIZE = 128;

const EMPTY_FLOW_X = 0.5;
const EMPTY_FLOW_Y = 0.5;

export function createRiverbedMaskTexture(
  data: ChunkData,
  textureSize = RIVERBED_MASK_TEXTURE_SIZE,
): THREE.DataTexture {
  const pixels = new Uint8Array(textureSize * textureSize * 4);
  const rivers = data.rivers ?? [];

  for (let py = 0; py < textureSize; py++) {
    const y = ((py + 0.5) / textureSize) * data.size;

    for (let px = 0; px < textureSize; px++) {
      const x = ((px + 0.5) / textureSize) * data.size;
      const sample = closestRiverbedSample(x, y, rivers);
      const index = (py * textureSize + px) * 4;

      pixels[index] = Math.round(sample.influence * 255);
      pixels[index + 1] = Math.round((sample.flowX * 0.5 + 0.5) * 255);
      pixels[index + 2] = Math.round((sample.flowY * 0.5 + 0.5) * 255);
      pixels[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, textureSize, textureSize, THREE.RGBAFormat);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function closestRiverbedSample(
  x: number,
  y: number,
  rivers: NonNullable<ChunkData['rivers']>,
): { influence: number; flowX: number; flowY: number } {
  let strongestInfluence = 0;
  let strongestFlowX = EMPTY_FLOW_X * 2 - 1;
  let strongestFlowY = EMPTY_FLOW_Y * 2 - 1;

  for (const river of rivers) {
    const points = river.points;
    if (points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const sample = closestRiverRenderSample(x, y, points[i], points[i + 1]);
      const channelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
      if (channelRadius <= 0) continue;

      const feather = Math.max(0.22, channelRadius * 0.34);
      const outerRadius = channelRadius + feather;
      if (sample.distance > outerRadius) continue;

      const edgeT = clamp01((sample.distance - channelRadius) / feather);
      const influence = sample.distance <= channelRadius
        ? 1 - Math.pow(sample.distance / Math.max(channelRadius, 0.0001), 1.7) * 0.18
        : 1 - smoothstep(edgeT);

      if (influence > strongestInfluence) {
        strongestInfluence = influence;
        const flowLength = Math.hypot(sample.flowX, sample.flowY) || 1;
        strongestFlowX = sample.flowX / flowLength;
        strongestFlowY = sample.flowY / flowLength;
      }
    }
  }

  return {
    influence: clamp01(strongestInfluence),
    flowX: strongestFlowX,
    flowY: strongestFlowY,
  };
}

function closestRiverRenderSample(
  x: number,
  y: number,
  a: RiverPoint,
  b: RiverPoint,
): RiverPoint & { distance: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp01(((x - a.x) * vx + (y - a.y) * vy) / lenSq);
  const px = a.x + vx * t;
  const py = a.y + vy * t;
  const optional = (start: number | undefined, end: number | undefined): number | undefined => {
    if (!Number.isFinite(start) && !Number.isFinite(end)) return undefined;
    const from = Number.isFinite(start) ? (start as number) : (end as number);
    const to = Number.isFinite(end) ? (end as number) : from;
    return from + (to - from) * t;
  };

  return {
    ...a,
    x: px,
    y: py,
    height: a.height + (b.height - a.height) * t,
    surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * t,
    width: a.width + (b.width - a.width) * t,
    depth: a.depth + (b.depth - a.depth) * t,
    flow: optional(a.flow, b.flow),
    channelWidth: optional(a.channelWidth, b.channelWidth),
    valleyWidth: optional(a.valleyWidth, b.valleyWidth),
    channelDepth: optional(a.channelDepth, b.channelDepth),
    valleyDepth: optional(a.valleyDepth, b.valleyDepth),
    flowX: a.flowX + (b.flowX - a.flowX) * t,
    flowY: a.flowY + (b.flowY - a.flowY) * t,
    distance: Math.hypot(x - px, y - py),
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
