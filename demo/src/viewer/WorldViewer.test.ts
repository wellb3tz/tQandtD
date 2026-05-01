/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorldViewer } from './WorldViewer';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');

  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    shadowMap = {
      enabled: false,
      type: undefined,
    };
    toneMapping = undefined;
    toneMappingExposure = 1;

    setSize = vi.fn();
    setPixelRatio = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('WorldViewer lifecycle', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes DOM event listeners when disposed', () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');

    const container = document.createElement('div');
    const addContainerListener = vi.spyOn(container, 'addEventListener');
    const removeContainerListener = vi.spyOn(container, 'removeEventListener');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);

    const containerClickHandler = addContainerListener.mock.calls.find(([type]) => type === 'click')?.[1];
    const pointerLockHandler = addDocumentListener.mock.calls.find(([type]) => type === 'pointerlockchange')?.[1];
    const mouseMoveHandler = addDocumentListener.mock.calls.find(([type]) => type === 'mousemove')?.[1];
    const documentKeyDownHandler = addDocumentListener.mock.calls.find(([type]) => type === 'keydown')?.[1];
    const windowKeyDownHandler = addWindowListener.mock.calls.find(([type]) => type === 'keydown')?.[1];
    const windowKeyUpHandler = addWindowListener.mock.calls.find(([type]) => type === 'keyup')?.[1];

    viewer.dispose();

    expect(removeContainerListener).toHaveBeenCalledWith('click', containerClickHandler);
    expect(removeDocumentListener).toHaveBeenCalledWith('pointerlockchange', pointerLockHandler);
    expect(removeDocumentListener).toHaveBeenCalledWith('mousemove', mouseMoveHandler);
    expect(removeDocumentListener).toHaveBeenCalledWith('keydown', documentKeyDownHandler);
    expect(removeWindowListener).toHaveBeenCalledWith('keydown', windowKeyDownHandler);
    expect(removeWindowListener).toHaveBeenCalledWith('keyup', windowKeyUpHandler);
  });
});
