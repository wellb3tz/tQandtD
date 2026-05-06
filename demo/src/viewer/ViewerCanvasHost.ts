import * as THREE from 'three';

export interface ViewerCanvasHostOptions {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  getPixelRatio?: () => number;
}

export class ViewerCanvasHost {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly getPixelRatio: () => number;

  constructor(options: ViewerCanvasHostOptions) {
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.getPixelRatio = options.getPixelRatio ?? (() => window.devicePixelRatio);
  }

  attachToContainer(container: HTMLElement): void {
    this.resize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(this.getPixelRatio());
    container.appendChild(this.renderer.domElement);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  detachFromContainer(container: HTMLElement | null): void {
    const canvas = this.renderer.domElement;
    if (container && canvas.parentElement === container) {
      container.removeChild(canvas);
    }
  }
}
