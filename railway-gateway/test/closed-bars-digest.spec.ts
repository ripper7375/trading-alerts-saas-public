import {
  ClosedSpine,
  FetchBars,
  SPINE_DIGEST_VERSION,
  SpineBar,
  canonicalSpine,
  digestClosedSpine,
  loadClosedSpine,
} from '../src/cycle/closed-bars-digest';
import {
  Timeframe,
  formingBarOpen,
  lastClosedBarOpen,
} from '../src/cycle/slot';
import { ONE_DAY_CLOSED_BARS } from '../src/cycle/windows';

/**
 * The closed-bar digest (section 1.8 "replaying a slot returns the same closed
 * bars"; replay scope decided 2026-10-01).
 *
 * Its whole value is being a faithful fingerprint, so the properties worth
 * pinning are the ones that make a fingerprint wrong without any error:
 *
 *   * it must change when ANY closed bar's OHLC changes (otherwise a refit
 *     bar that moved is invisible);
 *   * it must NOT change for things that are not the spine: the order the rows
 *     arrived in, indicator columns, a bar still forming at the slot, rows that
 *     arrived after the slot (otherwise every replay disagrees and the digest
 *     is noise);
 *   * it must refuse a bar it cannot hash (a NaN would serialise as null and
 *     hash happily).
 */

const SLOT = 1789765200; // 21:00 on 18 Sep 2026: M5 and M15 both refresh
const STEP: Record<Timeframe, number> = { M5: 300, M15: 900 };

function bar(timestamp: number, i: number): SpineBar {
  return {
    timestamp,
    open: 2650 + i * 0.25,
    high: 2651.5 + i * 0.25,
    low: 2649.25 + i * 0.25,
    close: 2650.5 + i * 0.25,
    volume: 100 + i,
  };
}

/** `count` consecutive bars ending at `newest`, oldest first. */
function bars(timeframe: Timeframe, newest: number, count: number): SpineBar[] {
  return Array.from({ length: count }, (_, i) =>
    bar(newest - (count - 1 - i) * STEP[timeframe], i)
  );
}

function fullSpine(slot = SLOT): ClosedSpine {
  return {
    M5: bars('M5', lastClosedBarOpen('M5', slot), ONE_DAY_CLOSED_BARS.M5),
    M15: bars('M15', lastClosedBarOpen('M15', slot), ONE_DAY_CLOSED_BARS.M15),
  };
}

describe('the canonical form and a known answer', () => {
  const tiny: ClosedSpine = {
    M5: [
      {
        timestamp: 1789764300,
        open: 2650.25,
        high: 2651.5,
        low: 2649.25,
        close: 2650.5,
        volume: 100,
      },
      {
        timestamp: 1789764600,
        open: 2650.5,
        high: 2652.75,
        low: 2650.125,
        close: 2651.75,
        volume: 120,
      },
    ],
    M15: [
      {
        timestamp: 1789763400,
        open: 2648.5,
        high: 2652.25,
        low: 2647.5,
        close: 2651.125,
        volume: 900,
      },
    ],
  };

  it('is the version line and one compact JSON body, bars oldest first', () => {
    expect(canonicalSpine(tiny)).toBe(
      'spine/1\n{"M5":[[1789764300,2650.25,2651.5,2649.25,2650.5,100],' +
        '[1789764600,2650.5,2652.75,2650.125,2651.75,120]],' +
        '"M15":[[1789763400,2648.5,2652.25,2647.5,2651.125,900]]}'
    );
    expect(SPINE_DIGEST_VERSION).toBe('spine/1');
  });

  it("hashes to a value computed independently with Python's hashlib", () => {
    // Python: hashlib.sha256((text).encode()).hexdigest() over the exact text above.
    // (Prices here are not whole numbers on purpose: JavaScript prints 2650 where
    // Python prints 2650.0, and only the gateway computes this digest.)
    expect(digestClosedSpine(tiny)).toBe(
      '03200de5a58ae3806062d1bb46ae5326fa091158561a1eeeb87f8bbcb9704df7'
    );
  });

  it('is a lower-case SHA-256: 64 hex characters', () => {
    expect(digestClosedSpine(fullSpine())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(digestClosedSpine(fullSpine())).toBe(digestClosedSpine(fullSpine()));
  });
});

describe('what changes the digest', () => {
  const base = digestClosedSpine(fullSpine());
  const fields: Array<keyof SpineBar> = [
    'timestamp',
    'open',
    'high',
    'low',
    'close',
    'volume',
  ];

  it('any one field of any one bar, at the start, middle and end of each window', () => {
    const seen = new Set<string>([base]);
    for (const timeframe of ['M5', 'M15'] as const) {
      const last = ONE_DAY_CLOSED_BARS[timeframe] - 1;
      for (const index of [0, Math.floor(last / 2), last]) {
        for (const field of fields) {
          const spine = fullSpine();
          // nudge by the smallest amount that is still a different number
          spine[timeframe][index] = {
            ...spine[timeframe][index],
            [field]:
              spine[timeframe][index][field] +
              (field === 'timestamp' ? 60 : 0.01),
          };
          const digest = digestClosedSpine(spine);
          expect(digest).not.toBe(base);
          seen.add(digest);
        }
      }
    }
    // 2 timeframes x 3 positions x 6 fields = 36 different spines, 36 different digests
    expect(seen.size).toBe(1 + 36);
  });

  it('a bar added or dropped at either end of a window', () => {
    const grown = fullSpine();
    grown.M5.unshift(bar(grown.M5[0].timestamp - 300, 99));
    const shrunk = fullSpine();
    shrunk.M15.pop();
    expect(digestClosedSpine(grown)).not.toBe(base);
    expect(digestClosedSpine(shrunk)).not.toBe(base);
  });

  it('the same bars under the other timeframe', () => {
    const swapped: ClosedSpine = { M5: [], M15: [] };
    const bs = bars('M5', lastClosedBarOpen('M5', SLOT), 3);
    expect(digestClosedSpine({ ...swapped, M5: bs })).not.toBe(
      digestClosedSpine({ ...swapped, M15: bs })
    );
  });

  it('an empty spine is a valid, different digest (not an error)', () => {
    const empty = digestClosedSpine({ M5: [], M15: [] });
    expect(empty).toMatch(/^[0-9a-f]{64}$/);
    expect(empty).not.toBe(base);
  });
});

describe('what must NOT change the digest', () => {
  const base = digestClosedSpine(fullSpine());

  it('the order the rows arrived in', () => {
    const shuffled = fullSpine();
    shuffled.M5.reverse();
    shuffled.M15 = [...shuffled.M15.slice(40), ...shuffled.M15.slice(0, 40)];
    expect(digestClosedSpine(shuffled)).toBe(base);
  });

  it('indicator columns riding along on the rows (they are refit by later cycles)', () => {
    const spine = fullSpine();
    spine.M5 = spine.M5.map((b) => ({
      ...b,
      best_fit_a_ssa: 2651.123,
      non_b_uoedt: 2660,
      zigzag_category: 'HH',
    })) as SpineBar[];
    expect(digestClosedSpine(spine)).toBe(base);
  });
});

describe('what it refuses to hash', () => {
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['undefined', undefined],
    ['null', null],
    ['a string', '2650.5'],
  ])('a bar whose close is %s', (_label, value) => {
    const spine = fullSpine();
    spine.M5[3] = { ...spine.M5[3], close: value as unknown as number };
    expect(() => digestClosedSpine(spine)).toThrow(RangeError);
  });

  it('two bars at the same open time', () => {
    const spine = fullSpine();
    spine.M5[1] = { ...spine.M5[1], timestamp: spine.M5[0].timestamp };
    expect(() => digestClosedSpine(spine)).toThrow(/two bars at/);
  });
});

describe('loading the one-day spine as of a slot', () => {
  /** An in-memory market_data_v6 with the same filter-and-take the real query has. */
  function table(rows: Array<SpineBar & { timeframe: Timeframe }>): {
    fetch: FetchBars;
    calls: Array<[Timeframe, number, number]>;
  } {
    const calls: Array<[Timeframe, number, number]> = [];
    const fetch: FetchBars = async (timeframe, maxOpenTime, take) => {
      calls.push([timeframe, maxOpenTime, take]);
      return rows
        .filter((r) => r.timeframe === timeframe && r.timestamp <= maxOpenTime)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, take)
        .map(({ timeframe: _tf, ...rest }) => rest);
    };
    return { fetch, calls };
  }

  function everything(extraNewer: boolean) {
    const rows: Array<SpineBar & { timeframe: Timeframe }> = [];
    for (const timeframe of ['M5', 'M15'] as const) {
      // 3,000 bars like the live window, up to and including the bar forming at the slot
      for (const b of bars(timeframe, formingBarOpen(timeframe, SLOT), 3000)) {
        rows.push({ ...b, timeframe });
      }
      if (extraNewer) {
        // rows that arrived AFTER the slot (a later cycle's bars)
        for (let i = 1; i <= 5; i += 1) {
          rows.push({ ...bar(SLOT + i * STEP[timeframe], 500 + i), timeframe });
        }
      }
    }
    return rows;
  }

  it('asks for the newest closed bar and 288 / 96 of them, and nothing newer', async () => {
    const t = table(everything(false));
    await loadClosedSpine(t.fetch, SLOT);
    expect(t.calls).toEqual([
      ['M5', SLOT - 300, 288],
      ['M15', SLOT - 900, 96],
    ]);
  });

  it('returns exactly one day of closed bars, oldest first, ending at the newest closed bar', async () => {
    const spine = await loadClosedSpine(table(everything(false)).fetch, SLOT);
    expect(spine.M5).toHaveLength(288);
    expect(spine.M15).toHaveLength(96);
    expect(spine.M5[287].timestamp).toBe(SLOT - 300);
    expect(spine.M15[95].timestamp).toBe(SLOT - 900);
    expect(spine.M5[0].timestamp).toBe(SLOT - 300 - 287 * 300);
    for (const tf of ['M5', 'M15'] as const) {
      const stamps = spine[tf].map((b) => b.timestamp);
      expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    }
  });

  it('never includes the bar still forming at the slot (section 1.8: no still-open bar downstream)', async () => {
    const spine = await loadClosedSpine(table(everything(false)).fetch, SLOT);
    expect(spine.M5.map((b) => b.timestamp)).not.toContain(SLOT);
    expect(spine.M15.map((b) => b.timestamp)).not.toContain(SLOT);
  });

  it("gives the same digest with or without the forming bar and later cycles' rows in the table", async () => {
    const lean = everything(false).filter(
      (r) => r.timestamp < formingBarOpen(r.timeframe, SLOT)
    );
    const a = digestClosedSpine(await loadClosedSpine(table(lean).fetch, SLOT));
    const b = digestClosedSpine(
      await loadClosedSpine(table(everything(false)).fetch, SLOT)
    );
    const c = digestClosedSpine(
      await loadClosedSpine(table(everything(true)).fetch, SLOT)
    );
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('changes when a closed bar is later upserted with different values (the case it exists to reveal)', async () => {
    const rows = everything(false);
    const before = digestClosedSpine(
      await loadClosedSpine(table(rows).fetch, SLOT)
    );
    // the newest closed M5 bar, exported a second before it closed, is refreshed by the next cycle
    const target = rows.find(
      (r) => r.timeframe === 'M5' && r.timestamp === SLOT - 300
    )!;
    target.close += 0.35;
    const after = digestClosedSpine(
      await loadClosedSpine(table(rows).fetch, SLOT)
    );
    expect(after).not.toBe(before);
  });

  it('on a slot that does not refresh M15 the M15 window still ends at the last closed M15 bar', async () => {
    const plain = SLOT - 300; // 20:55
    const t = table(everything(false));
    const spine = await loadClosedSpine(t.fetch, plain);
    // 20:55: the M15 bar opened 20:45 is still forming, so the newest closed one opened 20:30
    expect(lastClosedBarOpen('M15', plain)).toBe(SLOT - 300 - 600 - 900);
    expect(t.calls[1]).toEqual(['M15', lastClosedBarOpen('M15', plain), 96]);
    expect(spine.M15[spine.M15.length - 1].timestamp).toBe(
      lastClosedBarOpen('M15', plain)
    );
  });
});

describe('the one-day window', () => {
  it('is 288 M5 and 96 M15 bars', () => {
    expect({ ...ONE_DAY_CLOSED_BARS }).toEqual({ M5: 288, M15: 96 });
  });
});
