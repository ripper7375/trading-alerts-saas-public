/**
 * R2 chart object-key tests.
 *
 * The parity test below is the important one. The object key here and the
 * renderer's output filename are maintained in two different languages, in two
 * different directories, with no compiler linking them -- exactly the shape of
 * drift that left `mtf_render` selecting a `best_fit_*` column that had been
 * renamed months earlier. Here it would surface as a 404 on download rather
 * than as an error, so it is worth pinning explicitly.
 */

import { readFileSync } from 'fs';
import path from 'path';

import {
  CHART_VARIANTS,
  chartObjectKey,
  DEFAULT_CHART_VARIANT,
  parseChartVariant,
} from '@/lib/storage/chart-keys';

const RENDERER_MAIN = path.join(
  process.cwd(),
  'backend-stack-c',
  '1_EA-and-backfill-worker-on-contabo-vps',
  'v2_29_multi-timeframe-visualisation',
  'mtf_render',
  '__main__.py'
);

describe('chart object keys', () => {
  it('exposes exactly the two variants the renderer produces', () => {
    expect([...CHART_VARIANTS]).toEqual(['overlay', 'standard']);
    expect(DEFAULT_CHART_VARIANT).toBe('overlay');
  });

  it('builds a stable key per variant', () => {
    expect(chartObjectKey('overlay')).toBe(
      'xauusd/mtf_render_xauusd_m5_m15_overlay.png'
    );
    expect(chartObjectKey('standard')).toBe(
      'xauusd/mtf_render_xauusd_m5_m15_standard.png'
    );
  });

  it('coerces untrusted input instead of throwing', () => {
    expect(parseChartVariant('standard')).toBe('standard');
    expect(parseChartVariant('overlay')).toBe('overlay');
    expect(parseChartVariant('garbage')).toBe('overlay');
    expect(parseChartVariant(null)).toBe('overlay');
    expect(parseChartVariant(undefined)).toBe('overlay');
  });
});

describe('parity with the renderer', () => {
  it("matches the renderer's own output filenames", () => {
    const source = readFileSync(RENDERER_MAIN, 'utf-8');

    // The renderer builds `<stem>_<variant>.png` from its DEFAULT_OUT.
    const stemMatch = source.match(/DEFAULT_OUT\s*=\s*"([^"]+)"/);
    expect(stemMatch).not.toBeNull();

    const stem = (stemMatch as RegExpMatchArray)[1].replace(/\.png$/, '');

    for (const variant of CHART_VARIANTS) {
      const rendererFilename = `${stem}_${variant}.png`;
      expect(chartObjectKey(variant)).toBe(`xauusd/${rendererFilename}`);
    }
  });

  it("uses the same variant names the renderer's CLI writes", () => {
    const source = readFileSync(RENDERER_MAIN, 'utf-8');

    // __main__.py iterates ("overlay", True), ("standard", False)
    for (const variant of CHART_VARIANTS) {
      expect(source).toContain(`"${variant}"`);
    }
  });
});
