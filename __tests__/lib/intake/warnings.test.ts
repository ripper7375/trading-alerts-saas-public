/**
 * @jest-environment node
 */

/**
 * Warnings (`lib/intake/warnings.ts`, ADR-041, plan decision D2 b): the usable sensors that
 * say STAND_ASIDE or that take the side opposite to a directional synthesis.
 */

import {
  WARNING_KINDS,
  findWarnings,
  opposes,
  type Bias,
  type SensorStatus,
} from '@/lib/intake';

type Row = { mcd_id: string; status: SensorStatus; bias: Bias | null };
const row = (mcd_id: string, status: SensorStatus, bias: Bias | null): Row => ({
  mcd_id,
  status,
  bias,
});

describe('the kinds of warning', () => {
  it('are two: a sensor that stands aside, and one that opposes the synthesis', () => {
    expect([...WARNING_KINDS]).toEqual(['STAND_ASIDE', 'OPPOSES_SYNTHESIS']);
  });
});

describe('opposes', () => {
  it.each([
    ['LONG', 'SHORT', true],
    ['SHORT', 'LONG', true],
    ['LONG', 'LONG', false],
    ['SHORT', 'SHORT', false],
    ['LONG', 'NEUTRAL', false],
    ['NEUTRAL', 'SHORT', false],
    ['STAND_ASIDE', 'LONG', false],
    ['LONG', 'STAND_ASIDE', false],
    ['NEUTRAL', 'NEUTRAL', false],
    [null, 'LONG', false],
    ['SHORT', null, false],
    [null, null, false],
  ] as const)('%s against %s is %s', (a, b, expected) => {
    expect(opposes(a, b)).toBe(expected);
  });
});

describe('findWarnings', () => {
  it('names a usable sensor that stands aside, whatever the synthesis says', () => {
    for (const synthesis of [
      'LONG',
      'SHORT',
      'NEUTRAL',
      'STAND_ASIDE',
      null,
    ] as const) {
      expect(
        findWarnings([row('MCD3', 'CAUTIONARY', 'STAND_ASIDE')], synthesis)
      ).toEqual([{ mcd_id: 'MCD3', kind: 'STAND_ASIDE' }]);
    }
  });

  it('names a sensor that takes the other side of a directional synthesis', () => {
    expect(findWarnings([row('MCD2', 'VALID', 'LONG')], 'SHORT')).toEqual([
      { mcd_id: 'MCD2', kind: 'OPPOSES_SYNTHESIS' },
    ]);
    expect(findWarnings([row('MCD2', 'VALID', 'SHORT')], 'LONG')).toEqual([
      { mcd_id: 'MCD2', kind: 'OPPOSES_SYNTHESIS' },
    ]);
  });

  it('does not name a sensor that agrees, or takes no side', () => {
    expect(findWarnings([row('MCD1', 'VALID', 'LONG')], 'LONG')).toEqual([]);
    expect(
      findWarnings([row('MCD3', 'CAUTIONARY', 'NEUTRAL')], 'LONG')
    ).toEqual([]);
    expect(
      findWarnings([row('MCD3', 'CAUTIONARY', 'NEUTRAL')], 'SHORT')
    ).toEqual([]);
  });

  it('finds nothing to oppose when the synthesis has no direction', () => {
    for (const synthesis of ['NEUTRAL', 'STAND_ASIDE', null] as const) {
      expect(
        findWarnings(
          [row('MCD1', 'VALID', 'LONG'), row('MCD2', 'VALID', 'SHORT')],
          synthesis
        )
      ).toEqual([]);
    }
  });

  it('never names a sensor that is not usable', () => {
    expect(
      findWarnings(
        [
          row('MCD1', 'INVALID', 'STAND_ASIDE'),
          row('MCD2', 'STALE', 'LONG'),
          row('MCD3', 'ABSENT' as SensorStatus, 'SHORT'),
        ],
        'LONG'
      )
    ).toEqual([]);
  });

  it('goes on past a sensor that is not usable to the ones after it', () => {
    expect(
      findWarnings(
        [
          row('MCD1', 'INVALID', null),
          row('MCD2', 'STALE', null),
          row('MCD3', 'VALID', 'STAND_ASIDE'),
        ],
        'LONG'
      )
    ).toEqual([{ mcd_id: 'MCD3', kind: 'STAND_ASIDE' }]);
  });

  it('puts the warnings in the order of the MCD number whatever the order given', () => {
    const sensors = [
      row('MCD10', 'VALID', 'STAND_ASIDE'),
      row('MCD2', 'VALID', 'STAND_ASIDE'),
      row('MCD3', 'VALID', 'SHORT'),
    ];
    expect(findWarnings(sensors, 'LONG').map((w) => w.mcd_id)).toEqual([
      'MCD2',
      'MCD3',
      'MCD10',
    ]);
    expect(
      findWarnings([...sensors].reverse(), 'LONG').map((w) => w.mcd_id)
    ).toEqual(['MCD2', 'MCD3', 'MCD10']);
  });

  it('names a sensor once', () => {
    const twice = [
      row('MCD3', 'VALID', 'STAND_ASIDE'),
      row('MCD3', 'VALID', 'STAND_ASIDE'),
    ];
    expect(findWarnings(twice, 'LONG')).toHaveLength(1);
  });

  it('takes any iterable and an empty one', () => {
    expect(findWarnings([], 'LONG')).toEqual([]);
    expect(
      findWarnings(new Set([row('MCD1', 'VALID', 'SHORT')]), 'LONG')
    ).toHaveLength(1);
  });
});
