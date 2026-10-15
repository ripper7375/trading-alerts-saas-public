/**
 * @jest-environment node
 */

/**
 * The requests that must NEVER reach a model (build step 7 part 7a; acceptance 5.14 items 2 and 3;
 * plan part 7 "call counts"): a Free trader, a caller who is not signed in, an unknown tier, a
 * thread of another trader, an empty balance, a STALE cycle and a Report 2 request. The model
 * port's call count is the assertion, and so is what the trader was charged.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import type {
  ActionResult,
  FixedAnswerResult,
} from '@/lib/reply/contracts/result';

import { echoResult } from '../../intake/helpers/ports';
import { buildWorld, run, USER } from './helpers/world';

/** Neither the answer model nor its fallback was asked. */
function modelsNeverAsked(w: Awaited<ReturnType<typeof buildWorld>>): void {
  expect(w.primary?.count).toBe(0);
  expect(w.fallback?.count ?? 0).toBe(0);
}

describe('refused at the gate: no model, no charge', () => {
  it('a Free trader', async () => {
    const w = await buildWorld({
      intake: { session: { userId: USER, tier: 'FREE' } },
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('TIER_REQUIRED');
    modelsNeverAsked(w);
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
    // the body is never read for a tier that may not ask (it is read after the tier check)
    expect(w.fake.calls.thread).toBe(0);
  });

  it('a caller who is not signed in', async () => {
    const w = await buildWorld({ intake: { session: null } });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('NOT_SIGNED_IN');
    modelsNeverAsked(w);
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
    expect(w.traces.rows.size).toBe(0);
  });

  it.each(['ENTERPRISE', '', 'pro', 'ADMIN'])(
    'an unknown tier %j reads as no analyst',
    async (tier) => {
      const w = await buildWorld({
        intake: { session: { userId: USER, tier } },
      });
      const out = await run(w, { kind: 'TYPED' });
      expect(out.kind).toBe('REFUSED');
      if (out.kind !== 'REFUSED') return;
      expect(out.refusal.code).toBe('TIER_REQUIRED');
      modelsNeverAsked(w);
      expect(w.ledger.reservations.size).toBe(0);
    }
  );

  it('a thread of another trader is THREAD_INVALID, the same as one that does not exist', async () => {
    const w = await buildWorld();
    const theirs = w.chat.seedThread({ user_id: 'someone-else' });
    const mine = w.chat.seedThread({ user_id: USER });
    for (const threadId of [theirs.id, 'th-does-not-exist', 'bad id']) {
      const out = await run(w, { kind: 'TYPED', threadId });
      expect(out.kind).toBe('REFUSED');
      if (out.kind !== 'REFUSED') continue;
      expect(out.refusal.code).toBe('THREAD_INVALID');
    }
    modelsNeverAsked(w);
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
    // the trader's own thread is accepted
    const ok = await run(w, {
      kind: 'TYPED',
      threadId: mine.id,
      clientRequestId: 'client-ok-0001',
    });
    expect(ok.kind).toBe('REPLY');
  });

  it('the profile not confirmed', async () => {
    const w = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('PROFILE_NOT_SET');
    modelsNeverAsked(w);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('a refusal at the gate with the intent known has a trace row (an instant prompt); a typed one has none', async () => {
    const instant = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const out = await run(instant, { kind: 'INSTANT' });
    expect(out.kind === 'REFUSED' && out.traced).toBe(true);
    const row = [...instant.traces.rows.values()][0]!;
    expect(row.outcome).toBe('REFUSED');
    expect(row.intent).toBe('INSTANT_M5_INSPECT');
    expect(row.units_charged).toBe(0);
    expect(row.thread_id).toBeNull();

    const typed = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const refused = await run(typed, { kind: 'TYPED' });
    expect(refused.kind === 'REFUSED' && refused.traced).toBe(false);
    expect(typed.traces.rows.size).toBe(0);
  });
});

describe('the balance', () => {
  it('an allowance that cannot cover the worst case is refused with the balance, before any model is called', async () => {
    // enough for the floor (one request's cheapest case), far too little for the worst case
    const w = await buildWorld({ allowance: 30_000 });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('QUOTA_INSUFFICIENT');
    expect(out.quota).not.toBeNull();
    expect(out.quota!.limitUnits).toBe(30_000);
    expect(out.quota!.availableUnits).toBe(30_000);
    expect(out.quota!.neededUnits).toBeGreaterThan(30_000);
    modelsNeverAsked(w);
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
    const period = [...w.ledger.periods.values()][0];
    expect(period?.reserved ?? 0).toBe(0);
    expect(period?.used ?? 0).toBe(0);
  });

  it('an empty balance is refused at the floor, before the hold', async () => {
    const w = await buildWorld({ allowance: 1_000_000 });
    // spend it all with another request
    const meter = w.ports.meter;
    const taken = await meter.reserve(
      { requestId: 'earlier', userId: USER, tier: 'PRO' },
      {
        ok: true,
        understandUnits: 0,
        answerUnits: 1_000_000,
        regenerationUnits: 0,
        baseUnits: 1_000_000,
        withRegenerationUnits: 1_000_000,
      }
    );
    expect(taken.ok).toBe(true);
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('QUOTA_INSUFFICIENT');
    modelsNeverAsked(w);
    // only the earlier hold exists
    expect([...w.ledger.reservations.keys()]).toEqual(['earlier']);
  });

  it('an allowance that is not set refuses everything', async () => {
    const w = await buildWorld({ allowance: null });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind === 'REFUSED' && out.refusal.code).toBe(
      'QUOTA_INSUFFICIENT'
    );
    modelsNeverAsked(w);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('no launch model: the feature is unavailable, not a quota refusal', async () => {
    const w = await buildWorld({ primary: null });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('FEATURE_UNAVAILABLE');
    expect(out.quota).toBeNull();
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
  });
});

describe('no model by design', () => {
  it('a STALE cycle: the fixed answer says when the data stopped and states no direction', async () => {
    const w = await buildWorld({
      intake: { worldOptions: { gateway: 'STALE' } },
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.kind).toBe('FIXED_ANSWER');
    expect(result.fixed.reason).toBe('DATA_STALE');
    expect(result.fixed.direction).toBeNull();
    expect(result.fixed.levels).toEqual([]);
    expect(result.stamp.data_status).toBe('STALE');
    expect(result.stamp.as_of).toBe(w.world.slotIso);
    modelsNeverAsked(w);
    // the Understand call was real and is the only thing charged
    const reservation = [...w.ledger.reservations.values()][0]!;
    expect(reservation.status).toBe('SETTLED');
    expect(reservation.actual_units).toBe(300);
    const row = [...w.traces.rows.values()][0]!;
    expect(row.outcome).toBe('FIXED_ANSWER');
    expect(row.units_charged).toBe(300);
    expect((row.checks_group as { fixed_reason: string }).fixed_reason).toBe(
      'DATA_STALE'
    );
    // stages: the model and the checks were skipped
    expect(w.calls.bars).toBe(0);
  });

  it('a STALE cycle answers Explain, which needs no direction', async () => {
    const w = await buildWorld({
      intake: {
        worldOptions: { gateway: 'STALE' },
        understand: echoResult('what is a corridor', 'EXPLAIN'),
      },
      // a short answer is made from the answer schema
      primary: [
        {
          kind: 'REPLY',
          text: JSON.stringify({
            locale: 'en-US',
            text: 'A corridor is the band the price moves in.',
            cites: ['MCD1'],
            action: null,
          }),
          usage: { cost_micro_usd: 1_000 },
        },
      ],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    expect(out.result.kind).toBe('ANSWER');
    expect(w.primary?.count).toBe(1);
  });

  it('a Report 2 request opens the Trade Setup with the cycle, the trader type and the zones, and calls no model', async () => {
    const w = await buildWorld({
      intake: { understand: echoResult('open a trade', 'REPORT_2') },
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as ActionResult;
    expect(result.kind).toBe('ACTION');
    expect(result.action).toEqual({
      type: 'OPEN_TRADE_SETUP',
      cycle_slot: w.world.slotIso,
      trader_type: 'DAY_TRADER',
      zone_ids: ['Z1', 'Z2'],
    });
    modelsNeverAsked(w);
    expect(w.calls.bars).toBe(0);
    const row = [...w.traces.rows.values()][0]!;
    expect(row.outcome).toBe('OPEN_TRADE_SETUP');
    expect(row.model).toBeNull();
    // only the Understand call was charged
    expect([...w.ledger.reservations.values()][0]!.actual_units).toBe(300);
  });

  it('Report 2 on a closed market is a fixed answer, not a modal', async () => {
    const w = await buildWorld({
      intake: {
        understand: echoResult('open a trade', 'REPORT_2'),
        worldOptions: { gateway: 'MARKET_CLOSED' },
      },
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.kind).toBe('FIXED_ANSWER');
    expect(result.fixed.reason).toBe('MARKET_CLOSED');
    modelsNeverAsked(w);
  });

  it('an instant prompt on a STALE cycle costs nothing at all', async () => {
    const w = await buildWorld({
      intake: { worldOptions: { gateway: 'STALE' } },
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    expect(out.result.kind).toBe('FIXED_ANSWER');
    modelsNeverAsked(w);
    expect(w.fake.calls.understand).toBe(0);
    const reservation = [...w.ledger.reservations.values()][0]!;
    expect(reservation.status).toBe('RELEASED');
    expect([...w.ledger.periods.values()][0]!.used).toBe(0);
    expect([...w.traces.rows.values()][0]!.units_charged).toBe(0);
  });
});
