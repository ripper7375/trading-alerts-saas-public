import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { buildCurrentCycleBody } from '../src/cycle/active-indicator/current-cycle';
import {
  CycleManifest,
  validateCycleManifest,
} from '../src/cycle/cycle-manifest.contract';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CycleManifestJobData,
  CycleManifestService,
  CycleReadyJobData,
} from '../src/worker/cycle-manifest.service';
import {
  BAR_SECONDS,
  FakeBar,
  FakePrisma,
  FakeQueue,
  landBars,
  landStatistics,
  landWindow,
  m5Window,
  repushBars,
} from './helpers/fake-cycle-store';
import { B, S, Tuning, manifestAt, plain } from './helpers/promote-world';

/**
 * Promote and RETUNING through the service (build step 2 parts 9 and 10, ADR-015,
 * STACK-D-ARCHITECTURE.md 1.6 and the last "Done when" item of 1.8: "a rehearsed
 * promote is visible: RETUNING, then FRESH; the event names its slot and config
 * hashes").
 *
 * The manifests are the real sender's, moved along the slot axis and retuned
 * (see manifestAt): same contract, same field shapes, so what the gateway does
 * here is what it does with a manifest from the VPS. The pure rules are pinned
 * one by one in retuning.spec.ts; this file is about the whole path:
 * detect, write the event, carry the flag, announce it, and survive repeats.
 *
 * OPTION A (part 10): RETUNING ends when the GATEWAY counts no pre-promote row
 * left in the 3,000-bar M5 window, not when the sender reports a count. So these
 * tests do what the collector and the push worker do: the first cycle writes the
 * whole window under its cycle id, and a promote's cycle rewrites only its
 * priority set (the newest 289 rows) at once; the older part follows, oldest
 * first, in the next cycles (see `Delivery.window`). Bars are named by their
 * distance j from the first slot's newest bar: bar j has open time
 * `S(0) + 300 * j`, and cycle k's priority set is j = k - 288 .. k.
 */

function world() {
  const prisma = new FakePrisma();
  const sync = new FakeQueue();
  const ready = new FakeQueue();
  const service = new CycleManifestService(
    prisma as unknown as PrismaService,
    sync as unknown as Queue,
    ready as unknown as Queue
  );
  const reader = new CycleReaderService(prisma as unknown as PrismaService);
  return { prisma, sync, ready, service, reader };
}
type World = ReturnType<typeof world>;

function job(
  manifest: CycleManifest,
  receivedAt: number,
  checks?: number
): Job<CycleManifestJobData> {
  return {
    name: 'cycle-manifest',
    id: `cycle_manifest_${manifest.symbol}_${manifest.slot}`,
    data: { manifest, receivedAt, ...(checks ? { checks } : {}) },
  } as unknown as Job<CycleManifestJobData>;
}

interface Delivery {
  /** Land the rows and statistics the manifest describes first (default). */
  land?: boolean;
  /** Seconds between the manifest arriving and the gateway looking at it. */
  after?: number;
  checks?: number;
  /**
   * What the push worker re-pushed this cycle besides the priority set, all under
   * this cycle's id: 'all' is everything the gateway's window count looks at (the
   * 3,000-bar window and the one bar below it; written outright when `land` is
   * on, otherwise only the rows already there), a number is that many of the
   * OLDEST bars of the window, which is the order the worker drains in.
   * Absent: the priority set only.
   */
  window?: 'all' | number;
  /** Runs after the rows are landed and before the gateway looks (plant a row, remove one). */
  before?: (w: World) => void;
}

function pushWindow(w: World, m: CycleManifest, d: Delivery): void {
  if (d.window === undefined) return;
  const cycleId = m.timeframes.M5.collection_cycle_id;
  const { first, last } = m5Window(m);
  if (d.window === 'all') {
    if (d.land === false) {
      repushBars(w.prisma, m.symbol, first - BAR_SECONDS.M5, last, cycleId);
    } else {
      landWindow(w.prisma, m);
    }
    return;
  }
  repushBars(
    w.prisma,
    m.symbol,
    first,
    first + (d.window - 1) * BAR_SECONDS.M5,
    cycleId
  );
}

/** The manifest reaches the gateway about a minute after its slot and is looked at a second later. */
async function deliver(w: World, m: CycleManifest, d: Delivery = {}) {
  if (d.land !== false) {
    landBars(w.prisma, m);
    landStatistics(w.prisma, m);
  }
  pushWindow(w, m, d);
  d.before?.(w);
  const receivedAt = m.slot + 62;
  return w.service.handle(
    job(m, receivedAt, d.checks),
    receivedAt + (d.after ?? 1)
  );
}

/** Not landed, looked at after the give-up time: the cycle is recorded INCOMPLETE. */
const incomplete = (w: World, m: CycleManifest, d: Delivery = {}) =>
  deliver(w, m, { ...d, land: false, after: 125 });

/** The first cycle: the collector's first full push puts the whole window under cycle 1. */
const baseline = (w: World, o: Tuning = {}) =>
  deliver(w, manifestAt(S(0), o), { window: 'all' });

const row = (w: World, slot: number) => w.prisma.cycle('XAUUSD', slot)!;
const retuningOf = (w: World, slot: number) => row(w, slot)['retuning'];
const readyPayloads = (w: World): CycleReadyJobData[] =>
  w.ready.named('cycle-ready').map((add) => add.data as CycleReadyJobData);
const events = (w: World) =>
  w.prisma.events.map((e) => [e.event_type, e.effective_slot]);

const logged = (method: 'log' | 'warn'): string[] =>
  (
    (Logger.prototype[method] as unknown as jest.Mock).mock.calls as unknown[][]
  ).map((call) => String(call[0]));

/** The count a READY cycle's log line reports, or null when it did not count. */
function leftInWindow(slot: number): number | null {
  const line = logged('log').find((l) =>
    l.startsWith(`Cycle XAUUSD ${slot} READY`)
  );
  const found = line?.match(/(\d+) pre-promote M5 bars left in the window/);
  return found ? Number(found[1]) : null;
}

/** The count queries the service made (the landed-row check also counts, without a cycle_id). */
const windowCounts = (w: World) =>
  w.prisma
    .queries('marketDataV6', 'count')
    .filter((q) => 'cycle_id' in q.args.where);

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('the manifests used here are what the sender could send', () => {
  it('every generated manifest satisfies the contract', () => {
    for (let k = 0; k < 8; k += 1) {
      for (const o of [
        {},
        B,
        { ...B, repush: 0 },
        { ...B, repush: 5997 },
        { modes: { best_fit_a: 'FROZEN', non_b: 'DYNAMIC' } as const },
      ] as Tuning[]) {
        const result = validateCycleManifest(manifestAt(S(k), o));
        expect(result).toEqual({ valid: true, manifest: expect.anything() });
      }
    }
    expect(Object.keys(manifestAt(S(1)).timeframes)).toEqual(['M5', 'M15']);
    expect(Object.keys(manifestAt(S(2)).timeframes)).toEqual(['M5']);
    expect('repush_rows_unsent' in manifestAt(S(0))).toBe(false);
    expect(manifestAt(S(0), { repush: 0 }).repush_rows_unsent).toBe(0);
  });
});

describe('a rehearsed promote (section 1.8, Option A)', () => {
  /**
   * `repush` is what the sender reports and is deliberately UNRELATED to the
   * window here (a 0 while rows are left, a large number once it is drained):
   * the gateway no longer reads it, and the sequence must not care.
   * `left` is the count the gateway makes at that cycle, worked out from the bars:
   *
   *   j = -2999 .. -288  cycle 1 (the first full push), 2712 bars
   *   j = -287           cycle 2, one bar (the priority set of k = 1 reaches j = -287)
   *   promote at k = 2 (cycle id 3): its priority set is j = -286 .. 2
   *   k = 3: the bound starts at j = -2997. Old: -2997 .. -288 and -287 = 2711; the
   *          worker re-pushes the oldest 1,000 of the window (j = -2996 .. -1997),
   *          which leaves 1,711 (j = -2997 is one bar below the window, never
   *          re-pushed, and still counted: the bound is one bar wider)
   *   k = 4: the bound starts at j = -2996; the oldest 2,000 (j = -2995 .. -996)
   *          are now re-pushed; old: j = -995 .. -287 = 709
   *   k = 5: the whole window is re-pushed: 0
   */
  const plan: Array<{
    k: number;
    o: Tuning;
    window?: 'all' | number;
    retuning: boolean;
    left: number | null;
    note: string;
  }> = [
    {
      k: 0,
      o: { repush: 0 },
      window: 'all',
      retuning: false,
      left: null,
      note: 'baseline: the whole window under cycle 1',
    },
    {
      k: 1,
      o: { repush: 0 },
      retuning: false,
      left: null,
      note: 'baseline, M15 refresh',
    },
    {
      k: 2,
      o: { ...B, repush: 5600 },
      retuning: true,
      left: null,
      note: 'the promote: new terminal and tuning, only the priority set is new',
    },
    {
      k: 3,
      o: { ...B, repush: 0 },
      window: 1000,
      retuning: true,
      left: 1711,
      note: 're-push: the sender says 0, the window still holds old rows',
    },
    {
      k: 4,
      o: { ...B, repush: 600 },
      window: 2000,
      retuning: true,
      left: 709,
      note: 're-push, M15 refresh with the new tuning',
    },
    {
      k: 5,
      o: { ...B, repush: 4000 },
      window: 'all',
      retuning: false,
      left: 0,
      note: 'the first verified manifest with nothing left to re-push ends it',
    },
    {
      k: 6,
      o: { ...B, repush: 0 },
      retuning: false,
      left: null,
      note: 'steady',
    },
    {
      k: 7,
      o: { ...B, repush: 0 },
      retuning: false,
      left: null,
      note: 'steady',
    },
  ];

  const run = (w: World, step: (typeof plan)[number]) =>
    deliver(w, manifestAt(S(step.k), step.o), { window: step.window });

  it('goes RETUNING at the promote and FRESH again at the first verified manifest after the window is re-pushed', async () => {
    const w = world();
    for (const step of plan) {
      expect(await run(w, step)).toEqual({ outcome: 'ready' });

      const stored = row(w, S(step.k));
      expect([step.note, stored['retuning']]).toEqual([
        step.note,
        step.retuning,
      ]);
      expect([step.note, stored['state']]).toEqual([step.note, 'READY']);
      // RETUNING is not a freshness state: the cycle's own status is untouched.
      expect(stored['data_status']).toBe('FRESH');
      // the sender's count is stored as sent, whatever the gateway made of the window
      expect(stored['repush_rows_unsent']).toBe(step.o.repush ?? null);
      // the count is made only while a RETUNING carries on from the cycle before
      expect([step.note, leftInWindow(S(step.k))]).toEqual([
        step.note,
        step.left,
      ]);
    }

    // what the ready queue announced, cycle by cycle
    expect(readyPayloads(w).map((p) => [p.slot, p.retuning])).toEqual(
      plan.map((step) => [S(step.k), step.retuning])
    );
    expect(w.ready.named('cycle-ready').map((a) => a.opts.jobId)).toEqual(
      plan.map((step) => `XAUUSD_${S(step.k)}`)
    );
  });

  it('writes exactly two events: the PROMOTE at the promote slot and the RETUNE_COMPLETE at the verified one', async () => {
    const w = world();
    for (const step of plan) {
      await run(w, step);
      // the event appears at its slot and not before
      const expected = [
        ...(step.k >= 2 ? [['PROMOTE', S(2)]] : []),
        ...(step.k >= 5 ? [['RETUNE_COMPLETE', S(5)]] : []),
      ];
      expect([step.note, events(w)]).toEqual([step.note, expected]);
    }
    const [promote, complete] = w.prisma.events;
    expect(promote.dedupe_key).toBe(`XAUUSD_PROMOTE_${S(2)}`);
    expect(complete.dedupe_key).toBe(`XAUUSD_RETUNE_COMPLETE_${S(5)}`);
  });

  it('the RETUNE_COMPLETE event names the promote it ends and what the gateway counted', async () => {
    const w = world();
    for (const step of plan) await run(w, step);
    const complete = w.prisma.events[1];
    expect(complete).toMatchObject({
      event_type: 'RETUNE_COMPLETE',
      effective_slot: S(5),
      terminal_id: 'MT5-B',
    });
    expect(complete.detail).toStrictEqual({
      promote_slot: S(2),
      // the promote's own cycle: S(2) is the third slot, collection cycle id 3
      promote_m5_collection_cycle_id: 3,
      window_old_rows: 0,
      window_from: S(5) - 900000,
      window_to: S(5),
      verified_at_slot: S(5),
    });
  });

  it('the PROMOTE event names the slot, the terminal, the hashes and the modes, and what they were before', async () => {
    const w = world();
    for (const step of plan.slice(0, 3)) await run(w, step);
    const promoted = manifestAt(S(2), { ...B, repush: 5600 });
    const before = manifestAt(S(1), { repush: 0 });
    const [event] = w.prisma.events;

    expect(event).toMatchObject({
      symbol: 'XAUUSD',
      event_type: 'PROMOTE',
      effective_slot: S(2),
      dedupe_key: `XAUUSD_PROMOTE_${S(2)}`,
      terminal_id: 'MT5-B',
    });
    expect(event.config_hashes).toStrictEqual({
      M5: promoted.timeframes.M5.config_hashes,
    });
    expect(event.source_modes).toStrictEqual({
      M5: promoted.timeframes.M5.source_modes,
    });
    // every M5 hash is new
    expect(event.detail).toMatchObject({
      previous: {
        slot: S(1),
        terminal_id: 'MT5-A',
        config_hashes: { M5: before.timeframes.M5.config_hashes },
      },
      new: { slot: S(2), terminal_id: 'MT5-B' },
      changed: {
        terminal: { previous: 'MT5-A', current: 'MT5-B' },
        config_hashes: { M5: ['best_fit_a', 'non_b', 'sr_levels'] },
      },
    });
    // the slot is a real slot
    expect(event.effective_slot % 300).toBe(0);
  });

  it('the M15 hashes that first appear on the next refresh slot are not a second promote', async () => {
    // k = 4 is the first refresh slot after the promote and carries the NEW M15
    // tuning, while the last M15 on record (k = 1) has the old one.
    const w = world();
    for (const step of plan.slice(0, 5)) await run(w, step);
    expect(S(4) % 900).toBe(0);
    expect(row(w, S(4))['m15_collection_cycle_id']).not.toBeNull();
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(retuningOf(w, S(4))).toBe(true);
  });

  it('the stamp exposes retuning to the readers: ReaderCycle and the current-cycle body', async () => {
    const w = world();
    for (const step of plan.slice(0, 3)) await run(w, step);
    const newest = await w.reader.getNewestReadyCycle();
    expect(newest).toMatchObject({ slot: S(2), retuning: true });
    expect(await w.reader.getReadyCycle(S(1))).toMatchObject({
      retuning: false,
    });
    const body = buildCurrentCycleBody({
      now: S(2) + 70,
      cycle: newest,
      indicators: { M5: null, M15: null },
    });
    expect(body.cycle?.retuning).toBe(true);
    expect(body.cycle?.status).toBe('FRESH');

    for (const step of plan.slice(3)) await run(w, step);
    const after = await w.reader.getNewestReadyCycle();
    expect(after).toMatchObject({ slot: S(7), retuning: false });
    expect(await w.reader.getReadyCycle(S(4))).toMatchObject({
      retuning: true,
    });
    expect(await w.reader.getReadyCycle(S(5))).toMatchObject({
      retuning: false,
    });
    expect(
      buildCurrentCycleBody({
        now: S(7) + 70,
        cycle: after,
        indicators: { M5: null, M15: null },
      }).cycle?.retuning
    ).toBe(false);
  });
});

describe('what counts as a promote', () => {
  const firstTwo = async (w: World, second: Tuning) => {
    await baseline(w);
    await deliver(w, manifestAt(S(2), second)); // S(2) is an M5-only slot
  };

  it('the first cycle ever has nothing to differ from', async () => {
    const w = world();
    await deliver(w, manifestAt(S(0), { ...B, repush: 0 }));
    expect(w.prisma.events).toEqual([]);
    expect(retuningOf(w, S(0))).toBe(false);
  });

  it('identical terminal, hashes and modes cycle after cycle are not a promote', async () => {
    const w = world();
    for (let k = 0; k < 6; k += 1) await deliver(w, manifestAt(S(k)));
    expect(w.prisma.events).toEqual([]);
    expect(readyPayloads(w).map((p) => p.retuning)).toEqual(
      Array(6).fill(false)
    );
  });

  it('a different terminal alone is a promote', async () => {
    const w = world();
    await firstTwo(w, { terminal: 'MT5-B' });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(w.prisma.events[0].detail).toMatchObject({
      changed: { terminal: { previous: 'MT5-A', current: 'MT5-B' } },
    });
    expect(retuningOf(w, S(2))).toBe(true);
  });

  it('a different config_hash alone is a promote', async () => {
    const w = world();
    await firstTwo(w, { tuning: 'b' });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(w.prisma.events[0].terminal_id).toBe('MT5-A');
    expect(retuningOf(w, S(2))).toBe(true);
  });

  it('a different projection mode alone is a promote', async () => {
    const w = world();
    await firstTwo(w, { modes: { best_fit_a: 'FROZEN', non_b: 'FROZEN' } });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(w.prisma.events[0].detail).toMatchObject({
      changed: { source_modes: { M5: ['best_fit_a'] } },
    });
  });

  it('a previous cycle whose stored tuning is unreadable still shows a terminal change, and nothing else', async () => {
    const w = world();
    await baseline(w);
    row(w, S(0))['config_hashes'] = null;
    row(w, S(0))['source_modes'] = 'not json';
    await deliver(w, manifestAt(S(2), { tuning: 'b' }));
    expect(w.prisma.events).toEqual([]);
    expect(retuningOf(w, S(2))).toBe(false);

    await deliver(w, manifestAt(S(3), { terminal: 'MT5-B', tuning: 'b' }));
    expect(events(w)).toEqual([['PROMOTE', S(3)]]);
  });
});

describe('the RETUNING state machine over time', () => {
  it('the sender count is not read: a 0 with old rows left keeps RETUNING, and a large count with none left ends it', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), { ...B, repush: 0 })); // the promote
    // the sender says 0 every cycle, the window is only partly re-pushed
    for (let k = 2; k <= 4; k += 1) {
      await deliver(w, manifestAt(S(k), { ...B, repush: 0 }), { window: 500 });
      expect([k, retuningOf(w, S(k))]).toEqual([k, true]);
    }
    expect(events(w)).toEqual([['PROMOTE', S(1)]]);
    // the sender now says 5997, the window is entirely re-pushed
    await deliver(w, manifestAt(S(5), { ...B, repush: 5997 }), {
      window: 'all',
    });
    expect(retuningOf(w, S(5))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(5)],
    ]);
  });

  it('a sender that omits the count changes nothing: Option A needs no help from the sender', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B)); // no count in the manifest
    expect(row(w, S(1))['repush_rows_unsent']).toBeNull();
    expect(retuningOf(w, S(1))).toBe(true);
    await deliver(w, manifestAt(S(2), B), { window: 'all' });
    expect(retuningOf(w, S(2))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
    ]);
  });

  it('a window that is never fully re-pushed keeps RETUNING on cycle after cycle, and each READY line says how many rows are left', async () => {
    // a worker too slow for the window re-sends the same oldest rows every slot
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), { ...B, repush: 0 }));
    const left: Array<number | null> = [];
    for (let k = 2; k <= 12; k += 1) {
      await deliver(w, manifestAt(S(k), { ...B, repush: 0 }), { window: 1000 });
      expect([k, retuningOf(w, S(k))]).toEqual([k, true]);
      left.push(leftInWindow(S(k)));
    }
    expect(left.every((n) => n !== null && n > 0)).toBe(true);
    expect(events(w)).toEqual([['PROMOTE', S(1)]]);
  });

  it('the verified manifest that ends it is judged by what is in the window at its own look', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), { ...B, repush: 80 }));
    await deliver(w, manifestAt(S(2), { ...B, repush: 0 }), { window: 'all' });
    expect(retuningOf(w, S(2))).toBe(false);
    expect(events(w).at(-1)).toEqual(['RETUNE_COMPLETE', S(2)]);
    // a later cycle that happens to report a large count is not RETUNING again
    await deliver(w, manifestAt(S(3), { ...B, repush: 400 }));
    expect(retuningOf(w, S(3))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
    ]);
  });

  it('a promote in the middle of RETUNING starts it over, and the window is then measured against the NEW promote', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B)); // promote to B (cycle id 2)
    await deliver(w, manifestAt(S(2), B), { window: 1000 }); // part of the window re-pushed
    expect(retuningOf(w, S(2))).toBe(true);
    // switched back to A before it ended (cycle id 4)
    await deliver(w, manifestAt(S(3)));
    expect(retuningOf(w, S(3))).toBe(true);
    // every row pushed under B is now older than the second promote's cycle, so a
    // cycle that re-pushes nothing finds them and carries on
    await deliver(w, manifestAt(S(4)));
    expect(retuningOf(w, S(4))).toBe(true);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['PROMOTE', S(3)],
    ]);
    await deliver(w, manifestAt(S(5)), { window: 'all' });
    expect(retuningOf(w, S(5))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['PROMOTE', S(3)],
      ['RETUNE_COMPLETE', S(5)],
    ]);
    expect(w.prisma.events.at(-1)!.detail).toMatchObject({
      promote_slot: S(3),
      promote_m5_collection_cycle_id: 4,
    });
  });

  it('a row that has just scrolled out of the window holds RETUNING for one more cycle, and no longer', async () => {
    // The gateway's window is one bar wider than the collector's. The oldest bar
    // of the promote cycle's window (j = -2997 for a promote at k = 2... here k = 1,
    // j = -2998) is not in the next cycle's window but is inside its bound; if it
    // was not re-pushed while it was still in a window it stays old until the bound
    // moves past it.
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B)); // promote at k = 1, cycle id 2
    // k = 2: the oldest 1,000 bars of ITS window are re-pushed, which starts at
    // j = -2997 and leaves j = -2998 (cycle 1) behind, inside the bound
    await deliver(w, manifestAt(S(2), B), { window: 1000 });
    expect(retuningOf(w, S(2))).toBe(true);
    // k = 3: everything the gateway looks at is re-pushed; j = -2998 is below the bound
    await deliver(w, manifestAt(S(3), B), { window: 'all' });
    expect(retuningOf(w, S(3))).toBe(false);
    // 1 slack bar + the middle of the window (j = -1997 .. -288) at k = 2
    expect(leftInWindow(S(2))).toBe(1 + 1710);
    expect(leftInWindow(S(3))).toBe(0);
  });

  it('a second RETUNING later is its own episode, with its own events', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B));
    await deliver(w, manifestAt(S(2), B), { window: 'all' });
    await deliver(w, manifestAt(S(3), B));
    await deliver(w, manifestAt(S(4))); // back to A
    await deliver(w, manifestAt(S(5)), { window: 'all' });
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
      ['PROMOTE', S(4)],
      ['RETUNE_COMPLETE', S(5)],
    ]);
    expect([1, 2, 3, 4, 5].map((k) => retuningOf(w, S(k)))).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
  });

  describe('only a VERIFIED manifest ends it', () => {
    it('a window found clean by a cycle that did not verify does not end it; the next verified one does', async () => {
      const w = world();
      await baseline(w);
      await deliver(w, manifestAt(S(1), B)); // the promote
      // S(2): every row already in the table is re-pushed, but its own rows have not
      // landed, so the landed-row check fails and the cycle is INCOMPLETE
      expect(
        await incomplete(w, manifestAt(S(2), B), { window: 'all' })
      ).toEqual({ outcome: 'incomplete' });
      expect(row(w, S(2))['state']).toBe('INCOMPLETE');
      expect(retuningOf(w, S(2))).toBe(true);
      expect(events(w)).toEqual([['PROMOTE', S(1)]]);

      await deliver(w, manifestAt(S(3), B), { window: 'all' });
      expect(retuningOf(w, S(3))).toBe(false);
      expect(events(w)).toEqual([
        ['PROMOTE', S(1)],
        ['RETUNE_COMPLETE', S(3)],
      ]);
      expect(readyPayloads(w).at(-1)).toMatchObject({
        slot: S(3),
        retuning: false,
      });
    });

    it('an INCOMPLETE cycle that still finds old rows keeps the flag too', async () => {
      const w = world();
      await baseline(w);
      await deliver(w, manifestAt(S(1), B));
      await incomplete(w, manifestAt(S(2), B));
      expect(retuningOf(w, S(2))).toBe(true);
      expect(events(w)).toEqual([['PROMOTE', S(1)]]);
    });

    it('a cycle that is INCOMPLETE and was not RETUNING does not become RETUNING', async () => {
      const w = world();
      await baseline(w);
      await incomplete(w, manifestAt(S(2)));
      expect(row(w, S(2))['state']).toBe('INCOMPLETE');
      expect(retuningOf(w, S(2))).toBe(false);
      await deliver(w, manifestAt(S(3)));
      expect(retuningOf(w, S(3))).toBe(false);
      expect(w.prisma.events).toEqual([]);
    });

    it('an INCOMPLETE promote cycle is still a promote, and is announced to nobody', async () => {
      const w = world();
      await baseline(w);
      await incomplete(w, manifestAt(S(2), { ...B, repush: 900 }));
      expect(events(w)).toEqual([['PROMOTE', S(2)]]);
      expect(retuningOf(w, S(2))).toBe(true);
      expect(readyPayloads(w).map((p) => p.slot)).toEqual([S(0)]);
      // and the cycle after it is judged against it: the same tuning is not a second
      // promote, and the old rows are measured against the INCOMPLETE promote cycle
      await deliver(w, manifestAt(S(3), { ...B, repush: 500 }));
      expect(events(w)).toEqual([['PROMOTE', S(2)]]);
      expect(retuningOf(w, S(3))).toBe(true);
    });
  });

  it('a cycle still PENDING already carries the flag, so its successor continues the RETUNING', async () => {
    const w = world();
    await baseline(w);
    // the promote's rows have not landed: waiting, and its job is never picked up again
    expect(
      await deliver(w, manifestAt(S(2), { ...B, repush: 700 }), { land: false })
    ).toEqual({ outcome: 'waiting' });
    expect(row(w, S(2))['state']).toBe('PENDING');
    expect(retuningOf(w, S(2))).toBe(true);

    await deliver(w, manifestAt(S(3), { ...B, repush: 300 }));
    expect(retuningOf(w, S(3))).toBe(true);
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    // the PENDING promote cycle's id is what the window is measured against
    expect(windowCounts(w).map((q) => q.args.where.cycle_id)).toEqual([
      { lt: 3 },
    ]);
  });
});

describe('Option A: what the gateway counts', () => {
  /**
   * A world at the promote's cycle: a baseline, the promote at S(1) (cycle id 2),
   * and then every row removed, so the only old rows are the ones a test plants.
   * Returns a function that delivers S(2), a cycle that carries on the RETUNING.
   */
  async function afterPromote(): Promise<{
    w: World;
    next: (plant?: FakeBar[]) => Promise<void>;
  }> {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B));
    w.prisma.bars.length = 0;
    return {
      w,
      next: async (plant = []) => {
        await deliver(w, manifestAt(S(2), B), {
          before: (x) => plant.forEach((bar) => x.prisma.upsertBar(bar)),
        });
      },
    };
  }

  const bar = (over: Partial<FakeBar>): FakeBar => ({
    symbol: 'XAUUSD',
    timeframe: 'M5',
    timestamp: S(2) - 3000,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 1,
    cycle_id: 1,
    ...over,
  });

  it('a clean table has no old row: the first cycle after the promote that is verified ends it', async () => {
    const { w, next } = await afterPromote();
    await next();
    expect(retuningOf(w, S(2))).toBe(false);
    expect(leftInWindow(S(2))).toBe(0);
  });

  describe('the window runs from slot - 3000 * 300 to the slot, both ends included', () => {
    const FROM = S(2) - 3000 * 300;
    for (const [name, timestamp, holds] of [
      ['the first second of the window', FROM, true],
      ['one bar below it', FROM - 300, false],
      ['one second below it', FROM - 1, false],
      ['one second above the first', FROM + 1, true],
      ['a bar in the middle', S(2) - 1500 * 300, true],
      ['a bar just before the newest', S(2) - 600, true],
      ['a bar after the slot', S(2) + 300, false],
    ] as Array<[string, number, boolean]>) {
      it(`${name}: ${holds ? 'counted, so RETUNING goes on' : 'not counted, so it ends'}`, async () => {
        const { w, next } = await afterPromote();
        await next([bar({ timestamp })]);
        expect([name, retuningOf(w, S(2))]).toEqual([name, holds]);
        expect(leftInWindow(S(2))).toBe(holds ? 1 : 0);
      });
    }
  });

  describe('a row is old when its cycle_id is below the promote cycle (id 2 here), not at it', () => {
    for (const [cycleId, holds] of [
      [1, true],
      [0, true],
      [2, false],
      [3, false],
    ] as Array<[number, boolean]>) {
      it(`cycle_id ${cycleId}: ${holds ? 'old' : 'not old'}`, async () => {
        const { w, next } = await afterPromote();
        await next([bar({ timestamp: S(2) - 9000, cycle_id: cycleId })]);
        expect(retuningOf(w, S(2))).toBe(holds);
      });
    }
  });

  it('only M5 rows are counted: an old M15 row does not hold it', async () => {
    const { w, next } = await afterPromote();
    await next([bar({ timeframe: 'M15', timestamp: S(2) - 9000 })]);
    expect(retuningOf(w, S(2))).toBe(false);
  });

  it('only the manifest symbol is counted: an old row of another symbol does not hold it', async () => {
    const { w, next } = await afterPromote();
    await next([bar({ symbol: 'EURUSD', timestamp: S(2) - 9000 })]);
    expect(retuningOf(w, S(2))).toBe(false);
  });

  it('counts every old row, not whether there is one', async () => {
    const { w, next } = await afterPromote();
    await next([
      bar({ timestamp: S(2) - 9000 }),
      bar({ timestamp: S(2) - 9300 }),
      bar({ timestamp: S(2) - 9600 }),
    ]);
    expect(leftInWindow(S(2))).toBe(3);
    expect(retuningOf(w, S(2))).toBe(true);
  });

  it('is counted with the query the order names, once per look, and only while a RETUNING carries on', async () => {
    const w = world();
    // six calm cycles and a promote: not one window count
    for (let k = 0; k < 6; k += 1) await deliver(w, manifestAt(S(k)));
    await deliver(w, manifestAt(S(6), B));
    expect(windowCounts(w)).toEqual([]);
    // the cycle after the promote carries it on: one count, against the promote cycle (id 7)
    await deliver(w, manifestAt(S(7), B));
    expect(windowCounts(w)).toHaveLength(1);
    expect(windowCounts(w)[0].args).toStrictEqual({
      where: {
        symbol: 'XAUUSD',
        timeframe: 'M5',
        timestamp: { gte: S(7) - 3000 * 300, lte: S(7) },
        cycle_id: { lt: 7 },
      },
    });
    expect(retuningOf(w, S(7))).toBe(true);
    // the whole window is re-pushed: one more count, and it ends
    await deliver(w, manifestAt(S(8), B), { window: 'all' });
    expect(windowCounts(w)).toHaveLength(2);
    expect(retuningOf(w, S(8))).toBe(false);
    // once it has ended, no more counts
    await deliver(w, manifestAt(S(9), B));
    await deliver(w, manifestAt(S(10), B));
    expect(windowCounts(w)).toHaveLength(2);
  });

  it('looking again at a manifest that is still waiting counts again, and a window that has just been re-pushed ends it', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B));
    const m = manifestAt(S(2), B);
    // first look: its rows have not landed, and the window is old
    expect(await deliver(w, m, { land: false })).toEqual({
      outcome: 'waiting',
    });
    expect(retuningOf(w, S(2))).toBe(true);
    // by the second look everything has landed and been re-pushed
    expect(
      await deliver(w, m, { window: 'all', checks: 1, after: 10 })
    ).toEqual({ outcome: 'ready' });
    expect(retuningOf(w, S(2))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
    ]);
    expect(windowCounts(w)).toHaveLength(2);
  });

  describe('when there is no promote to measure against, the window is not counted and RETUNING stays', () => {
    it('no PROMOTE event is on record', async () => {
      const w = world();
      await baseline(w);
      // a predecessor that says it was RETUNING, with no event behind it
      row(w, S(0))['retuning'] = true;
      await deliver(w, manifestAt(S(1)), { window: 'all' });
      expect(retuningOf(w, S(1))).toBe(true);
      expect(windowCounts(w)).toEqual([]);
      expect(events(w)).toEqual([]);
      expect(logged('warn').some((l) => /no promote cycle id/.test(l))).toBe(
        true
      );
    });

    it('the PROMOTE cycle has no collection cycle id on its row', async () => {
      const w = world();
      await baseline(w);
      await deliver(w, manifestAt(S(1), B));
      row(w, S(1))['m5_collection_cycle_id'] = null;
      await deliver(w, manifestAt(S(2), B), { window: 'all' });
      expect(retuningOf(w, S(2))).toBe(true);
      expect(windowCounts(w)).toEqual([]);
      expect(events(w)).toEqual([['PROMOTE', S(1)]]);
    });

    it('the PROMOTE event is for another symbol', async () => {
      const w = world();
      await baseline(w);
      await deliver(w, manifestAt(S(1), B));
      w.prisma.events[0].symbol = 'EURUSD';
      await deliver(w, manifestAt(S(2), B), { window: 'all' });
      expect(retuningOf(w, S(2))).toBe(true);
    });

    it('the only event on record is of another type', async () => {
      const w = world();
      await baseline(w);
      await deliver(w, manifestAt(S(1), B));
      w.prisma.events[0].event_type = 'WATCHDOG_ALERT';
      await deliver(w, manifestAt(S(2), B), { window: 'all' });
      expect(retuningOf(w, S(2))).toBe(true);
    });
  });

  it('measures against the latest promote AT OR BEFORE the slot, not one that was recorded for a later slot', async () => {
    const w = world();
    await baseline(w);
    // the promote to B at S(1) (cycle id 2) re-pushes everything at once
    await deliver(w, manifestAt(S(1), B), { window: 'all' });
    // S(3) arrives first and is a promote back to A (cycle id 4), with nothing re-pushed
    await deliver(w, manifestAt(S(3)));
    expect(events(w).at(-1)).toEqual(['PROMOTE', S(3)]);
    // S(2) arrives late. Every row is at cycle 2 or above: measured against the
    // promote at S(1) (id 2) the window is clean; measured against S(3)'s (id 4)
    // the rows of cycles 2 and 3 would all be old.
    await deliver(w, manifestAt(S(2), B));
    expect(retuningOf(w, S(2))).toBe(false);
    expect(leftInWindow(S(2))).toBe(0);
    // the late cycle writes no event of its own
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['PROMOTE', S(3)],
    ]);
  });
});

describe('repeats and failures change nothing twice', () => {
  it('a manifest delivered again after it is READY writes no second event and keeps its flag', async () => {
    const w = world();
    await baseline(w);
    const promote = manifestAt(S(2), B);
    await deliver(w, promote);
    const complete = manifestAt(S(3), B);
    await deliver(w, complete, { window: 'all' });
    const snapshot = JSON.stringify([
      w.prisma.events,
      [...w.prisma.cycles.values()],
      w.ready.adds,
    ]);

    for (const again of [promote, complete, promote, complete]) {
      expect(await deliver(w, again)).toEqual({ outcome: 'already-ready' });
    }
    expect(
      JSON.stringify([
        w.prisma.events,
        [...w.prisma.cycles.values()],
        w.ready.adds,
      ])
    ).toBe(snapshot);
    expect(events(w)).toEqual([
      ['PROMOTE', S(2)],
      ['RETUNE_COMPLETE', S(3)],
    ]);
  });

  it('looking again at a manifest that is still waiting writes the PROMOTE once', async () => {
    const w = world();
    await baseline(w);
    const promote = manifestAt(S(2), { ...B, repush: 4000 });

    expect(await deliver(w, promote, { land: false })).toEqual({
      outcome: 'waiting',
    });
    expect(
      await deliver(w, promote, { land: false, checks: 1, after: 10 })
    ).toEqual({
      outcome: 'waiting',
    });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);

    expect(await deliver(w, promote, { checks: 2, after: 20 })).toEqual({
      outcome: 'ready',
    });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(retuningOf(w, S(2))).toBe(true);
    expect(readyPayloads(w).map((p) => [p.slot, p.retuning])).toEqual([
      [S(0), false],
      [S(2), true],
    ]);
  });

  /** The first PENDING -> READY update fails, as if the database went away at the worst moment. */
  function failFirstReadyCommit(prisma: FakePrisma): void {
    const real = prisma.marketCycle.updateMany;
    let failed = false;
    prisma.marketCycle.updateMany = async (args) => {
      if (
        !failed &&
        (args.data as Record<string, unknown>)['state'] === 'READY'
      ) {
        failed = true;
        throw new Error('db went away');
      }
      return real(args);
    };
  }

  it('a job retried after the commit failed ends the RETUNING once: one event, one flag, one announcement', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B));
    const completing = manifestAt(S(2), B);

    failFirstReadyCommit(w.prisma);
    await expect(deliver(w, completing, { window: 'all' })).rejects.toThrow(
      'db went away'
    );
    expect(row(w, S(2))['state']).toBe('PENDING');
    // what was already done before the failure is the event, never half of a pair
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
    ]);

    expect(await deliver(w, completing, { window: 'all', checks: 1 })).toEqual({
      outcome: 'ready',
    });
    expect(retuningOf(w, S(2))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
    ]);
    expect(readyPayloads(w).filter((p) => p.slot === S(2))).toEqual([
      expect.objectContaining({ slot: S(2), retuning: false }),
    ]);
  });

  it('a job retried after the commit failed on a promote writes the PROMOTE once', async () => {
    const w = world();
    await baseline(w);
    const promote = manifestAt(S(2), { ...B, repush: 900 });

    failFirstReadyCommit(w.prisma);
    await expect(deliver(w, promote)).rejects.toThrow('db went away');
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(retuningOf(w, S(2))).toBe(true); // the provisional flag

    await deliver(w, promote, { checks: 1 });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(retuningOf(w, S(2))).toBe(true);
  });

  it('an event that cannot be written fails the job before anything else, so the retry starts clean', async () => {
    const w = world();
    await baseline(w);
    const promote = manifestAt(S(2), { ...B, repush: 900 });

    w.prisma.failNext = { eventCreateMany: new Error('cycle_events is gone') };
    await expect(deliver(w, promote)).rejects.toThrow('cycle_events is gone');
    expect(row(w, S(2))['state']).toBe('PENDING');
    expect(retuningOf(w, S(2))).toBe(false);
    expect(readyPayloads(w).map((p) => p.slot)).toEqual([S(0)]);

    expect(await deliver(w, promote, { checks: 1 })).toEqual({
      outcome: 'ready',
    });
    expect(events(w)).toEqual([['PROMOTE', S(2)]]);
    expect(retuningOf(w, S(2))).toBe(true);
  });

  it('events are append-only: the service only ever creates them, and reads the latest PROMOTE', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B));
    await deliver(w, manifestAt(S(2), B), { window: 'all' });
    const ops = w.prisma.queries('cycleEvent').map((q) => q.op);
    expect(ops.length).toBeGreaterThan(0);
    // anything that updated or deleted an event would not even exist on the fake
    expect(new Set(ops)).toEqual(new Set(['createMany', 'findFirst']));
    for (const q of w.prisma.queries('cycleEvent', 'createMany')) {
      expect((q.args as { skipDuplicates?: boolean }).skipDuplicates).toBe(
        true
      );
    }
  });
});

describe('a manifest that arrives behind a newer one (the sender delivers newest first)', () => {
  it('still gets its own flag, but writes no second PROMOTE for the same promote', async () => {
    const w = world();
    await baseline(w);
    // S(3) is delivered first and is the first the gateway sees with the new tuning
    await deliver(w, manifestAt(S(3), { ...B, repush: 700 }));
    expect(events(w)).toEqual([['PROMOTE', S(3)]]);

    // S(2) was built under the new tuning too, and arrives late
    await deliver(w, manifestAt(S(2), { ...B, repush: 900 }));
    expect(retuningOf(w, S(2))).toBe(true);
    expect(events(w)).toEqual([['PROMOTE', S(3)]]);

    // S(1) still had the old tuning
    await deliver(w, manifestAt(S(1)));
    expect(retuningOf(w, S(1))).toBe(false);
    expect(events(w)).toEqual([['PROMOTE', S(3)]]);
  });

  it('writes no second RETUNE_COMPLETE either', async () => {
    const w = world();
    await baseline(w);
    await deliver(w, manifestAt(S(1), B), { window: 'all' }); // promote, everything re-pushed at once
    await deliver(w, manifestAt(S(3), B)); // judged against S(1): the window is clean, so it completes
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(3)],
    ]);

    await deliver(w, manifestAt(S(2), B)); // late
    expect(retuningOf(w, S(2))).toBe(false);
    expect(events(w)).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(3)],
    ]);
  });
});

describe('what the cycle row keeps (the part 4 columns, now written by the promote logic)', () => {
  it('stores retuning, backlog_rows and repush_rows_unsent as the sender sent them', async () => {
    const w = world();
    const m = manifestAt(S(1), { ...B, repush: 5997 });
    m.backlog_rows = 6000;
    await baseline(w);
    await deliver(w, m);
    expect(row(w, S(1))).toMatchObject({
      retuning: true,
      backlog_rows: 6000,
      repush_rows_unsent: 5997,
      terminal_id: 'MT5-B',
    });
  });

  it('a sender that omits the count leaves NULL, not zero, on the row', async () => {
    const w = world();
    await deliver(w, manifestAt(S(0)));
    expect(row(w, S(0))['repush_rows_unsent']).toBeNull();
  });
});
