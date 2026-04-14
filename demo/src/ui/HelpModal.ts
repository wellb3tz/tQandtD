/**
 * HelpModal Component
 * 
 * Displays comprehensive documentation and help information for the demo application.
 * Includes feature descriptions, keyboard shortcuts, and links to engine documentation.
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
 */

export class HelpModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;

  /**
   * Initialize the help modal
   */
  initialize(): void {
    this.createModal();
    this.attachEventListeners();
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(): void {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'modal-dialog hidden';
    this.modal.id = 'help-modal';
    
    // Create modal content
    this.modal.innerHTML = `
      <div class="modal-content help-modal-content">
        <div class="modal-header">
          <h3>📚 Help & Documentation</h3>
          <button class="close-btn" id="help-modal-close" aria-label="Close help">&times;</button>
        </div>
        <div class="modal-body">
          ${this.getHelpContent()}
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="help-modal-ok">Got it!</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
  }

  /**
   * Generate help content HTML
   */
  private getHelpContent(): string {
    return `
      <div class="help-section">
        <h4>🎮 Getting Started</h4>
        <p>
          This demo showcases the Procedural World Engine's capabilities through an interactive 3D visualization.
          Use the controls on the left to adjust generation parameters, and explore the generated world in the 3D viewer.
        </p>
      </div>

      <div class="help-section">
        <h4>🌍 World Generation</h4>
        <ul class="help-list">
          <li><strong>Seed:</strong> Enter a number to generate a deterministic world. Same seed = same world.</li>
          <li><strong>Generate Button:</strong> Click to create a new world with current parameters.</li>
          <li><strong>Presets:</strong> Quick configurations for different terrain types (Mountainous, Flat Plains, etc.).</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>🎨 Terrain Parameters</h4>
        <ul class="help-list">
          <li><strong>Base Scale:</strong> Controls overall terrain feature size (0.001-0.1).</li>
          <li><strong>Octaves:</strong> Number of noise layers for detail (1-8).</li>
          <li><strong>Persistence:</strong> How much each octave contributes (0.1-0.9).</li>
          <li><strong>Lacunarity:</strong> Frequency multiplier between octaves (1.5-3.0).</li>
          <li><strong>Warp Strength:</strong> Domain warping intensity for organic shapes (0-100).</li>
          <li><strong>Height Multiplier:</strong> Overall terrain height scaling (0.5-2.0).</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>🌲 Biome System</h4>
        <ul class="help-list">
          <li><strong>Temperature/Moisture Scale:</strong> Controls biome distribution patterns.</li>
          <li><strong>Blend Radius:</strong> Smoothness of biome transitions.</li>
          <li><strong>Transitions:</strong> Enable smooth blending between biomes.</li>
          <li><strong>Micro Biomes:</strong> Small-scale biome variations for detail.</li>
          <li><strong>Elevation Bands:</strong> Altitude-based biome zones (e.g., snow line).</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>💧 River Networks</h4>
        <ul class="help-list">
          <li><strong>Source Elevation:</strong> Minimum height for river sources (0.5-0.9).</li>
          <li><strong>Min Flow Length:</strong> Minimum river length before termination.</li>
          <li><strong>Tributaries:</strong> Enable branching river systems.</li>
          <li><strong>Lakes & Deltas:</strong> Enable water features at river endpoints.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>🏔️ Terrain Editing</h4>
        <ul class="help-list">
          <li><strong>Raise/Lower:</strong> Modify terrain height at clicked location.</li>
          <li><strong>Flatten:</strong> Smooth terrain to a uniform height.</li>
          <li><strong>Smooth:</strong> Blend terrain heights for smoother transitions.</li>
          <li><strong>Brush Size:</strong> Radius of terrain modification (1-10).</li>
          <li><strong>Brush Strength:</strong> Intensity of modification (0.1-2.0).</li>
          <li><strong>Undo/Redo:</strong> Revert or reapply terrain changes.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>⚡ Performance Features</h4>
        <ul class="help-list">
          <li><strong>LOD System:</strong> Reduces detail for distant chunks to improve performance.</li>
          <li><strong>Worker Pool:</strong> Multi-threaded generation for faster chunk loading.</li>
          <li><strong>Incremental Generation:</strong> Progressive chunk generation to maintain smooth framerate.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>⌨️ Keyboard Shortcuts</h4>
        <table class="shortcuts-table">
          <tr>
            <td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td>
            <td>Move camera forward/left/back/right</td>
          </tr>
          <tr>
            <td><kbd>Mouse Drag</kbd></td>
            <td>Rotate camera (orbit)</td>
          </tr>
          <tr>
            <td><kbd>Mouse Wheel</kbd></td>
            <td>Zoom in/out</td>
          </tr>
          <tr>
            <td><kbd>Right Click + Drag</kbd></td>
            <td>Pan camera</td>
          </tr>
          <tr>
            <td><kbd>?</kbd></td>
            <td>Show this help dialog</td>
          </tr>
        </table>
      </div>

      <div class="help-section">
        <h4>👁️ Visibility Toggles</h4>
        <p>
          Use the checkboxes in the control panel to show/hide different world elements:
          terrain, biomes, rivers, resources, structures, chunk boundaries, and wireframe mode.
        </p>
      </div>

      <div class="help-section">
        <h4>💾 World Management</h4>
        <ul class="help-list">
          <li><strong>Save:</strong> Export world in JSON or binary format.</li>
          <li><strong>Load:</strong> Import previously saved world.</li>
          <li><strong>Export:</strong> Save heightmap, biome map, or configuration.</li>
          <li><strong>Share:</strong> Generate URL with current configuration or copy seed.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>📊 Performance Monitor</h4>
        <p>
          The right panel shows real-time metrics including FPS, generation time, memory usage,
          LOD statistics, worker pool activity, and incremental generation progress.
        </p>
      </div>

      <div class="help-section">
        <h4>📖 Engine Documentation</h4>
        <p>
          For detailed API documentation and integration guides, visit the engine repository:
        </p>
        <a href="https://github.com/yourusername/procedural-world-engine" target="_blank" rel="noopener noreferrer" class="doc-link">
          🔗 View Engine Documentation on GitHub
        </a>
      </div>

      <div class="help-section">
        <h4>💡 Tips</h4>
        <ul class="help-list">
          <li>Hover over any control label to see a tooltip with more information.</li>
          <li>Start with presets to see interesting configurations quickly.</li>
          <li>Enable LOD and Worker Pool for better performance with large worlds.</li>
          <li>Use incremental generation to maintain smooth framerate during chunk loading.</li>
          <li>Save your favorite configurations using the Export Configuration button.</li>
        </ul>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close button
    const closeBtn = this.modal.querySelector('#help-modal-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // OK button
    const okBtn = this.modal.querySelector('#help-modal-ok');
    okBtn?.addEventListener('click', () => this.hide());

    // Click outside modal to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Question mark key to open (requirement 20.5)
    document.addEventListener('keydown', (e) => {
      if ((e.key === '?' || e.key === '/') && !this.isVisible) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        this.show();
      }
    });
  }

  /**
   * Show the help modal
   */
  show(): void {
    if (this.modal) {
      this.modal.classList.remove('hidden');
      this.isVisible = true;
      
      // Focus the modal for accessibility
      const closeBtn = this.modal.querySelector('#help-modal-close') as HTMLElement;
      closeBtn?.focus();
    }
  }

  /**
   * Hide the help modal
   */
  hide(): void {
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.isVisible = false;
    }
  }

  /**
   * Toggle modal visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if modal is currently visible
   */
  isOpen(): boolean {
    return this.isVisible;
  }
}
