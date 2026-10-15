/**
 * @jest-environment node
 */

/**
 * The trace builder and the hold, on their own (build step 7 part 7a): what the trace of an answer
 * contains and never contains, and every way the quota hold can end, one by one.
 */

import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { TraceRecorder } from '@/lib/reply/contracts/intake';
import type { IntakePacket } from '@/lib/reply/contracts/intake';
import { validateReplyTrace } from '@/lib/reply/contracts/trace-fields';
import type { RequestBounds } from '@/lib/reply/meter/estimate';
import { boundOf } from '@/lib/reply/meter/estimate';
import { createMeter } from '@/lib/reply/meter/quota-port';
import type { Meter } from '@/lib/reply/meter/quota-port';
import { callRecordOf } from '@/lib/reply/run/calls';
import { Hold, HoldStopped } from '@/lib/reply/run/hold';
import { buildTrace, quietChecks } from '@/lib/reply/run/trace';
import type { TraceInput } from '@/lib/reply/run/trace';
import {
  emptyPass,
  eventsShownOf,
  runAnswerStep,
  synthesisBias,
} from '@/lib/reply/run/answer-step';
import type { ReplyRequest } from '@/lib/reply/run/types';
import { REPLY_VERSION } from '@/lib/reply/version';

import { LedgerModel } from '../../platform/helpers/ledger-model';
import { goldenPacket } from '../context/helpers/context-fixtures';
import { PRICED_A, UNDERSTAND_TARGET } from './helpers/world';

const REQUEST: ReplyRequest = {
  kind: 'TYPED',
  question: 'THE-QUESTION-TEXT',
  threadId: null,
  clientRequestId: 'client-0001',
};
const RID = 'a'.repeat(64);
const SHA = 'b'.repeat(64);

function recorder(): TraceRecorder {
  let t = 0;
  const r = new TraceRecorder({
    requestId: 'x',
    route: 'typed',
    method: 'POST',
    startedAt: '2026-09-18T20:57:00.000Z',
    clock: () => (t += 3),
  });
  return r;
}

/** The golden packet, with the index named the way the knowledge service names it ("kb-" and 32 hex digits). */
function golden(): IntakePacket {
  const packet = JSON.parse(JSON.stringify(goldenPacket('01'))) as IntakePacket;
  if (packet.knowledge?.index_build_id) {
    packet.knowledge.index_build_id = `kb-${'ab'.repeat(16)}`;
  }
  return packet;
}

function input(
  over: Partial<TraceInput> = {},
  packet: IntakePacket | null = golden()
): TraceInput {
  return {
    request: REQUEST,
    requestId: RID,
    tier: 'PRO',
    threadId: 'th-1',
    intake: recorder().snapshot(),
    packet,
    intent: 'DIRECTION',
    replyLocale: 'en-US',
    startedAt: '2026-09-18T20:57:00.000Z',
    totalMs: 12.4,
    deadlineHit: false,
    stages: [{ name: 'MODEL', ms: 9.6 }],
    shape: 'REPORT1',
    gate: null,
    checks: null,
    fixedReason: null,
    directionEqualsSyn: true,
    calls: [],
    model: null,
    promptVersion: null,
    fallbackUsed: false,
    components: null,
    cycleBlockSha256: null,
    packetSha256: SHA,
    unitsCharged: 0,
    outcome: 'REPORT1',
    ...over,
  };
}

describe('the trace of an answer', () => {
  it('is accepted by the contract, from a packet', () => {
    const trace = buildTrace(input());
    expect(validateReplyTrace(trace).ok).toBe(true);
    expect(trace.risk).toBeNull();
    expect(trace.request).toMatchObject({
      reply_version: REPLY_VERSION,
      request_id: RID,
      client_request_id: 'client-0001',
      thread_id: 'th-1',
      tier: 'PRO',
      kind: 'TYPED',
      intent: 'DIRECTION',
      reply_locale: 'en-US',
    });
  });

  it('copies the data group from the packet and never works it out again', () => {
    const packet = golden();
    const trace = buildTrace(input({}, packet));
    expect(trace.data).toMatchObject({
      cycle_slot: packet.data.cycle_slot,
      data_status: packet.data.status,
      retuning: packet.data.retuning,
      flags: packet.data.flags,
      sensor_statuses: packet.trace.sensor_statuses,
      synthesis_rule: packet.trace.synthesis_rule,
      synthesis_rules_version: 'draft-1',
      last_price_bar: packet.data.last_price?.bar ?? null,
      intake_version: packet.trace.intake_version,
      routing_version: packet.trace.routing_version,
      packet_sha256: SHA,
    });
    expect(trace.knowledge.m_star).toEqual(packet.readings.m_star);
    expect(trace.knowledge.chunk_ids).toEqual(packet.trace.chunk_ids);
  });

  it('holds no text the trader typed, and no user id', () => {
    const text = JSON.stringify(buildTrace(input()));
    expect(text).not.toContain('THE-QUESTION-TEXT');
    expect(text).not.toContain('user-pro-1');
  });

  it('a tier that is not PRO is FREE', () => {
    expect(buildTrace(input({ tier: 'FREE' })).request.tier).toBe('FREE');
    expect(buildTrace(input({ tier: 'whatever' })).request.tier).toBe('FREE');
  });

  it('records a pack that was asked and held nothing as a missed piece of knowledge, without the question', () => {
    const packet = golden();
    packet.knowledge = {
      status: 'EMPTY',
      index_build_id: null,
      chunks: [],
      expansions: [],
    };
    const trace = buildTrace(input({}, packet));
    expect(trace.knowledge.missed).toEqual({
      intent: packet.intent,
      m_star: packet.readings.m_star,
      reply_locale: packet.question.reply_locale,
      chunk_count: 0,
      packet_sha256: SHA,
    });
    expect(trace.knowledge.status).toBe('EMPTY');
    expect(JSON.stringify(trace)).not.toContain('THE-QUESTION-TEXT');
  });

  it('a pack that is there, or a service that was down, is not a miss', () => {
    const base = golden();
    expect(buildTrace(input({}, base)).knowledge.missed).toBeNull();
    const down = JSON.parse(JSON.stringify(base)) as IntakePacket;
    down.knowledge = {
      status: 'UNAVAILABLE',
      index_build_id: null,
      chunks: [],
      expansions: [],
    };
    expect(buildTrace(input({}, down)).knowledge.missed).toBeNull();
    const none = JSON.parse(JSON.stringify(base)) as IntakePacket;
    none.knowledge = null;
    expect(buildTrace(input({}, none)).knowledge).toMatchObject({
      status: null,
      missed: null,
      index_build_id: null,
    });
    const empty = JSON.parse(JSON.stringify(base)) as IntakePacket;
    empty.knowledge = {
      status: 'EMPTY',
      index_build_id: null,
      chunks: [],
      expansions: [],
    };
    expect(
      buildTrace(input({ packetSha256: null }, empty)).knowledge.missed
    ).toBeNull();
  });

  it('a refusal has no packet: the data and knowledge groups are empty and it is still accepted', () => {
    const trace = buildTrace(
      input(
        {
          outcome: 'REFUSED',
          shape: 'NONE',
          threadId: null,
          directionEqualsSyn: null,
          packetSha256: null,
        },
        null
      )
    );
    expect(trace.data).toEqual({
      cycle_slot: null,
      data_status: null,
      retuning: false,
      flags: [],
      sensor_statuses: {},
      synthesis_rule: null,
      synthesis_rules_version: null,
      last_price_bar: null,
      intake_version: null,
      routing_version: null,
      packet_sha256: null,
    });
    expect(trace.knowledge).toEqual({
      m_star: [],
      chunk_ids: [],
      index_build_id: null,
      status: null,
      missed: null,
    });
    expect(validateReplyTrace(trace).ok).toBe(true);
  });

  it('takes the interface locale and the language from the intake trace, and a family when it has none', () => {
    const r = recorder();
    r.set({ interface_locale: 'de', language: 'ja' });
    const trace = buildTrace(input({ intake: r.snapshot() }, null));
    expect(trace.request).toMatchObject({
      interface_locale: 'de',
      language: 'ja',
    });
    const r2 = recorder();
    r2.set({ interface_locale: 'pt-BR' });
    expect(
      buildTrace(input({ intake: r2.snapshot() }, null)).request.language
    ).toBe('pt');
    expect(buildTrace(input({}, null)).request).toMatchObject({
      interface_locale: 'en-US',
      language: 'en',
    });
  });

  it('counts the stages of the intake path and then its own, in whole milliseconds', async () => {
    const r = recorder();
    await r.stage('GATE', async () => 1);
    const trace = buildTrace(
      input(
        { intake: r.snapshot(), stages: [{ name: 'MODEL', ms: 9.6 }] },
        null
      )
    );
    expect(trace.time.stages.map((s) => s.name)).toEqual(['GATE', 'MODEL']);
    expect(trace.time.stages[1]!.ms).toBe(10);
    expect(trace.time.total_ms).toBe(12);
    expect(trace.time.started_at).toBe('2026-09-18T20:57:00.000Z');
  });

  it('the model group carries the calls, the sums and what the ledger charged', () => {
    const call = (cost: number) =>
      callRecordOf('ANSWER', {
        ok: true,
        text: '{}',
        model: 'vendor/model',
        served_model: null,
        host: null,
        generation_id: null,
        response_mode: 'JSON_SCHEMA',
        finish_reason: 'stop',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          cached_tokens: 2,
          cost_micro_usd: cost,
          cost_flag: null,
        },
        latency_ms: 1,
        attempts: 1,
      });
    const trace = buildTrace(
      input({
        calls: [call(100), call(40)],
        model: 'vendor/model',
        promptVersion: 'prompts.v1',
        fallbackUsed: true,
        unitsCharged: 130,
        cycleBlockSha256: SHA,
        components: {
          SYSTEM_RULES: 1,
          BOARD_SYNTHESIS: 2,
          OHLC: 3,
          CHART: 4,
          READINGS_ZONES: 5,
          KNOWLEDGE: 6,
          PROFILE_EVENTS: 7,
          HISTORY: 8,
          QUESTION: 9,
          ANSWER: 10,
        },
      })
    );
    expect(trace.model).toMatchObject({
      model: 'vendor/model',
      prompt_version: 'prompts.v1',
      fallback_used: true,
      cycle_block_sha256: SHA,
      units_charged: 130,
      cost_micro_usd: 140,
      tokens: { prompt: 20, completion: 10, cached: 4 },
    });
    expect(trace.model.calls).toHaveLength(2);
    expect(trace.model.components.OHLC).toBe(3);
  });

  it('a request with no model has zero components and no sums', () => {
    const trace = buildTrace(input({ outcome: 'FIXED_ANSWER', shape: 'NONE' }));
    expect(Object.values(trace.model.components).every((n) => n === 0)).toBe(
      true
    );
    expect(trace.model).toMatchObject({
      model: null,
      cost_micro_usd: null,
      tokens: { prompt: null },
    });
  });

  it('copies the calls, so a later change to the hold cannot change the row', () => {
    const calls = [
      callRecordOf('ANSWER', {
        ok: false,
        code: 'TIMEOUT',
        model: 'm/x',
        latency_ms: 1,
        attempts: 1,
      }),
    ];
    const trace = buildTrace(input({ calls }));
    calls[0]!.model = 'changed/x';
    expect(trace.model.calls[0]!.model).toBe('m/x');
  });

  it('the quiet checks say exactly this, and nothing else', () => {
    const zeros = (words: string[]) =>
      Object.fromEntries(words.map((w) => [w, 0]));
    expect(quietChecks('REPORT1', null, null, true)).toEqual({
      answer_gate: null,
      shape: 'REPORT1',
      schema_retries: 0,
      numbers: {
        extracted: 0,
        matched: 0,
        violations: 0,
        flagged: 0,
        classes: zeros(['PRICE', 'DISTANCE', 'PCT', 'RATIO', 'TIME', 'COUNT']),
      },
      wording: {
        violations: 0,
        categories: zeros([
          'ADVICE',
          'PROBABILITY',
          'GUARANTEE',
          'URGENCY',
          'UNLISTED_NEWS',
          'DIRECTION_WORD',
        ]),
        fixed_answer: false,
      },
      regenerations: 0,
      direction_equals_syn: true,
      fixed_reason: null,
    });
  });

  it('a stage that took no time, and a request that took none, are zero', () => {
    const r = recorder();
    const trace = buildTrace(
      input(
        {
          intake: r.snapshot(),
          stages: [{ name: 'MODEL', ms: 0 }],
          totalMs: 0,
        },
        null
      )
    );
    expect(trace.time.stages).toEqual([{ name: 'MODEL', ms: 0 }]);
    expect(trace.time.total_ms).toBe(0);
    const negative = buildTrace(
      input({ stages: [{ name: 'MODEL', ms: -4 }], totalMs: -9 }, null)
    );
    expect(negative.time.stages).toEqual([{ name: 'MODEL', ms: 0 }]);
    expect(negative.time.total_ms).toBe(0);
  });

  it('an intake stage that took no time is zero, and one that took a fraction is rounded', async () => {
    let t = 0;
    const clock = () => t;
    const r = new TraceRecorder({
      requestId: 'x',
      route: 'typed',
      method: 'POST',
      startedAt: '2026-09-18T20:57:00.000Z',
      clock,
    });
    await r.stage('GATE', async () => 1);
    await r.stage('DOOR', async () => {
      t += 2.6;
    });
    const trace = buildTrace(input({ intake: r.snapshot() }, null));
    expect(trace.time.stages.map((s) => [s.name, s.ms])).toEqual([
      ['GATE', 0],
      ['DOOR', 3],
      ['MODEL', 10],
    ]);
  });

  it('carries the flags of the data and the flags of the question', () => {
    const packet = golden();
    packet.data.flags = ['SENSORS_NOT_LIVE'];
    packet.question.flags = ['TERM_DROPPED'];
    const trace = buildTrace(input({}, packet));
    expect(trace.data.flags).toEqual(['SENSORS_NOT_LIVE']);
    expect(trace.request.question_flags).toEqual(['TERM_DROPPED']);
    const r = recorder();
    r.set({ question_flags: ['AMBIGUOUS_NUMBER'] });
    expect(
      buildTrace(input({ intake: r.snapshot() }, null)).request.question_flags
    ).toEqual(['AMBIGUOUS_NUMBER']);
  });

  it('the quiet checks of a request with no model add up and say why', () => {
    const quiet = quietChecks('NONE', null, 'DATA_STALE', null);
    expect(quiet).toMatchObject({
      shape: 'NONE',
      schema_retries: 0,
      regenerations: 0,
      direction_equals_syn: null,
      fixed_reason: 'DATA_STALE',
      numbers: { extracted: 0, violations: 0, flagged: 0 },
      wording: { violations: 0, fixed_answer: false },
    });
    expect(Object.values(quiet.numbers.classes).every((n) => n === 0)).toBe(
      true
    );
    expect(Object.values(quiet.wording.categories).every((n) => n === 0)).toBe(
      true
    );
  });
});

describe('what a step with no checks reports', () => {
  it('an empty pass judged nothing and found nothing', () => {
    const pass = emptyPass();
    expect(pass.numbers).toMatchObject({
      extracted: 0,
      matched: 0,
      violations: [],
      needsRegeneration: false,
    });
    expect(pass.wording).toMatchObject({
      ok: true,
      violations: 0,
      findings: [],
    });
  });

  it('an empty pass says exactly this', () => {
    expect(emptyPass()).toEqual({
      numbers: {
        extracted: 0,
        exempt: 0,
        matched: 0,
        matchRate: 1,
        violations: [],
        classes: { PRICE: 0, DISTANCE: 0, PCT: 0, RATIO: 0, TIME: 0, COUNT: 0 },
        needsRegeneration: false,
      },
      wording: {
        ok: true,
        findings: [],
        violations: 0,
        categories: {
          ADVICE: 0,
          PROBABILITY: 0,
          GUARANTEE: 0,
          URGENCY: 0,
          UNLISTED_NEWS: 0,
          DIRECTION_WORD: 0,
        },
        languages: [],
        unsupportedLocale: false,
      },
    });
  });

  it('the events the prompt lists are the ones the assembler kept', () => {
    expect(eventsShownOf(10, 3)).toBe(7);
    expect(eventsShownOf(10, 0)).toBe(10);
    expect(eventsShownOf(0, 0)).toBe(0);
    expect(eventsShownOf(2, 5)).toBe(0);
  });

  it('with no primary model the step ends in the board-only answer, says so, and sends nothing', async () => {
    const logs: string[] = [];
    const step = await runAnswerStep({
      ports: {
        models: { primary: null, fallback: null },
        log: (code: string) => logs.push(code),
      } as never,
      hold: {} as never,
      packet: golden(),
      shape: 'REPORT1',
      chart: {
        decision: 'NOT_CALLED_FOR',
        note: null,
        reason: null,
        stamp: null,
        image: null,
      },
      dayBars: null,
      history: [],
      deadline: { signal: new AbortController().signal, atMs: 0 },
      now: () => 0,
    });
    expect(step).toMatchObject({
      ok: false,
      reason: 'MODEL_UNAVAILABLE',
      dictionary: null,
      components: null,
      cycleBlockSha256: null,
      promptVersion: 'prompts.v1',
      fallbackUsed: false,
      record: { schemaRetries: 0, second: null },
    });
    expect(logs).toEqual(['NO_PRIMARY_MODEL']);
  });

  it('the synthesis bias is the reading, or none', () => {
    expect(synthesisBias(goldenPacket('01'))).toBe('LONG');
    const none = JSON.parse(JSON.stringify(goldenPacket('01'))) as IntakePacket;
    none.readings.synthesis = null;
    expect(synthesisBias(none)).toBeNull();
    const odd = JSON.parse(JSON.stringify(goldenPacket('01'))) as IntakePacket;
    odd.readings.synthesis!.reading['bias'] = 'SIDEWAYS';
    expect(synthesisBias(odd)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The hold
// ---------------------------------------------------------------------------

const BOUNDS: RequestBounds = {
  understand: boundOf(UNDERSTAND_TARGET, 5_000),
  answer: boundOf(PRICED_A, 19_600, 1_500),
};

function holdWorld(
  over: {
    bounds?: (kind: 'TYPED' | 'INSTANT') => RequestBounds | null;
    requestId?: () => string | null;
    signal?: AbortSignal;
    allowance?: number | null;
    meter?: Meter;
  } = {}
) {
  const ledger = new LedgerModel();
  ledger.addUser('u1');
  const port = createLedgerPort({ client: ledger });
  const now = () => Date.UTC(2026, 8, 18, 21, 0, 0);
  const meter =
    over.meter ??
    createMeter({
      ledger: port,
      now,
      allowanceOf: (tier) =>
        tier === 'PRO'
          ? over.allowance === undefined
            ? 5_000_000
            : over.allowance
          : 0,
      floorOf: () => 1,
    });
  const logs: string[] = [];
  const details: [string, unknown][] = [];
  const inner = { precheck: jest.fn(async () => ({ allowed: true })) };
  const hold = new Hold({
    meter,
    bounds:
      over.bounds ??
      ((kind) => (kind === 'TYPED' ? BOUNDS : { ...BOUNDS, understand: null })),
    requestId: over.requestId ?? (() => 'req-1'),
    ...(over.signal === undefined ? {} : { signal: over.signal }),
    log: (code, detail) => {
      logs.push(code);
      details.push([code, detail]);
    },
  });
  return { hold, ledger, inner, logs, details, quota: hold.wrapQuota(inner) };
}
const ask = { userId: 'u1', tier: 'PRO', kind: 'TYPED' as const };

describe('the hold before anything happens', () => {
  it('holds nothing, allows nothing, refuses nothing and has seen nothing', () => {
    const w = holdWorld();
    expect(w.hold).toMatchObject({
      held: false,
      regenerationAllowed: false,
      reservedUnits: 0,
      quota: null,
      duplicate: null,
      aborted: false,
      dispatched: false,
      failure: null,
      spent: [],
      records: [],
    });
    expect(new HoldStopped('WHY').name).toBe('HoldStopped');
    expect(new HoldStopped('WHY').why).toBe('WHY');
  });
});

describe('the hold: taking it', () => {
  it('runs the floor check first, then holds the worst case', async () => {
    const w = holdWorld();
    await expect(w.quota.precheck(ask)).resolves.toEqual({ allowed: true });
    expect(w.inner.precheck).toHaveBeenCalledWith(ask);
    expect(w.hold.held).toBe(true);
    expect(w.hold.reservedUnits).toBeGreaterThan(0);
    expect(w.hold.regenerationAllowed).toBe(true);
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      request_id: 'req-1',
      status: 'RESERVED',
      user_id: 'u1',
    });
  });

  it('holds nothing when the floor check says no, and says the same', async () => {
    const w = holdWorld();
    w.inner.precheck.mockResolvedValue({ allowed: false });
    await expect(w.quota.precheck(ask)).resolves.toEqual({ allowed: false });
    expect(w.hold.held).toBe(false);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('an instant prompt holds the answer alone', async () => {
    const w = holdWorld();
    const typed = holdWorld();
    await w.quota.precheck({ ...ask, kind: 'INSTANT' });
    await typed.quota.precheck(ask);
    expect(w.hold.reservedUnits).toBeLessThan(typed.hold.reservedUnits);
  });

  it('a balance that covers one answer and not two is held without the regeneration', async () => {
    const w = holdWorld({ allowance: 50_000 });
    await w.quota.precheck(ask);
    expect(w.hold.held).toBe(true);
    expect(w.hold.regenerationAllowed).toBe(false);
  });

  it('a balance that covers neither is a refusal with the numbers', async () => {
    const w = holdWorld({ allowance: 10_000 });
    await expect(w.quota.precheck(ask)).resolves.toEqual({ allowed: false });
    expect(w.hold.held).toBe(false);
    expect(w.hold.quota).toMatchObject({
      limitUnits: 10_000,
      availableUnits: 10_000,
    });
    expect(w.hold.quota!.neededUnits).toBeGreaterThan(10_000);
  });

  it('an allowance that is not set is a refusal without numbers', async () => {
    const w = holdWorld({ allowance: null });
    await expect(w.quota.precheck(ask)).resolves.toEqual({ allowed: false });
    expect(w.hold.quota).toBeNull();
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('stops the gate, by throwing, when nobody can price the request', async () => {
    const w = holdWorld({ bounds: () => null });
    await expect(w.quota.precheck(ask)).rejects.toBeInstanceOf(HoldStopped);
    expect(w.hold.failure).toBe('NO_MODEL');
    expect(w.ledger.reservations.size).toBe(0);
    const unpriced = holdWorld({
      bounds: () => ({
        understand: null,
        answer: boundOf({ ...PRICED_A, price_in: null }, 100),
      }),
    });
    await expect(unpriced.quota.precheck(ask)).rejects.toBeInstanceOf(
      HoldStopped
    );
    expect(unpriced.hold.failure).toBe('HOLD_PRICE_UNKNOWN');
  });

  it('stops the gate when there is no request id to hold under', async () => {
    const w = holdWorld({ requestId: () => null });
    await expect(w.quota.precheck(ask)).rejects.toMatchObject({
      why: 'NO_REQUEST_ID',
    });
    expect(w.hold.failure).toBe('NO_REQUEST_ID');
  });

  it('stops the gate for a trader the ledger does not know', async () => {
    const w = holdWorld();
    await expect(
      w.quota.precheck({ ...ask, userId: 'ghost' })
    ).rejects.toBeInstanceOf(HoldStopped);
    expect(w.hold.failure).toBe('HOLD_USER_NOT_FOUND');
  });

  it('knows a request that already has a hold, and runs nothing', async () => {
    const first = holdWorld();
    await first.quota.precheck(ask);
    const again = new Hold({
      meter: createMeter({
        ledger: createLedgerPort({ client: first.ledger }),
        now: () => Date.UTC(2026, 8, 18, 21, 0, 0),
        allowanceOf: () => 5_000_000,
        floorOf: () => 1,
      }),
      bounds: () => BOUNDS,
      requestId: () => 'req-1',
      log: () => undefined,
    });
    await expect(
      again.wrapQuota(first.inner).precheck(ask)
    ).rejects.toMatchObject({ why: 'DUPLICATE' });
    expect(again.duplicate).toBe('RESERVED');
    expect(again.held).toBe(false);
    // it did not touch the first request's hold
    expect(await again.end()).toEqual({ settlement: null, release: null });
    expect(first.ledger.reservations.get('req-1')!.status).toBe('RESERVED');
  });

  it('a client that has already left holds nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const w = holdWorld({ signal: controller.signal });
    await expect(w.quota.precheck(ask)).rejects.toMatchObject({
      why: 'CLIENT_ABORTED',
    });
    expect(w.hold.aborted).toBe(true);
    expect(w.ledger.reservations.size).toBe(0);
  });
});

describe('the hold: the client leaving', () => {
  it('ends the request at a checkpoint until a model has been called, and not after', () => {
    const controller = new AbortController();
    const w = holdWorld({ signal: controller.signal });
    expect(w.hold.checkpoint()).toBe(false);
    controller.abort();
    expect(w.hold.checkpoint()).toBe(true);
    expect(w.hold.aborted).toBe(true);

    const late = holdWorld({ signal: controller.signal });
    late.hold.markDispatched();
    expect(late.hold.checkpoint()).toBe(false);
    expect(late.hold.aborted).toBe(false);
    expect(late.hold.dispatched).toBe(true);
  });

  it('the Understand port is not called for a client that has left, and marks the first call as sent', async () => {
    const controller = new AbortController();
    const w = holdWorld({ signal: controller.signal });
    const inner = { understand: jest.fn(async () => ({ ok: 1 })) };
    const wrapped = w.hold.wrapUnderstand(inner);
    await expect(
      wrapped.understand({ version: 'understand-1', system: 's', user: 'u' })
    ).resolves.toEqual({ ok: 1 });
    expect(w.hold.dispatched).toBe(true);
    // a second call after the first was sent goes through whatever the client does
    controller.abort();
    await expect(
      wrapped.understand({ version: 'understand-1', system: 's', user: 'u' })
    ).resolves.toEqual({ ok: 1 });

    const gone = holdWorld({ signal: controller.signal });
    const innerGone = { understand: jest.fn(async () => ({})) };
    await expect(
      gone.hold
        .wrapUnderstand(innerGone)
        .understand({ version: 'understand-1', system: 's', user: 'u' })
    ).rejects.toMatchObject({ why: 'CLIENT_ABORTED' });
    expect(innerGone.understand).not.toHaveBeenCalled();
    expect(gone.hold.aborted).toBe(true);
    expect(gone.hold.dispatched).toBe(false);
  });
});

describe('the hold: the calls and the end', () => {
  const ok = (cost: number | null, model = 'vendor/model') => ({
    ok: true as const,
    text: '{}',
    model,
    served_model: null,
    host: null,
    generation_id: null,
    response_mode: 'JSON_SCHEMA' as const,
    finish_reason: 'stop',
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      cached_tokens: 0,
      cost_micro_usd: cost,
      cost_flag: null,
    },
    latency_ms: 1,
    attempts: 1,
  });

  it('records a call that answered in the books and the trace, and one that failed in the trace only', async () => {
    const w = holdWorld();
    await w.quota.precheck(ask);
    w.hold.report('ANSWER', {
      ok: false,
      code: 'TIMEOUT',
      model: 'm/x',
      latency_ms: 1,
      attempts: 1,
    });
    w.hold.report('FALLBACK', ok(700));
    expect(w.hold.records.map((r) => r.role)).toEqual(['ANSWER', 'FALLBACK']);
    expect(w.hold.spent).toEqual([
      {
        model: 'vendor/model',
        costMicroUsd: 700,
        promptTokens: 10,
        completionTokens: 5,
      },
    ]);
    const ended = await w.hold.end();
    expect(ended.settlement).toMatchObject({ ok: true, chargedUnits: 700 });
    expect(w.ledger.reservations.get('req-1')).toMatchObject({
      status: 'SETTLED',
      actual_units: 700,
      model: 'vendor/model',
    });
  });

  it('does not record a call that was never sent, and logs which one and why', async () => {
    const w = holdWorld();
    w.hold.report('ANSWER', {
      ok: false,
      code: 'CONTEXT_TOO_LARGE',
      model: 'm/x',
      latency_ms: 0,
      attempts: 0,
    });
    w.hold.report('FALLBACK', { ...(ok(5) as object), attempts: 0 } as never);
    expect(w.hold.records).toEqual([]);
    expect(w.details).toEqual([
      ['MODEL_CALL_NOT_SENT', { role: 'ANSWER', code: 'CONTEXT_TOO_LARGE' }],
      ['MODEL_CALL_NOT_SENT', { role: 'FALLBACK', code: 'OK' }],
    ]);
  });

  it('an unknown cost charges the whole hold', async () => {
    const w = holdWorld();
    await w.quota.precheck(ask);
    w.hold.report('ANSWER', ok(null));
    const ended = await w.hold.end();
    expect(ended.settlement).toMatchObject({
      ok: true,
      chargedUnits: w.hold.reservedUnits,
    });
  });

  it('gives the hold back when no call was paid for', async () => {
    const w = holdWorld();
    await w.quota.precheck(ask);
    const ended = await w.hold.end();
    expect(ended).toMatchObject({ settlement: null, release: { ok: true } });
    expect(w.ledger.reservations.get('req-1')!.status).toBe('RELEASED');
  });

  it('ends nothing when there was no hold', async () => {
    const w = holdWorld();
    expect(await w.hold.end()).toEqual({ settlement: null, release: null });
    const noId = holdWorld({ requestId: () => null });
    await noId.quota.precheck(ask).catch(() => undefined);
    expect(await noId.hold.end()).toEqual({ settlement: null, release: null });
  });

  it('can change the outcome of the last call once the reply is read, and only if it was OK', () => {
    const w = holdWorld();
    w.hold.report('ANSWER', ok(1));
    w.hold.reclassifyLast('BAD_JSON');
    expect(w.hold.records[0]!.outcome).toBe('BAD_JSON');
    w.hold.reclassifyLast('BAD_SCHEMA');
    expect(w.hold.records[0]!.outcome).toBe('BAD_JSON');
    const none = holdWorld();
    expect(() => none.hold.reclassifyLast('BAD_JSON')).not.toThrow();
    none.hold.report('ANSWER', {
      ok: false,
      code: 'TIMEOUT',
      model: 'm/x',
      latency_ms: 1,
      attempts: 1,
    });
    none.hold.reclassifyLast('BAD_JSON');
    expect(none.hold.records[0]!.outcome).toBe('TIMEOUT');
  });

  it('records the Understand call through its hook', async () => {
    const w = holdWorld();
    await w.quota.precheck(ask);
    w.hold.onUnderstandCall(ok(250, 'understand/small'));
    expect(w.hold.records[0]).toMatchObject({
      role: 'UNDERSTAND',
      model: 'understand/small',
    });
    expect((await w.hold.end()).settlement).toMatchObject({
      ok: true,
      chargedUnits: 250,
    });
  });

  it('never throws at the end: a ledger that cannot be reached is a result', async () => {
    const w = holdWorld();
    await w.quota.precheck(ask);
    w.hold.report('ANSWER', ok(100));
    w.ledger.failNext = {
      sql: (await import('@/lib/platform/metering/ledger-store')).LEDGER_SQL
        .settle,
      code: '57P01',
    };
    const ended = await w.hold.end();
    expect(ended.settlement).toEqual({ ok: false, code: 'LEDGER_ERROR' });
    expect(ended.release).toBeNull();
  });
});
