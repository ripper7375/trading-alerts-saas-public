/**
 * Jest Setup File
 *
 * Polyfills for Jest test environment
 * Fixes compatibility issues with undici/jsdom environment
 *
 * NOTE: This runs via setupFiles (before test framework), not setupFilesAfterEnv
 */

// Polyfill clearImmediate for jsdom environment
// undici uses clearImmediate which is a Node.js global, not implemented in jsdom
if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = function (immediate?: any) {
    return clearTimeout(immediate);
  };
}

// Polyfill setImmediate for jsdom environment
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = Object.assign(
    function (callback: (...args: any[]) => void, ...args: any[]) {
      return setTimeout(callback, 0, ...args);
    },
    { __promisify__: undefined }
  ) as any;
}

// Mock markResourceTiming for undici compatibility
// undici calls performance.markResourceTiming which doesn't exist in jsdom
if (typeof global.performance !== 'undefined' && typeof (global.performance as any).markResourceTiming === 'undefined') {
  (global.performance as any).markResourceTiming = function () {
    // No-op mock
  };
}
