import * as fs from 'fs';
import * as path from 'path';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import {
  DecisionInput,
  LandedCount,
  cycleAttempts,
  decideManifest,
  expectedBars,
  listTimeframes,
} from '../src/cycle/manifest-decision';
import { MANIFEST_THRESHOLDS } from '../src/cycle/manifest-thresholds';
import { Timeframe } from '../src/cycle/slot';

/**
 * What to do with a manifest whose rows may not all have landed (ADR-009).
 *
 * The boundaries are tested to the second because they are starting values that
 * will be tuned: a boundary off by one second today is a wrong decision for real
 * cycles later. The manifests are the REAL sender's (see
 * scripts/generate_cycle_manifest_fixtures.py).
 */

function fixture(name: string): CycleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  );
}

const refresh = fixture('cycle-manifest-refresh-slot.json'); // M5 289 bars, M15 97 bars, 3 + 3 statistics
const plain = fixture('cycle-manifest-plain-slot.json'); // M5 289 bars, 3 statistics
const closed = fixture('cycle-manifest-closed-newest.json'); // M5 288 bars (1 quarantined), M15 96 bars

/** Everything landed, exactly as expected. */
function allLanded(
  manifest: CycleManifest
): Partial<Record<Timeframe, LandedCount>> {
  const out: Partial<Record<Timeframe, LandedCount>> = {};
  for (const tf of listTimeframes(manifest)) {
    const s = manifest.timeframes[tf]!;
    out[tf] = {
      bars: expectedBars(s),
      statistics: s.statistics_count,
      // the cycle's own version of the newest row has landed
      newestCycleId: s.collection_cycle_id,
    };
  }
  return out;
}

function input(
  manifest: CycleManifest,
  counts: DecisionInput['counts'],
  ageSec = 10,
  slotAgeSec = 70
): DecisionInput {
  return { manifest, counts, ageSec, slotAgeSec };
}

describe('what the manifest expects', () => {
  it('the bars it pushed first, less the ones the gateway rejected', () => {
    expect(expectedBars(refresh.timeframes.M5)).toBe(289);
    expect(expectedBars(closed.timeframes.M5)).toBe(287); // 288 sent, 1 quarantined
    expect(expectedBars(closed.timeframes.M15!)).toBe(96);
  });

  it('never goes below zero', () => {
    expect(
      expectedBars({
        ...plain.timeframes.M5,
        bar_count: 1,
        quarantined_rows: 5,
      })
    ).toBe(0);
  });

  it('lists the timeframes it carries: M5 always, M15 on refresh slots', () => {
    expect(listTimeframes(refresh)).toEqual(['M5', 'M15']);
    expect(listTimeframes(plain)).toEqual(['M5']);
  });

  it("the cycle's attempts are the larger of its timeframes'", () => {
    expect(cycleAttempts(refresh)).toBe(2); // M5 needed 2, M15 needed 1
    expect(cycleAttempts(plain)).toBe(1);
    const m15Worse: CycleManifest = {
      ...refresh,
      timeframes: {
        M5: { ...refresh.timeframes.M5, attempts: 1 },
        M15: { ...refresh.timeframes.M15!, attempts: 3 },
      },
    };
    expect(cycleAttempts(m15Worse)).toBe(3);
  });
});

describe('everything has landed', () => {
  it('is ready at once, with nothing to report', () => {
    expect(decideManifest(input(refresh, allLanded(refresh)))).toEqual({
      action: 'ready',
      detail: null,
    });
  });

  it('extra rows in the range do not matter (an upsert is idempotent)', () => {
    const counts = allLanded(refresh);
    counts.M5 = {
      ...counts.M5!,
      bars: counts.M5!.bars + 3,
      statistics: counts.M5!.statistics + 1,
    };
    expect(decideManifest(input(refresh, counts)).action).toBe('ready');
  });

  it('is ready on an M5-only slot without looking for M15', () => {
    expect(
      decideManifest(input(plain, { M5: allLanded(plain).M5 })).action
    ).toBe('ready');
  });

  it('a quarantined row is not waited for', () => {
    const counts = allLanded(closed); // 287 + 96
    expect(counts.M5!.bars).toBe(287);
    expect(decideManifest(input(closed, counts)).action).toBe('ready');
  });
});

describe('the bars have not all landed', () => {
  const missingOne = (manifest: CycleManifest, tf: Timeframe) => {
    const counts = allLanded(manifest);
    counts[tf] = { ...counts[tf]!, bars: counts[tf]!.bars - 1 };
    return counts;
  };

  it('waits, and says what is missing, while it is early', () => {
    const d = decideManifest(input(refresh, missingOne(refresh, 'M5'), 10));
    expect(d.action).toBe('wait');
    expect(d.detail).toMatchObject({
      reason: 'LANDED_ROWS_MISSING',
      timeframes: { M5: { bars: { expected: 289, landed: 288 } } },
    });
  });

  it('waits for M15 as well as M5', () => {
    expect(
      decideManifest(input(refresh, missingOne(refresh, 'M15'), 10)).action
    ).toBe('wait');
  });

  it('gives up at exactly the limit, not a second before', () => {
    const limit = MANIFEST_THRESHOLDS.landedGiveUpAfterSec;
    expect(
      decideManifest(input(refresh, missingOne(refresh, 'M5'), limit - 1))
        .action
    ).toBe('wait');
    const d = decideManifest(input(refresh, missingOne(refresh, 'M5'), limit));
    expect(d).toMatchObject({
      action: 'incomplete',
      reason: 'LANDED_ROWS_MISSING',
    });
  });

  it('nothing landed at all is the same decision, not a special case', () => {
    expect(decideManifest(input(plain, {}, 10)).action).toBe('wait');
    expect(decideManifest(input(plain, {}, 500)).action).toBe('incomplete');
  });

  it("the detail carries both timeframes' counts, bars and statistics", () => {
    const d = decideManifest(input(refresh, missingOne(refresh, 'M5'), 500));
    expect(d.detail!.timeframes).toEqual({
      M5: {
        bars: { expected: 289, landed: 288 },
        statistics: { expected: 3, landed: 3 },
        newest: {
          minCycleId: refresh.timeframes.M5.collection_cycle_id,
          cycleId: refresh.timeframes.M5.collection_cycle_id,
        },
      },
      M15: {
        bars: { expected: 97, landed: 97 },
        statistics: { expected: 3, landed: 3 },
        newest: {
          minCycleId: refresh.timeframes.M15!.collection_cycle_id,
          cycleId: refresh.timeframes.M15!.collection_cycle_id,
        },
      },
    });
  });
});

describe('the bars landed and the statistics have not', () => {
  const noStatistics = (manifest: CycleManifest) => {
    const counts = allLanded(manifest);
    for (const tf of listTimeframes(manifest)) {
      counts[tf] = { ...counts[tf]!, statistics: 0 };
    }
    return counts;
  };

  it('waits for them for a short grace', () => {
    const d = decideManifest(input(plain, noStatistics(plain), 5));
    expect(d.action).toBe('wait');
    expect(d.detail).toMatchObject({ reason: 'STATISTICS_SHORTFALL' });
  });

  it('then goes ahead WITHOUT them and says so, at exactly the grace limit', () => {
    const grace = MANIFEST_THRESHOLDS.statisticsGraceSec;
    expect(
      decideManifest(input(plain, noStatistics(plain), grace - 1)).action
    ).toBe('wait');
    const d = decideManifest(input(plain, noStatistics(plain), grace));
    expect(d.action).toBe('ready');
    expect(d.detail).toMatchObject({
      reason: 'STATISTICS_SHORTFALL',
      timeframes: { M5: { statistics: { expected: 3, landed: 0 } } },
    });
  });

  it('a statistics shortfall in only one timeframe still counts', () => {
    const counts = allLanded(refresh);
    counts.M15 = { ...counts.M15!, statistics: 2 };
    expect(decideManifest(input(refresh, counts, 1)).action).toBe('wait');
    expect(decideManifest(input(refresh, counts, 60)).action).toBe('ready');
  });

  it('a manifest that declared no statistics expects none', () => {
    const none: CycleManifest = {
      ...plain,
      timeframes: { M5: { ...plain.timeframes.M5, statistics_count: 0 } },
    };
    expect(
      decideManifest(
        input(none, {
          M5: {
            bars: 289,
            statistics: 0,
            newestCycleId: none.timeframes.M5.collection_cycle_id,
          },
        })
      ).action
    ).toBe('ready');
  });

  it('missing bars outrank missing statistics', () => {
    const counts = noStatistics(plain);
    counts.M5 = { bars: 0, statistics: 0, newestCycleId: null };
    expect(decideManifest(input(plain, counts, 60)).action).toBe('wait');
    expect(decideManifest(input(plain, counts, 130)).action).toBe('incomplete');
  });
});

describe('a stale manifest', () => {
  it('is incomplete without looking at the data, even if everything landed', () => {
    const limit = MANIFEST_THRESHOLDS.staleManifestAfterSec;
    expect(
      decideManifest(input(refresh, allLanded(refresh), 10, limit)).action
    ).toBe('ready');
    const d = decideManifest(input(refresh, allLanded(refresh), 10, limit + 1));
    expect(d).toMatchObject({ action: 'incomplete', reason: 'STALE_MANIFEST' });
  });

  it('needs no counts at all', () => {
    expect(
      decideManifest(
        input(refresh, {}, 10, MANIFEST_THRESHOLDS.staleManifestAfterSec + 1)
      ).detail
    ).toMatchObject({ reason: 'STALE_MANIFEST', slotAgeSec: 3601 });
  });
});

describe("the newest row is an older cycle's copy, not this cycle's", () => {
  // Consecutive slots overlap by almost the whole window, so every row can be
  // COUNTED while this cycle's upsert of the newest row (the one that changes
  // every cycle) has failed and is waiting to be retried.
  const m5Id = refresh.timeframes.M5.collection_cycle_id;
  const m15Id = refresh.timeframes.M15!.collection_cycle_id;
  const withNewest = (
    manifest: CycleManifest,
    tf: Timeframe,
    newestCycleId: number | null
  ) => {
    const counts = allLanded(manifest);
    counts[tf] = { ...counts[tf]!, newestCycleId };
    return counts;
  };

  it('is waited for even though every row is counted', () => {
    const d = decideManifest(
      input(refresh, withNewest(refresh, 'M5', m5Id - 1), 10)
    );
    expect(d.action).toBe('wait');
    expect(d.detail).toMatchObject({
      reason: 'NEWEST_ROW_NOT_CURRENT',
      timeframes: { M5: { newest: { minCycleId: m5Id, cycleId: m5Id - 1 } } },
    });
  });

  it('no newest row at all is the same decision', () => {
    const d = decideManifest(
      input(refresh, withNewest(refresh, 'M5', null), 10)
    );
    expect(d.action).toBe('wait');
    expect(d.detail).toMatchObject({
      reason: 'NEWEST_ROW_NOT_CURRENT',
      timeframes: { M5: { newest: { minCycleId: m5Id, cycleId: null } } },
    });
  });

  it("this cycle's id is current, and so is any later cycle's (a retune re-pushes the window)", () => {
    expect(
      decideManifest(input(refresh, withNewest(refresh, 'M5', m5Id))).action
    ).toBe('ready');
    expect(
      decideManifest(input(refresh, withNewest(refresh, 'M5', m5Id + 7))).action
    ).toBe('ready');
  });

  it('gives up at exactly the limit, saying the newest row is the problem', () => {
    const limit = MANIFEST_THRESHOLDS.landedGiveUpAfterSec;
    const stale = withNewest(refresh, 'M5', m5Id - 1);
    expect(decideManifest(input(refresh, stale, limit - 1)).action).toBe(
      'wait'
    );
    expect(decideManifest(input(refresh, stale, limit))).toMatchObject({
      action: 'incomplete',
      reason: 'NEWEST_ROW_NOT_CURRENT',
    });
  });

  it('checks every timeframe: a stale M15 newest row holds a refresh slot', () => {
    const d = decideManifest(
      input(refresh, withNewest(refresh, 'M15', m15Id - 1), 10)
    );
    expect(d.action).toBe('wait');
    expect(d.detail).toMatchObject({
      timeframes: { M15: { newest: { cycleId: m15Id - 1 } } },
    });
  });

  it('each timeframe is held to its OWN collection cycle id', () => {
    // M5 and M15 are collected by different cycles with different ids
    expect(m5Id).not.toBe(m15Id);
    const counts = allLanded(refresh);
    counts.M5 = { ...counts.M5!, newestCycleId: m15Id };
    counts.M15 = { ...counts.M15!, newestCycleId: m5Id };
    const holds = m5Id > m15Id ? 'M5' : 'M15';
    const d = decideManifest(input(refresh, counts, 10));
    expect(d.action).toBe('wait');
    expect(d.detail!.timeframes[holds]!.newest.minCycleId).toBeGreaterThan(
      d.detail!.timeframes[holds]!.newest.cycleId!
    );
  });

  it('missing bars outrank it: the reason names the rows, not the newest row', () => {
    const counts = withNewest(refresh, 'M5', m5Id - 1);
    counts.M5 = { ...counts.M5!, bars: counts.M5!.bars - 1 };
    expect(decideManifest(input(refresh, counts, 10)).detail).toMatchObject({
      reason: 'LANDED_ROWS_MISSING',
    });
    expect(decideManifest(input(refresh, counts, 500))).toMatchObject({
      action: 'incomplete',
      reason: 'LANDED_ROWS_MISSING',
    });
  });

  it('the statistics grace does not start the clock: the rows are the limit, and they get the longer wait', () => {
    const counts = withNewest(
      plain,
      'M5',
      plain.timeframes.M5.collection_cycle_id - 1
    );
    counts.M5 = { ...counts.M5!, statistics: 0 };
    // past the 30 s statistics grace, still inside the 120 s rows limit: keep waiting, do not go READY
    expect(decideManifest(input(plain, counts, 60)).action).toBe('wait');
    expect(decideManifest(input(plain, counts, 130)).action).toBe('incomplete');
  });

  it('a stale manifest records what it wanted without looking at the data', () => {
    const d = decideManifest(
      input(refresh, {}, 10, MANIFEST_THRESHOLDS.staleManifestAfterSec + 1)
    );
    expect(d.detail!.timeframes.M5!.newest).toEqual({
      minCycleId: m5Id,
      cycleId: null,
    });
  });
});

describe('thresholds are an argument, not a constant buried in the logic', () => {
  it('uses the ones it is given', () => {
    const tight = { ...MANIFEST_THRESHOLDS, landedGiveUpAfterSec: 10 };
    const counts = allLanded(plain);
    counts.M5 = { ...counts.M5!, bars: 0 };
    expect(decideManifest(input(plain, counts, 9), tight).action).toBe('wait');
    expect(decideManifest(input(plain, counts, 10), tight).action).toBe(
      'incomplete'
    );
  });
});
