import type { CheckboxConfig, SliderConfig, SliderDisplayOptions } from './controlSchemas';

const sliderValueFormatters = new Map<string, (value: number) => string>();

export function createSliderControl(
  config: SliderConfig,
  onChange: (value: number) => void,
  displayOptions: SliderDisplayOptions = {},
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'control-group';

  const label = document.createElement('label');
  label.htmlFor = config.id;
  label.textContent = config.label;
  if (config.tooltip) {
    label.title = config.tooltip;
  }

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'slider-value';
  if (displayOptions.formatValue) {
    sliderValueFormatters.set(config.id, displayOptions.formatValue);
  } else {
    sliderValueFormatters.delete(config.id);
  }
  valueDisplay.textContent = formatSliderValue(config.id, config.defaultValue, config.step);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = config.id;
  slider.min = config.min.toString();
  slider.max = config.max.toString();
  slider.step = config.step.toString();
  slider.value = config.defaultValue.toString();

  slider.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    valueDisplay.textContent = formatSliderValue(config.id, value, config.step);
    onChange(value);
  });

  label.appendChild(valueDisplay);
  group.appendChild(label);
  group.appendChild(slider);

  return group;
}

export function createColorControl(
  config: { id: string; label: string; defaultValue: string; tooltip?: string },
  onChange: (color: string) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'control-group';
  group.style.display = 'flex';
  group.style.alignItems = 'center';
  group.style.gap = '8px';
  group.style.marginBottom = '12px';

  const label = document.createElement('label');
  label.htmlFor = config.id;
  label.textContent = config.label;
  label.style.flex = '1';
  if (config.tooltip) {
    label.title = config.tooltip;
  }

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.id = config.id;
  colorInput.value = config.defaultValue;
  colorInput.style.width = '50px';
  colorInput.style.height = '30px';
  colorInput.style.border = '1px solid var(--border-color, #ccc)';
  colorInput.style.borderRadius = '4px';
  colorInput.style.cursor = 'pointer';

  colorInput.addEventListener('input', (e) => {
    const color = (e.target as HTMLInputElement).value;
    onChange(color);
  });

  group.appendChild(label);
  group.appendChild(colorInput);

  return group;
}

export function createCheckboxControl(
  config: CheckboxConfig,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'control-group';
  group.style.display = 'flex';
  group.style.alignItems = 'center';
  group.style.gap = '8px';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = config.id;
  checkbox.checked = config.defaultValue;

  const label = document.createElement('label');
  label.htmlFor = config.id;
  label.textContent = config.label;
  label.style.marginBottom = '0';
  label.style.cursor = 'pointer';
  if (config.tooltip) {
    label.title = config.tooltip;
  }

  checkbox.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    onChange(checked);
  });

  group.appendChild(checkbox);
  group.appendChild(label);

  return group;
}

export function updateSliderValue(id: string, value: number): void {
  const slider = document.getElementById(id) as HTMLInputElement;
  if (!slider) return;

  slider.value = value.toString();

  const label = slider.parentElement?.querySelector('label');
  const valueDisplay = label?.querySelector('.slider-value');
  if (valueDisplay) {
    const step = parseFloat(slider.step);
    valueDisplay.textContent = formatSliderValue(id, value, step);
  }
}

export function updateCheckboxValue(id: string, checked: boolean): void {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  if (!checkbox) return;

  checkbox.checked = checked;

  switch (id) {
    case 'enableTransitions': {
      setControlDisplay('transitionWidth-group', checked);
      break;
    }
    case 'enableElevationBands': {
      setControlDisplay('snowLineElevation-group', checked);
      break;
    }
    case 'enable3D': {
      setControlDisplay('zScale-group', checked);
      break;
    }
    case 'enableContinentalness': {
      setControlDisplay('continentalScale-group', checked);
      setControlDisplay('continentalStrength-group', checked);
      break;
    }
  }
}

function getDecimalPlaces(step: number): number {
  if (step >= 1) return 0;

  const stepStr = step.toString();
  const decimalIndex = stepStr.indexOf('.');
  return decimalIndex !== -1 ? stepStr.length - decimalIndex - 1 : 0;
}

function formatSliderValue(id: string, value: number, step: number): string {
  return sliderValueFormatters.get(id)?.(value) ?? value.toFixed(getDecimalPlaces(step));
}

function setControlDisplay(id: string, visible: boolean): void {
  const control = document.getElementById(id);
  if (control) {
    control.style.display = visible ? 'block' : 'none';
  }
}
