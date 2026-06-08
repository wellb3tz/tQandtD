/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from 'vitest';
import { createSliderControl, updateSliderValue } from './controlElements';

describe('controlElements', () => {
  it('uses the slider display formatter on creation, input, and external updates', () => {
    const onChange = vi.fn();
    const control = createSliderControl({
      id: 'viewDistance',
      label: 'Terrain Radius',
      min: 1,
      max: 8,
      step: 1,
      defaultValue: 3,
    }, onChange, {
      formatValue: value => `${value * 640} m`,
    });

    document.body.appendChild(control);

    const slider = control.querySelector('input') as HTMLInputElement;
    const valueDisplay = control.querySelector('.slider-value') as HTMLElement;

    expect(valueDisplay.textContent).toBe('1920 m');

    slider.value = '4';
    slider.dispatchEvent(new Event('input'));

    expect(valueDisplay.textContent).toBe('2560 m');
    expect(onChange).toHaveBeenCalledWith(4);

    updateSliderValue('viewDistance', 5);

    expect(valueDisplay.textContent).toBe('3200 m');
  });

  it('formats render scale as a percentage', () => {
    const control = createSliderControl({
      id: 'renderScale',
      label: 'Render Scale',
      min: 0.5,
      max: 1,
      step: 0.05,
      defaultValue: 1,
    }, vi.fn(), {
      formatValue: value => `${Math.round(value * 100)}%`,
    });

    document.body.appendChild(control);

    const valueDisplay = control.querySelector('.slider-value') as HTMLElement;
    expect(valueDisplay.textContent).toBe('100%');

    updateSliderValue('renderScale', 0.85);

    expect(valueDisplay.textContent).toBe('85%');
  });
});
