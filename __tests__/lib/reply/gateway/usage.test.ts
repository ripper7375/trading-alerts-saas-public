/**
 * @jest-environment node
 */

/**
 * Usage and cost capture (build step 7 part 3; ADR-050, decision D2): what the provider reported,
 * as whole numbers and integer micro-dollars; the estimate from a dated price when it reported no
 * cost; and the cases where the answer is "unknown", never a guess.
 */

import {
  MAX_CALL_COST_MICRO_USD,
  costFromPrice,
  extractUsage,
  usdToMicro,
} from '@/lib/reply/gateway/usage';

type Any = any;

const PRICE = { price_in: 0.3, price_out: 2.5 };

const body = (usage: unknown) => ({ choices: [], usage });

describe('usdToMicro', () => {
  it.each([
    [0, 0],
    [0.00765, 7650],
    [1, 1_000_000],
    [0.000001, 1],
    [0.0000012, 1],
    [0.0000016, 2],
    [12.345678, 12_345_678],
    [100, MAX_CALL_COST_MICRO_USD],
  ])('%p dollars is %p micro-dollars', (usd, micro) => {
    expect(usdToMicro(usd)).toBe(micro);
  });

  it('always returns a whole number', () => {
    for (const usd of [
      0.1 + 0.2,
      0.00007650000000001,
      1 / 3,
      2 / 3,
      1e-7 * 7,
    ]) {
      expect(Number.isInteger(usdToMicro(usd))).toBe(true);
    }
  });

  it.each([
    ['a negative', -0.01],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a string', '0.01'],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
    ['a cost over $100 for one call', 100.000001],
    ['a cost that is absurd', 1e12],
  ])('does not believe %s', (_name, value) => {
    expect(usdToMicro(value)).toBeNull();
  });
});

describe('costFromPrice', () => {
  it('prices the tokens: USD per million tokens is micro-dollars per token', () => {
    // 18,000 x 0.30 + 900 x 2.50 = 5,400 + 2,250
    expect(costFromPrice(PRICE, 18_000, 900)).toBe(7650);
    expect(costFromPrice(PRICE, 0, 0)).toBe(0);
    expect(costFromPrice({ price_in: 10, price_out: 30 }, 1, 1)).toBe(40);
  });

  it('rounds the total, not each part, to the nearest micro-dollar (half up)', () => {
    const tiny = { price_in: 0.000001, price_out: 0 };
    expect(costFromPrice(tiny, 499_999, 0)).toBe(0);
    expect(costFromPrice(tiny, 500_000, 0)).toBe(1);
    expect(costFromPrice(tiny, 1_499_999, 0)).toBe(1);
    expect(costFromPrice(tiny, 1_500_000, 0)).toBe(2);
    // two halves that add to a whole are one micro-dollar, not two
    const halves = { price_in: 0.000001, price_out: 0.000001 };
    expect(costFromPrice(halves, 250_000, 250_000)).toBe(1);
  });

  it('is exact for a price with six decimals', () => {
    expect(
      costFromPrice({ price_in: 0.123456, price_out: 0 }, 1_000_000, 0)
    ).toBe(123_456);
    expect(
      costFromPrice({ price_in: 0.999999, price_out: 0 }, 1_000_000, 0)
    ).toBe(999_999);
    // 999,999,999 millionths x 99,999 tokens = 99,998,999.900001 micro-dollars, rounded
    expect(
      costFromPrice({ price_in: 0, price_out: 999.999999 }, 0, 99_999)
    ).toBe(99_999_000);
  });

  it.each([
    ['no input price', { price_in: null, price_out: 2.5 }, 10, 10],
    ['no output price', { price_in: 0.3, price_out: null }, 10, 10],
    ['no prompt count', PRICE, null, 10],
    ['no completion count', PRICE, 10, null],
  ])('is null with %s', (_name, price, prompt, completion) => {
    expect(
      costFromPrice(price as Any, prompt as Any, completion as Any)
    ).toBeNull();
  });

  it('is null when the result is more than one call can cost', () => {
    expect(
      costFromPrice({ price_in: 1000, price_out: 1000 }, 200_000, 0)
    ).toBeNull();
    expect(costFromPrice({ price_in: 1000, price_out: 0 }, 100_000, 0)).toBe(
      MAX_CALL_COST_MICRO_USD
    );
  });

  it('agrees with an independent integer calculation on 400 random prices and counts', () => {
    let seed = 20261014;
    const next = (modulus: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % modulus;
    };
    for (let i = 0; i < 400; i += 1) {
      // prices in millionths of a dollar per million tokens, which is what the registry holds
      const inMillionths = next(50_000_000);
      const outMillionths = next(50_000_000);
      const prompt = next(200_000);
      const completion = next(8_000);
      const exact =
        BigInt(inMillionths) * BigInt(prompt) +
        BigInt(outMillionths) * BigInt(completion);
      const expected = Number((exact * 2n + 1_000_000n) / 2_000_000n);
      const got = costFromPrice(
        { price_in: inMillionths / 1e6, price_out: outMillionths / 1e6 },
        prompt,
        completion
      );
      expect(got).toBe(expected <= MAX_CALL_COST_MICRO_USD ? expected : null);
    }
  });
});

describe('extractUsage: the provider reported a cost', () => {
  const usage = {
    prompt_tokens: 18_000,
    completion_tokens: 900,
    prompt_tokens_details: { cached_tokens: 16_000 },
    cost: 0.00765,
  };

  it('takes the counts and the cost as integers, and sets no flag', () => {
    expect(extractUsage(body(usage), PRICE)).toEqual({
      prompt_tokens: 18_000,
      completion_tokens: 900,
      cached_tokens: 16_000,
      cost_micro_usd: 7650,
      cost_flag: null,
    });
  });

  it('prefers the reported cost to the registry price, even when they differ', () => {
    const got = extractUsage(body({ ...usage, cost: 0.001 }), PRICE);
    expect(got.cost_micro_usd).toBe(1000);
    expect(got.cost_flag).toBeNull();
  });

  it('keeps a reported cost of zero (a free or cached call) as zero, not as unknown', () => {
    const got = extractUsage(body({ ...usage, cost: 0 }), PRICE);
    expect(got.cost_micro_usd).toBe(0);
    expect(got.cost_flag).toBeNull();
  });

  it('needs no registry price to take a reported cost', () => {
    expect(extractUsage(body(usage), null).cost_micro_usd).toBe(7650);
    expect(
      extractUsage(body(usage), { price_in: null, price_out: null })
        .cost_micro_usd
    ).toBe(7650);
  });

  it('reads cached tokens: zero is "none", absent is "not said"', () => {
    expect(
      extractUsage(
        body({ ...usage, prompt_tokens_details: { cached_tokens: 0 } }),
        PRICE
      ).cached_tokens
    ).toBe(0);
    expect(
      extractUsage(body({ ...usage, prompt_tokens_details: {} }), PRICE)
        .cached_tokens
    ).toBeNull();
    expect(
      extractUsage(body({ ...usage, prompt_tokens_details: undefined }), PRICE)
        .cached_tokens
    ).toBeNull();
    expect(
      extractUsage(body({ ...usage, prompt_tokens_details: 'many' }), PRICE)
        .cached_tokens
    ).toBeNull();
  });

  it('does not believe more cached tokens than prompt tokens', () => {
    const got = extractUsage(
      body({ ...usage, prompt_tokens_details: { cached_tokens: 18_001 } }),
      PRICE
    );
    expect(got.cached_tokens).toBeNull();
    expect(
      extractUsage(
        body({ ...usage, prompt_tokens_details: { cached_tokens: 18_000 } }),
        PRICE
      ).cached_tokens
    ).toBe(18_000);
  });

  it('keeps the cached tokens when the prompt count is missing: there is nothing to compare them with', () => {
    const got = extractUsage(
      body({
        cost: 0.001,
        completion_tokens: 900,
        prompt_tokens_details: { cached_tokens: 5 },
      }),
      PRICE
    );
    expect(got.prompt_tokens).toBeNull();
    expect(got.cached_tokens).toBe(5);
    const bad = extractUsage(
      body({
        cost: 0.001,
        prompt_tokens: 'many',
        prompt_tokens_details: { cached_tokens: 5 },
      }),
      PRICE
    );
    expect(bad.cached_tokens).toBe(5);
  });
});

describe('extractUsage: the provider reported no cost', () => {
  const counts = { prompt_tokens: 18_000, completion_tokens: 900 };

  it('estimates the cost from the dated price and says so', () => {
    expect(extractUsage(body(counts), PRICE)).toEqual({
      prompt_tokens: 18_000,
      completion_tokens: 900,
      cached_tokens: null,
      cost_micro_usd: 7650,
      cost_flag: 'COST_ESTIMATED',
    });
  });

  it('prices cached input as ordinary input: the estimate is never below the truth', () => {
    const got = extractUsage(
      body({ ...counts, prompt_tokens_details: { cached_tokens: 16_000 } }),
      PRICE
    );
    expect(got.cost_micro_usd).toBe(7650);
    expect(got.cached_tokens).toBe(16_000);
  });

  it.each([
    ['no price', null],
    ['an unverified price', { price_in: null, price_out: null }],
  ])('has no cost with %s, and still says COST_ESTIMATED', (_name, price) => {
    const got = extractUsage(body(counts), price);
    expect(got.cost_micro_usd).toBeNull();
    expect(got.cost_flag).toBe('COST_ESTIMATED');
  });

  it('has no cost when the counts are missing too', () => {
    const got = extractUsage(body({}), PRICE);
    expect(got).toEqual({
      prompt_tokens: null,
      completion_tokens: null,
      cached_tokens: null,
      cost_micro_usd: null,
      cost_flag: 'COST_ESTIMATED',
    });
  });

  it.each([
    ['a string', '0.01'],
    ['a negative', -0.5],
    ['NaN', Number.NaN],
    ['null', null],
    ['an object', { usd: 1 }],
    ['over $100', 250],
  ])('treats a reported cost that is %s as not reported', (_name, cost) => {
    const got = extractUsage(body({ ...counts, cost }), PRICE);
    expect(got.cost_micro_usd).toBe(7650);
    expect(got.cost_flag).toBe('COST_ESTIMATED');
  });

  it.each([
    ['no usage block', { choices: [] }],
    ['a usage block that is null', body(null)],
    ['a usage block that is a list', body([])],
    ['a usage block that is text', body('lots')],
    ['a body that is null', null],
    ['a body that is text', 'x'],
    ['a body that is a list', []],
  ])('is all unknown with %s', (_name, value) => {
    expect(extractUsage(value, PRICE)).toEqual({
      prompt_tokens: null,
      completion_tokens: null,
      cached_tokens: null,
      cost_micro_usd: null,
      cost_flag: 'COST_ESTIMATED',
    });
  });
});

describe('extractUsage: token counts', () => {
  it.each([
    ['a fraction', 1.5],
    ['a negative', -1],
    ['a string', '100'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['beyond a safe integer', 2 ** 60],
    ['null', null],
  ])('reads %s as unknown', (_name, value) => {
    const got = extractUsage(
      body({ prompt_tokens: value, completion_tokens: value, cost: 0.001 }),
      PRICE
    );
    expect(got.prompt_tokens).toBeNull();
    expect(got.completion_tokens).toBeNull();
    // the reported cost does not depend on the counts
    expect(got.cost_micro_usd).toBe(1000);
  });

  it('keeps a count of zero', () => {
    const got = extractUsage(
      body({ prompt_tokens: 0, completion_tokens: 0 }),
      PRICE
    );
    expect(got.prompt_tokens).toBe(0);
    expect(got.completion_tokens).toBe(0);
    expect(got.cost_micro_usd).toBe(0);
  });

  it('does not estimate a cost from one count alone', () => {
    expect(
      extractUsage(body({ prompt_tokens: 100 }), PRICE).cost_micro_usd
    ).toBeNull();
    expect(
      extractUsage(body({ completion_tokens: 100 }), PRICE).cost_micro_usd
    ).toBeNull();
  });
});
