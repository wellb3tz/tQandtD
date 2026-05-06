/**
 * ErrorHandler - Centralized error handling and user feedback system
 * 
 * Provides error toast notifications, error dialogs, validation, and fallback strategies
 * for various error scenarios in the world application.
 */

/**
 * Error categories for classification and handling
 */
export enum ErrorCategory {
  INITIALIZATION = 'initialization',
  GENERATION = 'generation',
  SERIALIZATION = 'serialization',
  USER_INPUT = 'user_input',
  RESOURCE = 'resource',
  WEBGL = 'webgl',
  WORKER_POOL = 'worker_pool'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Custom error class with additional metadata
 */
export class AppError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public severity: ErrorSeverity,
    public recoverable: boolean,
    public userMessage: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error action for dialog buttons
 */
export interface ErrorAction {
  label: string;
  callback: () => void;
  primary?: boolean;
}

/**
 * ErrorHandler - Manages error display and recovery
 */
export class ErrorHandler {
  private toastContainer: HTMLElement | null = null;
  private dialogContainer: HTMLElement | null = null;
  private progressContainer: HTMLElement | null = null;

  constructor() {
    this.initializeContainers();
  }

  /**
   * Initialize DOM containers for error display
   */
  private initializeContainers(): void {
    // Toast container should already exist in HTML
    this.toastContainer = document.getElementById('toast-container');

    // Create dialog container if it doesn't exist
    if (!document.getElementById('error-dialog-container')) {
      const dialogContainer = document.createElement('div');
      dialogContainer.id = 'error-dialog-container';
      dialogContainer.className = 'error-dialog-container';
      document.body.appendChild(dialogContainer);
      this.dialogContainer = dialogContainer;
    } else {
      this.dialogContainer = document.getElementById('error-dialog-container');
    }

    // Create progress container if it doesn't exist
    if (!document.getElementById('progress-container')) {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'progress-container';
      progressContainer.className = 'progress-container';
      document.body.appendChild(progressContainer);
      this.progressContainer = progressContainer;
    } else {
      this.progressContainer = document.getElementById('progress-container');
    }
  }

  /**
   * Handle an error with appropriate user feedback
   */
  handleError(error: AppError | Error): void {
    // Convert to AppError if needed
    const appError = error instanceof AppError
      ? error
      : new AppError(
          error.message,
          ErrorCategory.GENERATION,
          ErrorSeverity.ERROR,
          true,
          'An unexpected error occurred',
          error
        );

    // Log to console
    this.logError(appError);

    // Show appropriate user feedback based on severity
    if (appError.severity === ErrorSeverity.CRITICAL) {
      this.showErrorDialog(
        'Critical Error',
        appError.userMessage,
        [
          {
            label: 'Reload Page',
            callback: () => window.location.reload(),
            primary: true
          },
          {
            label: 'Dismiss',
            callback: () => this.closeDialog()
          }
        ]
      );
    } else if (appError.severity === ErrorSeverity.ERROR) {
      this.showErrorToast(appError.userMessage, 5000);
    } else if (appError.severity === ErrorSeverity.WARNING) {
      this.showWarningToast(appError.userMessage, 4000);
    } else {
      this.showInfoToast(appError.userMessage, 3000);
    }

    // Apply fallback strategy if available
    this.applyFallback(appError);
  }

  /**
   * Show error toast notification
   */
  showErrorToast(message: string, duration: number = 3000): void {
    this.showToast(message, 'error', duration);
  }

  /**
   * Show warning toast notification
   */
  showWarningToast(message: string, duration: number = 3000): void {
    this.showToast(message, 'warning', duration);
  }

  /**
   * Show info toast notification
   */
  showInfoToast(message: string, duration: number = 3000): void {
    this.showToast(message, 'info', duration);
  }

  /**
   * Show success toast notification
   */
  showSuccessToast(message: string, duration: number = 3000): void {
    this.showToast(message, 'success', duration);
  }

  /**
   * Show toast notification with specified type
   */
  private showToast(message: string, type: 'success' | 'error' | 'warning' | 'info', duration: number): void {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add icon based on type
    const icon = this.getToastIcon(type);
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;

    this.toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => {
        if (this.toastContainer && this.toastContainer.contains(toast)) {
          this.toastContainer.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /**
   * Get icon for toast type
   */
  private getToastIcon(type: string): string {
    const icons: Record<string, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  /**
   * Show error dialog for critical failures
   */
  showErrorDialog(title: string, message: string, actions: ErrorAction[]): void {
    if (!this.dialogContainer) return;

    // Clear existing dialogs
    this.dialogContainer.innerHTML = '';

    const dialog = document.createElement('div');
    dialog.className = 'error-dialog';
    dialog.innerHTML = `
      <div class="error-dialog-overlay"></div>
      <div class="error-dialog-content">
        <div class="error-dialog-header">
          <h3>${title}</h3>
        </div>
        <div class="error-dialog-body">
          <p>${message}</p>
        </div>
        <div class="error-dialog-footer">
          ${actions.map((action, index) => `
            <button class="error-dialog-btn ${action.primary ? 'primary' : 'secondary'}" data-action="${index}">
              ${action.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Add event listeners for action buttons
    dialog.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const actionIndex = parseInt(btn.getAttribute('data-action') || '0');
        actions[actionIndex].callback();
      });
    });

    this.dialogContainer.appendChild(dialog);
    
    // Trigger animation
    setTimeout(() => dialog.classList.add('show'), 10);
  }

  /**
   * Close error dialog
   */
  closeDialog(): void {
    if (!this.dialogContainer) return;

    const dialog = this.dialogContainer.querySelector('.error-dialog');
    if (dialog) {
      dialog.classList.remove('show');
      setTimeout(() => {
        if (this.dialogContainer) {
          this.dialogContainer.innerHTML = '';
        }
      }, 300);
    }
  }

  /**
   * Show progress bar for long operations
   */
  showProgress(message: string, progress: number = 0): string {
    if (!this.progressContainer) return '';

    const progressId = `progress-${Date.now()}`;
    const progressBar = document.createElement('div');
    progressBar.id = progressId;
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
      <div class="progress-message">${message}</div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="progress-percentage">${progress}%</div>
    `;

    this.progressContainer.appendChild(progressBar);
    
    // Trigger animation
    setTimeout(() => progressBar.classList.add('show'), 10);

    return progressId;
  }

  /**
   * Update progress bar
   */
  updateProgress(progressId: string, progress: number, message?: string): void {
    const progressBar = document.getElementById(progressId);
    if (!progressBar) return;

    const fill = progressBar.querySelector('.progress-fill') as HTMLElement;
    const percentage = progressBar.querySelector('.progress-percentage') as HTMLElement;
    const messageEl = progressBar.querySelector('.progress-message') as HTMLElement;

    if (fill) fill.style.width = `${progress}%`;
    if (percentage) percentage.textContent = `${progress}%`;
    if (message && messageEl) messageEl.textContent = message;
  }

  /**
   * Hide progress bar
   */
  hideProgress(progressId: string): void {
    const progressBar = document.getElementById(progressId);
    if (!progressBar) return;

    progressBar.classList.remove('show');
    progressBar.classList.add('hide');
    
    setTimeout(() => {
      if (this.progressContainer && this.progressContainer.contains(progressBar)) {
        this.progressContainer.removeChild(progressBar);
      }
    }, 300);
  }

  /**
   * Log error to console with details
   */
  logError(error: AppError): void {
    const logLevel = error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.ERROR
      ? 'error'
      : error.severity === ErrorSeverity.WARNING
      ? 'warn'
      : 'info';

    console[logLevel](`[${error.category}] ${error.message}`, {
      severity: error.severity,
      recoverable: error.recoverable,
      userMessage: error.userMessage,
      originalError: error.originalError
    });
  }

  /**
   * Apply fallback strategy based on error category
   */
  private applyFallback(error: AppError): void {
    if (!error.recoverable) return;

    switch (error.category) {
      case ErrorCategory.WORKER_POOL:
        this.showWarningToast('Falling back to single-threaded generation', 3000);
        break;
      
      case ErrorCategory.WEBGL:
        this.showWarningToast('WebGL features limited. Some visualizations may be unavailable.', 5000);
        break;
      
      case ErrorCategory.GENERATION:
        this.showInfoToast('Retrying with simplified configuration...', 3000);
        break;
      
      case ErrorCategory.RESOURCE:
        this.showWarningToast('Clearing cache to free memory...', 3000);
        break;
    }
  }

  /**
   * Validate parameter input
   */
  validateParameter(value: any, min: number, max: number, paramName: string): boolean {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      this.showErrorToast(`Invalid value for ${paramName}. Please enter a valid number.`, 3000);
      return false;
    }

    if (numValue < min || numValue > max) {
      this.showErrorToast(`${paramName} must be between ${min} and ${max}.`, 3000);
      return false;
    }

    return true;
  }

  /**
   * Check WebGL compatibility
   */
  checkWebGLCompatibility(): { supported: boolean; message?: string } {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return {
          supported: false,
          message: 'WebGL is not supported in your browser. Please use a modern browser with WebGL support.'
        };
      }

      // Check for required extensions
      const requiredExtensions = ['OES_element_index_uint'];
      const missingExtensions: string[] = [];

      for (const ext of requiredExtensions) {
        if (!(gl as WebGLRenderingContext).getExtension(ext)) {
          missingExtensions.push(ext);
        }
      }

      if (missingExtensions.length > 0) {
        return {
          supported: true,
          message: `Some WebGL extensions are not available: ${missingExtensions.join(', ')}. Performance may be limited.`
        };
      }

      return { supported: true };
    } catch (error) {
      return {
        supported: false,
        message: 'Failed to initialize WebGL. Your browser or graphics card may not support WebGL.'
      };
    }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
