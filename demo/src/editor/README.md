# Terrain Editor

The Terrain Editor component provides interactive terrain modification tools with brush-based operations.

## Features

- **Brush Tools**: Raise, lower, flatten, and smooth terrain
- **Brush Configuration**: Adjustable size (1-10), strength (0.1-2.0), and shape (circle/square)
- **Brush Preview**: Visual indicator showing brush area and position
- **Undo/Redo**: Full history support for terrain modifications (up to 50 operations)
- **Modification Tracking**: Integrates with ChunkManager's modification tracking system

## Usage

```typescript
import { TerrainEditor, BrushShape } from './editor/TerrainEditor';
import { DemoApp, TerrainTool } from './core/DemoApp';
import { WorldViewer } from './viewer/WorldViewer';

// Initialize
const editor = new TerrainEditor();
editor.initialize(app, viewer);

// Configure brush
editor.setTool(TerrainTool.RAISE);
editor.setBrushSize(5);
editor.setBrushStrength(1.0);
editor.setBrushShape(BrushShape.CIRCLE);

// Apply modifications
editor.applyBrush(worldX, worldY);

// Undo/Redo
if (editor.canUndo()) {
  editor.undo();
}

if (editor.canRedo()) {
  editor.redo();
}

// Show/hide brush preview
editor.showBrushPreview(worldX, worldY);
editor.hideBrushPreview();

// Listen for modifications
const unsubscribe = editor.onModification((worldX, worldY, tool) => {
  console.log(`Modified terrain at (${worldX}, ${worldY}) with ${tool}`);
});
```

## Brush Tools

### Raise
Increases terrain height at the brush location with falloff based on distance from center.

### Lower
Decreases terrain height at the brush location with falloff based on distance from center.

### Flatten
Smoothly interpolates terrain towards the height at the brush center.

### Smooth
Averages terrain height with neighboring tiles to create smooth transitions.

## Brush Shapes

- **Circle**: Radial falloff from center point
- **Square**: Square area with distance calculated as max(|dx|, |dy|)

## Integration

The TerrainEditor integrates with:
- **DemoApp**: Syncs tool and brush settings with application state
- **WorldViewer**: Updates terrain mesh visualization after modifications
- **ChunkManager**: Records modifications for persistence and serialization

## Implementation Notes

- Modifications are applied through ChunkManager's `modifyTile()` method
- Undo/Redo history stores heightmap snapshots for affected chunks
- Brush preview requires access to viewer's scene (currently limited)
- All modifications trigger viewer mesh updates within 100ms
