/**
 * World scale contract.
 *
 * Runtime world coordinates use meters directly: 1 world unit equals 1 meter.
 * Normalized heightmap values remain in [0, 1] and are converted to rendered
 * meters with TERRAIN_HEIGHT_SCALE_METERS.
 */
export const WORLD_METERS_PER_UNIT = 1;
export const TERRAIN_TILE_SIZE_METERS = 4;
export const TERRAIN_HEIGHT_SCALE_METERS = 240;

export const DEFAULT_CAMERA_POSITION_METERS = {
  x: 400,
  y: 300,
  z: 400,
} as const;

export const FOLLOW_TERRAIN_HEIGHT_METERS = 120;
export const ORTHOGRAPHIC_FRUSTUM_SIZE_METERS = 260;
export const FIRST_PERSON_EYE_HEIGHT_METERS = 1.7;
