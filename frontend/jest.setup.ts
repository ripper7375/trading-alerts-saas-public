/**
 * Jest Setup File
 *
 * Polyfills and global setup for Jest tests
 * Fixes compatibility issues with undici/jsdom environment
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
  global.setImmediate = function (callback: (...args: any[]) => void, ...args: any[]) {
    return setTimeout(callback, 0, ...args);
  };
}

// Mock markResourceTiming for undici compatibility
// undici calls performance.markResourceTiming which doesn't exist in jsdom
if (typeof global.performance !== 'undefined' && typeof global.performance.markResourceTiming === 'undefined') {
  global.performance.markResourceTiming = function () {
    // No-op mock
  };
}

// Increase test timeout for integration tests (default is 5000ms)
jest.setTimeout(15000);
