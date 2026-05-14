/**
 * Generates chunk coordinates in a spiral order from a center point.
 * Starts at the center, then walks outward ring by ring.
 * Guarantees that closer chunks are yielded before more distant ones.
 */
export function* generateSpiralCoordinates(
  centerX: number,
  centerY: number,
  radius: number,
): Generator<{ x: number; y: number }> {
  yield { x: centerX, y: centerY };

  for (let r = 1; r <= radius; r++) {
    // Top edge, left to right (including corners)
    for (let dx = -r; dx <= r; dx++) {
      yield { x: centerX + dx, y: centerY - r };
    }
    // Right edge, top+1 to bottom (including bottom-right corner)
    for (let dy = -r + 1; dy <= r; dy++) {
      yield { x: centerX + r, y: centerY + dy };
    }
    // Bottom edge, right-1 to left (including bottom-left corner)
    for (let dx = r - 1; dx >= -r; dx--) {
      yield { x: centerX + dx, y: centerY + r };
    }
    // Left edge, bottom-1 to top+1 (excluding top-left and bottom-left corners already yielded)
    for (let dy = r - 1; dy >= -r + 1; dy--) {
      yield { x: centerX - r, y: centerY + dy };
    }
  }
}
