export function createSaveDialogElement(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.id = 'save-dialog';
  dialog.className = 'modal-dialog hidden';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Save World</h3>
        <button class="close-btn" data-close="save-dialog">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Format:</label>
          <div class="radio-group">
            <label>
              <input type="radio" name="save-format" value="json" checked />
              JSON (Human-readable)
            </label>
            <label>
              <input type="radio" name="save-format" value="binary" />
              Binary (Compact)
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="save-compress" checked />
            Enable Compression
          </label>
          <p class="help-text">Reduces file size using deflate compression</p>
        </div>

        <div class="form-group">
          <label for="save-filename">Filename:</label>
          <input type="text" id="save-filename" value="world" />
        </div>

        <div id="save-checksum-display" class="checksum-display hidden">
          <strong>Checksum:</strong> <code id="save-checksum-value"></code>
        </div>
      </div>
      <div class="modal-footer">
        <button class="secondary-btn" data-close="save-dialog">Cancel</button>
        <button class="primary-btn" id="confirm-save-btn">Save</button>
      </div>
    </div>
  `;
  return dialog;
}

export function createLoadDialogElement(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.id = 'load-dialog';
  dialog.className = 'modal-dialog hidden';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Load World</h3>
        <button class="close-btn" data-close="load-dialog">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="load-file-input">Select World File:</label>
          <input type="file" id="load-file-input" accept=".json,.bin,.world" />
          <p class="help-text">Supports JSON and binary formats</p>
        </div>

        <div id="load-info-display" class="info-display hidden">
          <h4>World Information</h4>
          <div class="info-row">
            <span class="info-label">Seed:</span>
            <span id="load-seed-value" class="info-value">--</span>
          </div>
          <div class="info-row">
            <span class="info-label">Chunks:</span>
            <span id="load-chunks-value" class="info-value">--</span>
          </div>
          <div class="info-row">
            <span class="info-label">Checksum:</span>
            <code id="load-checksum-value" class="info-value">--</code>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span id="load-status-value" class="info-value">--</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="secondary-btn" data-close="load-dialog">Cancel</button>
        <button class="primary-btn" id="confirm-load-btn" disabled>Load</button>
      </div>
    </div>
  `;
  return dialog;
}

export function createExportDialogElement(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.id = 'export-dialog';
  dialog.className = 'modal-dialog hidden';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Export Maps</h3>
        <button class="close-btn" data-close="export-dialog">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Export Type:</label>
          <div class="radio-group">
            <label>
              <input type="radio" name="export-type" value="heightmap" checked />
              Heightmap
            </label>
            <label>
              <input type="radio" name="export-type" value="biomemap" />
              Biome Map
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Image Format:</label>
          <div class="radio-group">
            <label>
              <input type="radio" name="export-format" value="png" checked />
              PNG
            </label>
            <label>
              <input type="radio" name="export-format" value="jpeg" />
              JPEG
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="export-filename">Filename:</label>
          <input type="text" id="export-filename" value="world-map" />
        </div>

        <p class="help-text">Exports all loaded chunks as a single image</p>
      </div>
      <div class="modal-footer">
        <button class="secondary-btn" data-close="export-dialog">Cancel</button>
        <button class="primary-btn" id="confirm-export-btn">Export</button>
      </div>
    </div>
  `;
  return dialog;
}
