/**
 * @jest-environment node
 */

import {
  PROFILE_BOUNDS,
  PROFILE_DEFAULTS,
  RISK_PCT_STEP,
  completeProfile,
  validateProfile,
} from '@/lib/engine4';
import type { ProfileIssue, TraderProfileInput } from '@/lib/engine4';

const base = (): TraderProfileInput => ({ ...PROFILE_DEFAULTS });

function issuesOf(candidate: Partial<TraderProfileInput>): ProfileIssue[] {
  const result = validateProfile(candidate);
  if (result.ok) throw new Error('expected the profile to be refused');
  return result.issues;
}

describe('the 6.2 defaults', () => {
  test('are exactly the table', () => {
    expect(PROFILE_DEFAULTS).toEqual({
      traderType: 'DAY_TRADER',
      style: 'TREND_FOLLOWING',
      maxRiskPct: '1.5',
      maxLeverage: '1.5',
      targetRrr: '1.75',
      equity: '5000',
      minSld: '13',
      commission: '4',
    });
  });

  test('are valid, and come back unchanged', () => {
    const result = validateProfile(base());
    expect(result).toEqual({ ok: true, profile: { ...PROFILE_DEFAULTS } });
  });

  test('cannot be edited by a caller', () => {
    expect(Object.isFrozen(PROFILE_DEFAULTS)).toBe(true);
  });

  test('the profile has eight metrics', () => {
    expect(Object.keys(PROFILE_DEFAULTS)).toHaveLength(8);
  });
});

describe('Max risk per trade: 0.5% to 2.0%', () => {
  test.each(['0.5', '0.75', '1.5', '2', '2.0', '1.2'])(
    '%s is accepted',
    (value) => {
      expect(validateProfile({ ...base(), maxRiskPct: value }).ok).toBe(true);
    }
  );

  test.each([
    ['0.49', 'BELOW_MIN'],
    ['0', 'BELOW_MIN'],
    ['-1', 'BELOW_MIN'],
    ['2.01', 'ABOVE_MAX'],
    ['5', 'ABOVE_MAX'],
  ])('%s is refused as %s', (value, code) => {
    expect(issuesOf({ ...base(), maxRiskPct: value })).toEqual([
      expect.objectContaining({ field: 'maxRiskPct', code }),
    ]);
  });

  test('the step is 0.25 (D5)', () => {
    expect(RISK_PCT_STEP).toBe('0.25');
  });
});

describe('Maximum leverage: a multiplier with a ceiling of 1:5', () => {
  test.each(['1', '1.5', '3', '4.2', '5', '5.0', '0.5'])(
    '%s is accepted',
    (value) => {
      expect(validateProfile({ ...base(), maxLeverage: value }).ok).toBe(true);
    }
  );

  test.each(['5.01', '6', '10', '100'])('%s is above the ceiling', (value) => {
    expect(issuesOf({ ...base(), maxLeverage: value })).toEqual([
      expect.objectContaining({
        field: 'maxLeverage',
        code: 'LEVERAGE_ABOVE_CEILING',
      }),
    ]);
  });

  test.each(['0', '-1'])('%s is not above zero', (value) => {
    expect(issuesOf({ ...base(), maxLeverage: value })).toEqual([
      expect.objectContaining({ field: 'maxLeverage', code: 'NOT_POSITIVE' }),
    ]);
  });

  test('the ceiling is 5', () => {
    expect(PROFILE_BOUNDS.maxLeverageCeiling).toBe('5');
  });
});

describe('Target RRR: 1.50 to 3.50, and 2.50 for a counter-trend style', () => {
  test.each(['1.5', '1.75', '2.85', '3.5'])(
    '%s is accepted for trend following',
    (value) => {
      expect(validateProfile({ ...base(), targetRrr: value }).ok).toBe(true);
    }
  );

  test.each([
    ['1.49', 'BELOW_MIN'],
    ['1', 'BELOW_MIN'],
    ['3.51', 'ABOVE_MAX'],
    ['4', 'ABOVE_MAX'],
  ])('%s is refused as %s', (value, code) => {
    expect(issuesOf({ ...base(), targetRrr: value })).toEqual([
      expect.objectContaining({ field: 'targetRrr', code }),
    ]);
  });

  test('Trend Countering is capped at 2.50', () => {
    const counter = { ...base(), style: 'TREND_COUNTERING' };
    expect(validateProfile({ ...counter, targetRrr: '2.5' }).ok).toBe(true);
    expect(issuesOf({ ...counter, targetRrr: '2.51' })).toEqual([
      expect.objectContaining({
        field: 'targetRrr',
        code: 'RRR_ABOVE_COUNTER_TREND_CAP',
      }),
    ]);
    expect(issuesOf({ ...counter, targetRrr: '3.5' })[0]?.code).toBe(
      'RRR_ABOVE_COUNTER_TREND_CAP'
    );
  });

  test('Both keeps 3.50 on the profile: the cap follows each setup (ADR-064)', () => {
    expect(
      validateProfile({ ...base(), style: 'BOTH', targetRrr: '3.5' }).ok
    ).toBe(true);
  });

  test('Trend Following may go to 3.50', () => {
    expect(validateProfile({ ...base(), targetRrr: '3.5' }).ok).toBe(true);
  });
});

describe('equity, Min SLD and commission', () => {
  test.each([
    ['equity', '0', 'NOT_POSITIVE'],
    ['equity', '-5000', 'NOT_POSITIVE'],
    ['minSld', '0', 'NOT_POSITIVE'],
    ['minSld', '-13', 'NOT_POSITIVE'],
    ['commission', '-0.01', 'NEGATIVE'],
  ] as const)('%s = %s is refused as %s', (field, value, code) => {
    expect(issuesOf({ ...base(), [field]: value })).toEqual([
      expect.objectContaining({ field, code }),
    ]);
  });

  test.each([
    ['equity', '0.01'],
    ['equity', '1000000000'],
    ['minSld', '0.01'],
    ['minSld', '21.5'],
    ['commission', '0'],
    ['commission', '7.25'],
  ] as const)('%s = %s is accepted', (field, value) => {
    expect(validateProfile({ ...base(), [field]: value }).ok).toBe(true);
  });
});

describe('the two choices', () => {
  test.each(['SCALPER', 'DAY_TRADER'])(
    'trader type %s is accepted',
    (value) => {
      expect(validateProfile({ ...base(), traderType: value }).ok).toBe(true);
    }
  );

  test.each(['TREND_FOLLOWING', 'TREND_COUNTERING', 'BOTH'])(
    'style %s is accepted',
    (value) => {
      expect(validateProfile({ ...base(), style: value }).ok).toBe(true);
    }
  );

  test('anything else is not an option', () => {
    expect(issuesOf({ ...base(), traderType: 'SWING' })).toEqual([
      expect.objectContaining({ field: 'traderType', code: 'UNKNOWN_OPTION' }),
    ]);
    expect(issuesOf({ ...base(), style: 'trend following' })).toEqual([
      expect.objectContaining({ field: 'style', code: 'UNKNOWN_OPTION' }),
    ]);
    expect(issuesOf({ ...base(), style: 3 })[0]?.code).toBe('UNKNOWN_OPTION');
  });
});

describe('missing and malformed values', () => {
  test('a missing field is REQUIRED', () => {
    const { equity: _equity, ...withoutEquity } = base();
    expect(issuesOf(withoutEquity)).toEqual([
      expect.objectContaining({ field: 'equity', code: 'REQUIRED' }),
    ]);
  });

  test('null and blank text are REQUIRED', () => {
    expect(issuesOf({ ...base(), equity: null })[0]?.code).toBe('REQUIRED');
    expect(issuesOf({ ...base(), equity: '' })[0]?.code).toBe('REQUIRED');
    expect(issuesOf({ ...base(), equity: '   ' })[0]?.code).toBe('REQUIRED');
    expect(issuesOf({ ...base(), traderType: undefined })[0]?.code).toBe(
      'REQUIRED'
    );
  });

  test.each(['abc', '1,000', '$5000', '1.2.3', 'NaN', 'Infinity', '1e999'])(
    '%j is not a number',
    (value) => {
      expect(issuesOf({ ...base(), equity: value })).toEqual([
        expect.objectContaining({ field: 'equity', code: 'NOT_A_DECIMAL' }),
      ]);
    }
  );

  test('a value of the wrong type is not a number', () => {
    expect(issuesOf({ ...base(), equity: {} })[0]?.code).toBe('NOT_A_DECIMAL');
    expect(issuesOf({ ...base(), equity: true })[0]?.code).toBe(
      'NOT_A_DECIMAL'
    );
    expect(issuesOf({ ...base(), equity: [5000] })[0]?.code).toBe(
      'NOT_A_DECIMAL'
    );
  });

  test('a whole number may arrive as a bigint', () => {
    const result = validateProfile({ ...base(), equity: 7500n, minSld: 20n });
    expect(result).toEqual({
      ok: true,
      profile: { ...PROFILE_DEFAULTS, equity: '7500', minSld: '20' },
    });
  });

  test('numbers are read by their decimal text', () => {
    const result = validateProfile({
      ...base(),
      maxRiskPct: 1.2,
      equity: 7500,
    });
    expect(result).toEqual({
      ok: true,
      profile: { ...PROFILE_DEFAULTS, maxRiskPct: '1.2', equity: '7500' },
    });
  });

  test('every problem is returned at once, in metric order', () => {
    const issues = issuesOf({
      traderType: 'NOPE',
      style: 'NOPE',
      maxRiskPct: '9',
      maxLeverage: '9',
      targetRrr: '9',
      equity: '-1',
      minSld: '0',
      commission: '-1',
    });
    expect(issues.map((issue) => issue.field)).toEqual([
      'traderType',
      'style',
      'maxRiskPct',
      'maxLeverage',
      'targetRrr',
      'equity',
      'minSld',
      'commission',
    ]);
  });

  test('a refused profile is never repaired: no profile comes back', () => {
    const result = validateProfile({ ...base(), maxLeverage: '9' });
    expect(result.ok).toBe(false);
    expect('profile' in result).toBe(false);
  });
});

describe('canonical output', () => {
  test('figures come back as canonical decimal text', () => {
    const result = validateProfile({
      ...base(),
      maxRiskPct: '1.50',
      maxLeverage: '01.5000',
      targetRrr: '1.750',
      equity: '5000.00',
      minSld: '13.0',
      commission: '4.00',
    });
    expect(result).toEqual({ ok: true, profile: { ...PROFILE_DEFAULTS } });
  });

  test('the result is JSON safe', () => {
    const result = validateProfile(base());
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe('completeProfile', () => {
  test('fills what is missing from the defaults', () => {
    expect(completeProfile({})).toEqual({
      ok: true,
      profile: { ...PROFILE_DEFAULTS },
    });
    expect(completeProfile({ equity: '12000', traderType: 'SCALPER' })).toEqual(
      {
        ok: true,
        profile: {
          ...PROFILE_DEFAULTS,
          equity: '12000',
          traderType: 'SCALPER',
        },
      }
    );
  });

  test('does not replace a value that is present and wrong', () => {
    const result = completeProfile({ maxLeverage: '9' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        expect.objectContaining({
          field: 'maxLeverage',
          code: 'LEVERAGE_ABOVE_CEILING',
        }),
      ]);
    }
  });

  test('a null is a wrong value, not a missing one', () => {
    const result = completeProfile({ equity: null });
    expect(result.ok).toBe(false);
  });
});
