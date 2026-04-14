# UI Components

This directory contains the UI components for the Comprehensive Engine Demo application.

## Components

### ControlPanel

Provides interactive controls for all terrain, biome, river, resource, and structure parameters. Supports real-time updates, presets, and collapsible sections.

**Features:**
- Terrain parameter sliders (baseScale, octaves, persistence, etc.)
- Biome configuration controls
- River network settings
- Resource and structure type toggles
- Preset configurations
- Visibility toggles for rendering layers

### PerformanceMonitor

Displays real-time performance metrics and statistics in an overlay panel.

**Metrics:**
- Frame rate (FPS)
- Generation time breakdown by stage
- Memory usage and cache statistics
- Render statistics (vertices, draw calls)
- LOD system statistics
- Worker pool statistics
- Incremental generation progress

### WorldManager

Handles world serialization, loading, and export operations with format selection and compression options.

**Features:**
- **Save World**: Export world data in JSON or binary format
  - Format selection (JSON/Binary)
  - Compression option (deflate)
  - Modified chunks only option
  - Checksum display for integrity verification
  
- **Load World**: Import previously saved world data
  - File validation with checksum verification
  - World information preview (seed, chunk count)
  - Status indicator (valid/invalid)
  
- **Export Maps**: Export heightmap and biome map as images
  - Export type selection (heightmap/biome map)
  - Image format selection (PNG/JPEG)
  - Exports all loaded chunks as a single image
  
- **Shareable URLs**: Generate URLs with current configuration
- **Clipboard Operations**: Copy seed to clipboard

**Usage:**

```typescript
import { WorldManager } from './ui/WorldManager';
import { DemoApp } from './core/DemoApp';

// Initialize
const app = new DemoApp();
await app.initialize();

const worldManager = new WorldManager();
worldManager.initialize(app);

// Show save dialog
worldManager.showSaveDialog();

// Show load dialog
worldManager.showLoadDialog();

// Show export dialog
worldManager.showExportDialog('heightmap');

// Generate shareable URL
const url = worldManager.generateShareableURL();

// Copy seed to clipboard
await worldManager.copySeedToClipboard();

// Get last checksum
const checksum = worldManager.getLastChecksum();

// Clean up
worldManager.dispose();
```

**Dialog Structure:**

All dialogs follow a consistent structure:
- **Modal Header**: Title and close button
- **Modal Body**: Form controls and information displays
- **Modal Footer**: Cancel and confirm buttons

**Save Dialog Options:**
- Format: JSON (human-readable) or Binary (compact)
- Compression: Enable/disable deflate compression
- Modified Only: Save only modified chunks
- Filename: Custom filename for the export

**Load Dialog Features:**
- File input with format detection
- World information preview
- Checksum validation
- Status indicator

**Export Dialog Options:**
- Export type: Heightmap or Biome Map
- Image format: PNG or JPEG
- Filename: Custom filename for the export

**Biome Colors:**
The biome map export uses the following color scheme:
- Forest: Forest Green (34, 139, 34)
- Desert: Moccasin (255, 228, 181)
- Tundra: Light Blue (173, 216, 230)
- Grassland: Light Green (144, 238, 144)
- Mountain: Saddle Brown (139, 69, 19)
- Ocean: Dodger Blue (30, 144, 255)
- Beach: Lemon Chiffon (255, 250, 205)
- Swamp: Dark Green (34, 139, 34)

**Requirements Satisfied:**
- 11.1: Save button with format selection
- 11.2: JSON format support
- 11.3: Binary format support
- 11.4: Compression checkbox
- 11.5: ModifiedOnly checkbox
- 11.6: Load button with file picker
- 11.7: Export heightmap button
- 11.8: Export biome map button
- 11.9: Checksum display after save
- 11.10: Checksum validation when loading

## Styling

All components use CSS custom properties (CSS variables) defined in `demo/styles.css` for consistent theming:

- `--primary-color`: Primary action color
- `--surface-color`: Component background
- `--text-color`: Primary text color
- `--text-secondary`: Secondary text color
- `--border-color`: Border and divider color
- `--success-color`: Success state color
- `--error-color`: Error state color
- `--spacing-*`: Consistent spacing scale

## Testing

Each component has comprehensive unit tests covering:
- Initialization and setup
- UI element creation and visibility
- User interactions and event handling
- State management and updates
- Edge cases and error handling
- Cleanup and disposal

Run tests with:
```bash
npm test -- demo/src/ui/
```
