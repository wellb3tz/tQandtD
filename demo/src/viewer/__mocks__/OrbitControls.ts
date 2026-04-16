/**
 * OrbitControls mock for testing
 */

import { Vector3 } from './three';

export class OrbitControls {
  enableDamping: boolean;
  dampingFactor: number;
  screenSpacePanning: boolean;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle: number;
  target: Vector3;
  object: any;

  constructor(camera: any, domElement: HTMLElement) {
    this.enableDamping = false;
    this.dampingFactor = 0.05;
    this.screenSpacePanning = false;
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.maxPolarAngle = Math.PI;
    this.target = new Vector3();
    this.object = camera;
  }

  update() {}
  dispose() {}
}

export default { OrbitControls };
