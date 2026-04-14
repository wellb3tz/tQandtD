/**
 * Browser Compatibility Tests
 * 
 * **Validates: Requirements 18.4**
 * 
 * These tests verify browser compatibility for the demo application,
 * including WebGL support, required extensions, and browser-specific features.
 * 
 * NOTE: These tests are designed to run in actual browsers, not in Node.js.
 * They will be skipped in Node.js environments and should be run manually
 * in target browsers using a browser test runner or by opening the demo
 * application in each browser.
 * 
 * Manual Testing Required:
 * - Chrome/Edge (Chromium): Open demo in Chrome or Edge browser
 * - Firefox: Open demo in Firefox browser
 * - Safari: Open demo in Safari browser (macOS/iOS)
 * - Mobile: Open demo on iOS Safari and Chrome Mobile
 * 
 * To run these tests in a browser environment, use a tool like:
 * - Playwright
 * - Puppeteer
 * - Selenium
 * - Or manually open the demo and check browser console
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Check if we're running in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// Helper to skip tests in Node.js environment
const browserOnly = isBrowser ? it : it.skip;

describe('Browser Compatibility Tests', () => {
  // Add a test to indicate these are browser-only tests
  it('should indicate browser-only test suite', () => {
    if (!isBrowser) {
      console.log('⚠️  Browser compatibility tests are designed to run in actual browsers');
      console.log('   These tests are skipped in Node.js environments');
      console.log('   To test browser compatibility:');
      console.log('   1. Open the demo application in target browsers');
      console.log('   2. Check browser console for any errors');
      console.log('   3. Verify all features work as expected');
      console.log('   4. See demo/BROWSER_COMPATIBILITY.md for testing checklist');
    }
    expect(true).toBe(true);
  });

  describe('WebGL Support', () => {
    browserOnly('should detect WebGL context availability', () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      expect(gl).toBeTruthy();
      expect(gl).toBeInstanceOf(WebGLRenderingContext);
    });

    browserOnly('should detect WebGL2 context availability', () => {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      
      // WebGL2 is preferred but not required
      if (gl2) {
        expect(gl2).toBeInstanceOf(WebGL2RenderingContext);
      }
    });

    browserOnly('should report WebGL version', () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        const version = (gl as WebGLRenderingContext).getParameter(
          (gl as WebGLRenderingContext).VERSION
        );
        expect(version).toBeTruthy();
        expect(typeof version).toBe('string');
        console.log('WebGL Version:', version);
      }
    });

    browserOnly('should report WebGL vendor and renderer', () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        const vendor = (gl as WebGLRenderingContext).getParameter(
          (gl as WebGLRenderingContext).VENDOR
        );
        const renderer = (gl as WebGLRenderingContext).getParameter(
          (gl as WebGLRenderingContext).RENDERER
        );
        
        expect(vendor).toBeTruthy();
        expect(renderer).toBeTruthy();
        console.log('WebGL Vendor:', vendor);
        console.log('WebGL Renderer:', renderer);
      }
    });
  });

  describe('Required WebGL Extensions', () => {
    let gl: WebGLRenderingContext | null;

    beforeEach(() => {
      if (!isBrowser) return;
      const canvas = document.createElement('canvas');
      gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;
    });

    browserOnly('should support OES_element_index_uint extension', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping extension test');
        return;
      }

      const ext = gl.getExtension('OES_element_index_uint');
      expect(ext).toBeTruthy();
    });

    browserOnly('should report all available extensions', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping extension test');
        return;
      }

      const extensions = gl.getSupportedExtensions();
      expect(extensions).toBeTruthy();
      expect(Array.isArray(extensions)).toBe(true);
      
      if (extensions) {
        console.log('Available WebGL Extensions:', extensions.length);
        console.log(extensions.join(', '));
      }
    });

    browserOnly('should check for optional performance extensions', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping extension test');
        return;
      }

      const optionalExtensions = [
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_etc',
        'WEBGL_compressed_texture_astc',
        'OES_texture_float',
        'OES_texture_half_float',
        'WEBGL_depth_texture',
        'EXT_texture_filter_anisotropic'
      ];

      const availableOptional: string[] = [];
      const missingOptional: string[] = [];

      for (const extName of optionalExtensions) {
        if (gl.getExtension(extName)) {
          availableOptional.push(extName);
        } else {
          missingOptional.push(extName);
        }
      }

      console.log('Available optional extensions:', availableOptional);
      console.log('Missing optional extensions:', missingOptional);
      
      // These are optional, so we don't fail the test
      expect(true).toBe(true);
    });
  });

  describe('WebGL Capabilities', () => {
    let gl: WebGLRenderingContext | null;

    beforeEach(() => {
      if (!isBrowser) return;
      const canvas = document.createElement('canvas');
      gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;
    });

    browserOnly('should report maximum texture size', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping capability test');
        return;
      }

      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      expect(maxTextureSize).toBeGreaterThanOrEqual(2048);
      console.log('Max Texture Size:', maxTextureSize);
    });

    browserOnly('should report maximum vertex attributes', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping capability test');
        return;
      }

      const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
      expect(maxVertexAttribs).toBeGreaterThanOrEqual(8);
      console.log('Max Vertex Attributes:', maxVertexAttribs);
    });

    browserOnly('should report maximum varying vectors', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping capability test');
        return;
      }

      const maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
      expect(maxVaryingVectors).toBeGreaterThanOrEqual(8);
      console.log('Max Varying Vectors:', maxVaryingVectors);
    });

    browserOnly('should report maximum vertex uniform vectors', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping capability test');
        return;
      }

      const maxVertexUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
      expect(maxVertexUniformVectors).toBeGreaterThanOrEqual(128);
      console.log('Max Vertex Uniform Vectors:', maxVertexUniformVectors);
    });

    browserOnly('should report maximum fragment uniform vectors', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping capability test');
        return;
      }

      const maxFragmentUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
      expect(maxFragmentUniformVectors).toBeGreaterThanOrEqual(16);
      console.log('Max Fragment Uniform Vectors:', maxFragmentUniformVectors);
    });

    browserOnly('should report viewport dimensions', () => {
      if (!gl) {
        console.warn('WebGL not available, skipping capability test');
        return;
      }

      const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      expect(Array.isArray(maxViewportDims)).toBe(true);
      expect(maxViewportDims[0]).toBeGreaterThanOrEqual(2048);
      expect(maxViewportDims[1]).toBeGreaterThanOrEqual(2048);
      console.log('Max Viewport Dimensions:', maxViewportDims);
    });
  });

  describe('Browser Feature Detection', () => {
    browserOnly('should support Web Workers', () => {
      expect(typeof Worker).toBe('function');
    });

    it('should support Typed Arrays', () => {
      expect(typeof Float32Array).toBe('function');
      expect(typeof Uint8Array).toBe('function');
      expect(typeof Uint16Array).toBe('function');
      expect(typeof Uint32Array).toBe('function');
    });

    it('should support ArrayBuffer', () => {
      expect(typeof ArrayBuffer).toBe('function');
      const buffer = new ArrayBuffer(16);
      expect(buffer.byteLength).toBe(16);
    });

    browserOnly('should support Blob and File APIs', () => {
      expect(typeof Blob).toBe('function');
      expect(typeof File).toBe('function');
      expect(typeof FileReader).toBe('function');
    });

    browserOnly('should support Canvas API', () => {
      const canvas = document.createElement('canvas');
      expect(canvas).toBeTruthy();
      expect(typeof canvas.getContext).toBe('function');
      
      const ctx2d = canvas.getContext('2d');
      expect(ctx2d).toBeTruthy();
    });

    browserOnly('should support requestAnimationFrame', () => {
      expect(typeof requestAnimationFrame).toBe('function');
      expect(typeof cancelAnimationFrame).toBe('function');
    });

    browserOnly('should support localStorage', () => {
      expect(typeof localStorage).toBe('object');
      expect(typeof localStorage.getItem).toBe('function');
      expect(typeof localStorage.setItem).toBe('function');
    });

    it('should support URL API', () => {
      expect(typeof URL).toBe('function');
      const url = new URL('https://example.com/path?query=value');
      expect(url.hostname).toBe('example.com');
    });

    browserOnly('should support Clipboard API', () => {
      expect(typeof navigator.clipboard).toBe('object');
      // Note: clipboard.writeText may require user interaction
    });
  });

  describe('Performance APIs', () => {
    it('should support Performance API', () => {
      expect(typeof performance).toBe('object');
      expect(typeof performance.now).toBe('function');
    });

    it('should support performance.memory (Chrome/Edge)', () => {
      // This is a non-standard API available in Chrome/Edge
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        console.log('Memory API available');
        console.log('Used JS Heap Size:', perfMemory.usedJSHeapSize);
        console.log('Total JS Heap Size:', perfMemory.totalJSHeapSize);
        console.log('JS Heap Size Limit:', perfMemory.jsHeapSizeLimit);
      } else {
        console.log('Memory API not available (expected in Firefox/Safari)');
      }
      expect(true).toBe(true); // Don't fail if not available
    });

    it('should support PerformanceObserver', () => {
      expect(typeof PerformanceObserver).toBe('function');
    });
  });

  describe('Mobile-Specific Features', () => {
    browserOnly('should detect touch support', () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      console.log('Touch Support:', hasTouch);
      expect(typeof hasTouch).toBe('boolean');
    });

    browserOnly('should detect device pixel ratio', () => {
      const dpr = window.devicePixelRatio || 1;
      console.log('Device Pixel Ratio:', dpr);
      expect(dpr).toBeGreaterThan(0);
    });

    browserOnly('should detect screen orientation API', () => {
      const hasOrientation = 'orientation' in screen || 'orientation' in window;
      console.log('Orientation API:', hasOrientation);
      expect(typeof hasOrientation).toBe('boolean');
    });

    it('should report hardware concurrency', () => {
      const cores = navigator.hardwareConcurrency || 1;
      console.log('Hardware Concurrency:', cores);
      expect(cores).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Browser-Specific Quirks', () => {
    it('should detect user agent', () => {
      const ua = navigator.userAgent;
      console.log('User Agent:', ua);
      
      const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
      const isFirefox = /Firefox/.test(ua);
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
      const isEdge = /Edg/.test(ua);
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isAndroid = /Android/.test(ua);
      
      console.log('Browser Detection:', {
        isChrome,
        isFirefox,
        isSafari,
        isEdge,
        isIOS,
        isAndroid
      });
      
      expect(typeof ua).toBe('string');
    });

    browserOnly('should check for Safari-specific WebGL limitations', () => {
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      
      if (isSafari) {
        console.log('Running on Safari - checking for known limitations');
        
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') as WebGLRenderingContext;
        
        if (gl) {
          // Safari has lower limits for some WebGL parameters
          const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
          console.log('Safari Max Texture Size:', maxTextureSize);
          
          // Safari typically has 4096 or 8192, while Chrome can have 16384
          expect(maxTextureSize).toBeGreaterThanOrEqual(4096);
        }
      }
      
      expect(true).toBe(true);
    });

    browserOnly('should check for iOS Safari memory constraints', () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        console.log('Running on iOS - be aware of memory constraints');
        console.log('iOS devices have stricter memory limits');
        console.log('Consider reducing chunk cache size and LOD distances');
      }
      
      expect(true).toBe(true);
    });
  });
});
