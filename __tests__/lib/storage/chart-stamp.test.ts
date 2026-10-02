/**
 * Chart stamp helpers (rule 8, ADR-014): reading a stamp back out of an R2 object's
 * metadata, deciding whether an image belongs to a cycle, and describing it in
 * response headers.
 *
 * A stamp is only worth anything if it can be believed, so the parser is tested
 * mostly on what it must REFUSE: every way the metadata can be missing, malformed
 * or inconsistent means "no stamp", never a best-effort guess.
 */

import { readFileSync } from 'fs';
import path from 'path';

import {
  CHART_SLOT_SECONDS,
  CHART_STAMP_METADATA_KEYS,
  chartMatchesCycle,
  chartStampHeaders,
  parseChartStamp,
  type ChartStamp,
} from '@/lib/storage/chart-keys';

const SLOT = 1789764900; // 2026-09-18 20:55 UTC

const good = (overrides: Record<string, string | undefined> = {}) => ({
  'cycle-slot': String(SLOT),
  'last-closed-bar': String(SLOT - 300),
  overlay: 'best_fit_a',
  variant: 'overlay',
  'rendered-at': String(SLOT + 70),
  'overlay-m15': 'non_b',
  'overlay-source': 'setting',
  ...overrides,
});

describe('parseChartStamp', () => {
  it('reads a complete stamp', () => {
    expect(parseChartStamp(good(), 'overlay')).toEqual({
      slot: SLOT,
      lastClosedBar: SLOT - 300,
      overlay: 'best_fit_a',
      variant: 'overlay',
      renderedAt: SLOT + 70,
      overlayM15: 'non_b',
      overlaySource: 'setting',
    });
  });

  it('reads the standard variant under the standard key', () => {
    expect(
      parseChartStamp(good({ variant: 'standard' }), 'standard')?.variant
    ).toBe('standard');
  });

  it('the optional fields may be absent (a renderer that predates them)', () => {
    const minimal = {
      'cycle-slot': String(SLOT),
      'last-closed-bar': String(SLOT - 300),
      overlay: 'best_fit_a',
      variant: 'overlay',
    };
    expect(parseChartStamp(minimal, 'overlay')).toEqual({
      slot: SLOT,
      lastClosedBar: SLOT - 300,
      overlay: 'best_fit_a',
      variant: 'overlay',
    });
  });

  it('a default list of overlays (the renderer fell back) is accepted as the overlay', () => {
    expect(
      parseChartStamp(
        good({
          overlay: 'cherry_a,resistance,support',
          'overlay-source': 'default',
        }),
        'overlay'
      )
    ).toMatchObject({
      overlay: 'cherry_a,resistance,support',
      overlaySource: 'default',
    });
  });

  it.each([
    ['no metadata at all', undefined],
    ['null metadata', null],
    ['empty metadata', {}],
  ])('%s is no stamp', (_label, metadata) => {
    expect(parseChartStamp(metadata as never, 'overlay')).toBeNull();
  });

  it.each(['cycle-slot', 'last-closed-bar', 'overlay', 'variant'])(
    'a missing required field (%s) is no stamp',
    (key) => {
      const metadata = good();
      delete (metadata as Record<string, unknown>)[key];
      expect(parseChartStamp(metadata, 'overlay')).toBeNull();
    }
  );

  it.each([
    ['a slot that is text', { 'cycle-slot': 'tomorrow' }],
    ['a negative slot', { 'cycle-slot': '-300', 'last-closed-bar': '-600' }],
    ['a fractional slot', { 'cycle-slot': '1789764900.5' }],
    ['a slot in exponent form', { 'cycle-slot': '1.7897649e9' }],
    ['an empty slot', { 'cycle-slot': '' }],
    ['a slot with spaces', { 'cycle-slot': ` ${SLOT}` }],
    [
      'a slot too long to be a time (even with a consistent last closed bar)',
      {
        'cycle-slot': '1789764900000000',
        'last-closed-bar': '1789764899999700',
      },
    ],
    [
      'a slot off the 5-minute boundary',
      {
        'cycle-slot': String(SLOT + 1),
        'last-closed-bar': String(SLOT + 1 - 300),
      },
    ],
    [
      'a last closed bar that is not slot - 300',
      { 'last-closed-bar': String(SLOT) },
    ],
    [
      'a last closed bar two bars back',
      { 'last-closed-bar': String(SLOT - 600) },
    ],
    ['a last closed bar that is text', { 'last-closed-bar': 'x' }],
  ])('%s is no stamp', (_label, overrides) => {
    expect(parseChartStamp(good(overrides), 'overlay')).toBeNull();
  });

  it.each([
    ['an empty overlay', { overlay: '' }],
    ['an overlay with a space', { overlay: 'best fit a' }],
    ['an overlay in capitals', { overlay: 'BEST_FIT_A' }],
    ['a trailing comma', { overlay: 'best_fit_a,' }],
    ['an empty entry in the list', { overlay: 'best_fit_a,,non_b' }],
    ['an overlay with markup', { overlay: '<script>' }],
    ['a corrupt M15 overlay', { 'overlay-m15': 'non b' }],
    ['an unknown overlay source', { 'overlay-source': 'gateway' }],
    ['a corrupt render time', { 'rendered-at': 'now' }],
    ['a fractional render time', { 'rendered-at': '12.5' }],
  ])('%s is no stamp', (_label, overrides) => {
    expect(parseChartStamp(good(overrides), 'overlay')).toBeNull();
  });

  describe('the variant', () => {
    it('must be a variant', () => {
      expect(parseChartStamp(good({ variant: 'both' }), 'overlay')).toBeNull();
      expect(parseChartStamp(good({ variant: '' }), 'overlay')).toBeNull();
      expect(
        parseChartStamp(good({ variant: 'OVERLAY' }), 'overlay')
      ).toBeNull();
    });

    it('must be the one the object is stored under (an overlay stamp on the standard key is a corrupt pair)', () => {
      expect(
        parseChartStamp(good({ variant: 'overlay' }), 'standard')
      ).toBeNull();
      expect(
        parseChartStamp(good({ variant: 'standard' }), 'overlay')
      ).toBeNull();
    });
  });

  it('does not mutate what it is given', () => {
    const metadata = good();
    const copy = { ...metadata };
    parseChartStamp(metadata, 'overlay');
    expect(metadata).toEqual(copy);
  });

  it('ignores metadata keys it does not know', () => {
    expect(parseChartStamp(good({ unrelated: 'x' }), 'overlay')).not.toBeNull();
  });

  it('the slot length is five minutes', () => {
    expect(CHART_SLOT_SECONDS).toBe(300);
  });
});

describe('chartMatchesCycle', () => {
  const stamp: ChartStamp = {
    slot: SLOT,
    lastClosedBar: SLOT - 300,
    overlay: 'best_fit_a',
    variant: 'overlay',
  };

  it('matches the cycle the image was drawn for', () => {
    expect(chartMatchesCycle(stamp, SLOT)).toEqual({ matches: true });
  });

  it('no stamp is no match, with its reason', () => {
    expect(chartMatchesCycle(null, SLOT)).toEqual({
      matches: false,
      reason: 'NO_CHART_STAMP',
    });
  });

  it.each([
    ['the previous slot', SLOT - 300],
    ['the next slot', SLOT + 300],
    ['a slot a day away', SLOT - 86400],
    ['one second off (not even a slot)', SLOT + 1],
    ['slot zero', 0],
  ])(
    'an image for %s is not this cycle’s, and the reason names both slots',
    (_label, cycleSlot) => {
      const result = chartMatchesCycle(stamp, cycleSlot);
      expect(result.matches).toBe(false);
      expect(result.reason).toMatch(/^CHART_SLOT_MISMATCH: /);
      expect(result.reason).toContain(String(SLOT));
      expect(result.reason).toContain(String(cycleSlot));
    }
  );

  it('looks at the slot only: the indicators and the variant say what the image shows, not whether it is current', () => {
    expect(
      chartMatchesCycle(
        { ...stamp, overlay: 'cherry_a', variant: 'standard' },
        SLOT
      ).matches
    ).toBe(true);
    expect(chartMatchesCycle({ ...stamp, renderedAt: 5 }, SLOT).matches).toBe(
      true
    );
  });
});

describe('chartStampHeaders', () => {
  const stamp: ChartStamp = {
    slot: SLOT,
    lastClosedBar: SLOT - 300,
    overlay: 'best_fit_a',
    variant: 'standard',
    renderedAt: SLOT + 70,
    overlayM15: 'non_b',
    overlaySource: 'setting',
  };

  it('describes the stamp in the five agreed headers and the two extras', () => {
    expect(chartStampHeaders(stamp)).toEqual({
      'X-Chart-Slot': String(SLOT),
      'X-Chart-Last-Closed-Bar': String(SLOT - 300),
      'X-Chart-Overlay': 'best_fit_a',
      'X-Chart-Variant': 'standard',
      'X-Chart-Rendered-At': String(SLOT + 70),
      'X-Chart-Overlay-M15': 'non_b',
      'X-Chart-Overlay-Source': 'setting',
    });
  });

  it('leaves out what the image does not have', () => {
    const {
      renderedAt: _r,
      overlayM15: _m,
      overlaySource: _s,
      ...minimal
    } = stamp;
    expect(
      Object.keys(chartStampHeaders(minimal as ChartStamp)).sort()
    ).toEqual([
      'X-Chart-Last-Closed-Bar',
      'X-Chart-Overlay',
      'X-Chart-Slot',
      'X-Chart-Variant',
    ]);
  });

  it('every value is a string (a header cannot be anything else)', () => {
    for (const value of Object.values(chartStampHeaders(stamp))) {
      expect(typeof value).toBe('string');
    }
  });

  it('a render time of zero is still reported (zero is a value, not an absence)', () => {
    expect(
      chartStampHeaders({ ...stamp, renderedAt: 0 })['X-Chart-Rendered-At']
    ).toBe('0');
  });
});

describe('parity with the renderer (mtf_render/stamp.py)', () => {
  const STAMP_PY = readFileSync(
    path.join(
      process.cwd(),
      'backend-stack-c',
      '1_EA-and-backfill-worker-on-contabo-vps',
      'v2_29_multi-timeframe-visualisation',
      'mtf_render',
      'stamp.py'
    ),
    'utf-8'
  );

  it('writes exactly the metadata keys this side reads', () => {
    const python = Object.fromEntries(
      [...STAMP_PY.matchAll(/^META_([A-Z_0-9]+)\s*=\s*"([^"]+)"/gm)].map(
        (m) => [m[1], m[2]]
      )
    );
    expect(python).toEqual({
      SLOT: CHART_STAMP_METADATA_KEYS.slot,
      LAST_CLOSED_BAR: CHART_STAMP_METADATA_KEYS.lastClosedBar,
      OVERLAY: CHART_STAMP_METADATA_KEYS.overlay,
      VARIANT: CHART_STAMP_METADATA_KEYS.variant,
      RENDERED_AT: CHART_STAMP_METADATA_KEYS.renderedAt,
      OVERLAY_M15: CHART_STAMP_METADATA_KEYS.overlayM15,
      OVERLAY_SOURCE: CHART_STAMP_METADATA_KEYS.overlaySource,
    });
  });

  it('uses the same slot length', () => {
    expect(STAMP_PY).toMatch(
      new RegExp(`^SLOT_SECONDS = ${CHART_SLOT_SECONDS}$`, 'm')
    );
  });

  it('the overlay sources it can write are the ones this side accepts', () => {
    expect(STAMP_PY).toMatch(/^OVERLAY_SOURCES = \("setting", "default"\)$/m);
  });

  it('the variants it can write are the ones this side accepts', () => {
    expect(STAMP_PY).toMatch(/^VARIANTS = \("overlay", "standard"\)$/m);
  });

  it('last-closed-bar is slot minus one bar on both sides', () => {
    expect(STAMP_PY).toContain('return self.slot - SLOT_SECONDS');
  });
});
