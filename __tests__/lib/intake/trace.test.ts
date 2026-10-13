/**
 * @jest-environment node
 */

/**
 * The trace of an intake request (build step 6 part 5; architecture 4.11 item 10 and 7.4).
 */

import { canonicalSha256 } from '@/lib/intake';
import {
  INTAKE_VERSION,
  ROUTING_VERSION,
  TRACE_STAGES,
  TraceRecorder,
  type IntakePacket,
} from '@/lib/intake';

import { instant, newTrace, run, typed } from './helpers/ports';

function recorder(): { recorder: TraceRecorder; tick: (ms: number) => void } {
  let now = 1_000;
  return {
    recorder: new TraceRecorder({
      requestId: 'req-1',
      route: 'typed',
      method: 'POST',
      startedAt: '2026-10-13T00:00:00.000Z',
      clock: () => now,
    }),
    tick: (ms) => {
      now += ms;
    },
  };
}

describe('TraceRecorder', () => {
  it('names the request, the route and the start, and starts as an error until something says otherwise', () => {
    const { recorder: r } = recorder();
    expect(r.requestId).toBe('req-1');
    const trace = r.snapshot();
    expect(trace).toMatchObject({
      request_id: 'req-1',
      route: 'typed',
      method: 'POST',
      started_at: '2026-10-13T00:00:00.000Z',
      outcome: 'ERROR',
      tier: null,
      refusal_code: null,
      refusal_stage: null,
      interface_locale: null,
      language: null,
      reply_locale: null,
      intent: null,
      m_star: [],
      chunk_ids: [],
      index_build_id: null,
      knowledge_status: null,
      cycle_slot: null,
      data_status: null,
      sensor_statuses: {},
      synthesis_rule: null,
      intake_version: null,
      routing_version: null,
      packet_sha256: null,
      question_flags: [],
      problems: [],
      route_notes: [],
      timings: { total_ms: 0, stages: [] },
    });
  });

  it('charges nothing in step 6: units_charged is the number 0 on every snapshot', () => {
    const { recorder: r } = recorder();
    expect(r.snapshot().units_charged).toBe(0);
    r.set({ outcome: 'PACKET' });
    expect(r.snapshot().units_charged).toBe(0);
  });

  it('times a stage by the clock, in milliseconds, in the order the stages finish', async () => {
    const { recorder: r, tick } = recorder();
    await r.stage('GATE', async () => tick(7));
    await r.stage('SNAPSHOT', async () => tick(30));
    tick(4);
    const trace = r.snapshot();
    expect(trace.timings.stages).toEqual([
      { name: 'GATE', ms: 7 },
      { name: 'SNAPSHOT', ms: 30 },
    ]);
    expect(trace.timings.total_ms).toBe(41);
    expect(r.stageNames).toEqual(['GATE', 'SNAPSHOT']);
  });

  it('returns what the stage returned', async () => {
    const { recorder: r } = recorder();
    await expect(r.stage('BOARD', async () => 42)).resolves.toBe(42);
  });

  it('records the time of a stage that throws, and lets the error through', async () => {
    const { recorder: r, tick } = recorder();
    await expect(
      r.stage('ROUTE', async () => {
        tick(9);
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(r.snapshot().timings.stages).toEqual([{ name: 'ROUTE', ms: 9 }]);
  });

  it('never reports a negative duration, even if the clock steps back', async () => {
    const { recorder: r, tick } = recorder();
    await r.stage('GATE', async () => tick(-50));
    expect(r.snapshot().timings.stages[0]?.ms).toBe(0);
    expect(r.snapshot().timings.total_ms).toBe(0);
  });

  it('adds and replaces fields, and keeps the ones it was not told about', () => {
    const { recorder: r } = recorder();
    r.set({ tier: 'PRO', language: 'de' });
    r.set({ language: 'ja' });
    expect(r.snapshot()).toMatchObject({ tier: 'PRO', language: 'ja' });
  });

  it('keeps a problem code once, in the order it first appeared', () => {
    const { recorder: r } = recorder();
    r.problem('B');
    r.problem('A');
    r.problem('B');
    r.problems(['C', 'A', 'D']);
    expect(r.snapshot().problems).toEqual(['B', 'A', 'C', 'D']);
  });

  it('hands out copies: changing a snapshot does not change the recorder', async () => {
    const { recorder: r } = recorder();
    r.set({ m_star: ['MCD1'], chunk_ids: ['c'], question_flags: ['F'] });
    r.problem('P');
    await r.stage('GATE', async () => undefined);
    const first = r.snapshot();
    first.m_star.push('MCD9');
    first.chunk_ids.push('x');
    first.question_flags.push('G');
    first.problems.push('Q');
    first.route_notes.push('N');
    first.sensor_statuses['MCD9'] = 'VALID';
    first.timings.stages.push({ name: 'BOARD', ms: 1 });
    const second = r.snapshot();
    expect(second.m_star).toEqual(['MCD1']);
    expect(second.chunk_ids).toEqual(['c']);
    expect(second.question_flags).toEqual(['F']);
    expect(second.problems).toEqual(['P']);
    expect(second.route_notes).toEqual([]);
    expect(second.sensor_statuses).toEqual({});
    expect(second.timings.stages).toHaveLength(1);
  });

  it('has the stages of 4.2 in order, each once', () => {
    expect([...TRACE_STAGES]).toEqual([
      'GATE',
      'DOOR',
      'UNDERSTAND',
      'SCOPE',
      'SNAPSHOT',
      'DATA',
      'EVENTS',
      'BOARD',
      'ROUTE',
      'RETRIEVE',
      'ASSEMBLE',
    ]);
  });
});

describe('the trace of a request that became a packet (4.11 item 10)', () => {
  it('copies what the packet says of itself: language, intent, M*, chunk ids, build id, cycle, status, sensors, rule', async () => {
    const { result, trace } = await run(typed('Should I buy gold now'));
    if (result.kind !== 'PACKET') throw new Error('expected a packet');
    const p: IntakePacket = result.packet;
    expect(trace).toMatchObject({
      outcome: 'PACKET',
      refusal_code: null,
      refusal_stage: null,
      language: p.trace.language,
      reply_locale: p.trace.reply_locale,
      intent: p.trace.intent,
      m_star: p.trace.m_star,
      chunk_ids: p.trace.chunk_ids,
      index_build_id: p.trace.index_build_id,
      cycle_slot: p.trace.cycle_slot,
      data_status: p.trace.data_status,
      sensor_statuses: p.trace.sensor_statuses,
      synthesis_rule: p.trace.synthesis_rule,
      intake_version: INTAKE_VERSION,
      routing_version: ROUTING_VERSION,
      knowledge_status: 'OK',
      question_flags: p.question.flags,
      units_charged: 0,
    });
    // names the language, the intent, M*, the chunk ids and the build, none of them empty
    expect(trace.language).toBe('en');
    expect(trace.intent).toBe('DIRECTION');
    expect(trace.m_star.length).toBeGreaterThan(0);
    expect(trace.chunk_ids).toEqual(['D1-LEVELS', 'D2-MCD1-EXPANSION']);
    expect(trace.index_build_id).toBe('build-0001');
  });

  it('carries the fingerprint of the whole packet, trace included', async () => {
    const { result, trace } = await run(typed('Should I buy gold now'));
    if (result.kind !== 'PACKET') throw new Error('expected a packet');
    expect(trace.packet_sha256).toBe(result.packet_sha256);
    expect(trace.packet_sha256).toBe(await canonicalSha256(result.packet));
    expect(trace.packet_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('holds the fingerprint to the packet: change the packet and it is another', async () => {
    const { result } = await run(typed('Should I buy gold now'));
    if (result.kind !== 'PACKET') throw new Error('expected a packet');
    const changed = {
      ...result.packet,
      trace: { ...result.packet.trace, m_star: [] },
    };
    expect(await canonicalSha256(changed)).not.toBe(result.packet_sha256);
  });

  it('names the instant route and the interface language for an instant prompt', async () => {
    const { result, trace } = await run(instant('INSTANT_M15_INSPECT'), {
      locale: 'de',
    });
    if (result.kind !== 'PACKET') throw new Error('expected a packet');
    expect(trace).toMatchObject({
      route: 'instant',
      intent: 'INSTANT_M15_INSPECT',
      language: 'de',
      interface_locale: 'de',
      reply_locale: 'de',
      tier: 'PRO',
    });
  });

  it('times the stages in the order they ran, and the whole', async () => {
    const { trace } = await run(typed('Should I buy gold now'));
    expect(trace.timings.stages.map((s) => s.name)).toEqual([
      'GATE',
      'DOOR',
      'UNDERSTAND',
      'SCOPE',
      'SNAPSHOT',
      'DATA',
      'EVENTS',
      'BOARD',
      'ROUTE',
      'RETRIEVE',
      'ASSEMBLE',
    ]);
    for (const stage of trace.timings.stages) {
      expect(stage.ms).toBeGreaterThan(0);
    }
    expect(trace.timings.total_ms).toBeGreaterThanOrEqual(
      trace.timings.stages.reduce((sum, s) => sum + s.ms, 0)
    );
  });

  it('carries no user id, no text the trader typed and no secret', async () => {
    const question = 'Should I buy gold now please';
    const { result, trace } = await run(typed(question), {
      session: { userId: 'user-secret-4711', tier: 'PRO' },
    });
    expect(result.kind).toBe('PACKET');
    const text = JSON.stringify(trace);
    expect(text).not.toContain('user-secret-4711');
    expect(text).not.toContain(question);
    expect(text).not.toMatch(/equity|commission/i);
  });
});

describe('the trace of a request that ended in a refusal', () => {
  it('names the code, the stage and the locale of the reply', async () => {
    const { result, trace } = await run(typed('x'.repeat(501)), {
      locale: 'fr',
    });
    expect(result.kind).toBe('REFUSED');
    expect(trace).toMatchObject({
      outcome: 'REFUSED',
      refusal_code: 'QUESTION_TOO_LONG',
      refusal_stage: 'DOOR',
      interface_locale: 'fr',
      reply_locale: 'fr',
      packet_sha256: null,
      m_star: [],
      chunk_ids: [],
    });
  });

  it('is a disabled request with nothing else when the flag is off', async () => {
    const { result, trace } = await run(typed('hello'), { enabled: false });
    expect(result).toEqual({ kind: 'DISABLED' });
    expect(trace.outcome).toBe('DISABLED');
    expect(trace.tier).toBeNull();
  });

  it('a recorder from the test helper starts the clock fresh', () => {
    expect(newTrace().snapshot().timings.total_ms).toBeGreaterThan(0);
  });
});
