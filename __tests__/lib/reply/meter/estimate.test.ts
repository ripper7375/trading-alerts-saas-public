/**
 * @jest-environment node
 */

/**
 * The worst case of a request, in units (build step 7 part 6; ADR-050; architecture 5.6). The
 * figures marked "by hand" were worked out on paper from a price, a count and a margin, not by the
 * function; the rest hold the function to its rules (rounding up, integers, an unpriced call has no
 * worst case, the floor is a lower bound).
 */

import {
  buildUnderstandRequest,
  UNDERSTAND_SYSTEM_PROMPT,
} from '@/lib/intake/text/understand';
import { MAX_GLOSSARY_HINTS } from '@/lib/intake';
import {
  DEFAULT_CALIBRATION,
  estimateRawTokens,
} from '@/lib/reply/context/tokens';
import {
  SYSTEM_RULES_TEXT,
  WORDING_GUIDE_TEXT,
} from '@/lib/reply/context/static-text';
import {
  COST_MARGIN_BP,
  MIN_FLOOR_UNITS,
  STATIC_PROMPT_TOKENS,
  UNDERSTAND_MAX_OUTPUT_TOKENS,
  UNDERSTAND_PROMPT_TOKENS_CEILING,
  boundOf,
  callWorstCaseMicroUsd,
  callWorstCaseUnits,
  estimateRequest,
  floorUnits,
  type CallBound,
} from '@/lib/reply/meter/estimate';
import { UNDERSTAND_MAX_TOKENS } from '@/lib/reply/gateway/understand-adapter';

const CAL = { marginBp: 1_000 };

/** A call: 10,000 prompt tokens, 2,048 out, USD 0.5 in and 2 out per million tokens, a 10% calibration margin. */
const ANSWER: CallBound = {
  price: { price_in: 0.5, price_out: 2 },
  promptTokens: 10_000,
  maxOutputTokens: 2_048,
  calibration: CAL,
};
/** The Understand call: 4,000 prompt tokens, 700 out, USD 0.1 in and 0.4 out. */
const UNDERSTAND: CallBound = {
  price: { price_in: 0.1, price_out: 0.4 },
  promptTokens: 4_000,
  maxOutputTokens: 700,
  calibration: CAL,
};

describe('the margin', () => {
  it('is 10% on the cost of a call, and the floor is one unit', () => {
    expect(COST_MARGIN_BP).toBe(1_000);
    expect(MIN_FLOOR_UNITS).toBe(1);
  });
});

describe('callWorstCaseMicroUsd', () => {
  it('prices the prompt at its most and the reply at its most (by hand: 10,556 micro-dollars)', () => {
    // prompt: 10,000 × 1.10 calibration margin = 11,000 tokens × 0.5 = 5,500
    // reply : 2,048 × 2.0 = 4,096; together 9,596; 10% cost margin: ceil(9,596 × 1.1) = 10,556
    expect(callWorstCaseMicroUsd(ANSWER)).toBe(10_556);
    expect(callWorstCaseUnits(ANSWER)).toBe(10_556);
  });

  it('without the cost margin it is the prices times the counts (by hand: 9,596)', () => {
    expect(callWorstCaseMicroUsd(ANSWER, 0)).toBe(9_596);
  });

  it('adds the tokens of an image to the prompt (by hand: 1,000 image tokens × 0.5 = 500, so 10,096 × 1.1 = 11,105.6, up to 11,106)', () => {
    expect(callWorstCaseMicroUsd({ ...ANSWER, imageTokens: 1_000 })).toBe(
      11_106
    );
    expect(callWorstCaseMicroUsd({ ...ANSWER, imageTokens: 0 })).toBe(10_556);
  });

  it('carries the prompt to the model’s own tokens by the model’s margin, not a default', () => {
    // 0% calibration margin: 10,000 × 0.5 + 4,096 = 9,096; × 1.1 = 10,005.6, up to 10,006
    expect(
      callWorstCaseMicroUsd({ ...ANSWER, calibration: { marginBp: 0 } })
    ).toBe(10_006);
    // 50% margin: 15,000 × 0.5 + 4,096 = 11,596; × 1.1 = 12,755.6, up to 12,756
    expect(
      callWorstCaseMicroUsd({ ...ANSWER, calibration: { marginBp: 5_000 } })
    ).toBe(12_756);
  });

  it('rounds UP: a call that costs a fraction of a micro-dollar costs one', () => {
    expect(
      callWorstCaseMicroUsd(
        {
          price: { price_in: 0.000001, price_out: 0 },
          promptTokens: 1,
          maxOutputTokens: 0,
          calibration: { marginBp: 0 },
        },
        0
      )
    ).toBe(1);
  });

  it('is exact on a price with six decimals and millions of tokens (by hand: 0.123456 × 5,000,000 = 617,280)', () => {
    expect(
      callWorstCaseMicroUsd(
        {
          price: { price_in: 0.123456, price_out: 0 },
          promptTokens: 5_000_000,
          maxOutputTokens: 0,
          calibration: { marginBp: 0 },
        },
        0
      )
    ).toBe(617_280);
  });

  it('is zero for a free model and a cost of nothing', () => {
    expect(
      callWorstCaseMicroUsd({
        price: { price_in: 0, price_out: 0 },
        promptTokens: 1_000,
        maxOutputTokens: 1_000,
        calibration: CAL,
      })
    ).toBe(0);
  });

  it('is null when the price is not known: such a call has no worst case', () => {
    expect(
      callWorstCaseMicroUsd({
        ...ANSWER,
        price: { price_in: null, price_out: null },
      })
    ).toBeNull();
    expect(
      callWorstCaseMicroUsd({
        ...ANSWER,
        price: { price_in: 0.5, price_out: null },
      })
    ).toBeNull();
    expect(
      callWorstCaseMicroUsd({
        ...ANSWER,
        price: { price_in: null, price_out: 2 },
      })
    ).toBeNull();
    expect(
      callWorstCaseUnits({
        ...ANSWER,
        price: { price_in: null, price_out: null },
      })
    ).toBeNull();
  });

  it.each([
    ['a negative price', { price: { price_in: -1, price_out: 2 } }],
    ['a NaN price', { price: { price_in: Number.NaN, price_out: 2 } }],
    [
      'an infinite price',
      { price: { price_in: Number.POSITIVE_INFINITY, price_out: 2 } },
    ],
    ['negative prompt tokens', { promptTokens: -1 }],
    ['fractional prompt tokens', { promptTokens: 1.5 }],
    ['negative output tokens', { maxOutputTokens: -1 }],
    ['fractional output tokens', { maxOutputTokens: 0.5 }],
    ['negative image tokens', { imageTokens: -5 }],
    ['a fractional margin', { calibration: { marginBp: 1.5 } }],
    ['a negative margin', { calibration: { marginBp: -100 } }],
  ])('is null for %s', (_name, over) => {
    expect(
      callWorstCaseMicroUsd({ ...ANSWER, ...over } as CallBound)
    ).toBeNull();
  });

  it('is null for a cost margin that is not a whole number of at least zero', () => {
    expect(callWorstCaseMicroUsd(ANSWER, -1)).toBeNull();
    expect(callWorstCaseMicroUsd(ANSWER, 1.5)).toBeNull();
  });

  it('is null rather than wrong for a cost no integer can hold', () => {
    expect(
      callWorstCaseMicroUsd({
        price: { price_in: 1_000, price_out: 1_000 },
        promptTokens: Number.MAX_SAFE_INTEGER,
        maxOutputTokens: Number.MAX_SAFE_INTEGER,
        calibration: { marginBp: 10_000 },
      })
    ).toBeNull();
  });
});

describe('estimateRequest', () => {
  it('is the Understand call and the answer, and a regeneration that is a second answer (by hand: 792 + 10,556)', () => {
    // Understand: 4,000 × 1.1 = 4,400 × 0.1 = 440; 700 × 0.4 = 280; 720 × 1.1 = 792
    expect(estimateRequest({ understand: UNDERSTAND, answer: ANSWER })).toEqual(
      {
        ok: true,
        understandUnits: 792,
        answerUnits: 10_556,
        regenerationUnits: 10_556,
        baseUnits: 11_348,
        withRegenerationUnits: 21_904,
      }
    );
  });

  it('has no Understand call for an instant prompt', () => {
    expect(estimateRequest({ understand: null, answer: ANSWER })).toEqual({
      ok: true,
      understandUnits: 0,
      answerUnits: 10_556,
      regenerationUnits: 10_556,
      baseUnits: 10_556,
      withRegenerationUnits: 21_112,
    });
  });

  it('says WHICH call has no price', () => {
    const unpriced = { price_in: null, price_out: null };
    expect(
      estimateRequest({
        understand: { ...UNDERSTAND, price: unpriced },
        answer: ANSWER,
      })
    ).toEqual({ ok: false, code: 'PRICE_UNKNOWN', call: 'understand' });
    expect(
      estimateRequest({
        understand: UNDERSTAND,
        answer: { ...ANSWER, price: unpriced },
      })
    ).toEqual({ ok: false, code: 'PRICE_UNKNOWN', call: 'answer' });
    // both: the Understand call is named first, as it comes first
    expect(
      estimateRequest({
        understand: { ...UNDERSTAND, price: unpriced },
        answer: { ...ANSWER, price: unpriced },
      })
    ).toMatchObject({ call: 'understand' });
  });

  it('refuses a worst case the ledger could not hold', () => {
    expect(
      estimateRequest({
        understand: null,
        answer: {
          price: { price_in: 0, price_out: 1_000 },
          promptTokens: 0,
          maxOutputTokens: 1_100_000,
          calibration: { marginBp: 0 },
        },
      })
    ).toEqual({ ok: false, code: 'TOO_LARGE' });
  });

  it('takes the margin as an argument', () => {
    expect(
      estimateRequest({ understand: null, answer: ANSWER }, 0)
    ).toMatchObject({
      answerUnits: 9_596,
      withRegenerationUnits: 19_192,
    });
  });

  it('a request is never cheaper with a bigger prompt, a longer reply or an image', () => {
    const base = estimateRequest({ understand: UNDERSTAND, answer: ANSWER });
    for (const bigger of [
      { ...ANSWER, promptTokens: 10_001 },
      { ...ANSWER, maxOutputTokens: 2_049 },
      { ...ANSWER, imageTokens: 1 },
    ]) {
      const more = estimateRequest({ understand: UNDERSTAND, answer: bigger });
      expect(more.ok && base.ok && more.baseUnits >= base.baseUnits).toBe(true);
    }
  });
});

describe('boundOf', () => {
  it('takes the price, the reply limit and the calibration of a registry row', () => {
    expect(
      boundOf(
        {
          price_in: 0.5,
          price_out: 2,
          max_output_tokens: 2_048,
          calibration: { ...DEFAULT_CALIBRATION, marginBp: 1_000 },
        },
        10_000,
        300
      )
    ).toEqual({
      price: { price_in: 0.5, price_out: 2 },
      promptTokens: 10_000,
      imageTokens: 300,
      maxOutputTokens: 2_048,
      calibration: { ...DEFAULT_CALIBRATION, marginBp: 1_000 },
    });
  });
});

describe('floorUnits: a lower bound of every reservation', () => {
  const PRICED = {
    price_in: 0.5,
    price_out: 2,
    max_output_tokens: 2_048,
    calibration: { ...DEFAULT_CALIBRATION, marginBp: 1_000 },
  };
  const CHEAPER = { ...PRICED, price_in: 0.1, price_out: 0.4 };
  const UNPRICED = { ...PRICED, price_in: null, price_out: null };

  it('is one unit when nothing is priced: an empty account is still refused', () => {
    expect(
      floorUnits({ kind: 'TYPED', understandModel: null, answerModels: [] })
    ).toBe(1);
    expect(
      floorUnits({
        kind: 'TYPED',
        understandModel: UNPRICED,
        answerModels: [UNPRICED],
      })
    ).toBe(1);
    expect(
      floorUnits({
        kind: 'INSTANT',
        understandModel: null,
        answerModels: [UNPRICED],
      })
    ).toBe(1);
  });

  it('is the cheapest priced answer model at the smallest prompt, plus the Understand call for a typed question', () => {
    const answer = callWorstCaseUnits(
      boundOf(CHEAPER, STATIC_PROMPT_TOKENS)
    ) as number;
    // a lower bound for the Understand call: its reply at its most, its prompt at its least
    const understand = callWorstCaseUnits({
      ...boundOf(PRICED, 0),
      maxOutputTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
    }) as number;
    expect(answer).toBeGreaterThan(1);
    expect(understand).toBeGreaterThan(1);
    expect(
      floorUnits({
        kind: 'INSTANT',
        understandModel: PRICED,
        answerModels: [PRICED, CHEAPER],
      })
    ).toBe(answer);
    expect(
      floorUnits({
        kind: 'TYPED',
        understandModel: PRICED,
        answerModels: [PRICED, CHEAPER],
      })
    ).toBe(answer + understand);
  });

  it('leaves out a call nobody has priced and keeps the rest', () => {
    const answer = callWorstCaseUnits(
      boundOf(PRICED, STATIC_PROMPT_TOKENS)
    ) as number;
    expect(
      floorUnits({
        kind: 'TYPED',
        understandModel: UNPRICED,
        answerModels: [UNPRICED, PRICED],
      })
    ).toBe(answer);
    expect(
      floorUnits({
        kind: 'TYPED',
        understandModel: null,
        answerModels: [PRICED],
      })
    ).toBe(answer);
  });

  it('never exceeds what a real request would reserve, so a trader it refuses would be refused at the reservation too', () => {
    for (const kind of ['TYPED', 'INSTANT'] as const) {
      const floor = floorUnits({
        kind,
        understandModel: PRICED,
        answerModels: [PRICED, CHEAPER],
      });
      for (const answerModel of [PRICED, CHEAPER]) {
        const reservation = estimateRequest({
          understand:
            kind === 'TYPED'
              ? {
                  ...boundOf(PRICED, UNDERSTAND_PROMPT_TOKENS_CEILING),
                  maxOutputTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
                }
              : null,
          answer: boundOf(answerModel, STATIC_PROMPT_TOKENS + 1_000),
        });
        expect(reservation.ok).toBe(true);
        if (reservation.ok)
          expect(floor).toBeLessThanOrEqual(reservation.baseUnits);
      }
    }
  });

  it('is at least one unit even for a free model', () => {
    const free = { ...PRICED, price_in: 0, price_out: 0 };
    expect(
      floorUnits({
        kind: 'INSTANT',
        understandModel: null,
        answerModels: [free],
      })
    ).toBe(1);
  });

  it('takes the margin as an argument', () => {
    const without = floorUnits(
      { kind: 'INSTANT', understandModel: null, answerModels: [PRICED] },
      0
    );
    const withMargin = floorUnits({
      kind: 'INSTANT',
      understandModel: null,
      answerModels: [PRICED],
    });
    expect(without).toBeLessThan(withMargin);
  });
});

describe('the constants that stand for something else are held to it', () => {
  it('the Understand reply limit is the gateway adapter’s', () => {
    expect(UNDERSTAND_MAX_OUTPUT_TOKENS).toBe(UNDERSTAND_MAX_TOKENS);
  });

  it('the static prefix is the count of the rules and the wording guide, and a plausible size', () => {
    expect(STATIC_PROMPT_TOKENS).toBe(
      estimateRawTokens(`${SYSTEM_RULES_TEXT}\n${WORDING_GUIDE_TEXT}`)
    );
    expect(STATIC_PROMPT_TOKENS).toBeGreaterThan(1_000);
    expect(STATIC_PROMPT_TOKENS).toBeLessThan(2_500);
  });

  it('the Understand prompt ceiling holds the largest prompt the intake path can build', () => {
    // the system text, a question of the longest length in the densest script (one token a
    // character), and the most glossary hints at their longest
    const hints = Array.from({ length: MAX_GLOSSARY_HINTS }, (_v, i) => ({
      id: `term_${String(i).padStart(35, 'x')}`.slice(0, 40),
      matched: '漢'.repeat(80),
      en: 'e'.repeat(80),
    }));
    const request = buildUnderstandRequest('漢'.repeat(1_000), hints);
    const worst =
      estimateRawTokens(request.system) + estimateRawTokens(request.user);
    expect(estimateRawTokens(UNDERSTAND_SYSTEM_PROMPT)).toBeLessThan(2_000);
    expect(worst).toBeLessThanOrEqual(UNDERSTAND_PROMPT_TOKENS_CEILING);
  });
});
