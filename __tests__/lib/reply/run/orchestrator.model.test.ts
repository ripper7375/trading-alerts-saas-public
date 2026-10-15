/**
 * @jest-environment node
 */

/**
 * The model step of the orchestrator (build step 7 part 7a; acceptance 5.14 items 5 and 6; ADR-055;
 * decisions D11 and D23): the fallback model, the deadline, the schema, the number and wording
 * checks, and the ONE extra call they share. The fixture model plays recorded and planted replies.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import type { Report1Model } from '@/lib/reply/contracts/report1';
import type {
  FixedAnswerResult,
  Report1Result,
} from '@/lib/reply/contracts/result';
import { badJson, plantLiteral } from '@/lib/reply/gateway/fixture';
import type { FixtureScript } from '@/lib/reply/gateway/fixture';
import { modelReportFor } from '../report1/helpers/report1-fixtures';
import { CORPUS } from '../checks/helpers/corpus';

import { buildWorld, manualDeadline, run } from './helpers/world';
import type { ReplyWorld } from './helpers/world';

const reply = (
  text: string,
  cost = 2_500
): Extract<FixtureScript, { kind: 'REPLY' }> => ({
  kind: 'REPLY',
  text,
  usage: {
    prompt_tokens: 14_000,
    completion_tokens: 300,
    cost_micro_usd: cost,
  },
});
const FAIL = (code: string): FixtureScript => ({
  kind: 'FAIL',
  code: code as never,
});

/** The model's good report for the world's cycle, and the same with something planted in it. */
async function texts(): Promise<{
  good: string;
  wrongPrice: string;
  banned: string;
  model: Report1Model;
}> {
  // the world builds the same packet; the report is made from it once here for the planted variants
  const probe = await buildWorld();
  const model = modelReportFor(probe.packet, probe.dictionary);
  const good = JSON.stringify(model);
  const banned: Report1Model = {
    ...model,
    rationale: [
      { text: CORPUS['en']!.never.GUARANTEE.bad, cites: ['SYN'] },
      ...model.rationale.slice(1),
    ],
  };
  return {
    good,
    wrongPrice: plantLiteral(good, '{LAST_PRICE}', '4999.99'),
    banned: JSON.stringify(banned),
    model,
  };
}

const roles = (w: ReplyWorld): string[] => {
  const row = [...w.traces.rows.values()][0]!;
  return (row.model_group as { calls: { role: string }[] }).calls.map(
    (c) => c.role
  );
};
const checksGroup = (w: ReplyWorld) =>
  [...w.traces.rows.values()][0]!.checks_group as {
    regenerations: number;
    schema_retries: number;
    fixed_reason: string | null;
    numbers: { violations: number; flagged: number };
    wording: { violations: number; fixed_answer: boolean };
  };

describe('the fallback model (ADR-055)', () => {
  it('asks the fallback when the primary fails, and charges only the reply that was made', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [FAIL('HTTP_503')],
      fallback: [reply(t.good, 3_100)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as Report1Result;
    expect(result.kind).toBe('REPORT1');
    expect(result.provenance.model).toBe('fixture-b/recorded');
    expect(w.primary?.count).toBe(1);
    expect(w.fallback?.count).toBe(1);
    // the failed call is in the trace and not in the books
    expect(roles(w)).toEqual(['ANSWER', 'FALLBACK']);
    const row = [...w.traces.rows.values()][0]!;
    expect((row.model_group as { fallback_used: boolean }).fallback_used).toBe(
      true
    );
    expect(row.units_charged).toBe(3_100);
    expect([...w.ledger.reservations.values()][0]!.actual_units).toBe(3_100);
    expect(row.model).toBe('fixture-b/recorded');
  });

  it('sends the board-only fixed answer when both models fail', async () => {
    const w = await buildWorld({
      primary: [FAIL('TIMEOUT')],
      fallback: [FAIL('HTTP_500')],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.kind).toBe('FIXED_ANSWER');
    expect(result.fixed.reason).toBe('MODEL_UNAVAILABLE');
    // live data: the direction and the board are shown, the model's words are not
    expect(result.fixed.direction).not.toBeNull();
    expect(result.fixed.board.length).toBeGreaterThan(0);
    expect(result.provenance.model).toBeNull();
    expect(w.primary?.count).toBe(1);
    expect(w.fallback?.count).toBe(1);
    // nothing was answered, so only the Understand call was charged
    expect([...w.ledger.reservations.values()][0]!.actual_units).toBe(300);
    expect(checksGroup(w).fixed_reason).toBe('MODEL_UNAVAILABLE');
    expect([...w.traces.rows.values()][0]!.outcome).toBe('FIXED_ANSWER');
  });

  it('sends the board-only answer when there is a primary and no fallback and it fails', async () => {
    const w = await buildWorld({ primary: [FAIL('UNREACHABLE')] });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('FIXED_ANSWER');
    expect([...w.ledger.reservations.values()][0]!.status).toBe('RELEASED');
  });

  it('sends the board-only answer at the deadline, and says so in the trace', async () => {
    const deadline = manualDeadline();
    const w = await buildWorld({ deadline });
    deadline.fire();
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.fixed.reason).toBe('DEADLINE');
    const row = [...w.traces.rows.values()][0]!;
    expect((row.time_group as { deadline_hit: boolean }).deadline_hit).toBe(
      true
    );
    // a call that was never sent costs nothing; the Understand call was
    expect(row.units_charged).toBe(300);
  });

  it('cancels the deadline when the run ends', async () => {
    const w = await buildWorld();
    await run(w, { kind: 'INSTANT' });
    expect(w.calls.deadlines).toBe(1);
    expect(w.calls.cancelled).toBe(1);
    const refused = await buildWorld({ intake: { session: null } });
    await run(refused, { kind: 'INSTANT' });
    expect(refused.calls.cancelled).toBe(1);
  });
});

describe('the number check and the one regeneration (5.14 item 5)', () => {
  it('catches a wrong price, asks once, and delivers the corrected reply', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply(t.wrongPrice, 2_500), reply(t.good, 2_700)],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as Report1Result;
    expect(result.checks).toEqual({ numbers_flagged: 0, regenerations: 1 });
    expect(result.report.headline).not.toContain('4,999.99');
    expect(w.primary?.count).toBe(2);
    expect(roles(w)).toEqual(['UNDERSTAND', 'ANSWER', 'REGENERATE']);
    expect(checksGroup(w)).toMatchObject({
      regenerations: 1,
      schema_retries: 0,
      numbers: { violations: 1, flagged: 0 },
    });
    // both replies were paid for, and the Understand call
    expect([...w.ledger.reservations.values()][0]!.actual_units).toBe(
      300 + 2_500 + 2_700
    );
    // the second call carried the model's own words back, and the instruction
    const second = w.primary!.calls[1]!.messages;
    expect(second.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    const instruction = second[3]!.content as string;
    expect(instruction).toContain('4999.99');
    expect(instruction).not.toContain('What is the direction of gold now');
  });

  it('flags a number that is still wrong after the regeneration, and shows the reply', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply(t.wrongPrice), reply(t.wrongPrice)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as Report1Result;
    expect(result.kind).toBe('REPORT1');
    expect(result.checks).toEqual({ numbers_flagged: 1, regenerations: 1 });
    expect(result.report.headline).not.toContain('4999.99');
    expect(checksGroup(w)).toMatchObject({
      regenerations: 1,
      numbers: { violations: 1, flagged: 1 },
    });
    expect(w.primary?.count).toBe(2);
  });

  it('flags at once, with no second call, when the hold covers one answer and no more', async () => {
    const t = await texts();
    // enough for one answer (about 40,000), not for two (about 80,000)
    const w = await buildWorld({
      allowance: 50_000,
      primary: [reply(t.wrongPrice), reply(t.good)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as Report1Result;
    expect(result.checks).toEqual({ numbers_flagged: 1, regenerations: 0 });
    expect(w.primary?.count).toBe(1);
    expect(roles(w)).toEqual(['ANSWER']);
  });

  it('a regeneration that fails leaves the first reply to be judged as it stands, and counts the call', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply(t.wrongPrice), FAIL('TIMEOUT')],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    expect((out.result as Report1Result).checks).toEqual({
      numbers_flagged: 1,
      regenerations: 1,
    });
    expect(roles(w)).toEqual(['ANSWER', 'REGENERATE']);
    expect(checksGroup(w).regenerations).toBe(1);
    // the failed call is not charged
    expect([...w.ledger.reservations.values()][0]!.actual_units).toBe(2_500);
  });
});

describe('the wording check (5.14 item 6)', () => {
  it('replaces a reply that breaks a wording rule twice with the fixed answer', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply(t.banned), reply(t.banned)],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.kind).toBe('FIXED_ANSWER');
    expect(result.fixed.reason).toBe('WORDING_FAILED');
    // the model's words are not in what the trader reads
    expect(JSON.stringify(result)).not.toContain(
      CORPUS['en']!.never.GUARANTEE.bad
    );
    expect(checksGroup(w)).toMatchObject({
      regenerations: 1,
      wording: { fixed_answer: true },
      fixed_reason: 'WORDING_FAILED',
    });
    expect(checksGroup(w).wording.violations).toBeGreaterThan(0);
    // both replies were paid for
    expect([...w.ledger.reservations.values()][0]!.actual_units).toBe(
      300 + 2_500 + 2_500
    );
  });

  it('delivers the corrected reply when the second one is clean', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply(t.banned), reply(t.good)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('REPORT1');
    expect(checksGroup(w)).toMatchObject({
      regenerations: 1,
      wording: { fixed_answer: false },
    });
    const instruction = w.primary!.calls[1]!.messages[3]!.content as string;
    expect(instruction).toContain('GUARANTEE');
  });

  it('goes straight to the fixed answer when there is no hold for a second call', async () => {
    const t = await texts();
    const w = await buildWorld({
      allowance: 50_000,
      primary: [reply(t.banned), reply(t.good)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('FIXED_ANSWER');
    expect(w.primary?.count).toBe(1);
  });
});

describe('the schema', () => {
  it('asks once more for JSON that does not parse, and delivers the second reply', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply(badJson(t.good)), reply(t.good)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('REPORT1');
    // the extra call went to the schema, not to a check: no REGENERATE call, one schema retry
    expect(roles(w)).toEqual(['ANSWER', 'ANSWER']);
    expect(checksGroup(w)).toMatchObject({
      schema_retries: 1,
      regenerations: 0,
    });
    expect(
      (out.kind === 'REPLY' ? out.result : null)?.checks.regenerations
    ).toBe(0);
    const outcomes = (
      [...w.traces.rows.values()][0]!.model_group as {
        calls: { outcome: string }[];
      }
    ).calls.map((c) => c.outcome);
    expect(outcomes).toEqual(['BAD_JSON', 'OK']);
  });

  it('a reply that parses but is not the schema (a direction field) is a schema failure', async () => {
    const t = await texts();
    const withDirection = JSON.stringify({ ...t.model, direction: 'SHORT' });
    const w = await buildWorld({
      primary: [reply(withDirection), reply(withDirection)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.fixed.reason).toBe('SCHEMA_FAILED');
    expect(checksGroup(w).schema_retries).toBe(1);
    const outcomes = (
      [...w.traces.rows.values()][0]!.model_group as {
        calls: { outcome: string }[];
      }
    ).calls.map((c) => c.outcome);
    expect(outcomes).toEqual(['BAD_SCHEMA', 'BAD_SCHEMA']);
  });

  it('spends the one extra call on the schema, so a wording failure after it is the fixed answer at once', async () => {
    const t = await texts();
    const w = await buildWorld({
      primary: [reply('{'), reply(t.banned), reply(t.good)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('FIXED_ANSWER');
    expect(w.primary?.count).toBe(2);
    expect(checksGroup(w)).toMatchObject({
      schema_retries: 1,
      regenerations: 0,
    });
  });

  it('is the fixed answer when there is no hold for a retry', async () => {
    const t = await texts();
    const w = await buildWorld({
      allowance: 50_000,
      primary: [reply('not json'), reply(t.good)],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('FIXED_ANSWER');
    expect(w.primary?.count).toBe(1);
    expect(checksGroup(w).fixed_reason).toBe('SCHEMA_FAILED');
  });

  it('a short answer is read against the answer schema', async () => {
    const w = await buildWorld({
      intake: {
        understand: {
          schema: 'understand-result/1',
          language: 'en',
          english: 'what is a corridor',
          intent: 'EXPLAIN',
          symbols: ['XAUUSD'],
          timeframes: [],
        },
      },
      primary: [
        reply(
          JSON.stringify({
            locale: 'en-US',
            text: 'A corridor is the band the price moves in.',
            cites: ['MCD1'],
            action: null,
          })
        ),
      ],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('ANSWER');
    const row = [...w.traces.rows.values()][0]!;
    expect(row.outcome).toBe('ANSWER');
    expect((row.checks_group as { shape: string }).shape).toBe('ANSWER');
  });
});
