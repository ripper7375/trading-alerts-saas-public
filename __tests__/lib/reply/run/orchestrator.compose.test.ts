/**
 * @jest-environment node
 */

/**
 * A reply the result contract refuses is never shown (build step 7 part 7a; ADR-054): the board-only
 * answer goes out instead, with the reason SCHEMA_FAILED, and the trace says so. The composers are
 * replaced here by ones that refuse, because the real ones only refuse what no checked model reply
 * can be, so no recorded reply reaches these two branches.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const refuse = { report1: false, answer: false };
jest.mock('@/lib/reply/report1/compose', () => {
  const actual = jest.requireActual('@/lib/reply/report1/compose');
  const refused = {
    ok: false,
    failures: [{ code: 'WRONG_TYPE', path: 'report', message: 'planted' }],
  };
  return {
    ...actual,
    composeReport1Result: (...args: unknown[]) =>
      refuse.report1 ? refused : actual.composeReport1Result(...args),
    composeAnswerResult: (...args: unknown[]) =>
      refuse.answer ? refused : actual.composeAnswerResult(...args),
  };
});

import type { FixedAnswerResult } from '@/lib/reply/contracts/result';

import { echoResult } from '../../intake/helpers/ports';
import { buildWorld, run } from './helpers/world';

beforeEach(() => {
  refuse.report1 = false;
  refuse.answer = false;
});

const checksGroup = (rows: Map<string, { checks_group: unknown }>) =>
  [...rows.values()][0]!.checks_group as { fixed_reason: string | null };

describe('a Report 1 the contract refuses', () => {
  it('goes out as the board-only answer, SCHEMA_FAILED, and the trace says why', async () => {
    refuse.report1 = true;
    const w = await buildWorld();
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.kind).toBe('FIXED_ANSWER');
    expect(result.fixed.reason).toBe('SCHEMA_FAILED');
    expect(result.provenance.model).toBeNull();
    // the model was paid for and the charge stands
    expect(w.primary?.count).toBe(1);
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
    });
    const row = [...w.traces.rows.values()][0]!;
    expect(row.outcome).toBe('FIXED_ANSWER');
    expect(checksGroup(w.traces.rows as never).fixed_reason).toBe(
      'SCHEMA_FAILED'
    );
  });
});

describe('a short answer the contract refuses', () => {
  it('goes out as the board-only answer, SCHEMA_FAILED, and the trace says why', async () => {
    refuse.answer = true;
    const w = await buildWorld({
      intake: { understand: echoResult('what is a corridor', 'EXPLAIN') },
      primary: [
        {
          kind: 'REPLY',
          text: JSON.stringify({
            locale: 'en-US',
            text: 'A band.',
            cites: ['MCD1'],
            action: null,
          }),
        },
      ],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as FixedAnswerResult;
    expect(result.kind).toBe('FIXED_ANSWER');
    expect(result.fixed.reason).toBe('SCHEMA_FAILED');
    expect(w.primary?.count).toBe(1);
    expect(checksGroup(w.traces.rows as never).fixed_reason).toBe(
      'SCHEMA_FAILED'
    );
  });
});
