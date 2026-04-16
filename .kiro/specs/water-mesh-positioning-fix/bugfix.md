# Bugfix Requirements Document

## Introduction

Water meshes (blue ocean surfaces) are appearing in incorrect locations - positioned on elevated terrain instead of above grey underwater areas (terrain below sea level). The root cause is a coordinate system mismatch between terrain rendering and water rendering. Terrain meshes use world coordinates directly in their geometry, while water meshes use local chunk coordinates with group positioning. This inconsistency causes water to be positioned incorrectly relative to the terrain.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN terrain is rendered THEN the system uses world coordinates directly in vertex positions (worldX = chunkX * chunkSize + x)

1.2 WHEN water meshes are generated THEN the system uses local chunk coordinates (0 to size) in vertex positions

1.3 WHEN water group is positioned THEN the system applies chunk world offset (chunkData.x * chunkData.size, 0, chunkData.y * chunkData.size)

1.4 WHEN coordinate systems mismatch THEN water meshes appear in wrong locations relative to terrain

1.5 WHEN water should appear above underwater terrain THEN it appears on elevated terrain instead

### Expected Behavior (Correct)

2.1 WHEN water meshes are generated THEN the system SHALL use world coordinates matching terrain rendering (worldX = chunkX * chunkSize + localX)

2.2 WHEN water group is positioned THEN the system SHALL use origin position (0, 0, 0) since geometry already contains world coordinates

2.3 WHEN water elevation is calculated THEN the system SHALL position water at (seaLevel + waterOffset) * HEIGHT_SCALE matching terrain height scale

2.4 WHEN water is rendered THEN it SHALL appear above all terrain tiles where height < seaLevel

2.5 WHEN grey underwater terrain is visible THEN blue water mesh SHALL be positioned directly above it at sea level

### Unchanged Behavior (Regression Prevention)

3.1 WHEN terrain is rendered THEN the system SHALL CONTINUE TO use world coordinates in vertex positions

3.2 WHEN heightmap sampling occurs THEN the system SHALL CONTINUE TO sample at tile centers (average of 4 corner vertices)

3.3 WHEN ocean tiles are identified THEN the system SHALL CONTINUE TO identify tiles where terrainHeight < seaLevel

3.4 WHEN underwater terrain colors are applied THEN the system SHALL CONTINUE TO darken and desaturate terrain below sea level

3.5 WHEN chunk boundaries are rendered THEN the system SHALL CONTINUE TO align seamlessly without gaps

3.6 WHEN HEIGHT_SCALE is applied THEN the system SHALL CONTINUE TO use value of 50 for both terrain and water

3.7 WHEN water material is created THEN the system SHALL CONTINUE TO use configured color, opacity, and shininess values

3.8 WHEN water visibility is toggled THEN the system SHALL CONTINUE TO show/hide all water layers independently from terrain
