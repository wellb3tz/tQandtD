import * as THREE from 'three';
import { applyChunkVisibility, type RenderLayerChunk, type RenderLayerVisibilityState } from './RenderLayerVisibility';

export interface FrustumChunk extends RenderLayerChunk {
  boundingBox?: THREE.Box3;
  visible?: boolean;
}

export interface FrustumCullingStats {
  enabled: boolean;
  visible: number;
  hidden: number;
  total: number;
}

export function updateFrustumCulledChunks(
  chunks: Iterable<FrustumChunk>,
  frustum: THREE.Frustum,
  layerVisibility: RenderLayerVisibilityState,
): void {
  if (typeof frustum.intersectsBox !== 'function') return;

  for (const chunk of chunks) {
    if (!chunk.boundingBox) continue;

    const isVisible = frustum.intersectsBox(chunk.boundingBox);
    if (chunk.visible !== isVisible) {
      applyChunkVisibility(chunk, layerVisibility, isVisible);
    }
  }
}

export function restoreChunkVisibility(
  chunks: Iterable<FrustumChunk>,
  layerVisibility: RenderLayerVisibilityState,
): void {
  for (const chunk of chunks) {
    applyChunkVisibility(chunk, layerVisibility, true);
  }
}

export function calculateFrustumCullingStats(
  chunks: Iterable<FrustumChunk>,
  enabled: boolean,
): FrustumCullingStats {
  let visible = 0;
  let hidden = 0;

  for (const chunk of chunks) {
    if (chunk.visible) {
      visible++;
    } else {
      hidden++;
    }
  }

  return {
    enabled,
    visible,
    hidden,
    total: visible + hidden,
  };
}
