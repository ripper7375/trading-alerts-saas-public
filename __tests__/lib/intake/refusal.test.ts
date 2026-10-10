/**
 * @jest-environment node
 */

import {
  GATE_ORDER,
  LOCALES,
  REFUSAL_CODES,
  REFUSAL_REPLY_MAX_CHARS,
  REFUSAL_STAGE,
  REFUSAL_STAGES,
  buildRefusal,
  stageOfRefusal,
  validateRefusal,
  type IntakeRefusal,
  type RefusalCode,
} from '@/lib/intake';

const REPLY = 'Fixed reply text.';

function issuesOf(value: unknown) {
  const result = validateRefusal(value);
  if (result.ok) throw new Error('the refusal was accepted');
  return result.issues;
}

describe('the refusal codes', () => {
  it('are these ten, and each has the stage that refuses it', () => {
    expect([...REFUSAL_CODES]).toEqual([
      'NOT_SIGNED_IN',
      'TIER_REQUIRED',
      'THREAD_INVALID',
      'PROFILE_NOT_SET',
      'QUOTA_INSUFFICIENT',
      'FEATURE_UNAVAILABLE',
      'QUESTION_EMPTY',
      'QUESTION_TOO_LONG',
      'UNDERSTANDING_FAILED',
      'OUT_OF_SCOPE',
    ]);
    expect([...REFUSAL_STAGES]).toEqual([
      'GATE',
      'DOOR',
      'UNDERSTAND',
      'SCOPE',
    ]);
    expect(Object.keys(REFUSAL_STAGE).sort()).toEqual(
      [...REFUSAL_CODES].sort()
    );
    expect(REFUSAL_STAGE.OUT_OF_SCOPE).toBe('SCOPE');
    expect(REFUSAL_STAGE.UNDERSTANDING_FAILED).toBe('UNDERSTAND');
    expect(REFUSAL_STAGE.QUESTION_TOO_LONG).toBe('DOOR');
    expect(REFUSAL_STAGE.QUESTION_EMPTY).toBe('DOOR');
    for (const code of GATE_ORDER) expect(stageOfRefusal(code)).toBe('GATE');
  });

  it('are decided by the gate in the order flag (not a refusal), session, tier, thread, profile, quota', () => {
    expect([...GATE_ORDER]).toEqual([
      'NOT_SIGNED_IN',
      'TIER_REQUIRED',
      'THREAD_INVALID',
      'PROFILE_NOT_SET',
      'QUOTA_INSUFFICIENT',
    ]);
  });
});

describe('buildRefusal and validateRefusal', () => {
  it('make a valid refusal for every code in every locale', () => {
    let count = 0;
    for (const code of REFUSAL_CODES) {
      for (const locale of LOCALES) {
        const refusal = buildRefusal(code, locale, REPLY);
        expect(refusal).toEqual({
          schema: 'intake-refusal/1',
          code,
          stage: REFUSAL_STAGE[code],
          reply_locale: locale,
          reply: REPLY,
        });
        const result = validateRefusal(JSON.parse(JSON.stringify(refusal)));
        expect(result.ok).toBe(true);
        count += 1;
      }
    }
    expect(count).toBe(190);
  });

  it('refuse every missing field, each on its own path', () => {
    const base = buildRefusal('OUT_OF_SCOPE', 'th', REPLY);
    for (const key of Object.keys(base)) {
      const broken: Record<string, unknown> = { ...base };
      delete broken[key];
      const issues = issuesOf(broken);
      expect(issues).toEqual([
        expect.objectContaining({ path: key, code: 'REQUIRED' }),
      ]);
    }
  });

  it('refuse a field that is not part of the refusal', () => {
    const issues = issuesOf({
      ...buildRefusal('TIER_REQUIRED', 'en-US', REPLY),
      user_id: 'u1',
    });
    expect(issues).toEqual([
      expect.objectContaining({ path: 'user_id', code: 'UNKNOWN_KEY' }),
    ]);
  });

  it('refuse a wrong schema id, code, stage and locale', () => {
    const base = buildRefusal('QUESTION_TOO_LONG', 'de', REPLY);
    expect(issuesOf({ ...base, schema: 'intake-refusal/2' })[0]).toMatchObject({
      path: 'schema',
    });
    expect(issuesOf({ ...base, code: 'NO_SUCH_CODE' })[0]).toMatchObject({
      path: 'code',
      code: 'NOT_ONE_OF',
    });
    expect(issuesOf({ ...base, stage: 'NOWHERE' })[0]).toMatchObject({
      path: 'stage',
      code: 'NOT_ONE_OF',
    });
    expect(issuesOf({ ...base, reply_locale: 'pt-br' })[0]).toMatchObject({
      path: 'reply_locale',
    });
    expect(issuesOf({ ...base, reply_locale: 'en' })[0]).toMatchObject({
      path: 'reply_locale',
    });
  });

  it('refuse a stage that is not the code’s own', () => {
    for (const code of REFUSAL_CODES) {
      for (const stage of REFUSAL_STAGES) {
        const refusal = { ...buildRefusal(code, 'fr', REPLY), stage };
        const result = validateRefusal(refusal);
        expect(result.ok).toBe(stage === REFUSAL_STAGE[code as RefusalCode]);
        if (!result.ok) {
          expect(result.issues[0]).toMatchObject({
            path: 'stage',
            code: 'INCONSISTENT',
          });
        }
      }
    }
  });

  it('refuse an empty reply, and one over the limit; accept one at it', () => {
    const base = buildRefusal('NOT_SIGNED_IN', 'ja', REPLY);
    expect(issuesOf({ ...base, reply: '' })[0]).toMatchObject({
      path: 'reply',
      code: 'TOO_SHORT',
    });
    expect(issuesOf({ ...base, reply: 5 })[0]).toMatchObject({
      path: 'reply',
      code: 'WRONG_TYPE',
    });
    expect(
      issuesOf({ ...base, reply: 'x'.repeat(REFUSAL_REPLY_MAX_CHARS + 1) })[0]
    ).toMatchObject({ path: 'reply', code: 'TOO_LONG' });
    expect(
      validateRefusal({ ...base, reply: 'x'.repeat(REFUSAL_REPLY_MAX_CHARS) })
        .ok
    ).toBe(true);
    expect(REFUSAL_REPLY_MAX_CHARS).toBe(600);
  });

  it('never throw on a value that is not an object', () => {
    for (const value of [null, undefined, 'x', 5, true, [], [1], () => 1]) {
      const result = validateRefusal(value);
      expect(result.ok).toBe(false);
    }
  });

  it('return the very object it was given when it is valid', () => {
    const refusal: IntakeRefusal = buildRefusal('PROFILE_NOT_SET', 'ko', REPLY);
    const result = validateRefusal(refusal);
    expect(result.ok && result.refusal).toBe(refusal);
  });
});
