/**
 * The REAL lightweight-charts inside Jest.
 *
 * jest.config.js maps `lightweight-charts` to a stub (the package is ESM only),
 * and a stubbed time scale cannot show where something really lands. This
 * evaluates the library's standalone build as a plain script and stubs only what
 * jsdom does not implement (the 2D canvas and `matchMedia`).
 */

import { readFileSync } from 'fs';
import type * as LightweightCharts from 'lightweight-charts';
import path from 'path';

export type Library = typeof LightweightCharts;

function stubBrowserApis(): void {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  })) as unknown as typeof window.matchMedia;

  const context = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, property) => {
      if (property in target) return target[property];
      if (property === 'measureText') {
        return () => ({
          width: 10,
          actualBoundingBoxAscent: 8,
          actualBoundingBoxDescent: 2,
        });
      }
      return () => undefined;
    },
    set: (target, property, value) => {
      target[property] = value;
      return true;
    },
  });
  HTMLCanvasElement.prototype.getContext = (() =>
    context) as unknown as HTMLCanvasElement['getContext'];
}

export function loadRealLibrary(): Library {
  stubBrowserApis();
  const root = path.dirname(require.resolve('lightweight-charts/package.json'));
  const source = readFileSync(
    path.join(root, 'dist', 'lightweight-charts.standalone.production.js'),
    'utf8'
  );
  new Function(source)();
  return (window as unknown as { LightweightCharts: Library })
    .LightweightCharts;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Lets the chart paint, which is when it applies changes and reports them. */
export async function settle(frames = 2): Promise<void> {
  for (let frame = 0; frame < frames; frame++) await nextFrame();
}
