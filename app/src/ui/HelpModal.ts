/**
 * HelpModal Component
 *
 * Displays documentation and help information for the world application.
 */

export class HelpModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private readonly handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isVisible) {
      this.hide();
    }
  };
  private readonly handleShortcutKey = (e: KeyboardEvent) => {
    if ((e.key === '?' || e.key === '/') && !this.isVisible) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      this.show();
    }
  };

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
          <h3>Help</h3>
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
    return '';
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

    document.addEventListener('keydown', this.handleEscapeKey);
    document.addEventListener('keydown', this.handleShortcutKey);
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

  dispose(): void {
    document.removeEventListener('keydown', this.handleEscapeKey);
    document.removeEventListener('keydown', this.handleShortcutKey);
    this.modal?.remove();
    this.modal = null;
    this.isVisible = false;
  }
}
