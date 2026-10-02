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

import { CHART_VARIANTS, chartObjectKey } from '@/lib/storage/chart-keys';

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
  });

  it('builds a stable key per variant', () => {
    expect(chartObjectKey('overlay')).toBe(
      'xauusd/mtf_render_xauusd_m5_m15_overlay.png'
    );
    expect(chartObjectKey('standard')).toBe(
      'xauusd/mtf_render_xauusd_m5_m15_standard.png'
    );
  });
});

const UPLOAD_WORKER = path.join(
  process.cwd(),
  'backend-stack-c',
  '1_EA-and-backfill-worker-on-contabo-vps',
  'v2_29_multi-timeframe-visualisation',
  'mtf_render_upload_worker.py'
);

describe('parity with the upload worker (the third place the name appears)', () => {
  const source = readFileSync(UPLOAD_WORKER, 'utf-8');
  const constant = (name: string) =>
    (source.match(new RegExp(`^${name}\\s*=\\s*'([^']+)'`, 'm')) ?? [])[1];

  it('uses the same key prefix and file stem the monolith builds its keys from', () => {
    expect(constant('KEY_PREFIX')).toBe('xauusd');
    expect(constant('OUT_STEM')).toBe('mtf_render_xauusd_m5_m15');
    for (const variant of CHART_VARIANTS) {
      expect(chartObjectKey(variant)).toBe(
        `${constant('KEY_PREFIX')}/${constant('OUT_STEM')}_${variant}.png`
      );
    }
  });

  it('builds its object key the same way (prefix / stem _ variant .png)', () => {
    expect(source).toContain("return f'{KEY_PREFIX}/{OUT_STEM}_{variant}.png'");
  });

  it('passes the stamp to R2 as object metadata', () => {
    expect(source).toContain("'Metadata': stamps[variant].object_metadata()");
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
