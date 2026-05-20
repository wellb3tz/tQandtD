export enum RenderLayer {
  TERRAIN = 'terrain',
  BIOMES = 'biomes',
  TEMPERATURE = 'temperature',
  RESOURCES = 'resources',
  STRUCTURES = 'structures',
  CHUNK_BOUNDARIES = 'chunkBoundaries',
}

export interface VisibleObject {
  visible: boolean;
}

export interface RenderLayerChunk {
  terrain: VisibleObject;
  foliage?: VisibleObject;
  resources?: VisibleObject;
  structures?: VisibleObject;
  boundaries?: VisibleObject;
  visible?: boolean;
}

export type RenderLayerVisibilityState = Map<RenderLayer, boolean>;

export function isRenderLayerVisible(layerVisibility: RenderLayerVisibilityState, layer: RenderLayer): boolean {
  return layerVisibility.get(layer) !== false;
}

export function applyChunkVisibility(
  chunk: RenderLayerChunk,
  layerVisibility: RenderLayerVisibilityState,
  frustumVisible: boolean = chunk.visible !== false,
): void {
  chunk.visible = frustumVisible;
  chunk.terrain.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.TERRAIN);

  if (chunk.foliage) {
    chunk.foliage.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.TERRAIN);
  }

  if (chunk.resources) {
    chunk.resources.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.RESOURCES);
  }

  if (chunk.structures) {
    chunk.structures.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.STRUCTURES);
  }

  if (chunk.boundaries) {
    chunk.boundaries.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.CHUNK_BOUNDARIES);
  }
}

export function applyRenderLayerVisibility(
  chunk: RenderLayerChunk,
  layer: RenderLayer,
  layerVisibility: RenderLayerVisibilityState,
): void {
  const frustumVisible = chunk.visible !== false;

  switch (layer) {
    case RenderLayer.TERRAIN:
      chunk.terrain.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.TERRAIN);
      if (chunk.foliage) {
        chunk.foliage.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.TERRAIN);
      }
      break;
    case RenderLayer.RESOURCES:
      if (chunk.resources) {
        chunk.resources.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.RESOURCES);
      }
      break;
    case RenderLayer.STRUCTURES:
      if (chunk.structures) {
        chunk.structures.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.STRUCTURES);
      }
      break;
    case RenderLayer.CHUNK_BOUNDARIES:
      if (chunk.boundaries) {
        chunk.boundaries.visible = frustumVisible && isRenderLayerVisible(layerVisibility, RenderLayer.CHUNK_BOUNDARIES);
      }
      break;
    case RenderLayer.BIOMES:
      break;
  }
}
