# Quick Reference Guide - Procedural World Engine Demo

A concise reference for all demo features and controls.

---

## 🎮 Camera Controls

| Action | Control |
|--------|---------|
| Rotate (Orbit) | Left Click + Drag |
| Zoom | Mouse Wheel |
| Pan | Right Click + Drag |
| Move Forward | `W` |
| Move Left | `A` |
| Move Backward | `S` |
| Move Right | `D` |
| Show Help | `?` or `/` |
| Close Dialog | `Escape` |

---

## 🌍 World Generation

### Quick Start
1. Enter a seed number (or leave empty for random)
2. Click "Generate" button
3. Wait for chunks to load

### Presets
- **Mountainous**: Dramatic peaks and valleys
- **Flat Plains**: Gentle rolling terrain
- **Island World**: Archipelago with beaches
- **River Valley**: Dense river networks
- **Performance Test**: Optimized for testing

---

## 🎨 Terrain Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Base Scale | 0.001 - 0.1 | 0.01 | Feature size (lower = larger) |
| Octaves | 1 - 8 | 4 | Detail layers (higher = more detail) |
| Persistence | 0.1 - 0.9 | 0.5 | Roughness (higher = rougher) |
| Lacunarity | 1.5 - 3.0 | 2.0 | Frequency multiplier |
| Warp Strength | 0 - 100 | 30 | Organic shapes (higher = more warped) |
| Height Multiplier | 0.5 - 2.0 | 1.0 | Overall height scale |

### 3D Noise
- **Enable 3D**: Checkbox for volumetric features
- **Z Scale**: 0.1 - 1.0 (vertical variation intensity)

---

## 🌲 Biome System

### 8 Biome Types
1. **Ocean** - Dark blue, deep water
2. **Beach** - Tan, coastal sand
3. **Desert** - Light brown, arid
4. **Plains** - Green, grasslands
5. **Forest** - Dark green, dense trees
6. **Taiga** - Blue-green, coniferous
7. **Tundra** - Light gray, cold
8. **Mountain** - Gray/white, rocky peaks

### Parameters
| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Temperature Scale | 0.001 - 0.01 | 0.005 | Temperature variation |
| Moisture Scale | 0.001 - 0.01 | 0.005 | Moisture variation |
| Blend Radius | 1 - 10 | 5 | Transition smoothness |

### Enhanced Features
- **Transitions**: Smooth biome blending (width: 5-20)
- **Micro-Biomes**: Localized variations (frequency: 0.01-0.5)
  - Oasis (desert), Clearing (forest), Pond (plains), Grove (tundra)
- **Elevation Bands**: Mountain zones (snow line: 0.6-0.95)
  - Foothills, Slopes, Peaks

---

## 💧 Rivers

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Source Elevation | 0.5 - 0.9 | 0.7 | River starting height |
| Min Flow Length | 5 - 50 | 10 | Minimum river length |
| Flow Width | 1 - 5 | 2 | River width in tiles |

### Advanced Features
- **Tributaries**: Branching rivers (probability: 0.1-0.5)
- **Lakes**: Water bodies in depressions
- **Deltas**: River mouths with branches

---

## 🏔️ Resources & Structures

### Resources (5 Types)
- **Iron** - Gray markers, mountains/plains
- **Gold** - Yellow markers, rare, mountains
- **Coal** - Black markers, forests/mountains
- **Stone** - Light gray markers, mountains
- **Wood** - Brown markers, forests

**Density Threshold**: 0.3 - 0.9 (lower = more resources)

### Structures (3 Types)
- **Village** - Settlements in plains
- **Ruins** - Ancient structures
- **Tower** - Tall structures on elevated terrain

**Min Distance**: 5 - 30 (spacing between structures)

---

## ⚡ Performance Features

### Level of Detail (LOD)
- **HIGH**: 0-2 chunks (100% detail)
- **MEDIUM**: 2-5 chunks (50% detail)
- **LOW**: 5+ chunks (25% detail)

**Effect**: 2-3x FPS improvement

### Worker Pool
- **Max Workers**: 1-16 (recommended: CPU core count)
- **Effect**: 50-70% faster generation

### Incremental Generation
- **Time Budget**: 8-32ms (16ms = 60fps target)
- **Stages**: Terrain → Biomes → Rivers → Resources → Structures
- **Effect**: Maintains smooth frame rate

---

## 🛠️ Terrain Editing

### Tools
- **Raise**: Increase terrain height
- **Lower**: Decrease terrain height
- **Flatten**: Smooth to uniform height
- **Smooth**: Blend terrain heights

### Brush Settings
- **Size**: 1 - 10 (radius of effect)
- **Strength**: 0.1 - 2.0 (intensity)

### Undo/Redo
- **Undo**: Revert last modification
- **Redo**: Reapply reverted modification

---

## 💾 World Management

### Save Options
- **Format**: JSON (readable) or Binary (compact)
- **Compress**: Enable gzip compression
- **Modified Only**: Save only changed chunks

### Export Options
- **Heightmap**: PNG image (grayscale)
- **Biome Map**: PNG image (colored)
- **Configuration**: JSON file (parameters)

### Sharing
- **Copy Seed**: Copy to clipboard
- **Shareable URL**: Generate URL with parameters

---

## 👁️ Visualization

### Visibility Toggles
- ☑️ **Terrain**: Show/hide terrain mesh
- ☑️ **Biomes**: Show/hide biome colors
- ☑️ **Rivers**: Show/hide river overlays
- ☑️ **Resources**: Show/hide resource markers
- ☑️ **Structures**: Show/hide structure markers
- ☐ **Chunk Boundaries**: Show/hide chunk grid
- ☐ **Wireframe**: Show/hide mesh structure

---

## 📊 Performance Metrics

### Key Metrics
- **FPS**: Target 60, Good 50-60, Acceptable 30-50
- **Generation Time**: Target <100ms, Typical 20-50ms
- **Memory**: ~46KB per chunk (32x32)

### Statistics
- **Chunk Count**: Total loaded chunks
- **Biome Distribution**: Percentage breakdown
- **Resource Counts**: By type
- **Structure Counts**: By type
- **Height Stats**: Min, Max, Average
- **River Count**: Total river systems

---

## 🔧 Troubleshooting

### Low FPS
1. Enable LOD system
2. Reduce loaded chunks (stay near origin)
3. Disable wireframe mode
4. Close other browser tabs

### Slow Generation
1. Enable Worker Pool
2. Reduce octaves (3-4)
3. Disable 3D noise
4. Reduce resource density

### Flat Terrain
1. Increase height multiplier (1.5-2.0)
2. Increase warp strength (50-80)
3. Increase octaves (5-6)
4. Decrease base scale (0.005)

### No Rivers
1. Enable "Show Rivers"
2. Increase source elevation (0.6-0.7)
3. Decrease min flow length (5-10)
4. Regenerate world

---

## 💡 Quick Tips

1. **Start with presets** for quick interesting results
2. **Hover over labels** to see parameter tooltips
3. **Enable LOD + Worker Pool** for best performance
4. **Use meaningful seeds** for worlds you want to revisit
5. **Save frequently** when making modifications
6. **Export configurations** for favorite setups
7. **Use shareable URLs** to share complete configurations
8. **Check Performance Monitor** to optimize settings

---

## 📖 Resources

- **Full User Guide**: `USER_GUIDE.md`
- **Video Walkthrough**: `VIDEO_WALKTHROUGH_SCRIPT.md`
- **Engine Documentation**: `../README.md`
- **Examples**: `../examples/`
- **Help Dialog**: Press `?` in the demo

---

## 🎯 Common Workflows

### Create Mountainous Terrain
1. Set Base Scale: 0.003
2. Set Octaves: 6
3. Set Warp Strength: 80
4. Set Height Multiplier: 1.8
5. Generate

### Create Island World
1. Use "Island World" preset
2. Enable Biome Transitions
3. Set Blend Radius: 8
4. Generate

### Optimize Performance
1. Enable LOD
2. Enable Worker Pool (max workers)
3. Enable Incremental Generation (16ms)
4. Disable wireframe
5. Generate

### Create and Save Custom World
1. Adjust parameters to taste
2. Generate world
3. Make terrain modifications
4. Click "Save World"
5. Choose Binary + Compress
6. Download file

### Share Configuration
1. Set up desired parameters
2. Generate world
3. Click "Generate Shareable URL"
4. Copy and share the URL

---

*Requirements: 20.1, 20.2, 20.3*
*Last Updated: 2024*
