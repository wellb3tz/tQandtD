# Implementation Plan: Comprehensive Water System

## Overview

This implementation plan creates a separate water rendering layer for the procedural world engine. The water system will render oceans, rivers, and lakes as distinct entities with proper transparency and materials, replacing the current approach where water appears as colored terrain tiles. The implementation follows a layered architecture with independent water mesh generation, configurable materials, and seamless integration with the existing terrain system.

## Tasks

- [x] 1. Set up water system foundation and configuration
  - Create `demo/src/viewer/water/` directory structure
  - Define `WaterConfig` interface with all configuration options (ocean, river, lake, performance, rendering)
  - Implement `validateWaterConfig()` function with validation and defaults
  - Export water system types from appropriate modules
  - _Requirements: 10.1, 10.2, 10.5_

- [x] 1.1 Write unit tests for water configuration
  - Test configuration validation and default values
  - Test parameter clamping (opacity, seaLevel ranges)
  - Test enable/disable flags
  - _Requirements: 10.1, 10.2_

- [x] 2. Implement water material factory
  - [x] 2.1 Create `WaterMaterialFactory.ts` with material creation functions
    - Implement `createOceanMaterial()` with configurable color, opacity, shininess
    - Implement `createRiverMaterial()` with distinct visual properties
    - Implement `createLakeMaterial()` with appropriate transparency
    - Use `THREE.MeshPhongMaterial` for all water types
    - Support optional normal map textures
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 2.2 Write property test for water material configuration reflection
    - **Property 12: Water Material Configuration Reflection**
    - **Validates: Requirements 5.2**
  
  - [x] 2.3 Write unit tests for material factory
    - Test material type verification
    - Test configuration parameter application
    - Test material property distinctness between water types
    - _Requirements: 5.1, 5.2, 5.6_

- [x] 3. Implement ocean mesh generator
  - [x] 3.1 Create `OceanMeshGenerator.ts` with ocean tile identification
    - Implement `identifyOceanTiles()` to find tiles where height < seaLevel
    - Create `OceanTile` data structure with index, terrainHeight, waterElevation, underwaterDepth
    - Implement `buildOceanGeometry()` to create merged mesh from ocean tiles
    - Position ocean surface at seaLevel + waterOffset (0.3 + 0.1)
    - _Requirements: 1.2, 2.1, 2.3_
  
  - [x] 3.2 Implement ocean boundary alignment for seamless chunks
    - Ensure boundary vertices use identical world coordinates
    - Match elevation at chunk edges (seaLevel + waterOffset)
    - _Requirements: 2.4_
  
  - [x] 3.3 Write property test for ocean water coverage completeness
    - **Property 1: Ocean Water Coverage Completeness**
    - **Validates: Requirements 1.2, 2.1, 2.3**
  
  - [x] 3.4 Write property test for ocean water seamless boundaries
    - **Property 6: Ocean Water Seamless Boundaries**
    - **Validates: Requirements 2.4**
  
  - [x] 3.5 Write unit tests for ocean mesh generator
    - Test ocean tile identification with various heightmaps
    - Test empty chunks (no ocean)
    - Test chunks with only ocean
    - Test geometry generation
    - _Requirements: 1.2, 2.1_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement river mesh generator
  - [x] 5.1 Create `RiverMeshGenerator.ts` with river path mesh creation
    - Implement `generateRiverMeshes()` accepting `RiverNetwork` data
    - Create mesh for each `RiverSegment` with width based on flow
    - Position river water at terrain height + waterOffset
    - Implement smooth width transitions between segments
    - _Requirements: 1.3, 3.1, 3.2, 3.3_
  
  - [x] 5.2 Write property test for river water path following
    - **Property 3: River Water Path Following**
    - **Validates: Requirements 1.3, 3.1, 3.2**
  
  - [x] 5.3 Write property test for river water terrain elevation matching
    - **Property 9: River Water Terrain Elevation Matching**
    - **Validates: Requirements 3.3, 9.1, 9.3**
  
  - [x] 5.4 Write property test for river width smooth transitions
    - **Property 10: River Width Smooth Transitions**
    - **Validates: Requirements 3.5**
  
  - [x] 5.5 Write unit tests for river mesh generator
    - Test river mesh generation for various river networks
    - Test width calculation based on flow
    - Test empty river data
    - _Requirements: 1.3, 3.1, 3.2_

- [x] 6. Implement lake mesh generator
  - [x] 6.1 Create `LakeMeshGenerator.ts` with lake surface mesh creation
    - Implement `generateLakeMeshes()` accepting lake data from `RiverNetwork`
    - Create mesh covering all lake tiles at lake elevation + waterOffset
    - Implement smooth surface across lake tiles
    - Handle lake-river outlet connections
    - _Requirements: 1.4, 4.1, 4.2, 4.4, 4.5_
  
  - [x] 6.2 Write property test for lake water coverage
    - **Property 4: Lake Water Coverage**
    - **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  
  - [x] 6.3 Write property test for lake-river connection seamlessness
    - **Property 11: Lake-River Connection Seamlessness**
    - **Validates: Requirements 4.5**
  
  - [x] 6.4 Write unit tests for lake mesh generator
    - Test lake mesh generation for various lake shapes
    - Test lake elevation positioning
    - Test empty lake data
    - _Requirements: 1.4, 4.1, 4.2_

- [x] 7. Implement underwater terrain processor
  - [x] 7.1 Create `UnderwaterTerrainProcessor.ts` with color adjustment functions
    - Implement `adjustUnderwaterColors()` to modify terrain mesh colors
    - Apply darkening factor (30-50%) to underwater terrain
    - Apply desaturation based on depth below seaLevel
    - Implement depth-based gradient (deeper = darker)
    - Exclude ocean biome colors from underwater terrain
    - _Requirements: 1.5, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [x] 7.2 Write property test for underwater terrain color exclusion
    - **Property 5: Underwater Terrain Color Exclusion**
    - **Validates: Requirements 1.5, 6.4, 6.5**
  
  - [x] 7.3 Write property test for underwater color darkening
    - **Property 7: Underwater Color Darkening**
    - **Validates: Requirements 2.5, 6.1, 6.2**
  
  - [x] 7.4 Write property test for underwater color desaturation
    - **Property 8: Underwater Color Desaturation**
    - **Validates: Requirements 2.5, 6.3**
  
  - [x] 7.5 Write property test for depth-based gradient application
    - **Property 13: Depth-Based Gradient Application**
    - **Validates: Requirements 6.6**
  
  - [x] 7.6 Write unit tests for underwater terrain processor
    - Test color darkening calculations
    - Test desaturation calculations
    - Test depth gradient application
    - Test ocean biome color exclusion
    - _Requirements: 1.5, 2.5, 6.1, 6.2, 6.3_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement water layer manager
  - [x] 9.1 Create `WaterLayerManager.ts` with water mesh lifecycle management
    - Implement `addWaterToChunk()` to generate and add water meshes to scene
    - Implement `removeWaterFromChunk()` to dispose water meshes and resources
    - Implement `updateWaterMeshes()` to refresh water when chunk data changes
    - Implement `toggleWaterVisibility()` for layer visibility control
    - Create `WaterLayerData` structure with ocean, rivers, lakes arrays and THREE.Group
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [x] 9.2 Write property test for water mesh independence
    - **Property 2: Water Mesh Independence**
    - **Validates: Requirements 1.1, 7.2, 7.3**
  
  - [x] 9.3 Write unit tests for water layer manager
    - Test adding water to chunks
    - Test removing water from chunks
    - Test updating water meshes
    - Test visibility toggling
    - Test resource disposal
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10. Integrate water system with WorldViewer
  - [x] 10.1 Extend `ChunkMesh` interface in `WorldViewer.ts`
    - Add `water?: WaterLayerData` property to `ChunkMesh` interface
    - Mark `rivers?: THREE.Group` as deprecated
    - _Requirements: 1.1, 7.1_
  
  - [x] 10.2 Modify `createTerrainMesh()` to apply underwater color adjustments
    - Call `UnderwaterTerrainProcessor.adjustUnderwaterColors()` for underwater tiles
    - Apply adjustments during vertex color generation
    - _Requirements: 1.5, 2.5, 6.1, 6.2, 6.3_
  
  - [x] 10.3 Modify `addChunk()` to generate and add water layer
    - Call `WaterLayerManager.addWaterToChunk()` after terrain mesh creation
    - Store water layer in `ChunkMesh.water` property
    - Ensure water renders above terrain (renderOrder or position offset)
    - _Requirements: 1.1, 1.6, 7.1, 7.2_
  
  - [x] 10.4 Modify `removeChunk()` to dispose water layer
    - Call `WaterLayerManager.removeWaterFromChunk()` before terrain disposal
    - _Requirements: 7.5, 7.6_
  
  - [x] 10.5 Modify `updateChunk()` to refresh water layer
    - Call `WaterLayerManager.updateWaterMeshes()` when chunk data changes
    - _Requirements: 7.6_
  
  - [x] 10.6 Write integration tests for WorldViewer water integration
    - Test complete water system integration with terrain
    - Test multi-chunk water continuity
    - Test water layer visibility controls
    - Test resource cleanup on chunk removal
    - _Requirements: 1.1, 1.6, 7.1, 7.2, 7.5_

- [x] 11. Add water layer controls to ControlPanel
  - [x] 11.1 Add water configuration controls to `ControlPanel.ts`
    - Add toggle for water layer visibility
    - Add ocean color, opacity, shininess controls
    - Add river color, opacity controls
    - Add lake color, opacity controls
    - Wire controls to `WaterConfig` and update WorldViewer
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [x] 11.2 Write unit tests for water controls
    - Test control initialization
    - Test configuration updates
    - Test visibility toggle
    - _Requirements: 10.5, 10.6_

- [x] 12. Implement performance optimizations
  - [x] 12.1 Add geometry pooling for water tiles
    - Implement geometry reuse for ocean tiles of same type
    - Implement geometry reuse for river segments
    - _Requirements: 8.1_
  
  - [x] 12.2 Implement mesh merging for adjacent water tiles
    - Merge adjacent ocean tiles into single meshes
    - Merge connected river segments where possible
    - _Requirements: 8.2_
  
  - [x] 12.3 Add LOD support for water meshes
    - Apply LOD based on distance from camera
    - Reduce water mesh complexity at distance
    - _Requirements: 8.3_
  
  - [x] 12.4 Add frustum culling for water meshes
    - Implement bounding box checks for water meshes
    - Hide water meshes outside camera view
    - _Requirements: 8.4_
  
  - [x] 12.5 Write performance tests for water rendering
    - Test frame time with extensive water bodies
    - Verify <16ms frame time target maintained
    - Test optimization feature impact (pooling, merging, LOD, culling)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. Implement water elevation and shoreline handling
  - [x] 13.1 Add water elevation correctness validation
    - Verify ocean at seaLevel + waterOffset
    - Verify rivers at terrain height + waterOffset
    - Verify lakes at lake elevation + waterOffset
    - Prevent z-fighting with 0.1 unit offset
    - _Requirements: 9.1, 9.4, 9.5_
  
  - [x] 13.2 Implement shoreline transition smoothing
    - Create smooth transitions at water-land boundaries
    - Handle elevation changes along river paths
    - Blend water edges with terrain at boundaries
    - _Requirements: 9.2, 9.3, 9.6_
  
  - [x] 13.3 Write property test for water elevation correctness
    - **Property 14: Water Elevation Correctness**
    - **Validates: Requirements 9.1, 9.4, 9.5**
  
  - [x] 13.4 Write property test for shoreline transition smoothness
    - **Property 15: Shoreline Transition Smoothness**
    - **Validates: Requirements 9.2, 9.6**
  
  - [x] 13.5 Write integration tests for water-terrain integration
    - Test water positioning relative to terrain
    - Test shoreline transitions
    - Test z-fighting prevention
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Create usage example and documentation
  - [x] 15.1 Create `examples/water-system-usage.ts`
    - Demonstrate basic water system configuration
    - Show how to customize water appearance
    - Show how to toggle water layer visibility
    - _Requirements: 10.1, 10.2, 10.5_
  
  - [x] 15.2 Update README.md with water system documentation
    - Add water system overview to features section
    - Document `WaterConfig` interface
    - Document water layer controls
    - Add screenshots/examples of water rendering
    - _Requirements: 10.1, 10.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from design document
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end workflows
- Performance tests ensure <16ms frame time target is maintained
- The water system integrates with existing `RiverNetwork` data structures (no changes to river generation needed)
- Underwater terrain color adjustments are applied during terrain mesh creation
- Water meshes render as a separate layer above terrain using THREE.js groups and render order
