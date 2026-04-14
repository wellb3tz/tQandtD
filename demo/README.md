# Procedural World Engine - Interactive Demo

An interactive 3D web application showcasing all capabilities of the Procedural World Engine through an intuitive user interface.

![Demo Screenshot](screenshot-placeholder.png)
*Screenshot: The demo application showing a generated world with mountains, rivers, and biomes*

---

## 🚀 Quick Start

### Running the Demo

1. **Open in Browser**:
   ```bash
   # From the project root
   cd demo
   # Open index.html in your browser
   ```

2. **Or use a local server** (recommended):
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Then open http://localhost:8000
   ```

3. **Or build with Vite**:
   ```bash
   npm install
   npm run dev
   ```

### First Steps

1. The demo loads with a default generated world
2. Use your mouse to rotate, zoom, and pan the camera
3. Try selecting a preset from the dropdown (e.g., "Mountainous")
4. Click "Generate" to see the new world
5. Press `?` to open the help dialog

---

## 📚 Documentation

### User Documentation

- **[User Guide](USER_GUIDE.md)** - Comprehensive guide covering all features
  - Getting started
  - Interface overview
  - Parameter explanations
  - Feature tutorials
  - Troubleshooting

- **[Quick Reference](QUICK_REFERENCE.md)** - Concise reference for quick lookup
  - Keyboard shortcuts
  - Parameter ranges
  - Common workflows
  - Quick tips

- **[Video Walkthrough Script](VIDEO_WALKTHROUGH_SCRIPT.md)** - Guide for creating video tutorials
  - Section-by-section script
  - Recording tips
  - Screenshot suggestions

### Technical Documentation

- **[Browser Compatibility](BROWSER_COMPATIBILITY.md)** - Browser support and testing
- **[Testing Guide](TESTING_BROWSER_COMPATIBILITY.md)** - How to test compatibility

---

## ✨ Features

### World Generation
- ✅ Deterministic seed-based generation
- ✅ Infinite world exploration
- ✅ Automatic chunk loading/unloading
- ✅ 5 preset configurations
- ✅ Real-time parameter adjustment

### Terrain System
- ✅ Multi-octave noise with domain warping
- ✅ 3D noise for volumetric features
- ✅ Configurable height and scale
- ✅ Real-time terrain editing (raise, lower, flatten, smooth)
- ✅ Undo/redo support

### Biome System
- ✅ 8 diverse biome types
- ✅ Smooth biome transitions
- ✅ Micro-biomes (oasis, clearing, pond, grove)
- ✅ Elevation bands (foothills, slopes, peaks)
- ✅ Biome-based terrain coloring

### Water Systems
- ✅ River network generation
- ✅ Flow-based river width
- ✅ Tributary support (data structures)
- ✅ Lake generation (data structures)
- ✅ Delta formation (data structures)

### Resources & Structures
- ✅ 5 resource types with biome-based distribution
- ✅ 3 structure types with placement rules
- ✅ Poisson disk sampling for realistic spacing
- ✅ Visual markers and 3D models

### Performance Features
- ✅ **Level of Detail (LOD)**: Distance-based detail reduction
- ✅ **Worker Pool**: Multi-threaded chunk generation
- ✅ **Incremental Generation**: Progressive rendering for smooth FPS
- ✅ Frustum culling and object pooling
- ✅ Real-time performance monitoring

### World Management
- ✅ Save/load worlds (JSON and Binary formats)
- ✅ Compression support
- ✅ Modification tracking and persistence
- ✅ Export heightmap and biome maps (PNG)
- ✅ Export configuration (JSON)
- ✅ Shareable URLs with encoded parameters

### Visualization
- ✅ 3D terrain rendering with Three.js
- ✅ Biome-based vertex coloring
- ✅ River overlays
- ✅ Resource and structure markers
- ✅ Chunk boundary visualization
- ✅ Wireframe mode
- ✅ Toggleable layer visibility

### User Interface
- ✅ Responsive layout (desktop and mobile)
- ✅ Collapsible control panel
- ✅ Real-time performance monitor
- ✅ Statistics display with charts
- ✅ Interactive help modal
- ✅ Tooltips for all parameters
- ✅ Error handling and user feedback

---

## 🎮 Controls

### Camera
- **Rotate**: Left Click + Drag
- **Zoom**: Mouse Wheel
- **Pan**: Right Click + Drag
- **Move**: `W` `A` `S` `D` keys

### Interface
- **Help**: `?` or `/` key
- **Close Dialog**: `Escape` key

See [Quick Reference](QUICK_REFERENCE.md) for complete control list.

---

## 📊 Performance

### Targets
- **Frame Rate**: 60 FPS sustained
- **Generation Time**: <100ms per chunk (typical: 20-50ms)
- **Memory**: ~46KB per chunk (32x32)
- **Initial Load**: <3 seconds
- **Time to Interactive**: <5 seconds

### Optimization Tips
1. Enable LOD system for 2-3x FPS improvement
2. Use Worker Pool for 50-70% faster generation
3. Enable Incremental Generation to maintain 60 FPS
4. Reduce visible chunk count (stay near origin)
5. Disable wireframe mode when not needed

---

## 🌐 Browser Compatibility

### Supported Browsers
- ✅ Chrome/Edge 90+ (Chromium)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Requirements
- WebGL 1.0 or higher
- Web Workers support
- ES2020 JavaScript support
- Minimum 2GB RAM recommended

See [Browser Compatibility](BROWSER_COMPATIBILITY.md) for detailed information.

---

## 🏗️ Project Structure

```
demo/
├── index.html                  # Main HTML file
├── main.ts                     # Application entry point
├── styles.css                  # Global styles
├── src/
│   ├── core/
│   │   └── DemoApp.ts         # Main application class
│   ├── viewer/
│   │   ├── WorldViewer.ts     # 3D rendering with Three.js
│   │   ├── materials.ts       # Material and color definitions
│   │   ├── ObjectPool.ts      # Object pooling for performance
│   │   └── GeometryPools.ts   # Geometry pooling
│   ├── ui/
│   │   ├── ControlPanel.ts    # Parameter controls
│   │   ├── PerformanceMonitor.ts  # Performance metrics
│   │   ├── StatisticsDisplay.ts   # World statistics
│   │   ├── WorldManager.ts    # Save/load/export
│   │   └── HelpModal.ts       # Help documentation
│   ├── editor/
│   │   └── TerrainEditor.ts   # Terrain modification tools
│   ├── config/
│   │   └── presets.ts         # Preset configurations
│   └── utils/
│       ├── coordinates.ts     # Coordinate conversion
│       ├── ErrorHandler.ts    # Error handling
│       └── BrowserCompatibility.ts  # Compatibility checks
├── USER_GUIDE.md              # Comprehensive user guide
├── QUICK_REFERENCE.md         # Quick reference guide
├── VIDEO_WALKTHROUGH_SCRIPT.md  # Video tutorial script
├── BROWSER_COMPATIBILITY.md   # Browser support info
└── README.md                  # This file
```

---

## 🎯 Use Cases

### For Engine Developers
- Test and validate engine features
- Debug generation algorithms
- Profile performance
- Demonstrate capabilities

### For Game Developers
- Evaluate the engine for projects
- Experiment with parameters
- Understand integration patterns
- Test performance on target platforms

### For Technical Artists
- Explore parameter effects
- Create terrain presets
- Design biome distributions
- Visualize procedural generation

### For Students/Learners
- Learn procedural generation techniques
- Understand noise functions
- Study biome systems
- Explore performance optimization

---

## 🔧 Development

### Building

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- DemoApp.test.ts

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

---

## 📝 Examples

### Basic Usage

```typescript
import { DemoApp } from './src/core/DemoApp';

// Initialize the demo
const app = new DemoApp();
await app.initialize();

// Generate a world
await app.generateWorld(12345);

// Update configuration
app.updateEngineConfig({
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0
  }
});
```

### Custom Preset

```typescript
import { PresetConfig } from './src/config/presets';

const customPreset: PresetConfig = {
  name: 'My Custom Preset',
  description: 'A unique terrain configuration',
  config: {
    seed: 12345,
    terrainConfig: {
      baseScale: 0.005,
      octaves: 6,
      persistence: 0.6,
      lacunarity: 2.5,
      warpStrength: 50,
      heightMultiplier: 1.5
    },
    // ... other config
  }
};

app.applyPreset(customPreset);
```

---

## 🤝 Contributing

Contributions are welcome! Please see the main project [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Areas for Contribution
- Additional presets
- UI improvements
- Performance optimizations
- Documentation enhancements
- Browser compatibility testing
- Accessibility improvements

---

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details.

---

## 🔗 Links

- **Engine Repository**: [GitHub](https://github.com/yourusername/procedural-world-engine)
- **Engine Documentation**: [README](../README.md)
- **Examples**: [examples/](../examples/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/procedural-world-engine/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/procedural-world-engine/discussions)

---

## 🙏 Acknowledgments

- **Three.js**: 3D rendering library
- **Vite**: Build tool and dev server
- **TypeScript**: Type-safe JavaScript
- **fast-check**: Property-based testing
- **Vitest**: Testing framework

---

## 📞 Support

- **Documentation**: See [USER_GUIDE.md](USER_GUIDE.md)
- **Quick Help**: Press `?` in the demo
- **Issues**: [GitHub Issues](https://github.com/yourusername/procedural-world-engine/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/procedural-world-engine/discussions)

---

**Requirements Fulfilled**: 20.1, 20.2, 20.3

*Last Updated: 2024*
*Version: 1.0.0*
