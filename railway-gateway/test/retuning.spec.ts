import * as fs from 'fs';
import * as path from 'path';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import { manifestTuning } from '../src/cycle/manifest-row';
import {
  PreviousCycle,
  PROMOTE_EVENT,
  RETUNE_COMPLETE_EVENT,
  RETUNE_WINDOW_M5_BARS,
  WindowCount,
  continuesRetuning,
  detectPromote,
  preTuningBarsWhere,
  promoteDedupeKey,
  promoteEvent,
  retuneCompleteDedupeKey,
  retuneCompleteEvent,
  retuneStep,
  retuneWindowStart,
  retuningOnceVerified,
} from '../src/cycle/retuning';

/**
 * The promote and RETUNING rules (ADR-015, STACK-D-ARCHITECTURE.md 1.6), as pure
 * functions. test/promote-retuning.spec.ts runs the same rules through the
 * service and a whole promote; this file pins each boundary on its own, so a
 * failure there says which rule broke.
 */

function fixture(name: string): CycleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  );
}

const plain = fixture('cycle-manifest-plain-slot.json'); // M5 only: best_fit_a, non_b, sr_levels
const refresh = fixture('cycle-manifest-refresh-slot.json'); // M5 and M15

const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

/** What the manifest said, as the earlier cycle's row would hold it. */
function previousOf(
  manifest: CycleManifest,
  overrides: Partial<PreviousCycle> = {}
): PreviousCycle {
  const tuning = manifestTuning(manifest);
  return {
    slot: manifest.slot - 300,
    terminal_id: tuning.terminal_id,
    config_hashes: tuning.config_hashes,
    source_modes: tuning.source_modes,
    retuning: false,
    ...overrides,
  };
}

/** A copy of the manifest with one M5 source's hash (or mode) changed. */
function withM5(
  manifest: CycleManifest,
  edit: (m5: CycleManifest['timeframes']['M5']) => void
): CycleManifest {
  const copy: CycleManifest = JSON.parse(JSON.stringify(manifest));
  edit(copy.timeframes.M5);
  return copy;
}

/** Does the stored row say anything about M15? */
function carriesM15(cycle: PreviousCycle): boolean {
  const hashes = cycle.config_hashes as Record<string, unknown>;
  return typeof hashes === 'object' && hashes !== null && 'M15' in hashes;
}

describe('the keys of the two events', () => {
  it('are symbol, event type and slot, exactly as the order names them', () => {
    expect(promoteDedupeKey('XAUUSD', 1789764900)).toBe(
      'XAUUSD_PROMOTE_1789764900'
    );
    expect(retuneCompleteDedupeKey('XAUUSD', 1789764900)).toBe(
      'XAUUSD_RETUNE_COMPLETE_1789764900'
    );
    expect(PROMOTE_EVENT).toBe('PROMOTE');
    expect(RETUNE_COMPLETE_EVENT).toBe('RETUNE_COMPLETE');
  });
});

describe('detectPromote (rule 1)', () => {
  it('finds nothing to compare with on the first cycle', () => {
    expect(detectPromote(plain, null)).toBeNull();
  });

  it('finds no change when the terminal, every hash and every mode are the same', () => {
    expect(detectPromote(plain, previousOf(plain))).toBeNull();
    expect(detectPromote(refresh, previousOf(refresh))).toBeNull();
  });

  it('notices a different terminal, and says from what to what', () => {
    const previous = previousOf(plain, { terminal_id: 'MT5-B' });
    expect(detectPromote(plain, previous)).toStrictEqual({
      terminal: { previous: 'MT5-B', current: plain.mt5_terminal },
      config_hashes: {},
      source_modes: {},
    });
  });

  it('notices one source whose config_hash differs, and names only that source', () => {
    const changed = withM5(plain, (m5) => {
      m5.config_hashes['non_b'] = HASH_B;
    });
    expect(detectPromote(changed, previousOf(plain))).toStrictEqual({
      terminal: null,
      config_hashes: { M5: ['non_b'] },
      source_modes: {},
    });
  });

  it('lists several changed sources in a stable, sorted order', () => {
    // the manifest lists its sources in the REVERSE of alphabetical order, so only
    // an explicit sort produces the order the event promises
    const changed = withM5(plain, (m5) => {
      m5.config_hashes = {
        sr_levels: HASH_C,
        non_b: plain.timeframes.M5.config_hashes['non_b'],
        best_fit_a: HASH_B,
      };
    });
    expect(Object.keys(changed.timeframes.M5.config_hashes)).toEqual([
      'sr_levels',
      'non_b',
      'best_fit_a',
    ]);
    expect(
      detectPromote(changed, previousOf(plain))?.config_hashes
    ).toStrictEqual({
      M5: ['best_fit_a', 'sr_levels'],
    });
    const modeChanged = withM5(plain, (m5) => {
      m5.source_modes = { non_b: 'DYNAMIC', best_fit_a: 'FROZEN' };
    });
    expect(
      detectPromote(modeChanged, previousOf(plain))?.source_modes
    ).toStrictEqual({ M5: ['best_fit_a', 'non_b'] });
  });

  it('notices a projection mode that differs (a frozen line approved or released)', () => {
    const changed = withM5(plain, (m5) => {
      m5.source_modes['best_fit_a'] = 'FROZEN';
    });
    expect(plain.timeframes.M5.source_modes['best_fit_a']).toBe('DYNAMIC');
    expect(detectPromote(changed, previousOf(plain))).toStrictEqual({
      terminal: null,
      config_hashes: {},
      source_modes: { M5: ['best_fit_a'] },
    });
  });

  it('reports a terminal change and a hash change together', () => {
    const changed = withM5(plain, (m5) => {
      m5.config_hashes['non_b'] = HASH_B;
    });
    const previous = previousOf(plain, { terminal_id: 'MT5-B' });
    const change = detectPromote(changed, previous);
    expect(change?.terminal).not.toBeNull();
    expect(change?.config_hashes).toStrictEqual({ M5: ['non_b'] });
  });

  describe('compares only what both sides state', () => {
    it('a source that is new in the manifest is not a change', () => {
      const withNew = withM5(plain, (m5) => {
        m5.config_hashes['sr2_levels'] = HASH_B;
      });
      expect(detectPromote(withNew, previousOf(plain))).toBeNull();
    });

    it('a source missing from the manifest (its statistic did not arrive) is not a change', () => {
      const without = withM5(plain, (m5) => {
        delete m5.config_hashes['non_b'];
        delete m5.source_modes['non_b'];
      });
      expect(detectPromote(without, previousOf(plain))).toBeNull();
    });

    it('a previous cycle with an unreadable column compares nothing for it', () => {
      for (const garbage of [null, 'x', 7, [], [{ M5: {} }]]) {
        const previous = previousOf(plain, {
          config_hashes: garbage,
          source_modes: garbage,
        });
        const changed = withM5(plain, (m5) => {
          m5.config_hashes['non_b'] = HASH_B;
        });
        expect(detectPromote(changed, previous)).toBeNull();
      }
    });

    it('a previous cycle with no recorded terminal compares no terminal', () => {
      const previous = previousOf(plain, { terminal_id: null });
      expect(detectPromote(plain, previous)).toBeNull();
    });
  });

  describe('M5 and M15', () => {
    const m15Changed: CycleManifest = JSON.parse(JSON.stringify(refresh));
    m15Changed.timeframes.M15!.config_hashes['non_b'] = HASH_B;

    it('M15 is compared when the previous cycle carried it too', () => {
      expect(
        detectPromote(
          m15Changed,
          previousOf(refresh, { slot: refresh.slot - 300 })
        )
      ).toStrictEqual({
        terminal: null,
        config_hashes: { M15: ['non_b'] },
        source_modes: {},
      });
    });

    it('an M15 hash that shows up on a refresh slot, after an M5-only slot, is NOT a second promote', () => {
      // The realistic case: a promote at the plain slot before already retuned
      // everything, M5 is unchanged since, and M15 appears for the first time.
      // The previous cycle is M5-only, so there is nothing to compare M15 with.
      const m5Only = previousOf(plain, {
        slot: refresh.slot - 300,
        config_hashes: { M5: manifestTuning(refresh).config_hashes['M5'] },
        source_modes: { M5: manifestTuning(refresh).source_modes['M5'] },
      });
      expect(carriesM15(m5Only)).toBe(false);
      expect(detectPromote(m15Changed, m5Only)).toBeNull();
    });

    it('M5 is still compared on a refresh slot', () => {
      const m5Changed = withM5(refresh, (m5) => {
        m5.config_hashes['non_b'] = HASH_B;
      });
      expect(
        detectPromote(
          m5Changed,
          previousOf(refresh, { slot: refresh.slot - 300 })
        )
      ).toStrictEqual({
        terminal: null,
        config_hashes: { M5: ['non_b'] },
        source_modes: {},
      });
    });

    it('a manifest without M15 compares no M15, whatever the previous cycle holds', () => {
      expect(detectPromote(plain, previousOf(refresh))).toBeNull();
    });
  });
});

/** What the gateway counted: `oldRows` pre-promote M5 rows left in the window. */
function counted(
  oldRows: number,
  over: Partial<WindowCount> = {}
): WindowCount {
  return {
    promoteSlot: plain.slot - 900,
    promoteCycleId: 40,
    oldRows,
    ...over,
  };
}

describe('retuneStep (rules 1 to 4)', () => {
  const calm = {
    promote: null,
    retuning: false,
    completesWhenVerified: false,
  };

  it('is calm on the first cycle', () => {
    expect(retuneStep(plain, null)).toEqual(calm);
  });

  it('is calm when nothing changed and the previous cycle was not RETUNING', () => {
    expect(retuneStep(plain, previousOf(plain))).toEqual(calm);
  });

  it('a promote starts RETUNING, and does not complete anything', () => {
    const previous = previousOf(plain, { terminal_id: 'MT5-B' });
    const step = retuneStep(plain, previous);
    expect(step.promote).not.toBeNull();
    expect(step.retuning).toBe(true);
    expect(step.completesWhenVerified).toBe(false);
  });

  it('a promote wins over a RETUNING that was about to end, even with a window count of 0', () => {
    const previous = previousOf(plain, {
      terminal_id: 'MT5-B',
      retuning: true,
    });
    const step = retuneStep(plain, previous, counted(0));
    expect(step.promote).not.toBeNull();
    expect(step.retuning).toBe(true);
    expect(step.completesWhenVerified).toBe(false);
  });

  describe('a RETUNING cycle with no new change (Option A: the gateway counts the window)', () => {
    const step = (window: WindowCount | null) =>
      retuneStep(plain, previousOf(plain, { retuning: true }), window);

    it('continues while the window still holds pre-promote rows', () => {
      for (const oldRows of [1, 6, 2711]) {
        expect(step(counted(oldRows))).toEqual({
          promote: null,
          retuning: true,
          completesWhenVerified: false,
        });
      }
    });

    it('is the cycle that ends it once the window holds none', () => {
      expect(step(counted(0))).toEqual({
        promote: null,
        retuning: true,
        completesWhenVerified: true,
      });
    });

    it('never reads "not counted" as 0', () => {
      expect(step(null)).toEqual({
        promote: null,
        retuning: true,
        completesWhenVerified: false,
      });
      // and the default, when no count is passed at all
      expect(retuneStep(plain, previousOf(plain, { retuning: true }))).toEqual({
        promote: null,
        retuning: true,
        completesWhenVerified: false,
      });
    });
  });

  it('a window count of 0 on a cycle whose predecessor was not RETUNING starts nothing', () => {
    expect(
      retuneStep(plain, previousOf(plain, { retuning: false }), counted(0))
    ).toEqual(calm);
  });

  it('a count is not consulted when there is no previous cycle', () => {
    expect(retuneStep(plain, null, counted(0))).toEqual(calm);
  });
});

describe('continuesRetuning', () => {
  const step = (retuning: boolean, promote: boolean) => ({
    promote: promote
      ? { terminal: null, config_hashes: {}, source_modes: {} }
      : null,
    retuning,
    completesWhenVerified: false,
  });
  it('is true only for a RETUNING that is not itself a promote: the one case that needs the count', () => {
    expect(continuesRetuning(step(false, false))).toBe(false);
    expect(continuesRetuning(step(true, true))).toBe(false);
    expect(continuesRetuning(step(true, false))).toBe(true);
  });
});

describe('the window that is counted (Option A)', () => {
  const SLOT = 1789764900;

  it('is the collector 3,000 bars: 3000 times 300 seconds back from the slot', () => {
    expect(RETUNE_WINDOW_M5_BARS).toBe(3000);
    expect(retuneWindowStart(SLOT)).toBe(SLOT - 900000);
    expect(retuneWindowStart(SLOT + 300)).toBe(SLOT + 300 - 900000);
  });

  it('is exactly the query the order names: M5, from slot - 3000 * 300 to the slot, below the promote cycle', () => {
    expect(preTuningBarsWhere('XAUUSD', SLOT, 77)).toStrictEqual({
      symbol: 'XAUUSD',
      timeframe: 'M5',
      timestamp: { gte: SLOT - 3000 * 300, lte: SLOT },
      cycle_id: { lt: 77 },
    });
  });

  it('takes the symbol, slot and cycle id it is given', () => {
    const where = preTuningBarsWhere('EURUSD', SLOT + 600, 5);
    expect(where.symbol).toBe('EURUSD');
    expect(where.timestamp).toEqual({
      gte: SLOT + 600 - 900000,
      lte: SLOT + 600,
    });
    expect(where.cycle_id).toEqual({ lt: 5 });
  });
});

describe('retuningOnceVerified', () => {
  const step = (retuning: boolean, completesWhenVerified: boolean) => ({
    promote: null,
    retuning,
    completesWhenVerified,
  });
  it('is the flag a verified cycle carries: RETUNING unless this cycle ends it', () => {
    expect(retuningOnceVerified(step(false, false))).toBe(false);
    expect(retuningOnceVerified(step(true, false))).toBe(true);
    expect(retuningOnceVerified(step(true, true))).toBe(false);
  });
});

describe('the events', () => {
  const changed = withM5(plain, (m5) => {
    m5.config_hashes['non_b'] = HASH_B;
  });
  const previous = previousOf(plain, {
    slot: plain.slot - 300,
    terminal_id: 'MT5-B',
  });

  it('PROMOTE carries the slot, the terminal, the hashes and the modes of the manifest', () => {
    const change = detectPromote(changed, previous)!;
    const event = promoteEvent(changed, change, previous);
    expect(event).toMatchObject({
      symbol: 'XAUUSD',
      event_type: 'PROMOTE',
      effective_slot: changed.slot,
      dedupe_key: `XAUUSD_PROMOTE_${changed.slot}`,
      terminal_id: changed.mt5_terminal,
    });
    expect(event.config_hashes).toStrictEqual({
      M5: changed.timeframes.M5.config_hashes,
    });
    expect(event.source_modes).toStrictEqual({
      M5: changed.timeframes.M5.source_modes,
    });
  });

  it('PROMOTE says what it was before and what it is now', () => {
    const change = detectPromote(changed, previous)!;
    const { detail } = promoteEvent(changed, change, previous);
    expect(detail).toStrictEqual({
      previous: {
        slot: plain.slot - 300,
        terminal_id: 'MT5-B',
        config_hashes: { M5: plain.timeframes.M5.config_hashes },
        source_modes: { M5: plain.timeframes.M5.source_modes },
      },
      new: {
        slot: changed.slot,
        terminal_id: changed.mt5_terminal,
        config_hashes: { M5: changed.timeframes.M5.config_hashes },
        source_modes: { M5: changed.timeframes.M5.source_modes },
      },
      changed: {
        terminal: { previous: 'MT5-B', current: changed.mt5_terminal },
        config_hashes: { M5: ['non_b'] },
        source_modes: {},
      },
    });
  });

  it('PROMOTE reports what the previous cycle said only for the timeframes the manifest carries', () => {
    // the previous cycle was a refresh slot (M5 and M15); this manifest is M5 only
    const before = previousOf(refresh, { slot: plain.slot - 300 });
    expect(Object.keys(before.config_hashes as object)).toEqual(['M5', 'M15']);
    const { detail } = promoteEvent(
      changed,
      detectPromote(changed, before)!,
      before
    );
    const was = detail['previous'] as {
      config_hashes: object;
      source_modes: object;
    };
    expect(Object.keys(was.config_hashes)).toEqual(['M5']);
    expect(Object.keys(was.source_modes)).toEqual(['M5']);
  });

  it('PROMOTE is plain JSON (it goes into a JSON column)', () => {
    const change = detectPromote(changed, previous)!;
    const event = promoteEvent(changed, change, previous);
    expect(JSON.parse(JSON.stringify(event))).toStrictEqual(event);
  });

  it('RETUNE_COMPLETE carries the verified slot, the promote it ends and what was counted', () => {
    const event = retuneCompleteEvent(
      plain,
      counted(0, { promoteSlot: plain.slot - 1200, promoteCycleId: 33 })
    );
    expect(event).toMatchObject({
      symbol: 'XAUUSD',
      event_type: 'RETUNE_COMPLETE',
      effective_slot: plain.slot,
      dedupe_key: `XAUUSD_RETUNE_COMPLETE_${plain.slot}`,
      terminal_id: plain.mt5_terminal,
    });
    expect(event.detail).toStrictEqual({
      promote_slot: plain.slot - 1200,
      promote_m5_collection_cycle_id: 33,
      window_old_rows: 0,
      window_from: plain.slot - 900000,
      window_to: plain.slot,
      verified_at_slot: plain.slot,
    });
    expect(event.config_hashes).toStrictEqual({
      M5: plain.timeframes.M5.config_hashes,
    });
    expect(JSON.parse(JSON.stringify(event))).toStrictEqual(event);
  });
});
