# Requirements Document: Remove River Generation System

## Introduction

This document specifies the requirements for completely removing the river generation system from the Procedural World Engine. The river generation system was originally planned as a feature but was never fully implemented (only data structures exist). This removal will clean up the codebase by eliminating unused river-related code, data structures, configuration options, and documentation references.

## Glossary

- **River_System**: The collection of data structures, configuration options, and code references related to river generation in the Procedural World Engine
- **ChunkData**: The core data structure containing all generated information for a chunk, including heightmap, biomes, resources, structures, and rivers
- **Serialization_System**: The world persistence system that saves and loads chunk data in JSON and binary formats
- **Water_Rendering_System**: The Three.js-based visualization system in the demo application that renders water features (oceans, rivers, lakes)
- **Generation_Stage**: Enumeration defining the sequential stages of chunk generation (TERRAIN, BIOMES, RIVERS, RESOURCES, STRUCTURES, COMPLETE)
- **Public_API**: The exported interfaces, types, and functions available to library consumers through src/index.ts
- **Documentation**: All user-facing documentation including README.md, product.md, structure.md, and code examples

## Requirements

### Requirement 1: Remove River Data Structures from ChunkData

**User Story:** As a library maintainer, I want to remove the unused rivers field from ChunkData, so that the codebase only contains implemented features.

#### Acceptance Criteria

1. THE Chunk_System SHALL remove the `rivers: Set<number>` field from the ChunkData interface in src/world/chunk.ts
2. WHEN ChunkData is instantiated in chunk generation, THE Chunk_Manager SHALL NOT initialize a rivers field
3. WHEN ChunkData is serialized, THE Serialization_System SHALL NOT include river data in the output
4. WHEN ChunkData is deserialized, THE Serialization_System SHALL NOT attempt to restore river data
5. FOR ALL ChunkData instances created after removal, the data structure SHALL NOT contain any river-related fields

### Requirement 2: Remove River Configuration Options

**User Story:** As a library user, I want river configuration options removed from the API, so that I am not confused by non-functional configuration parameters.

#### Acceptance Criteria

1. THE Configuration_System SHALL remove all river-related configuration interfaces from the codebase
2. THE WorldConfig interface SHALL NOT accept riverConfig or riverNetworkConfig parameters
3. THE Public_API SHALL NOT export RiverConfig, RiverNetworkConfig, RiverSegment, Lake, or RiverNetwork types
4. WHEN a user creates a WorldConfig, THE Type_System SHALL NOT allow river-related configuration properties
5. FOR ALL configuration examples in documentation, river configuration SHALL be absent

### Requirement 3: Update Generation Stage Enumeration

**User Story:** As a developer, I want the generation stage enumeration to reflect actual generation steps, so that incremental generation accurately represents the workflow.

#### Acceptance Criteria

1. THE Generation_Stage enumeration SHALL remove the RIVERS stage from src/world/chunk.ts
2. THE Generation_Stage enumeration SHALL renumber subsequent stages to maintain sequential ordering (TERRAIN=0, BIOMES=1, RESOURCES=2, STRUCTURES=3, COMPLETE=4)
3. WHEN incremental generation progresses, THE Incremental_Generator SHALL skip from BIOMES directly to RESOURCES
4. THE Generation_Stage enumeration SHALL contain exactly 5 stages after removal (TERRAIN, BIOMES, RESOURCES, STRUCTURES, COMPLETE)
5. FOR ALL code referencing GenerationStage values, the stage numbers SHALL remain consistent with the updated enumeration

### Requirement 4: Remove River References from Serialization

**User Story:** As a user saving world data, I want serialization to exclude river data, so that saved files are smaller and contain only implemented features.

#### Acceptance Criteria

1. THE Serialization_System SHALL remove river data handling from the serializeChunkJSON method in src/world/serialization.ts
2. THE Serialization_System SHALL remove river data handling from the serializeChunkBinary method in src/world/serialization.ts
3. THE Serialization_System SHALL remove river data handling from the deserializeChunkJSON method in src/world/serialization.ts
4. THE Serialization_System SHALL remove river data handling from the deserializeChunkBinary method in src/world/serialization.ts
5. THE SerializedChunk interface SHALL NOT contain a rivers field
6. WHEN serializing chunks, THE Serialization_System SHALL NOT allocate space for river data in binary format
7. WHEN deserializing legacy data containing river fields, THE Serialization_System SHALL ignore river data without errors

### Requirement 5: Remove River References from Worker Pool

**User Story:** As a developer using multi-threaded generation, I want worker pool serialization to exclude river data, so that worker communication is efficient and clean.

#### Acceptance Criteria

1. THE Worker_Pool SHALL remove river data handling from chunk serialization in src/world/worker-pool.ts
2. WHEN deserializing chunk data from workers, THE Worker_Pool SHALL NOT attempt to restore river data
3. THE Worker_Pool SHALL NOT include river-related fields in serialized chunk messages
4. FOR ALL worker-to-main-thread communication, river data SHALL be absent from transferred objects

### Requirement 6: Remove River References from Incremental Generator

**User Story:** As a developer using incremental generation, I want the incremental generator to skip river generation, so that generation stages accurately reflect the actual workflow.

#### Acceptance Criteria

1. THE Incremental_Generator SHALL remove river-related initialization from partial chunk data in src/world/incremental-generator.ts
2. THE Incremental_Generator SHALL NOT include a RIVERS generation stage in the workflow
3. WHEN initializing partial chunk data, THE Incremental_Generator SHALL NOT create an empty rivers Set
4. FOR ALL incremental generation workflows, the RIVERS stage SHALL be absent from the generation sequence

### Requirement 7: Update Public API Exports

**User Story:** As a library consumer, I want the public API to exclude river-related types, so that I only see documented and functional features.

#### Acceptance Criteria

1. THE Public_API SHALL remove all river-related type exports from src/index.ts
2. THE Public_API SHALL NOT export RiverConfig, RiverNetworkConfig, RiverSegment, Lake, or RiverNetwork types
3. WHEN importing from the library, THE Type_System SHALL NOT provide river-related types for autocomplete
4. THE Public_API documentation SHALL NOT reference river-related exports
5. FOR ALL library consumers, river-related types SHALL be unavailable for import

### Requirement 8: Remove River Documentation from README

**User Story:** As a library user reading documentation, I want the README to exclude river features, so that I understand what features are actually available.

#### Acceptance Criteria

1. THE Documentation SHALL remove the "Advanced River Networks" feature description from the Features section in README.md
2. THE Documentation SHALL remove the "River Networks" configuration section from README.md
3. THE Documentation SHALL remove the River Network Configuration table from README.md
4. THE Documentation SHALL remove river-related examples from the Quick Start and Advanced Features sections
5. THE Documentation SHALL remove RiverSegment, Lake, and RiverNetwork from the API Documentation types list
6. THE Documentation SHALL remove river-related configuration from the Complete Configuration Example
7. THE Documentation SHALL update the GenerationStage description to exclude the RIVERS stage
8. THE Documentation SHALL remove "rivers" from the ChunkData description
9. THE Documentation SHALL update the Project Structure section to remove references to src/gen/rivers.ts
10. WHEN users read feature lists, THE Documentation SHALL NOT mention river generation capabilities

### Requirement 9: Remove River Documentation from Product Overview

**User Story:** As a stakeholder reviewing product capabilities, I want the product overview to exclude river features, so that I have accurate information about implemented features.

#### Acceptance Criteria

1. THE Documentation SHALL remove "River Networks: Advanced river generation with tributaries, lakes, and deltas" from the Core Capabilities list in .kiro/steering/product.md
2. WHEN stakeholders review product capabilities, THE Documentation SHALL NOT list river generation as a feature

### Requirement 10: Remove River Documentation from Structure Guide

**User Story:** As a developer understanding the codebase structure, I want the structure guide to exclude river references, so that I have accurate information about existing code.

#### Acceptance Criteria

1. THE Documentation SHALL remove "rivers.ts: River network generation with flow simulation" from the Generation Systems section in .kiro/steering/structure.md
2. WHEN developers review the project structure, THE Documentation SHALL NOT reference river generation files

### Requirement 11: Remove Water Rendering System River Support

**User Story:** As a demo application user, I want the water rendering system to focus on oceans and lakes, so that the demo accurately represents implemented features.

#### Acceptance Criteria

1. THE Water_Rendering_System SHALL remove river-specific rendering code from demo/src/viewer/water/ directory
2. THE WaterConfig interface SHALL remove the river configuration section
3. THE Water_Layer_Manager SHALL NOT create or manage river water meshes
4. WHEN rendering water, THE Water_Rendering_System SHALL only render ocean and lake water
5. THE Documentation SHALL update water rendering examples to exclude river configuration
6. FOR ALL water rendering operations, river-specific materials and meshes SHALL be absent

### Requirement 12: Maintain Backward Compatibility for Serialization

**User Story:** As a user with existing saved worlds, I want to load my old save files without errors, so that I don't lose my world data.

#### Acceptance Criteria

1. WHEN deserializing world data containing river fields, THE Serialization_System SHALL ignore river data without throwing errors
2. WHEN loading legacy SerializedChunk objects with rivers arrays, THE Serialization_System SHALL skip the rivers field gracefully
3. THE Serialization_System SHALL NOT fail validation when encountering river data in saved files
4. FOR ALL legacy save files, deserialization SHALL succeed and restore all non-river data correctly
5. THE Serialization_System SHALL log a warning when encountering legacy river data (optional)

### Requirement 13: Remove Example Files Referencing Rivers

**User Story:** As a developer learning the library through examples, I want examples to exclude river features, so that I only learn about implemented functionality.

#### Acceptance Criteria

1. IF an examples/river-networks.ts file exists, THE Documentation_System SHALL remove it
2. THE Documentation SHALL remove references to river-networks.ts from the Examples section in README.md
3. WHEN developers browse example files, THE Examples_Directory SHALL NOT contain river-related examples
4. FOR ALL remaining example files, river configuration SHALL be absent from code samples

### Requirement 14: Update LOD System Feature Culling Documentation

**User Story:** As a developer using the LOD system, I want documentation to accurately describe which features are culled at different LOD levels, so that I understand performance optimizations.

#### Acceptance Criteria

1. THE Documentation SHALL update the LOD Feature Culling description in README.md to remove river references
2. THE Documentation SHALL state "Resources rendered only at HIGH LOD; structures at HIGH/MEDIUM LOD" without mentioning rivers
3. WHEN developers read LOD documentation, THE Feature_Culling_Description SHALL NOT reference river rendering

### Requirement 15: Verify No Broken References

**User Story:** As a library maintainer, I want to ensure no code references removed river functionality, so that the codebase remains functional after removal.

#### Acceptance Criteria

1. THE Codebase SHALL NOT contain any imports of river-related types or modules
2. THE Codebase SHALL NOT contain any function calls to river generation methods
3. THE Codebase SHALL NOT contain any references to RiverConfig, RiverNetworkConfig, RiverSegment, Lake, or RiverNetwork types
4. WHEN the TypeScript compiler runs, THE Build_System SHALL NOT report any errors related to missing river types
5. WHEN tests run, THE Test_Suite SHALL NOT fail due to missing river functionality
6. FOR ALL code files, river-related imports and references SHALL be absent

