/**
 * @jest-environment node
 */

import { buildRefusal } from '@/lib/intake';
import { OUTCOME_OF_KIND, inspectDelivered } from '@/lib/platform/delivered';

import {
  actionResult,
  answerResult,
  fixedResult,
  reportResult,
  withPath,
} from '../reply/helpers/fixtures';

const refusal = buildRefusal(
  'QUOTA_INSUFFICIENT',
  'en-US',
  'Your monthly allowance is used up.'
);

describe('what can be delivered, and the outcome each is traced as', () => {
  it('pins the outcome of every kind', () => {
    expect(OUTCOME_OF_KIND).toEqual({
      REPORT1: 'REPORT1',
      ANSWER: 'ANSWER',
      FIXED_ANSWER: 'FIXED_ANSWER',
      ACTION: 'OPEN_TRADE_SETUP',
      REFUSAL: 'REFUSED',
    });
  });

  it.each([
    ['REPORT1', reportResult()],
    ['ANSWER', answerResult()],
    ['FIXED_ANSWER', fixedResult()],
    ['ACTION', actionResult()],
    ['REFUSAL', refusal],
  ] as const)('accepts a %s and says what it is', (kind, reply) => {
    expect(inspectDelivered(reply)).toEqual({
      ok: true,
      kind,
      outcome: OUTCOME_OF_KIND[kind],
      reply,
    });
  });
});

describe('what it refuses', () => {
  it('a reply that fails its contract, with the issues of that contract', () => {
    const checked = inspectDelivered({ ...reportResult(), extra: 1 });
    expect(checked).toMatchObject({ ok: false, code: 'INVALID_REPLY' });
    expect(!checked.ok && checked.issues).toEqual([
      expect.objectContaining({ path: 'extra', code: 'UNKNOWN_KEY' }),
    ]);
    expect(inspectDelivered('text')).toMatchObject({
      ok: false,
      code: 'INVALID_REPLY',
    });
    expect(inspectDelivered(null)).toMatchObject({
      ok: false,
      code: 'INVALID_REPLY',
    });
  });

  it('a refusal that fails its contract is judged as a refusal, not as a result', () => {
    const checked = inspectDelivered({ ...refusal, extra: 1 });
    expect(checked).toMatchObject({ ok: false, code: 'INVALID_REPLY' });
    expect(!checked.ok && checked.issues.map((i) => i.path)).toEqual(['extra']);
  });

  it('a key called like the equity or the commission, named for what it is, wherever it is', () => {
    const equity = withPath(reportResult(), 'report.zones[0].equity', 1);
    const checked = inspectDelivered(equity);
    expect(checked).toMatchObject({ ok: false, code: 'FORBIDDEN_KEY' });
    expect(!checked.ok && checked.issues).toEqual([
      {
        path: 'report.zones[0].equity',
        code: 'FORBIDDEN_KEY',
        message: 'a reply never carries the equity or the commission',
      },
    ]);
    const nested = inspectDelivered({ ...refusal, commission: 4 });
    expect(nested).toMatchObject({ ok: false, code: 'FORBIDDEN_KEY' });
    expect(!nested.ok && nested.issues.map((i) => i.path)).toEqual([
      'commission',
    ]);
  });

  it('does not change what it is given', () => {
    const reply = reportResult();
    const before = JSON.stringify(reply);
    inspectDelivered(reply);
    inspectDelivered(withPath(reply, 'report.zones[0].equity', 1));
    expect(JSON.stringify(reply)).toBe(before);
  });
});
