# Procedural World Engine - Demo Application User Guide

Welcome to the Procedural World Engine Demo! This interactive 3D application showcases all capabilities of the procedural world generation engine through an intuitive web interface.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [World Generation](#world-generation)
4. [Terrain Parameters](#terrain-parameters)
5. [Biome System](#biome-system)
6. [River Networks](#river-networks)
7. [Resources and Structures](#resources-and-structures)
8. [Performance Features](#performance-features)
9. [Terrain Editing](#terrain-editing)
10. [Camera Controls](#camera-controls)
11. [World Management](#world-management)
12. [Visualization Options](#visualization-options)
13. [Performance Monitoring](#performance-monitoring)
14. [Statistics Display](#statistics-display)
15. [Keyboard Shortcuts](#keyboard-shortcuts)
16. [Tips and Best Practices](#tips-and-best-practices)
17. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Opening the Demo

1. Open `demo/index.html` in a modern web browser (Chrome, Firefox, Safari, or Edge)
2. The demo will initialize and display the default world
3. Wait for the initial chunks to load (you'll see a 3D terrain appear)

### First Steps

1. **Explore the default world**: Use your mouse to rotate, zoom, and pan the camera
2. **Try a preset**: Click the "Presets" dropdown in the left panel and select "Mountainous"
3. **Generate a new world**: Click the "Generate" button to see the changes
4. **Open the help**: Press `?` or click the help button (📚) in the header

---

## Interface Overview

The demo interface consists of four main areas:

### 1. Control Panel (Left Sidebar)

The collapsible left sidebar contains all generation parameters and controls:
- **World Generation**: Seed input and generate button
- **Presets**: Quick configuration templates
- **Terrain Parameters**: Height and noise settings
- **Biome Configuration**: Ecosystem distribution controls
- **River Settings**: Water system parameters
- **Resources & Structures**: Feature placement controls
- **Performance Features**: LOD, Worker Pool, Incremental Generation
- **Terrain Editor**: Modification tools
- **Visibility Toggles**: Show/hide different elements

**Tip**: Click the collapse button (☰) to hide the panel and maximize the 3D view.

### 2. 3D Viewer (Center)

The main viewing area displays your generated world in 3D:
- Terrain with biome-based coloring
- Rivers as blue overlays
- Resource markers (colored dots)
- Structure markers (3D models or colored markers)
- Chunk boundaries (when enabled)

### 3. Performance Monitor (Right Overlay)

The right panel shows real-time performance metrics:
- **FPS**: Current frame rate
- **Generation Time**: Average chunk generation time
- **Memory Usage**: Cache memory consumption
- **LOD Statistics**: Chunk counts per detail level
- **Worker Pool**: Active workers and queued tasks
- **Incremental Generation**: Current stage and progress

**Tip**: Click the toggle button to show/hide the performance monitor.

### 4. Statistics Display (Bottom Panel)

The statistics panel shows world information:
- Total chunk count
- Biome distribution (pie chart)
- Resource counts (bar chart)
- Structure counts
- Height statistics (min, max, average)
- River count

---

## World Generation

### Using Seeds

Seeds are numbers that determine world generation. The same seed always produces the same world.

**To generate a world with a specific seed:**

1. Enter a number in the "Seed" input field (e.g., `12345`)
2. Click the "Generate" button
3. Wait for chunks to load

**To generate a random world:**

1. Leave the seed field empty or enter `0`
2. Click "Generate"
3. A random seed will be assigned

**Sharing worlds:**
- Copy the seed number to share with others
- Anyone using the same seed and parameters will see the identical world
- Use the "Copy Seed" button in the World Manager section

### Generation Process

When you click "Generate":

1. **Initialization**: The engine creates a new ChunkManager with your parameters
2. **Initial Load**: A 3x3 grid of chunks (9 chunks) loads around the origin
3. **Progressive Loading**: As you move the camera, new chunks load automatically
4. **Unloading**: Distant chunks unload to conserve memory

**Loading Indicator**: Watch for the loading spinner during generation.

---

## Terrain Parameters

Terrain parameters control the shape and characteristics of the landscape.

### Base Scale (0.001 - 0.1)

Controls the overall size of terrain features.
- **Lower values** (0.001 - 0.005): Large, sweeping features (continents, mountain ranges)
- **Higher values** (0.05 - 0.1): Small, frequent variations (hills, valleys)
- **Default**: 0.01

**Example**: Try 0.003 for dramatic mountain ranges, or 0.05 for rolling hills.

### Octaves (1 - 8)

Number of noise layers combined to create detail.
- **Lower values** (1-2): Smooth, simple terrain
- **Higher values** (6-8): Complex, detailed terrain with multiple scales
- **Default**: 4

**Example**: Set to 2 for simple plains, or 7 for highly detailed landscapes.

### Persistence (0.1 - 0.9)

Controls how much each octave contributes to the final result.
- **Lower values** (0.1 - 0.3): Smooth terrain with subtle details
- **Higher values** (0.6 - 0.9): Rough, highly detailed terrain
- **Default**: 0.5

**Example**: Use 0.3 for gentle landscapes, or 0.7 for rugged mountains.

### Lacunarity (1.5 - 3.0)

Frequency multiplier between octaves.
- **Lower values** (1.5 - 2.0): Uniform detail distribution
- **Higher values** (2.5 - 3.0): Sharp contrast between large and small features
- **Default**: 2.0

**Example**: Try 2.5 for dramatic terrain with sharp peaks.

### Warp Strength (0 - 100)

Domain warping intensity for organic, natural-looking shapes.
- **0**: No warping (regular noise patterns)
- **30-50**: Moderate warping (natural-looking terrain)
- **80-100**: Extreme warping (surreal, twisted landscapes)
- **Default**: 30

**Example**: Set to 0 for geometric patterns, or 80 for alien landscapes.

### Height Multiplier (0.5 - 2.0)

Final scaling factor for terrain height.
- **Lower values** (0.5 - 0.8): Flat, low-relief terrain
- **Higher values** (1.5 - 2.0): Tall mountains and deep valleys
- **Default**: 1.0

**Example**: Use 0.6 for plains, or 1.8 for dramatic elevation changes.

### 3D Noise

Enable 3D noise for volumetric terrain features with vertical variation.

**Enable 3D**: Checkbox to toggle 3D noise generation
**Z Scale** (0.1 - 1.0): Controls vertical variation intensity
- **Lower values** (0.1 - 0.3): Subtle vertical variation
- **Higher values** (0.7 - 1.0): Strong vertical features
- **Default**: 0.5

**Example**: Enable 3D noise with Z Scale 0.7 for overhangs and caves.

---

## Biome System

Biomes are ecosystem types that determine terrain appearance and resource distribution.

### Available Biomes

1. **Ocean**: Deep water (dark blue)
2. **Beach**: Coastal sand (tan/yellow)
3. **Desert**: Arid sand (light brown)
4. **Plains**: Grasslands (green)
5. **Forest**: Dense trees (dark green)
6. **Taiga**: Coniferous forest (blue-green)
7. **Tundra**: Cold plains (light gray)
8. **Mountain**: Rocky peaks (gray/white)

### Basic Biome Parameters

**Temperature Scale** (0.001 - 0.01): Controls temperature variation
- Lower values: Large temperature zones
- Higher values: Frequent temperature changes
- **Default**: 0.005

**Moisture Scale** (0.001 - 0.01): Controls moisture variation
- Lower values: Large moisture zones
- Higher values: Frequent moisture changes
- **Default**: 0.005

**Blend Radius** (1 - 10): Smoothness of biome transitions
- Lower values: Sharp biome boundaries
- Higher values: Gradual transitions
- **Default**: 5

### Enhanced Biome Features

**Biome Transitions**: Smooth blending between adjacent biomes
- **Enable Transitions**: Checkbox to toggle
- **Transition Width** (5 - 20): Width of transition zones in world units
- **Default**: 10

**Micro-Biomes**: Small localized biome variations
- **Enable Micro-Biomes**: Checkbox to toggle
- **Micro-Biome Frequency** (0.01 - 0.5): Rarity of micro-biomes
- **Default**: 0.1

**Micro-Biome Types**:
- **Oasis**: Water sources in deserts
- **Clearing**: Open spaces in forests
- **Pond**: Small water bodies in plains
- **Grove**: Tree clusters in tundra

**Elevation Bands**: Altitude-based zones in mountains
- **Enable Elevation Bands**: Checkbox to toggle
- **Snow Line Elevation** (0.6 - 0.95): Height threshold for snow
- **Default**: 0.8

**Elevation Band Types**:
- **Foothills**: Below tree line, forested
- **Slopes**: Above tree line, rocky
- **Peaks**: Above snow line, snowy

---

## River Networks

Rivers add dynamic water systems to your world.

### Basic River Parameters

**Source Elevation** (0.5 - 0.9): Minimum height for river sources
- Higher values: Rivers start on mountains
- Lower values: Rivers start on hills
- **Default**: 0.7

**Min Flow Length** (5 - 50): Minimum river length to keep
- Lower values: Many short rivers
- Higher values: Only long rivers
- **Default**: 10

**Flow Width** (1 - 5): Width of river paths in tiles
- **Default**: 2

### Advanced River Features

**Tributaries**: Branching river systems
- **Enable Tributaries**: Checkbox to toggle
- **Tributary Probability** (0.1 - 0.5): Chance of tributary formation
- **Default**: 0.3

**Lakes**: Water bodies in depressions
- **Enable Lakes**: Checkbox to toggle

**Deltas**: River mouths with multiple branches
- **Enable Deltas**: Checkbox to toggle

**Note**: Advanced river features (tributaries, lakes, deltas) are partially implemented. Basic river generation is fully functional.

---

## Resources and Structures

### Resources

Five resource types can be placed in the world:

1. **Iron**: Gray markers, found in mountains and plains
2. **Gold**: Yellow markers, rare, found in mountains
3. **Coal**: Black markers, found in forests and mountains
4. **Stone**: Light gray markers, common in mountains
5. **Wood**: Brown markers, found in forests

**Resource Controls**:
- **Enable checkboxes**: Toggle each resource type
- **Density Threshold** (0.3 - 0.9): Controls resource rarity
  - Lower values: More resources
  - Higher values: Fewer resources
  - **Default**: 0.6

### Structures

Three structure types can be placed:

1. **Village**: Settlements in plains
2. **Ruins**: Ancient structures in various biomes
3. **Tower**: Tall structures on elevated terrain

**Structure Controls**:
- **Enable checkboxes**: Toggle each structure type
- **Min Distance** (5 - 30): Minimum spacing between structures
  - Lower values: Structures can be closer
  - Higher values: Structures are spread out
  - **Default**: 10

---

## Performance Features

### Level of Detail (LOD)

LOD reduces detail for distant chunks to improve performance.

**Enable LOD**: Checkbox to toggle LOD system

**LOD Levels**:
- **HIGH**: 0-2 chunks from camera (full detail)
- **MEDIUM**: 2-5 chunks from camera (50% resolution, 50% features)
- **LOW**: 5+ chunks from camera (25% resolution, 10% features)

**Visual Indicators**: Different colors or wireframe density show LOD levels.

**Performance Impact**: LOD can improve frame rate by 2-3x with many chunks loaded.

### Worker Pool

Multi-threaded chunk generation using Web Workers.

**Enable Worker Pool**: Checkbox to toggle

**Max Workers** (1 - 16): Number of parallel workers
- **Recommended**: Set to your CPU core count (typically 4-8)
- **Default**: Navigator.hardwareConcurrency (auto-detect)

**Performance Impact**: Worker Pool can reduce generation time by 50-70% with multiple chunks.

**Statistics**: Watch the Performance Monitor for:
- Active workers count
- Queued tasks count
- Per-worker generation time

### Incremental Generation

Progressive chunk generation to maintain smooth frame rate.

**Enable Incremental**: Checkbox to toggle

**Time Budget** (8 - 32 ms): Time allocated per frame for generation
- **16ms**: Target 60fps
- **8ms**: More responsive, slower generation
- **32ms**: Faster generation, may drop frames
- **Default**: 16ms

**Generation Stages**:
1. TERRAIN: Heightmap generation
2. BIOMES: Biome classification
3. RIVERS: River network generation
4. RESOURCES: Resource placement
5. STRUCTURES: Structure placement
6. COMPLETE: Chunk ready

**Visual Indicators**: Incomplete chunks show with different opacity or colors.

---

## Terrain Editing

Modify terrain in real-time with brush tools.

### Brush Tools

**Raise**: Increase terrain height at clicked location
- Click and hold to continuously raise
- Strength controls how much height is added

**Lower**: Decrease terrain height
- Click and hold to continuously lower
- Strength controls how much height is removed

**Flatten**: Smooth terrain to uniform height
- Sets terrain to the height at the click point
- Useful for creating flat areas

**Smooth**: Blend terrain heights
- Averages heights in the brush area
- Useful for removing sharp edges

### Brush Configuration

**Brush Size** (1 - 10): Radius of modification area
- Larger values affect more tiles
- **Default**: 5

**Brush Strength** (0.1 - 2.0): Intensity of modification
- Lower values: Subtle changes
- Higher values: Dramatic changes
- **Default**: 1.0

**Brush Shape**: Circle or Square (future feature)

### Using the Terrain Editor

1. Select a tool (Raise, Lower, Flatten, or Smooth)
2. Adjust brush size and strength
3. Click on the terrain to apply the modification
4. The terrain mesh updates within 100ms

**Brush Preview**: Hover over terrain to see the brush area (future feature).

### Undo/Redo

**Undo**: Revert the last terrain modification
- Button: "Undo" in Terrain Editor section
- Keyboard: Ctrl+Z (future feature)

**Redo**: Reapply a reverted modification
- Button: "Redo" in Terrain Editor section
- Keyboard: Ctrl+Y (future feature)

**History**: The demo maintains a modification history stack.

### Saving Modified Terrain

Terrain modifications are automatically included when you save the world:

1. Make terrain modifications
2. Click "Save World" in World Manager
3. Choose format (JSON or Binary)
4. Enable "Modified Only" to save only changed chunks
5. Download the file

When you load the saved world, all modifications are restored.

---

## Camera Controls

### Mouse Controls

**Orbit (Rotate)**:
- Click and drag with left mouse button
- Rotates camera around the target point

**Zoom**:
- Scroll mouse wheel up to zoom in
- Scroll mouse wheel down to zoom out

**Pan**:
- Click and drag with right mouse button
- Moves camera parallel to the view plane

### Keyboard Controls

**Movement**:
- `W`: Move camera forward
- `A`: Move camera left
- `S`: Move camera backward
- `D`: Move camera right

**Speed**: Hold `Shift` to move faster (future feature)

### Camera Buttons

**Reset Camera**: Returns camera to default position and orientation
- Button: "Reset Camera" in Camera Controls section

**Top-Down View**: Switches to orthographic top-down view
- Button: "Top-Down View"
- Useful for seeing the overall world layout

**Follow Terrain**: Camera maintains fixed height above terrain
- Button: "Follow Terrain"
- Useful for exploring at ground level

### Camera Position Display

The current camera position in world coordinates is displayed in the interface:
- **X**: East-West position
- **Y**: Altitude
- **Z**: North-South position

---

## World Management

### Saving Worlds

**To save your world**:

1. Click "Save World" button in World Manager section
2. Choose format:
   - **JSON**: Human-readable, larger file size
   - **Binary**: Compact, faster loading
3. Configure options:
   - **Compress**: Enable gzip compression (recommended)
   - **Modified Only**: Save only modified chunks (smaller file)
4. Click "Download"
5. The file downloads to your browser's download folder

**File naming**: Files are named `world-[seed]-[timestamp].json` or `.bin`

**Checksum**: A checksum is displayed after saving for verification.

### Loading Worlds

**To load a saved world**:

1. Click "Load World" button
2. Select a previously saved world file (.json or .bin)
3. Wait for the world to load
4. The world state is restored, including all modifications

**Validation**: The demo validates the checksum when loading to ensure data integrity.

### Exporting Data

**Export Heightmap**:
- Exports terrain height data as a PNG image
- Grayscale image where brightness = height
- Useful for importing into other tools

**Export Biome Map**:
- Exports biome distribution as a colored PNG image
- Each biome has a distinct color
- Useful for visualization and analysis

**Export Configuration**:
- Exports all generation parameters as JSON
- Useful for sharing configurations
- Can be imported by editing the file and loading

### Sharing

**Copy Seed**:
- Copies the current seed to clipboard
- Share the seed with others to generate the same world
- **Note**: They must use the same parameters

**Generate Shareable URL**:
- Creates a URL with all parameters encoded
- Share the URL to let others see your exact configuration
- Opens in a new tab with parameters pre-loaded

**URL Parameters**: The demo supports URL parameters for all settings:
```
?seed=12345&baseScale=0.01&octaves=4&preset=mountainous
```

---

## Visualization Options

### Visibility Toggles

Control what elements are displayed in the 3D viewer:

**Terrain**: Show/hide the terrain mesh
- Checkbox: "Show Terrain"
- **Default**: Enabled

**Biomes**: Show/hide biome-based coloring
- Checkbox: "Show Biomes"
- **Default**: Enabled
- When disabled, terrain uses a uniform color

**Rivers**: Show/hide river overlays
- Checkbox: "Show Rivers"
- **Default**: Enabled
- Rivers appear as blue lines on the terrain

**Resources**: Show/hide resource markers
- Checkbox: "Show Resources"
- **Default**: Enabled
- Colored dots indicate resource locations

**Structures**: Show/hide structure markers
- Checkbox: "Show Structures"
- **Default**: Enabled
- 3D models or colored markers show structure locations

**Chunk Boundaries**: Show/hide chunk grid
- Checkbox: "Show Chunk Boundaries"
- **Default**: Disabled
- Wireframe grid shows chunk edges

**Wireframe**: Show/hide wireframe overlay
- Checkbox: "Show Wireframe"
- **Default**: Disabled
- Shows the underlying mesh structure

**Update Speed**: Visibility changes apply within 50ms.

### Lighting

The demo uses a combination of lighting:
- **Ambient Light**: Provides base illumination
- **Directional Light**: Simulates sunlight with shadows (future feature)

---

## Performance Monitoring

The Performance Monitor displays real-time metrics in the right panel.

### Frame Rate (FPS)

**Current FPS**: Frames per second
- **Target**: 60 FPS
- **Good**: 50-60 FPS
- **Acceptable**: 30-50 FPS
- **Poor**: <30 FPS

**Tips for improving FPS**:
- Enable LOD system
- Reduce visible chunk count
- Disable wireframe mode
- Close other browser tabs

### Generation Time

**Average Generation Time**: Time to generate one chunk
- **Target**: <100ms
- **Typical**: 20-50ms

**Breakdown by Stage**:
- Terrain generation time
- Biome classification time
- River generation time
- Resource placement time
- Structure placement time

### Memory Usage

**Cache Memory**: Memory used by loaded chunks
- Displays current usage and maximum cache size
- **Typical**: 46KB per chunk (32x32)

**Cache Hit Rate**: Percentage of chunks loaded from cache vs. generated
- Higher is better (less regeneration)

### LOD Statistics

When LOD is enabled:
- **High Detail Chunks**: Count of chunks at full detail
- **Medium Detail Chunks**: Count at 50% detail
- **Low Detail Chunks**: Count at 25% detail

### Worker Pool Statistics

When Worker Pool is enabled:
- **Active Workers**: Currently generating chunks
- **Queued Tasks**: Chunks waiting for generation
- **Completed Tasks**: Total chunks generated
- **Avg Worker Time**: Average generation time per worker

### Incremental Generation Statistics

When Incremental Generation is enabled:
- **Chunks in Progress**: Map of chunk → current stage
- **Current FPS**: Frame rate during generation
- **Stage Progress**: Visual indicator of completion

**Update Frequency**: Metrics update every 500ms.

---

## Statistics Display

The Statistics Display shows world information in the bottom panel.

### Chunk Statistics

**Total Chunks**: Number of generated chunks
- Increases as you explore the world
- Decreases when distant chunks unload

### Biome Distribution

**Pie Chart**: Visual representation of biome percentages
- Each biome has a distinct color
- Hover to see exact percentages

**Biome Percentages**: Numerical breakdown
- Ocean: X%
- Beach: X%
- Desert: X%
- Plains: X%
- Forest: X%
- Taiga: X%
- Tundra: X%
- Mountain: X%

### Resource Counts

**Bar Chart**: Visual representation of resource quantities
- Each resource type has a distinct color
- Height indicates quantity

**Resource Totals**:
- Iron: X
- Gold: X
- Coal: X
- Stone: X
- Wood: X

### Structure Counts

**Structure Totals**:
- Village: X
- Ruins: X
- Tower: X

### Height Statistics

**Average Height**: Mean terrain elevation
**Min Height**: Lowest point in the world
**Max Height**: Highest point in the world

**Height Range**: Max - Min

### River Statistics

**Total Rivers**: Number of river systems
- Includes main rivers and tributaries (when implemented)

**Update Frequency**: Statistics update when new chunks are generated.

---

## Keyboard Shortcuts

### Camera

- `W` - Move forward
- `A` - Move left
- `S` - Move backward
- `D` - Move right
- `Mouse Drag` - Rotate camera
- `Mouse Wheel` - Zoom in/out
- `Right Click + Drag` - Pan camera

### Interface

- `?` or `/` - Show help dialog
- `Escape` - Close modal dialogs
- `Ctrl+Z` - Undo terrain modification (future feature)
- `Ctrl+Y` - Redo terrain modification (future feature)

### Toggles

- `T` - Toggle terrain visibility (future feature)
- `B` - Toggle biome colors (future feature)
- `R` - Toggle rivers (future feature)
- `G` - Toggle chunk boundaries (future feature)

---

## Tips and Best Practices

### Getting Started

1. **Start with presets**: Use the preset dropdown to see interesting configurations quickly
2. **Experiment gradually**: Change one parameter at a time to understand its effect
3. **Use tooltips**: Hover over parameter labels to see detailed descriptions
4. **Save favorites**: Export configurations you like for later use

### Performance Optimization

1. **Enable LOD**: Improves frame rate with many chunks loaded
2. **Use Worker Pool**: Speeds up chunk generation significantly
3. **Enable Incremental Generation**: Maintains smooth frame rate during loading
4. **Limit visible chunks**: Don't explore too far from the origin
5. **Close other tabs**: Free up browser resources

### World Generation

1. **Use meaningful seeds**: Pick memorable numbers for worlds you want to revisit
2. **Document parameters**: Export configuration when you create interesting worlds
3. **Test incrementally**: Generate, observe, adjust, repeat
4. **Combine features**: Enable multiple advanced features for rich worlds

### Terrain Editing

1. **Start with low strength**: Use 0.5-1.0 strength for subtle modifications
2. **Use smooth tool**: Clean up rough edges after raising/lowering
3. **Save frequently**: Save your world after significant modifications
4. **Undo liberally**: Don't be afraid to experiment and undo

### Sharing Worlds

1. **Use shareable URLs**: Easiest way to share complete configurations
2. **Document seed and parameters**: If sharing just the seed, list all parameters
3. **Export configurations**: Share JSON files for exact reproduction
4. **Save before sharing**: Ensure your world is saved before generating the URL

---

## Troubleshooting

### Performance Issues

**Problem**: Low frame rate (<30 FPS)

**Solutions**:
1. Enable LOD system
2. Reduce number of loaded chunks (stay near origin)
3. Disable wireframe mode
4. Close other browser tabs
5. Try a different browser (Chrome/Edge typically perform best)
6. Reduce screen resolution or browser window size

**Problem**: Slow chunk generation

**Solutions**:
1. Enable Worker Pool
2. Reduce octaves (try 3-4 instead of 6-8)
3. Disable 3D noise if not needed
4. Reduce resource and structure density

### Visual Issues

**Problem**: Terrain appears flat or uniform

**Solutions**:
1. Increase height multiplier (try 1.5-2.0)
2. Increase warp strength (try 50-80)
3. Increase octaves (try 5-6)
4. Decrease base scale (try 0.005)

**Problem**: Biomes look wrong or missing

**Solutions**:
1. Ensure "Show Biomes" is enabled
2. Check biome scale parameters (try 0.005)
3. Increase blend radius for smoother transitions
4. Regenerate the world

**Problem**: No rivers visible

**Solutions**:
1. Ensure "Show Rivers" is enabled
2. Increase source elevation (try 0.6-0.7)
3. Decrease min flow length (try 5-10)
4. Regenerate the world (rivers are random)

### Loading/Saving Issues

**Problem**: World won't load

**Solutions**:
1. Verify file format (.json or .bin)
2. Check file isn't corrupted
3. Ensure you're using the same engine version
4. Try loading in a different browser

**Problem**: Modifications not saved

**Solutions**:
1. Ensure you made modifications before saving
2. Don't enable "Modified Only" if you want all chunks
3. Verify the file downloaded successfully
4. Check browser download settings

### Browser Compatibility

**Problem**: Demo won't start or shows errors

**Solutions**:
1. Verify WebGL support: Visit https://get.webgl.org/
2. Update your browser to the latest version
3. Try a different browser (Chrome, Firefox, Safari, Edge)
4. Check browser console for error messages (F12)
5. Disable browser extensions that might interfere

**Problem**: Worker Pool not working

**Solutions**:
1. Ensure your browser supports Web Workers
2. Check that worker.js is accessible
3. Verify HTTPS or localhost (workers require secure context)
4. Disable Worker Pool and use single-threaded generation

### Other Issues

**Problem**: Controls not responding

**Solutions**:
1. Click on the 3D viewer to focus it
2. Refresh the page (F5)
3. Clear browser cache
4. Check browser console for errors

**Problem**: Help dialog won't open

**Solutions**:
1. Try clicking the help button in the header
2. Press `?` key (not in an input field)
3. Refresh the page
4. Check browser console for errors

---

## Additional Resources

### Engine Documentation

For detailed API documentation and integration guides:
- **GitHub Repository**: https://github.com/yourusername/procedural-world-engine
- **README**: See the main README.md in the project root
- **Examples**: Check the `examples/` directory for code samples

### Community

- **Issues**: Report bugs or request features on GitHub Issues
- **Discussions**: Join the community on GitHub Discussions
- **Contributing**: See CONTRIBUTING.md for guidelines

### Video Tutorials

See `VIDEO_WALKTHROUGH_SCRIPT.md` for a guided tour of all features.

---

## Conclusion

This demo showcases the full capabilities of the Procedural World Engine. Experiment with different parameters, explore the generated worlds, and see how the engine can power your procedural generation needs.

**Happy exploring!** 🌍✨

---

*Last Updated: 2024*
*Version: 1.0.0*
*Requirements: 20.1, 20.2, 20.3*
