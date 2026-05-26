/**
 * World scale contract.
 *
 * Runtime world coordinates use meters directly: 1 world unit equals 1 meter.
 * Normalized heightmap values remain in [0, 1] and are converted to rendered
 * meters with TERRAIN_HEIGHT_SCALE_METERS.
 */
export const WORLD_METERS_PER_UNIT = 1;
export const TERRAIN_TILE_SIZE_METERS = 20;
export const TERRAIN_HEIGHT_SCALE_METERS = 1200;

export const DEFAULT_CAMERA_POSITION_METERS = {
  x: 2000,
  y: 1500,
  z: 2000,
} as const;

export const FOLLOW_TERRAIN_HEIGHT_METERS = 600;
export const ORTHOGRAPHIC_FRUSTUM_SIZE_METERS = 1300;
export const FIRST_PERSON_EYE_HEIGHT_METERS = 1.7;
