/**
 * Unit tests for ErrorHandler
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler, DemoError, ErrorCategory, ErrorSeverity } from './ErrorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let toastContainer: HTMLElement;
  let dialogContainer: HTMLElement;
  let progressContainer: HTMLElement;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
    
    errorHandler = new ErrorHandler();
    
    dialogContainer = document.getElementById('error-dialog-container')!;
    progressContainer = document.getElementById('progress-container')!;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Toast Notifications', () => {
    it('should show success toast', () => {
      errorHandler.showSuccessToast('Test success message');
      
      const toast = toastContainer.querySelector('.toast-success');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toContain('Test success message');
    });

    it('should show error toast', () => {
      errorHandler.showErrorToast('Test error message');
      
      const toast = toastContainer.querySelector('.toast-error');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toContain('Test error message');
    });

    it('should show warning toast', () => {
      errorHandler.showWarningToast('Test warning message');
      
      const toast = toastContainer.querySelector('.toast-warning');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toContain('Test warning message');
    });

    it('should show info toast', () => {
      errorHandler.showInfoToast('Test info message');
      
      const toast = toastContainer.querySelector('.toast-info');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toContain('Test info message');
    });

    it('should auto-remove toast after duration', async () => {
      errorHandler.showSuccessToast('Test message', 100);
      
      expect(toastContainer.children.length).toBe(1);
      
      // Wait for toast to be removed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(toastContainer.children.length).toBe(0);
    });
  });

  describe('Error Dialog', () => {
    it('should show error dialog with title and message', () => {
      errorHandler.showErrorDialog('Test Title', 'Test message', [
        { label: 'OK', callback: () => {} }
      ]);
      
      const dialog = dialogContainer.querySelector('.error-dialog');
      expect(dialog).toBeTruthy();
      expect(dialog?.textContent).toContain('Test Title');
      expect(dialog?.textContent).toContain('Test message');
    });

    it('should show action buttons', () => {
      errorHandler.showErrorDialog('Test', 'Message', [
        { label: 'Action 1', callback: () => {} },
        { label: 'Action 2', callback: () => {}, primary: true }
      ]);
      
      const buttons = dialogContainer.querySelectorAll('.error-dialog-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toContain('Action 1');
      expect(buttons[1].textContent).toContain('Action 2');
      expect(buttons[1].classList.contains('primary')).toBe(true);
    });

    it('should call action callback when button clicked', () => {
      const callback = vi.fn();
      
      errorHandler.showErrorDialog('Test', 'Message', [
        { label: 'Test Action', callback }
      ]);
      
      const button = dialogContainer.querySelector('.error-dialog-btn') as HTMLButtonElement;
      button.click();
      
      expect(callback).toHaveBeenCalled();
    });

    it('should close dialog', () => {
      errorHandler.showErrorDialog('Test', 'Message', [
        { label: 'OK', callback: () => {} }
      ]);
      
      expect(dialogContainer.querySelector('.error-dialog')).toBeTruthy();
      
      errorHandler.closeDialog();
      
      // Wait for animation
      setTimeout(() => {
        expect(dialogContainer.querySelector('.error-dialog')).toBeFalsy();
      }, 400);
    });
  });

  describe('Progress Bar', () => {
    it('should show progress bar', () => {
      const progressId = errorHandler.showProgress('Loading...', 0);
      
      const progressBar = document.getElementById(progressId);
      expect(progressBar).toBeTruthy();
      expect(progressBar?.textContent).toContain('Loading...');
      expect(progressBar?.textContent).toContain('0%');
    });

    it('should update progress', () => {
      const progressId = errorHandler.showProgress('Loading...', 0);
      
      errorHandler.updateProgress(progressId, 50, 'Half done...');
      
      const progressBar = document.getElementById(progressId);
      expect(progressBar?.textContent).toContain('Half done...');
      expect(progressBar?.textContent).toContain('50%');
      
      const fill = progressBar?.querySelector('.progress-fill') as HTMLElement;
      expect(fill.style.width).toBe('50%');
    });

    it('should hide progress bar', async () => {
      const progressId = errorHandler.showProgress('Loading...', 0);
      
      expect(document.getElementById(progressId)).toBeTruthy();
      
      errorHandler.hideProgress(progressId);
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 400));
      
      expect(document.getElementById(progressId)).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should handle DemoError', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new DemoError(
        'Test error',
        ErrorCategory.GENERATION,
        ErrorSeverity.ERROR,
        true,
        'User-friendly message'
      );
      
      errorHandler.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(toastContainer.querySelector('.toast-error')).toBeTruthy();
      
      consoleErrorSpy.mockRestore();
    });

    it('should show dialog for critical errors', () => {
      const error = new DemoError(
        'Critical error',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.CRITICAL,
        false,
        'Critical failure message'
      );
      
      errorHandler.handleError(error);
      
      const dialog = dialogContainer.querySelector('.error-dialog');
      expect(dialog).toBeTruthy();
      expect(dialog?.textContent).toContain('Critical failure message');
    });

    it('should convert regular Error to DemoError', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('Regular error');
      errorHandler.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(toastContainer.querySelector('.toast-error')).toBeTruthy();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate valid parameter', () => {
      const result = errorHandler.validateParameter(5, 0, 10, 'testParam');
      expect(result).toBe(true);
    });

    it('should reject NaN value', () => {
      const result = errorHandler.validateParameter('invalid', 0, 10, 'testParam');
      expect(result).toBe(false);
      expect(toastContainer.querySelector('.toast-error')).toBeTruthy();
    });

    it('should reject value below min', () => {
      const result = errorHandler.validateParameter(-5, 0, 10, 'testParam');
      expect(result).toBe(false);
      expect(toastContainer.querySelector('.toast-error')).toBeTruthy();
    });

    it('should reject value above max', () => {
      const result = errorHandler.validateParameter(15, 0, 10, 'testParam');
      expect(result).toBe(false);
      expect(toastContainer.querySelector('.toast-error')).toBeTruthy();
    });

    it('should accept string numbers', () => {
      const result = errorHandler.validateParameter('5', 0, 10, 'testParam');
      expect(result).toBe(true);
    });
  });

  describe('WebGL Compatibility Check', () => {
    it('should check WebGL support', () => {
      const result = errorHandler.checkWebGLCompatibility();
      
      expect(result).toHaveProperty('supported');
      expect(typeof result.supported).toBe('boolean');
    });

    it('should return message if not supported', () => {
      // Mock canvas to return null for WebGL context
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'canvas') {
          const canvas = originalCreateElement('canvas');
          canvas.getContext = vi.fn(() => null);
          return canvas;
        }
        return originalCreateElement(tagName);
      }) as any;
      
      const result = errorHandler.checkWebGLCompatibility();
      
      expect(result.supported).toBe(false);
      expect(result.message).toBeTruthy();
      
      // Restore
      document.createElement = originalCreateElement;
    });
  });
});
