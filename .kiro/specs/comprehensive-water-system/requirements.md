# Requirements Document

## Introduction

The comprehensive water system separates water from terrain as distinct entities with proper visual representation. Currently, ocean biomes are rendered as colored terrain tiles and rivers appear as blue squares, which is visually incorrect. This feature introduces a proper water layer system with realistic rendering for oceans, rivers, and lakes.

## Glossary

- **Water_System**: The complete water management and rendering subsystem
- **Water_Layer**: A separate rendering layer for water entities, distinct from terrain
- **Ocean_Water**: Large bodies of water at sea level (height < 0.3)
- **River_Water**: Flowing water following river network paths
- **Lake_Water**: Standing water in terrain depressions
- **Water_Mesh**: Three.js mesh representing water surfaces
- **Water_Material**: Shader material for water rendering with transparency and animation
- **Terrain_Mesh**: Three.js mesh representing solid ground
- **Biome_System**: Existing system for terrain classification
- **River_Network**: Existing data structure containing river segments and lakes
- **WorldViewer**: Three.js rendering component in the demo application
- **ChunkData**: Data structure containing heightmap, biomes, rivers, and lakes

## Requirements

### Requirement 1: Separate Water from Terrain

**User Story:** As a developer, I want water to be a separate entity from terrain, so that oceans, rivers, and lakes are rendered correctly as water surfaces rather than colored terrain.

#### Acceptance Criteria

1. THE Water_System SHALL generate water meshes independently from terrain meshes
2. WHEN a chunk contains ocean tiles (height < 0.3), THE Water_System SHALL create Ocean_Water meshes at sea level
3. WHEN a chunk contains river segments, THE Water_System SHALL create River_Water meshes following river paths
4. WHEN a chunk contains lakes, THE Water_System SHALL create Lake_Water meshes filling lake depressions
5. THE Terrain_Mesh SHALL NOT use ocean biome colors for underwater terrain
6. THE Water_Layer SHALL render above terrain but below structures and resources

### Requirement 2: Ocean Water Rendering

**User Story:** As a user, I want oceans to appear as realistic water surfaces, so that I can distinguish water from land terrain.

#### Acceptance Criteria

1. WHEN terrain height is below 0.3, THE Water_System SHALL place Ocean_Water at elevation 0.3
2. THE Ocean_Water SHALL use a semi-transparent blue material with configurable opacity
3. THE Ocean_Water SHALL cover all tiles where heightmap value is less than 0.3
4. THE Ocean_Water SHALL create seamless surfaces across chunk boundaries
5. THE Terrain_Mesh SHALL render underwater terrain with appropriate coloring (darker, desaturated)
6. THE Ocean_Water SHALL support optional wave animation using vertex displacement

### Requirement 3: River Water Rendering

**User Story:** As a user, I want rivers to appear as flowing water channels, so that river networks are visually clear and realistic.

#### Acceptance Criteria

1. WHEN a chunk contains river segments, THE Water_System SHALL create River_Water meshes for each segment
2. THE River_Water SHALL follow the river network path with appropriate width based on flow data
3. THE River_Water SHALL be positioned at the terrain height of each river tile
4. THE River_Water SHALL use a semi-transparent blue material distinct from Ocean_Water
5. THE River_Water SHALL create smooth transitions between segments of varying width
6. THE River_Water SHALL NOT render as blue square tiles

### Requirement 4: Lake Water Rendering

**User Story:** As a user, I want lakes to appear as standing water bodies, so that terrain depressions with water are visually distinct.

#### Acceptance Criteria

1. WHEN a chunk contains lake data, THE Water_System SHALL create Lake_Water meshes for each lake
2. THE Lake_Water SHALL fill the lake depression at the lake's elevation level
3. THE Lake_Water SHALL use a semi-transparent blue material similar to Ocean_Water
4. THE Lake_Water SHALL create smooth surfaces across all lake tiles
5. THE Lake_Water SHALL connect seamlessly with river outlets where present
6. THE Lake_Water SHALL render above terrain but below River_Water at connection points

### Requirement 5: Water Material System

**User Story:** As a developer, I want a configurable water material system, so that water appearance can be customized for different visual styles.

#### Acceptance Criteria

1. THE Water_System SHALL provide a Water_Material factory function
2. THE Water_Material SHALL support configurable color, opacity, and shininess
3. THE Water_Material SHALL use THREE.MeshPhongMaterial or THREE.MeshStandardMaterial for realistic lighting
4. THE Water_Material SHALL support optional normal maps for surface detail
5. THE Water_Material SHALL support optional animated vertex displacement for waves
6. THE Water_Material SHALL distinguish between Ocean_Water, River_Water, and Lake_Water materials

### Requirement 6: Underwater Terrain Rendering

**User Story:** As a user, I want underwater terrain to be visually distinct, so that I can see the ocean floor topology.

#### Acceptance Criteria

1. WHEN terrain is below sea level (height < 0.3), THE Terrain_Mesh SHALL apply underwater color adjustments
2. THE Terrain_Mesh SHALL darken underwater terrain colors by 30-50%
3. THE Terrain_Mesh SHALL desaturate underwater terrain colors to simulate depth
4. THE Terrain_Mesh SHALL NOT use ocean biome colors for underwater terrain
5. THE Terrain_Mesh SHALL use the underlying terrain biome (beach, plains, etc.) for color calculation
6. THE Terrain_Mesh SHALL apply depth-based gradient for deeper areas

### Requirement 7: Water Layer Management

**User Story:** As a developer, I want water layers to be managed separately, so that water can be toggled, updated, and optimized independently from terrain.

#### Acceptance Criteria

1. THE WorldViewer SHALL maintain separate water mesh collections from terrain meshes
2. THE Water_System SHALL support adding water meshes to chunks without regenerating terrain
3. THE Water_System SHALL support removing water meshes independently
4. THE Water_System SHALL support toggling water layer visibility
5. THE Water_System SHALL dispose of water mesh resources when chunks are unloaded
6. THE Water_System SHALL update water meshes when chunk data changes

### Requirement 8: Performance Optimization

**User Story:** As a developer, I want water rendering to be performant, so that large worlds with extensive water bodies maintain 60fps.

#### Acceptance Criteria

1. THE Water_System SHALL reuse geometry for water tiles of the same type
2. THE Water_System SHALL merge adjacent water tiles into single meshes where possible
3. THE Water_System SHALL apply LOD to water meshes based on distance
4. THE Water_System SHALL support frustum culling for water meshes
5. THE Water_System SHALL limit water mesh complexity to maintain <16ms frame time
6. THE Water_System SHALL use instanced rendering for repeated water tile patterns

### Requirement 9: Water-Terrain Integration

**User Story:** As a developer, I want water to integrate seamlessly with terrain, so that shorelines and river banks appear natural.

#### Acceptance Criteria

1. THE Water_System SHALL position water surfaces at correct elevations relative to terrain
2. THE Water_System SHALL create smooth transitions at shorelines
3. THE Water_System SHALL handle elevation changes along river paths
4. THE Water_System SHALL prevent z-fighting between water and terrain surfaces
5. THE Water_System SHALL offset water surfaces slightly above terrain (0.1 units)
6. THE Water_System SHALL blend water edges with terrain at boundaries

### Requirement 10: Configuration and Customization

**User Story:** As a developer, I want configurable water rendering options, so that visual style can be adjusted for different projects.

#### Acceptance Criteria

1. THE Water_System SHALL accept a WaterConfig configuration object
2. THE WaterConfig SHALL specify ocean water color, opacity, and wave parameters
3. THE WaterConfig SHALL specify river water color, opacity, and flow animation
4. THE WaterConfig SHALL specify lake water color and opacity
5. THE WaterConfig SHALL enable or disable water layer rendering
6. THE WaterConfig SHALL enable or disable wave animations and normal maps
