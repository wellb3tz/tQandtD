// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler } from './ErrorHandler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="toast-container"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders toast messages as text instead of HTML', () => {
    const handler = new ErrorHandler();

    handler.showErrorToast('<img src=x onerror=alert(1)>');

    const message = document.querySelector('.toast-message');
    expect(message?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(message?.querySelector('img')).toBeNull();
  });

  it('renders dialog content and action labels as text instead of HTML', () => {
    const handler = new ErrorHandler();
    const callback = vi.fn();

    handler.showErrorDialog('<b>Title</b>', '<script>alert(1)</script>', [
      { label: '<img src=x>', callback, primary: true },
    ]);

    expect(document.querySelector('.error-dialog-header h3')?.textContent).toBe('<b>Title</b>');
    expect(document.querySelector('.error-dialog-body p')?.textContent).toBe('<script>alert(1)</script>');
    expect(document.querySelector('.error-dialog-btn')?.textContent).toBe('<img src=x>');
    expect(document.querySelector('.error-dialog b')).toBeNull();
    expect(document.querySelector('.error-dialog script')).toBeNull();
    expect(document.querySelector('.error-dialog img')).toBeNull();

    (document.querySelector('.error-dialog-btn') as HTMLButtonElement).click();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('renders progress messages as text instead of HTML', () => {
    const handler = new ErrorHandler();

    const id = handler.showProgress('<strong>Loading</strong>', 25);

    const progress = document.getElementById(id);
    const message = progress?.querySelector('.progress-message');
    expect(message?.textContent).toBe('<strong>Loading</strong>');
    expect(message?.querySelector('strong')).toBeNull();
  });
});
