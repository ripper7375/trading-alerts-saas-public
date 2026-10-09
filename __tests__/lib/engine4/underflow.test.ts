/**
 * @jest-environment node
 */

import {
  Engine4InputError,
  Rational,
  sizeSetup,
  underflowHelp,
} from '@/lib/engine4';
import type {
  SizingInput,
  SymbolSpecInput,
  UnderflowContext,
  UnderflowFact,
  UnderflowHelp,
  UnderflowOption,
} from '@/lib/engine4';

import {
  loadOracle,
  sameText,
  sameValue,
  toSizingInput,
} from './helpers/oracle';

const GOLD: SymbolSpecInput = {
  contractSize: '100',
  volumeMin: '0.01',
  volumeStep: '0.01',
  volumeMax: '100',
  typicalSpread: '0',
  point: '0.01',
};

const BASE: SizingInput = {
  side: 'BUY',
  entry: '2545.00',
  stopDistance: '15.00',
  equity: '10000',
  riskPct: '1.00',
  maxLeverage: '5',
  commission: '4',
  spec: GOLD,
};

const CONTEXT: UnderflowContext = { maxRiskPct: '2', minSld: '13' };

/**
 * Architecture 6.8, file G's case: $500 equity, 0.50% risk, $15.00 stop, $4
 * commission. At gold 2,545 a minimum lot already breaks the 1:5 ceiling at
 * $500 (509 of equity is the least), so the example is read at a price where
 * only the risk limit blocks it.
 */
const FILE_G: SizingInput = {
  ...BASE,
  entry: '1800.00',
  equity: '500',
  riskPct: '0.50',
};

const r = (text: string): Rational => Rational.of(text);

function help(
  input: SizingInput,
  context: UnderflowContext = CONTEXT
): UnderflowHelp {
  const result = underflowHelp(input, context);
  if (result === null) throw new Error('expected an underflow');
  return result;
}

const kinds = (options: UnderflowOption[]): string[] =>
  options.map((o) => o.kind);

describe('when there is nothing to help with', () => {
  test('a lot that fits gives null', () => {
    expect(underflowHelp(BASE, CONTEXT)).toBeNull();
  });

  test('a lot of exactly the minimum gives null', () => {
    expect(underflowHelp({ ...BASE, equity: '1504' }, CONTEXT)).toBeNull();
  });
});

describe('6.8, file G: $500, 0.50% risk, $15.00 stop, $4 commission', () => {
  const found = help(FILE_G);

  test('the risk lot is 0.0017 and one 0.01 lot would lose $15.04 (3.01%)', () => {
    const sizing = sizeSetup(FILE_G);
    expect(sizing.status).toBe('UNDERFLOW');
    expect(sizing.lotAtStop.toDecimal(4)).toBe('0.0017');
    expect(found.causes).toEqual(['RISK']);
    expect(found.minLotLoss.toString()).toBe('15.04');
    expect(found.minLotRiskPct.toString()).toBe('3.008');
    expect(found.minLotRiskPct.toDecimal(2)).toBe('3.01');
  });

  test('option 1, raise risk to 3.01%, is not offered: it is above Max RPT of 2.00%', () => {
    expect(kinds(found.options)).not.toContain('RAISE_RISK');
  });

  test('option 3 is a fact, not a button: this setup needs at least $3,008 of equity at 0.50%', () => {
    expect(found.facts).toEqual([
      {
        kind: 'EQUITY_NEEDED_FOR_RISK',
        equity: r('3008'),
        atRiskPct: r('0.5'),
      },
    ]);
    expect(
      found.facts[0] &&
        'equity' in found.facts[0] &&
        found.facts[0].equity.toString()
    ).toBe('3008');
    expect(kinds(found.options)).toEqual(['DECLINE']);
  });

  test('with room under Max RPT the raise is offered, rounded UP so entering it is enough', () => {
    const wide = help(FILE_G, { maxRiskPct: '3.5', minSld: '13' });
    const raise = wide.options.find((o) => o.kind === 'RAISE_RISK');
    expect(raise).toBeDefined();
    if (raise?.kind !== 'RAISE_RISK') throw new Error('no raise');
    expect(raise.riskPct.toString()).toBe('3.01');
    expect(raise.riskPctExact.toString()).toBe('3.008');
    expect(raise.lot.toString()).toBe('0.01');
    expect(raise.actualRisk.toString()).toBe('15.04');
    // the lot really does come out at 3.01%
    const again = sizeSetup({ ...FILE_G, riskPct: raise.riskPct.toString() });
    expect(again.status).toBe('OK');
    // rounding to the nearest cent would have said 3.00%, which is NOT enough
    expect(sizeSetup({ ...FILE_G, riskPct: '3.00' }).status).toBe('UNDERFLOW');
    expect(kinds(wide.options)).toEqual(['RAISE_RISK', 'DECLINE']);
  });

  test('the needed risk at exactly Max RPT is still offered', () => {
    // 15.04 / 752 = 2.00% exactly
    const exact = help(
      { ...FILE_G, equity: '752', riskPct: '0.5' },
      { maxRiskPct: '2', minSld: '13' }
    );
    const raise = exact.options.find((o) => o.kind === 'RAISE_RISK');
    expect(raise?.kind === 'RAISE_RISK' && raise.riskPct.toString()).toBe('2');
  });

  test('a cent above Max RPT is not', () => {
    const over = help(
      { ...FILE_G, equity: '751.99', riskPct: '0.5' },
      { maxRiskPct: '2', minSld: '13' }
    );
    expect(kinds(over.options)).toEqual(['DECLINE']);
  });
});

describe('plan F6: the 18 Sep M15 UOEDT stop on the default profile', () => {
  const f6: SizingInput = {
    ...BASE,
    entry: '4367.20',
    stopDistance: '88.24',
    equity: '5000',
    riskPct: '1.50',
    maxLeverage: '1.5',
  };
  const stops = ['16.78', '17.54', '33.14', '88.24', '153.53', '241.46'];
  const found = help(f6, {
    maxRiskPct: '2',
    minSld: '13',
    structuralStopDistances: stops,
  });

  test('the risk can be raised to 1.77% (1.7656% is needed), still under Max RPT', () => {
    const raise = found.options[0];
    expect(raise?.kind).toBe('RAISE_RISK');
    if (raise?.kind !== 'RAISE_RISK') return;
    expect(raise.riskPctExact.toDecimal(4)).toBe('1.7656');
    expect(raise.riskPct.toString()).toBe('1.77');
    expect(raise.lot.toString()).toBe('0.01');
    expect(raise.actualRisk.toString()).toBe('88.28');
  });

  test('nearer structural stops are offered, nearest first, each re-sized', () => {
    const nearer = found.options.filter(
      (o) => o.kind === 'NEARER_STRUCTURAL_STOP'
    );
    expect(
      nearer.map(
        (o) => o.kind === 'NEARER_STRUCTURAL_STOP' && o.stopDistance.toString()
      )
    ).toEqual(['16.78', '17.54', '33.14']);
    const first = nearer[0];
    if (first?.kind !== 'NEARER_STRUCTURAL_STOP') throw new Error('no stop');
    expect(first.lot.toString()).toBe('0.01');
    expect(first.actualRisk.toDecimal(2)).toBe('16.82');
    expect(first.actualRiskPct.toDecimal(2)).toBe('0.34');
  });

  test('the current stop and the stops further out are not offered', () => {
    const offered = found.options
      .filter((o) => o.kind === 'NEARER_STRUCTURAL_STOP')
      .map(
        (o) => o.kind === 'NEARER_STRUCTURAL_STOP' && o.stopDistance.toString()
      );
    expect(offered).not.toContain('88.24');
    expect(offered).not.toContain('153.53');
    expect(offered).not.toContain('241.46');
  });

  test('Decline is last, and the fact states the equity that 1.50% needs', () => {
    expect(found.options[found.options.length - 1]).toEqual({
      kind: 'DECLINE',
    });
    expect(found.facts).toHaveLength(1);
    expect(found.facts[0]?.kind).toBe('EQUITY_NEEDED_FOR_RISK');
  });
});

describe('structural stops: only a nearer stop at or beyond Min SLD that really restores a lot', () => {
  // $3,000 at 0.50% is $15; a $15.00 stop loses $1,504 a lot: 0.00997 lot, just short
  const input: SizingInput = {
    ...BASE,
    entry: '1800.00',
    equity: '3000',
    riskPct: '0.50',
  };
  const offeredFor = (distances: string[], minSld = '13'): string[] =>
    help(input, {
      maxRiskPct: '2',
      minSld,
      structuralStopDistances: distances,
    }).options.flatMap((o) =>
      o.kind === 'NEARER_STRUCTURAL_STOP' ? [o.stopDistance.toString()] : []
    );

  test('is a risk-only underflow', () => {
    expect(help(input).causes).toEqual(['RISK']);
  });

  test('nearer stops that restore a 0.01 lot are offered, nearest first, in any input order', () => {
    expect(offeredFor(['14.5', '14', '13.2'])).toEqual(['13.2', '14', '14.5']);
  });

  test('a stop that is nearer but still leaves no lot is not offered', () => {
    // 14.99 loses $1,503 a lot: 15 / 1503 = 0.00998, still under 0.01
    expect(offeredFor(['14.99', '14'])).toEqual(['14']);
  });

  test('the current stop, further stops and stops under Min SLD are not offered', () => {
    expect(offeredFor(['15', '15.00', '20', '12.99', '12', '14'])).toEqual([
      '14',
    ]);
    // raise Min SLD to 14: 13 drops out, 14 stays
    expect(offeredFor(['14', '13'], '14')).toEqual(['14']);
  });

  test('a stop exactly at Min SLD is offered', () => {
    expect(offeredFor(['13'])).toEqual(['13']);
  });

  test('duplicates are offered once', () => {
    expect(offeredFor(['14', '14.0', '14.00', '14.5'])).toEqual(['14', '14.5']);
  });

  test('no stops given means no stop option', () => {
    expect(
      help(input).options.some((o) => o.kind === 'NEARER_STRUCTURAL_STOP')
    ).toBe(false);
  });
});

describe('D4: the leverage limit blocks the lot', () => {
  const d4: SizingInput = {
    ...BASE,
    entry: '4367.20',
    stopDistance: '16.78',
    equity: '2800',
    riskPct: '1.50',
    maxLeverage: '1.5',
  };
  const found = help(d4, {
    maxRiskPct: '2',
    minSld: '13',
    structuralStopDistances: ['13', '14'],
  });

  test('the risk limit would allow 0.025 lot; 1:1.5 allows 0.0096', () => {
    const sizing = sizeSetup(d4);
    expect(sizing.lotAtStop.toDecimal(4)).toBe('0.0250');
    expect(sizing.maxLotByLeverage.toDecimal(4)).toBe('0.0096');
    expect(found.causes).toEqual(['LEVERAGE']);
  });

  test('the only offer is to decline: not more risk, not a nearer stop, never more leverage', () => {
    expect(found.options).toEqual([{ kind: 'DECLINE' }]);
  });

  test('the fact says what equity the leverage limit needs: $2,912 (2,911.47 to the cent)', () => {
    expect(found.facts).toHaveLength(1);
    const fact = found.facts[0] as Extract<
      UnderflowFact,
      { kind: 'EQUITY_NEEDED_FOR_LEVERAGE' }
    >;
    expect(fact.kind).toBe('EQUITY_NEEDED_FOR_LEVERAGE');
    expect(fact.atMaxLeverage.toString()).toBe('1.5');
    expect(fact.equity.toDecimal(2, 'CEIL')).toBe('2911.47');
    expect(fact.equity.toDecimal(0, 'CEIL')).toBe('2912');
  });

  test('the figure is the exact threshold: a cent less is still an underflow, the rounded-up cent is not', () => {
    expect(sizeSetup({ ...d4, equity: '2911.46' }).status).toBe('UNDERFLOW');
    expect(sizeSetup({ ...d4, equity: '2911.47' }).status).toBe('OK');
  });
});

describe('a limit that allows exactly the minimum lot is not a cause', () => {
  test('risk allows exactly 0.01 lot, leverage allows less: the cause is leverage alone', () => {
    // $1,682 at 1% is $16.82, exactly one 0.01 lot of a $16.78 stop with $4 commission
    const found = help({
      ...BASE,
      entry: '4367.20',
      stopDistance: '16.78',
      equity: '1682',
      riskPct: '1',
      maxLeverage: '1.5',
    });
    expect(found.causes).toEqual(['LEVERAGE']);
    expect(found.options).toEqual([{ kind: 'DECLINE' }]);
    expect(found.facts.map((f) => f.kind)).toEqual([
      'EQUITY_NEEDED_FOR_LEVERAGE',
    ]);
  });

  test('leverage allows exactly 0.01 lot, risk allows less: the cause is risk alone', () => {
    // 1:1 on $2,000 at 2,000 is exactly 0.01 lot of 100 ounces
    const found = help(
      {
        ...BASE,
        entry: '2000.00',
        equity: '2000',
        riskPct: '0.5',
        maxLeverage: '1',
      },
      { maxRiskPct: '2', minSld: '13', structuralStopDistances: ['13'] }
    );
    expect(found.causes).toEqual(['RISK']);
    expect(found.facts.map((f) => f.kind)).toEqual(['EQUITY_NEEDED_FOR_RISK']);
    // the risk can be raised: 15.04 / 2,000 = 0.752%, so 0.76%
    const raise = found.options.find((o) => o.kind === 'RAISE_RISK');
    expect(raise?.kind === 'RAISE_RISK' && raise.riskPct.toString()).toBe(
      '0.76'
    );
  });
});

describe('when both limits block the lot, a raise that would cure the risk limit is still not offered', () => {
  // equity $100, risk 0.50%, a $1.00 stop: one 0.01 lot loses $1.04 (1.04% of equity, inside a Max RPT of 2%),
  // but 1:5 on $100 at 2,545 allows 0.002 lot, so more risk buys nothing
  const found = help(
    {
      ...BASE,
      stopDistance: '1.00',
      equity: '100',
      riskPct: '0.5',
      maxLeverage: '5',
    },
    { maxRiskPct: '2', minSld: '0.5', structuralStopDistances: ['0.6'] }
  );

  test('both causes, and only Decline', () => {
    expect(found.causes).toEqual(['RISK', 'LEVERAGE']);
    expect(found.minLotRiskPct.toString()).toBe('1.04');
    expect(found.options).toEqual([{ kind: 'DECLINE' }]);
  });
});

describe('both limits block the lot', () => {
  const found = help({ ...BASE, equity: '500', riskPct: '0.50' });

  test('only Decline is offered, and both facts are stated', () => {
    expect(found.causes).toEqual(['RISK', 'LEVERAGE']);
    expect(found.options).toEqual([{ kind: 'DECLINE' }]);
    expect(found.facts.map((f) => f.kind)).toEqual([
      'EQUITY_NEEDED_FOR_RISK',
      'EQUITY_NEEDED_FOR_LEVERAGE',
    ]);
    expect(
      found.facts[0] &&
        'equity' in found.facts[0] &&
        found.facts[0].equity.toString()
    ).toBe('3008');
    expect(
      found.facts[1] &&
        'equity' in found.facts[1] &&
        found.facts[1].equity.toString()
    ).toBe('509');
  });
});

describe("nothing offered ever leaves the trader's limits", () => {
  const all = loadOracle().cases.filter((c) => c.sizing.status === 'UNDERFLOW');

  test.each(all.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const input = toSizingInput(c.input);
    const context: UnderflowContext = {
      maxRiskPct: c.input.max_risk_pct,
      minSld: c.input.min_sld,
      structuralStopDistances: c.input.structural_stops,
    };
    const found = help(input, context);
    const maxRisk = r(c.input.max_risk_pct);
    const equity = r(c.input.equity);
    const declared = r(c.input.risk_pct);

    // exactly one Decline, and it is last
    expect(found.options.filter((o) => o.kind === 'DECLINE')).toHaveLength(1);
    expect(found.options[found.options.length - 1]).toEqual({
      kind: 'DECLINE',
    });

    for (const option of found.options) {
      // no option carries an equity figure or a leverage figure
      expect(
        Object.keys(option).filter((key) => /equity|leverage/i.test(key))
      ).toEqual([]);
      if (option.kind === 'RAISE_RISK') {
        expect(option.riskPct.lte(maxRisk)).toBe(true);
        expect(option.riskPct.gte(option.riskPctExact)).toBe(true);
        expect(option.lot.gte(r(c.input.spec.volume_min))).toBe(true);
        expect(
          option.actualRisk.lte(option.riskPct.div(r('100')).mul(equity))
        ).toBe(true);
      }
      if (option.kind === 'NEARER_STRUCTURAL_STOP') {
        expect(option.stopDistance.gte(r(c.input.min_sld))).toBe(true);
        expect(option.stopDistance.lt(r(c.input.stop_distance))).toBe(true);
        expect(option.lot.gte(r(c.input.spec.volume_min))).toBe(true);
        expect(option.actualRisk.lte(declared.div(r('100')).mul(equity))).toBe(
          true
        );
        expect(option.actualRiskPct.lte(maxRisk)).toBe(true);
      }
    }

    // each offer, taken, gives a placeable lot
    for (const option of found.options) {
      if (option.kind === 'RAISE_RISK') {
        expect(
          sizeSetup({ ...input, riskPct: option.riskPct.toString() }).status
        ).toBe('OK');
      }
      if (option.kind === 'NEARER_STRUCTURAL_STOP') {
        expect(
          sizeSetup({ ...input, stopDistance: option.stopDistance.toString() })
            .status
        ).toBe('OK');
      }
    }

    // when the leverage limit blocks the lot, nothing but Decline can help
    if (found.causes.includes('LEVERAGE')) {
      expect(kinds(found.options)).toEqual(['DECLINE']);
    }
    // the facts match the causes
    expect(found.facts.map((f) => f.kind)).toEqual(
      found.causes.map((cause) =>
        cause === 'RISK'
          ? 'EQUITY_NEEDED_FOR_RISK'
          : 'EQUITY_NEEDED_FOR_LEVERAGE'
      )
    );
  });
});

describe('what it refuses', () => {
  test('a chosen risk above Max RPT', () => {
    try {
      underflowHelp({ ...FILE_G, riskPct: '2.5' }, CONTEXT);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Engine4InputError);
      expect((error as Engine4InputError).field).toBe('riskPct');
    }
  });

  test.each([
    [{ maxRiskPct: '0', minSld: '13' }],
    [{ maxRiskPct: '101', minSld: '13' }],
    [{ maxRiskPct: 'x', minSld: '13' }],
    [{ maxRiskPct: '2', minSld: '0' }],
    [{ maxRiskPct: '2', minSld: '13', structuralStopDistances: ['abc'] }],
    [{ maxRiskPct: '2', minSld: '13', structuralStopDistances: ['0'] }],
  ])('the context %j', (context) => {
    expect(() => underflowHelp(FILE_G, context as UnderflowContext)).toThrow(
      Engine4InputError
    );
  });

  test('a Max RPT of exactly 100% is allowed, above 100% is not', () => {
    expect(() =>
      underflowHelp(FILE_G, { maxRiskPct: '100', minSld: '13' })
    ).not.toThrow();
    expect(() =>
      underflowHelp(FILE_G, { maxRiskPct: '100.01', minSld: '13' })
    ).toThrow(Engine4InputError);
  });

  test('a sizing input the engine refuses', () => {
    expect(() => underflowHelp({ ...FILE_G, equity: '0' }, CONTEXT)).toThrow(
      Engine4InputError
    );
  });
});

describe('against the independent oracle (scripts/engine4/oracle.py)', () => {
  const cases = loadOracle().cases;

  test.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const context: UnderflowContext = {
      maxRiskPct: c.input.max_risk_pct,
      minSld: c.input.min_sld,
      structuralStopDistances: c.input.structural_stops,
    };
    const found = underflowHelp(toSizingInput(c.input), context);
    const want = c.underflow;
    if (want === null) {
      expect(found).toBeNull();
      return;
    }
    expect(found).not.toBeNull();
    if (found === null) return;

    const problems: string[] = [];
    sameText(problems, 'causes', found.causes.join('+'), want.causes.join('+'));
    sameValue(problems, 'minLotLoss', found.minLotLoss, want.min_lot_loss);
    sameValue(
      problems,
      'minLotRiskPct',
      found.minLotRiskPct,
      want.min_lot_risk_pct
    );

    sameText(
      problems,
      'option kinds',
      found.options.map((o) => o.kind).join(','),
      want.options.map((o) => o['kind']).join(',')
    );
    found.options.forEach((option, index) => {
      const w = want.options[index];
      if (w === undefined || w['kind'] !== option.kind) return;
      const at = `option ${index} ${option.kind}`;
      if (option.kind === 'RAISE_RISK') {
        sameValue(problems, `${at} riskPct`, option.riskPct, w['risk_pct']);
        sameValue(
          problems,
          `${at} riskPctExact`,
          option.riskPctExact,
          w['risk_pct_exact']
        );
        sameValue(problems, `${at} lot`, option.lot, w['lot']);
        sameValue(
          problems,
          `${at} actualRisk`,
          option.actualRisk,
          w['actual_risk']
        );
      } else if (option.kind === 'NEARER_STRUCTURAL_STOP') {
        sameValue(
          problems,
          `${at} stopDistance`,
          option.stopDistance,
          w['stop_distance']
        );
        sameValue(problems, `${at} lot`, option.lot, w['lot']);
        sameValue(
          problems,
          `${at} actualRisk`,
          option.actualRisk,
          w['actual_risk']
        );
        sameValue(
          problems,
          `${at} actualRiskPct`,
          option.actualRiskPct,
          w['actual_risk_pct']
        );
      }
    });

    sameText(
      problems,
      'fact kinds',
      found.facts.map((f) => f.kind).join(','),
      want.facts.map((f) => f['kind']).join(',')
    );
    found.facts.forEach((fact, index) => {
      const w = want.facts[index];
      if (w === undefined || w['kind'] !== fact.kind) return;
      const at = `fact ${index} ${fact.kind}`;
      sameValue(problems, `${at} equity`, fact.equity, w['equity']);
      if (fact.kind === 'EQUITY_NEEDED_FOR_RISK') {
        sameValue(
          problems,
          `${at} atRiskPct`,
          fact.atRiskPct,
          w['at_risk_pct']
        );
      } else {
        sameValue(
          problems,
          `${at} atMaxLeverage`,
          fact.atMaxLeverage,
          w['at_max_leverage']
        );
      }
    });
    expect(problems).toEqual([]);
  });

  test('the corpus holds a raise, a nearer stop and a leverage underflow', () => {
    const optionKinds = new Set(
      cases.flatMap((c) => (c.underflow?.options ?? []).map((o) => o['kind']))
    );
    expect(optionKinds).toEqual(
      new Set(['RAISE_RISK', 'NEARER_STRUCTURAL_STOP', 'DECLINE'])
    );
    const factKinds = new Set(
      cases.flatMap((c) => (c.underflow?.facts ?? []).map((f) => f['kind']))
    );
    expect(factKinds).toEqual(
      new Set(['EQUITY_NEEDED_FOR_RISK', 'EQUITY_NEEDED_FOR_LEVERAGE'])
    );
  });
});
