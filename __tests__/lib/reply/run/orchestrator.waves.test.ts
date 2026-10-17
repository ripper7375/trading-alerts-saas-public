/**
 * @jest-environment node
 */

/**
 * The orchestrator's reads around the model (Next.js remediation T2-b): they are asked for in two
 * waves instead of one after another.
 *
 *   wave 1  the thread's context and the day's bars (neither needs the other)
 *   wave 2  the earlier cycle's states and the chart (both need the thread's context, not each other)
 *
 * What must not change: the earlier cycle is read ONLY when the thread has a last cycle that is not
 * this one (a first question, and a follow-up in the same cycle, never ask for it), a day's bars
 * that cannot be read are logged once with the same code, and the changes the reply carries are
 * the same.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { CHART_SLOT_SECONDS } from '@/lib/storage/chart-keys';
import type { ChartPort } from '@/lib/reply/read/chart';

import { buildWorld, run, USER } from './helpers/world';

const SLOT = Date.UTC(2026, 8, 18, 20, 55) / 1000;
const EARLIER = Date.UTC(2026, 8, 18, 20, 50) / 1000;

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

/** Let the run go on until `done()` holds (every wait here is a promise, so a few ticks do it). */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i += 1) await flush();
}

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

const stamp = {
  slot: SLOT,
  lastClosedBar: SLOT - CHART_SLOT_SECONDS,
  overlay: 'best_fit_a',
  variant: 'overlay',
} as const;

describe('the orchestrator reads in two waves', () => {
  async function observed() {
    const order: string[] = [];
    const held = {
      context: gate(),
      bars: gate(),
      previous: gate(),
      chart: gate(),
    };
    const chart: ChartPort = {
      getChartStamp: async () => {
        order.push('chart:start');
        await held.chart.opened;
        return stamp;
      },
      getChartImage: async () => ({
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
        contentType: 'image/png',
        stamp,
      }),
    };
    const w = await buildWorld({
      chart,
      previousStates: {
        slot: '2026-09-18T20:50Z',
        sensors: [
          { mcd_id: 'MCD1', state_code: 'MCD1_DOWN_IN_CORRIDOR' },
          { mcd_id: 'MCD2', state_code: 'MCD2_UP_IN_CORRIDOR' },
          {
            mcd_id: 'MCD3',
            state_code: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
          },
        ],
      },
    });

    const context = w.ports.threads.context.bind(w.ports.threads);
    w.ports.threads.context = async (userId, threadId) => {
      order.push('context:start');
      await held.context.opened;
      const read = await context(userId, threadId);
      order.push('context:end');
      return read;
    };
    const bars = w.ports.dayBars;
    w.ports.dayBars = async (slot) => {
      order.push('bars:start');
      await held.bars.opened;
      const read = await bars(slot);
      order.push('bars:end');
      return read;
    };
    const previous = w.ports.previousStates;
    w.ports.previousStates = async (slot) => {
      order.push('previous:start');
      await held.previous.opened;
      const read = await previous(slot);
      order.push('previous:end');
      return read;
    };
    return { w, order, held };
  }

  it('asks for the thread and the day’s bars together, then for the earlier cycle and the chart together', async () => {
    const { w, order, held } = await observed();
    const thread = w.chat.seedThread({
      user_id: USER,
      last_cycle_slot: EARLIER,
      message_count: 2,
    });

    const pending = run(w, { kind: 'INSTANT', threadId: thread.id });
    await until(() => order.includes('bars:start'));
    // wave 1: both in flight, nothing of wave 2
    expect(order).toEqual(['context:start', 'bars:start']);

    held.bars.open();
    await flush();
    // the bars are back, the thread is not: wave 2 waits for the thread
    expect(order).toEqual(['context:start', 'bars:start', 'bars:end']);

    held.context.open();
    await until(
      () => order.includes('previous:start') && order.includes('chart:start')
    );
    // wave 2: both in flight before either answers
    expect(order.slice(order.indexOf('context:end') + 1)).toEqual([
      'previous:start',
      'chart:start',
    ]);

    held.previous.open();
    held.chart.open();
    const out = await pending;

    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    // what moved since the thread's last cycle, built by code, as before
    expect(out.result.changes).toEqual([
      {
        mcd_id: 'MCD1',
        from: 'MCD1_DOWN_IN_CORRIDOR',
        to: 'MCD1_DOWN_UPPER_BREAKOUT',
      },
    ]);
    expect(w.calls.previousStates).toBe(1);
  });

  it('never asks for the earlier cycle when the thread’s last cycle is this one; the chart is still read', async () => {
    const { w, order, held } = await observed();
    const thread = w.chat.seedThread({
      user_id: USER,
      last_cycle_slot: SLOT,
      message_count: 2,
    });
    held.context.open();
    held.bars.open();
    held.chart.open();

    const out = await run(w, { kind: 'INSTANT', threadId: thread.id });

    expect(out.kind).toBe('REPLY');
    expect(out.kind === 'REPLY' && out.result.changes).toEqual([]);
    expect(order).not.toContain('previous:start');
    expect(order).toContain('chart:start');
    expect(w.calls.previousStates).toBe(0);
  });

  it('never asks for the earlier cycle on a first question, and does not look for a thread', async () => {
    const { w, order, held } = await observed();
    held.bars.open();
    held.chart.open();

    const out = await run(w, { kind: 'INSTANT' });

    expect(out.kind).toBe('REPLY');
    expect(out.kind === 'REPLY' && out.result.changes).toEqual([]);
    expect(order).not.toContain('context:start');
    expect(order).not.toContain('previous:start');
    expect(order).toContain('bars:start');
    expect(order).toContain('chart:start');
    expect(w.calls.previousStates).toBe(0);
  });

  it('logs a day’s bars that cannot be read once, with its code, and goes on', async () => {
    const w = await buildWorld({ noBars: true });

    const out = await run(w, { kind: 'INSTANT' });

    expect(w.logs.filter((l) => l.code === 'DAY_BARS_UNAVAILABLE')).toEqual([
      { code: 'DAY_BARS_UNAVAILABLE', detail: { code: 'DATABASE_ERROR' } },
    ]);
    expect(['REPLY', 'ERROR']).toContain(out.kind);
  });
});
