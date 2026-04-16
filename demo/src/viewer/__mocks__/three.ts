/**
 * Comprehensive Three.js mock for testing
 * Provides all necessary Three.js exports with proper constructors and methods
 */

import { vi } from 'vitest';

// Vector3 mock with full functionality
export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  add(v: Vector3) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vector3) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  crossVectors(a: Vector3, b: Vector3) {
    this.x = a.y * b.z - a.z * b.y;
    this.y = a.z * b.x - a.x * b.z;
    this.z = a.x * b.y - a.y * b.x;
    return this;
  }

  normalize() {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  getComponent(index: number) {
    switch (index) {
      case 0: return this.x;
      case 1: return this.y;
      case 2: return this.z;
      default: throw new Error('index out of range: ' + index);
    }
  }

  setComponent(index: number, value: number) {
    switch (index) {
      case 0: this.x = value; break;
      case 1: this.y = value; break;
      case 2: this.z = value; break;
      default: throw new Error('index out of range: ' + index);
    }
    return this;
  }

  project(camera: any) {
    // Simplified projection for testing
    // In real THREE.js, this applies camera's projection matrix
    // For tests, we'll just normalize to NDC space
    const vector = this.clone();
    
    // Apply camera's projection (simplified)
    // Assume camera is at origin looking down -Z
    // Project to normalized device coordinates [-1, 1]
    
    // Simple perspective division
    const distance = 100; // Assumed distance for testing
    vector.x = vector.x / distance;
    vector.y = vector.y / distance;
    vector.z = vector.z / distance;
    
    this.x = vector.x;
    this.y = vector.y;
    this.z = vector.z;
    
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v: Vector3) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
}

// Vector2 mock
export class Vector2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  copy(v: Vector2) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
}

// Euler mock
export class Euler {
  x: number;
  y: number;
  z: number;
  order: string;

  constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }

  set(x: number, y: number, z: number, order?: string) {
    this.x = x;
    this.y = y;
    this.z = z;
    if (order !== undefined) this.order = order;
    return this;
  }
}

// Quaternion mock
export class Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  setFromEuler(euler: Euler) {
    // Simplified quaternion from euler conversion
    const c1 = Math.cos(euler.x / 2);
    const c2 = Math.cos(euler.y / 2);
    const c3 = Math.cos(euler.z / 2);
    const s1 = Math.sin(euler.x / 2);
    const s2 = Math.sin(euler.y / 2);
    const s3 = Math.sin(euler.z / 2);

    if (euler.order === 'XYZ') {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 + s1 * s2 * c3;
      this.w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (euler.order === 'YXZ') {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 - s1 * s2 * c3;
      this.w = c1 * c2 * c3 + s1 * s2 * s3;
    }

    return this;
  }
}

// Matrix4 mock
export class Matrix4 {
  elements: number[];

  constructor() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  multiplyMatrices(a: Matrix4, b: Matrix4) {
    return this;
  }

  identity() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
    return this;
  }
}

// Frustum mock
export class Frustum {
  planes: any[];

  constructor() {
    this.planes = [];
  }

  setFromProjectionMatrix(m: Matrix4) {
    return this;
  }

  intersectsBox(box: any) {
    return true; // Always visible in tests
  }
}

// Box3 mock
export class Box3 {
  min: Vector3;
  max: Vector3;

  constructor(min?: Vector3, max?: Vector3) {
    this.min = min || new Vector3(Infinity, Infinity, Infinity);
    this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
  }

  clone() {
    return new Box3(
      new Vector3(this.min.x, this.min.y, this.min.z),
      new Vector3(this.max.x, this.max.y, this.max.z)
    );
  }

  applyMatrix4(matrix: Matrix4) {
    return this;
  }
}

// BufferAttribute mock
export class BufferAttribute {
  array: Float32Array | Uint16Array | Uint32Array;
  itemSize: number;
  count: number;
  needsUpdate: boolean;

  constructor(array: Float32Array | Uint16Array | Uint32Array, itemSize: number) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
    this.needsUpdate = false;
  }

  getX(index: number) {
    return this.array[index * this.itemSize];
  }

  getY(index: number) {
    return this.array[index * this.itemSize + 1];
  }

  getZ(index: number) {
    return this.array[index * this.itemSize + 2];
  }

  setXYZ(index: number, x: number, y: number, z: number) {
    const i = index * this.itemSize;
    this.array[i] = x;
    this.array[i + 1] = y;
    this.array[i + 2] = z;
  }
}

// BufferGeometry mock
export class BufferGeometry {
  attributes: Map<string, BufferAttribute>;
  index: BufferAttribute | null;
  boundingBox: Box3 | null;

  constructor() {
    this.attributes = new Map();
    this.index = null;
    this.boundingBox = null;
  }

  setAttribute(name: string, attribute: BufferAttribute) {
    this.attributes.set(name, attribute);
    return this;
  }

  getAttribute(name: string) {
    return this.attributes.get(name);
  }

  setIndex(index: BufferAttribute | number[] | Uint16Array | Uint32Array) {
    if (Array.isArray(index)) {
      this.index = new BufferAttribute(new Uint32Array(index), 1);
    } else if (index instanceof BufferAttribute) {
      this.index = index;
    } else {
      this.index = new BufferAttribute(index, 1);
    }
    return this;
  }

  getIndex() {
    return this.index;
  }

  computeVertexNormals() {
    const position = this.attributes.get('position');
    if (!position) return;

    const normals = new Float32Array(position.count * 3);
    // Simple upward normals for testing
    for (let i = 0; i < position.count; i++) {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }

    this.setAttribute('normal', new BufferAttribute(normals, 3));
  }

  computeBoundingBox() {
    const position = this.attributes.get('position');
    if (!position) {
      this.boundingBox = new Box3();
      return;
    }

    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);

      min.x = Math.min(min.x, x);
      min.y = Math.min(min.y, y);
      min.z = Math.min(min.z, z);

      max.x = Math.max(max.x, x);
      max.y = Math.max(max.y, y);
      max.z = Math.max(max.z, z);
    }

    this.boundingBox = new Box3(min, max);
  }

  dispose() {}
}

// Material mocks
export class Material {
  vertexColors: boolean;
  wireframe: boolean;
  transparent: boolean;
  opacity: number;

  constructor() {
    this.vertexColors = false;
    this.wireframe = false;
    this.transparent = false;
    this.opacity = 1;
  }

  dispose() {}
}

export class MeshLambertMaterial extends Material {
  constructor(params: any = {}) {
    super();
    Object.assign(this, params);
  }
}

export class MeshBasicMaterial extends Material {
  color: number;

  constructor(params: any = {}) {
    super();
    this.color = params.color || 0xffffff;
    Object.assign(this, params);
  }
}

export class LineBasicMaterial extends Material {
  color: number;

  constructor(params: any = {}) {
    super();
    this.color = params.color || 0xffffff;
    Object.assign(this, params);
  }
}

// Geometry mocks
export class BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1) {
    super();
  }
}

export class SphereGeometry extends BufferGeometry {
  constructor(radius = 1, widthSegments = 8, heightSegments = 6) {
    super();
  }
}

export class CylinderGeometry extends BufferGeometry {
  constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 8) {
    super();
  }
}

export class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super();
    
    // Create a simple plane geometry for testing
    const vertices: number[] = [];
    const indices: number[] = [];
    
    const segmentWidth = width / widthSegments;
    const segmentHeight = height / heightSegments;
    
    // Generate vertices
    for (let iy = 0; iy <= heightSegments; iy++) {
      const y = iy * segmentHeight - height / 2;
      for (let ix = 0; ix <= widthSegments; ix++) {
        const x = ix * segmentWidth - width / 2;
        vertices.push(x, 0, y); // Y is up in THREE.js by default for plane
      }
    }
    
    // Generate indices
    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = ix + (widthSegments + 1) * iy;
        const b = ix + (widthSegments + 1) * (iy + 1);
        const c = (ix + 1) + (widthSegments + 1) * (iy + 1);
        const d = (ix + 1) + (widthSegments + 1) * iy;
        
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    
    this.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    this.setIndex(new Uint32Array(indices));
  }
  
  rotateX(angle: number) {
    const position = this.getAttribute('position');
    if (!position) return this;
    
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      
      const newY = y * cos - z * sin;
      const newZ = y * sin + z * cos;
      
      position.setXYZ(i, x, newY, newZ);
    }
    
    position.needsUpdate = true;
    return this;
  }
  
  translate(x: number, y: number, z: number) {
    const position = this.getAttribute('position');
    if (!position) return this;
    
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i);
      const py = position.getY(i);
      const pz = position.getZ(i);
      
      position.setXYZ(i, px + x, py + y, pz + z);
    }
    
    position.needsUpdate = true;
    return this;
  }
}

export class RingGeometry extends BufferGeometry {
  constructor(innerRadius = 0.5, outerRadius = 1, thetaSegments = 8, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    
    // Create a simple ring geometry for testing
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Generate vertices for the ring
    for (let j = 0; j <= phiSegments; j++) {
      const radius = innerRadius + (outerRadius - innerRadius) * (j / phiSegments);
      
      for (let i = 0; i <= thetaSegments; i++) {
        const angle = thetaStart + (i / thetaSegments) * thetaLength;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        vertices.push(x, 0, z); // Ring lies in XZ plane
      }
    }
    
    // Generate indices
    for (let j = 0; j < phiSegments; j++) {
      for (let i = 0; i < thetaSegments; i++) {
        const a = (thetaSegments + 1) * j + i;
        const b = (thetaSegments + 1) * (j + 1) + i;
        const c = (thetaSegments + 1) * (j + 1) + i + 1;
        const d = (thetaSegments + 1) * j + i + 1;
        
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    
    this.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    this.setIndex(new Uint32Array(indices));
  }
}

// Object3D base class
export class Object3D {
  position: Vector3;
  rotation: Euler;
  quaternion: Quaternion;
  scale: Vector3;
  matrixWorld: Matrix4;
  visible: boolean;
  userData: any;

  constructor() {
    this.position = new Vector3();
    this.rotation = new Euler();
    this.quaternion = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    this.matrixWorld = new Matrix4();
    this.visible = true;
    this.userData = {};
  }

  getWorldDirection(target: Vector3) {
    target.set(0, 0, -1);
    return target;
  }

  updateMatrixWorld() {}
}

// Mesh mock
export class Mesh extends Object3D {
  geometry: BufferGeometry;
  material: Material | Material[];
  receiveShadow: boolean;
  castShadow: boolean;

  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.receiveShadow = false;
    this.castShadow = false;
  }
}

// Group mock
export class Group extends Object3D {
  children: Object3D[];

  constructor() {
    super();
    this.children = [];
  }

  add(...objects: Object3D[]) {
    this.children.push(...objects);
    return this;
  }

  remove(...objects: Object3D[]) {
    this.children = this.children.filter(child => !objects.includes(child));
    return this;
  }

  traverse(callback: (object: Object3D) => void) {
    callback(this);
    this.children.forEach(child => {
      if (child instanceof Group) {
        child.traverse(callback);
      } else {
        callback(child);
      }
    });
  }
}

// LineSegments mock
export class LineSegments extends Object3D {
  geometry: BufferGeometry;
  material: Material;

  constructor(geometry: BufferGeometry, material: Material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

// Camera mocks
export class Camera extends Object3D {
  matrixWorldInverse: Matrix4;
  projectionMatrix: Matrix4;
  projectionMatrixInverse: Matrix4;

  constructor() {
    super();
    this.matrixWorldInverse = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.projectionMatrixInverse = new Matrix4();
  }

  updateProjectionMatrix() {}
}

export class PerspectiveCamera extends Camera {
  aspect: number;
  fov: number;
  near: number;
  far: number;

  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    // Initialize quaternion for camera rotation
    this.quaternion = new Quaternion();
  }

  lookAt(x: number | Vector3, y?: number, z?: number) {
    return this;
  }
}

export class OrthographicCamera extends Camera {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;

  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
    super();
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.near = near;
    this.far = far;
    // Initialize quaternion for camera rotation
    this.quaternion = new Quaternion();
  }

  lookAt(x: number | Vector3, y?: number, z?: number) {
    return this;
  }
}

// Light mocks
export class Light extends Object3D {
  color: number;
  intensity: number;

  constructor(color = 0xffffff, intensity = 1) {
    super();
    this.color = color;
    this.intensity = intensity;
  }
}

export class AmbientLight extends Light {
  constructor(color = 0xffffff, intensity = 1) {
    super(color, intensity);
  }
}

export class DirectionalLight extends Light {
  castShadow: boolean;
  shadow: any;

  constructor(color = 0xffffff, intensity = 1) {
    super(color, intensity);
    this.castShadow = false;
    this.shadow = {
      camera: {
        left: -100,
        right: 100,
        top: 100,
        bottom: -100
      }
    };
  }
}

// Scene mock
export class Scene extends Object3D {
  background: any;
  children: Object3D[];

  constructor() {
    super();
    this.background = null;
    this.children = [];
  }

  add(...objects: Object3D[]) {
    this.children.push(...objects);
    return this;
  }

  remove(...objects: Object3D[]) {
    this.children = this.children.filter(child => !objects.includes(child));
    return this;
  }
}

// Color mock
export class Color {
  r: number;
  g: number;
  b: number;

  constructor(r?: number | string, g?: number, b?: number) {
    // Handle different constructor signatures
    if (r === undefined) {
      // No arguments - default to white
      this.r = 1;
      this.g = 1;
      this.b = 1;
    } else if (typeof r === 'number' && g !== undefined && b !== undefined) {
      // Three numbers - RGB values
      this.r = r;
      this.g = g;
      this.b = b;
    } else if (typeof r === 'number') {
      // Single number - hex color
      this.r = 1;
      this.g = 1;
      this.b = 1;
      this.setHex(r);
    } else {
      // String or other - default to white
      this.r = 1;
      this.g = 1;
      this.b = 1;
    }
  }

  setHex(hex: number) {
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
}

// WebGLRenderer mock
export class WebGLRenderer {
  domElement: HTMLCanvasElement;
  shadowMap: any;

  constructor(params: any = {}) {
    this.domElement = document.createElement('canvas');
    this.shadowMap = {
      enabled: false,
      type: 0
    };
  }

  setSize(width: number, height: number) {}
  setPixelRatio(ratio: number) {}
  render(scene: Scene, camera: Camera) {}
  dispose() {}
}

// Raycaster mock
export class Raycaster {
  ray: {
    origin: Vector3;
    direction: Vector3;
  };

  constructor(origin?: Vector3, direction?: Vector3) {
    this.ray = {
      origin: origin || new Vector3(),
      direction: direction || new Vector3(0, 0, -1)
    };
  }

  setFromCamera(coords: Vector2, camera: Camera) {
    // Simplified ray setup for testing
    // In real THREE.js, this unprojects the screen coordinates
    this.ray.origin.copy(camera.position);
    
    // For testing: NDC (0, 0) should point at center of terrain
    // NDC (-1, 1) is top-left corner, should miss
    // We'll use a simple heuristic: if NDC is near center, point down
    const isNearCenter = Math.abs(coords.x) < 0.5 && Math.abs(coords.y) < 0.5;
    
    if (isNearCenter) {
      // Point towards terrain center
      this.ray.direction.set(0, -1, 0).normalize();
    } else {
      // Point away from terrain
      this.ray.direction.set(coords.x * 2, -0.5, coords.y * 2).normalize();
    }
    
    return this;
  }

  intersectObjects(objects: Object3D[], recursive = false): Array<{
    distance: number;
    point: Vector3;
    object: Object3D;
  }> {
    const intersects: Array<{
      distance: number;
      point: Vector3;
      object: Object3D;
    }> = [];

    // Simplified intersection for testing
    // Check each object
    for (const object of objects) {
      if (object instanceof Mesh && object.geometry) {
        // Simple plane intersection test
        // Calculate intersection with Y=0 plane
        const t = -this.ray.origin.y / this.ray.direction.y;
        
        if (t > 0) {
          // Ray hits the plane
          const hitPoint = new Vector3(
            this.ray.origin.x + this.ray.direction.x * t,
            0,
            this.ray.origin.z + this.ray.direction.z * t
          );
          
          // Check if hit point is within terrain bounds (0-32 for a 32x32 plane)
          if (hitPoint.x >= 0 && hitPoint.x <= 32 && hitPoint.z >= 0 && hitPoint.z <= 32) {
            const distance = t;
            
            intersects.push({
              distance,
              point: hitPoint,
              object
            });
          }
        }
      }
    }

    return intersects.sort((a, b) => a.distance - b.distance);
  }
}

// Constants
export const PCFSoftShadowMap = 2;

// Export all
export default {
  Vector2,
  Vector3,
  Euler,
  Quaternion,
  Matrix4,
  Frustum,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Material,
  MeshLambertMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  RingGeometry,
  Object3D,
  Mesh,
  Group,
  LineSegments,
  Camera,
  PerspectiveCamera,
  OrthographicCamera,
  Light,
  AmbientLight,
  DirectionalLight,
  Scene,
  Color,
  WebGLRenderer,
  Raycaster,
  PCFSoftShadowMap
};
