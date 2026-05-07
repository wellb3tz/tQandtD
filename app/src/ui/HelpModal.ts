/**
 * HelpModal Component
 *
 * Displays documentation and help information for the world application.
 */

export class HelpModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;

  initialize(): void {
    this.createModal();
    this.attachEventListeners();
  }

  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.className = 'modal-dialog hidden';
    this.modal.id = 'help-modal';

    this.modal.innerHTML = `
      <div class="modal-content help-modal-content">
        <div class="modal-header">
          <h3>Help & Documentation</h3>
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

  private getHelpContent(): string {
    return `
      <div class="help-section">
        <h4>Getting Started</h4>
        <p>
          This application is a personal world-generation workbench.
          Use the controls on the left to tune system parameters, then inspect the generated world in the 3D viewer.
        </p>
      </div>

      <div class="help-section">
        <h4>World Generation</h4>
        <ul class="help-list">
          <li><strong>Seed:</strong> Enter a number to generate a deterministic world. Same seed = same world.</li>
          <li><strong>Generate:</strong> Rebuild the world with the current system parameters.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Terrain Parameters</h4>
        <ul class="help-list">
          <li><strong>Base Scale:</strong> Controls overall terrain feature size.</li>
          <li><strong>Octaves:</strong> Number of noise layers for detail.</li>
          <li><strong>Persistence:</strong> How much each octave contributes.</li>
          <li><strong>Lacunarity:</strong> Frequency multiplier between octaves.</li>
          <li><strong>Warp Strength:</strong> Domain warping intensity for organic shapes.</li>
          <li><strong>Height Multiplier:</strong> Overall terrain height scaling.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Biome System</h4>
        <ul class="help-list">
          <li><strong>Temperature/Moisture Scale:</strong> Controls biome distribution patterns.</li>
          <li><strong>Blend Radius:</strong> Smoothness of biome transitions.</li>
          <li><strong>Transitions:</strong> Enable smooth blending between biomes.</li>
          <li><strong>Elevation Bands:</strong> Altitude-based biome zones.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Performance Features</h4>
        <ul class="help-list">
          <li><strong>LOD System:</strong> Reduces detail for distant chunks to improve performance.</li>
          <li><strong>Worker Pool:</strong> Multi-threaded generation for faster chunk loading.</li>
          <li><strong>Incremental Generation:</strong> Progressive chunk generation to maintain smooth framerate.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Keyboard Shortcuts</h4>
        <table class="shortcuts-table">
          <tr>
            <td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td>
            <td>Move camera forward/left/back/right</td>
          </tr>
          <tr>
            <td><kbd>Mouse Drag</kbd></td>
            <td>Rotate camera</td>
          </tr>
          <tr>
            <td><kbd>Click Viewer</kbd></td>
            <td>Lock pointer for FPS camera controls when supported</td>
          </tr>
          <tr>
            <td><kbd>?</kbd></td>
            <td>Show this help dialog</td>
          </tr>
        </table>
      </div>

      <div class="help-section">
        <h4>Display Layers</h4>
        <p>
          Use the checkboxes in the control panel to choose which world layers are visible:
          terrain, biomes, water, resources, structures, chunk boundaries, textures, fog of war, and background mode.
        </p>
      </div>

      <div class="help-section">
        <h4>World Management</h4>
        <ul class="help-list">
          <li><strong>Save:</strong> Export world in JSON or binary format.</li>
          <li><strong>Load:</strong> Import previously saved world.</li>
          <li><strong>Export:</strong> Save heightmap, biome map, or configuration.</li>
          <li><strong>Share:</strong> Generate URL with current configuration or copy seed.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Performance Monitor</h4>
        <p>
          The right panel shows real-time metrics including FPS, generation time, memory usage,
          LOD statistics, worker pool activity, and incremental generation progress.
        </p>
      </div>

      <div class="help-section">
        <h4>Engine Documentation</h4>
        <p>For detailed API documentation and integration guides, visit the engine repository:</p>
        <a href="https://github.com/yourusername/tQandtD" target="_blank" rel="noopener noreferrer" class="doc-link">
          View tQandtD project Documentation on GitHub
        </a>
      </div>

      <div class="help-section">
        <h4>Tips</h4>
        <ul class="help-list">
          <li>Hover over any control label to see a tooltip with more information.</li>
          <li>Increase chunk radius carefully; it affects both visibility and loading cost.</li>
          <li>Use the worker pool and cache settings for larger worlds.</li>
          <li>Keep display layers separate from generation settings when comparing world variants.</li>
        </ul>
      </div>
    `;
  }

  private attachEventListeners(): void {
    if (!this.modal) return;

    const closeBtn = this.modal.querySelector('#help-modal-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const okBtn = this.modal.querySelector('#help-modal-ok');
    okBtn?.addEventListener('click', () => this.hide());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.key === '?' || e.key === '/') && !this.isVisible) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        this.show();
      }
    });
  }

  show(): void {
    if (this.modal) {
      this.modal.classList.remove('hidden');
      this.isVisible = true;

      const closeBtn = this.modal.querySelector('#help-modal-close') as HTMLElement;
      closeBtn?.focus();
    }
  }

  hide(): void {
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.isVisible = false;
    }
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isOpen(): boolean {
    return this.isVisible;
  }
}
