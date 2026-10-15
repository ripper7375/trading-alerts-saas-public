/**
 * @jest-environment node
 */

/**
 * The composer (build step 7 part 5; architecture 5.7, plan decisions D10, D11, D12): the six
 * sections of Report 1 from what the model wrote and what the engines said, as a result the
 * contract accepts. Direction is the synthesis reading's on every golden cycle (5.14 item 7).
 */

import { checkNumbers } from '@/lib/reply/checks/number-check';
import { checkReport1 } from '@/lib/reply/checks/report';
import {
  addressableIds,
  buildValueDictionary,
} from '@/lib/reply/checks/value-dictionary';
import { checkWording } from '@/lib/reply/checks/wording-check';
import { notVerifiedMark } from '@/lib/reply/checks/wording-lists';
import { LOCALES } from '@/lib/reply/contracts/intake';
import type { IntakePacket } from '@/lib/reply/contracts/intake';
import { validateAnswer } from '@/lib/reply/contracts/answer';
import { validateReport1 } from '@/lib/reply/contracts/report1';
import type { Report1Model } from '@/lib/reply/contracts/report1';
import {
  RESULT_LIMITS,
  validateReplyResult,
} from '@/lib/reply/contracts/result';
import {
  composeAnswerResult,
  composeReport1,
  composeReport1Result,
  directionEqualsSynthesis,
  flagReport1,
} from '@/lib/reply/report1/compose';
import type { ComposeOutcome } from '@/lib/reply/report1/compose';
import { invalidationText } from '@/lib/reply/report1/invalidation-line';
import { resolveText } from '@/lib/reply/report1/resolve';

import { fixtureFor } from '../checks/helpers/checks-fixtures';
import {
  FRAME,
  GOLDEN_IDS,
  TRADER_TYPE_LIST,
  contextOf,
  modelReportFor,
  overlay,
  worldOf,
} from './helpers/report1-fixtures';

type Rec = Record<string, any>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function must<T>(outcome: ComposeOutcome<T>): T {
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.failures));
  return outcome.value;
}
const failuresOf = <T>(outcome: ComposeOutcome<T>): string[] =>
  outcome.ok ? [] : outcome.failures.map((f) => `${f.code}|${f.path ?? ''}`);

describe('Report 1 on the 16 golden cycles', () => {
  it('is accepted by the contract with no issue, on all 16 cycles and both trader types', async () => {
    let composed = 0;
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const model = modelReportFor(packet, dictionary);
        // the model's own report is one the contracts and the checks accept
        expect(
          validateReport1(model, contextOf(packet, dictionary))
        ).toMatchObject({ ok: true });
        const checks = checkReport1(model, {
          dictionary,
          locale: packet.question.reply_locale,
          bias: packet.board.syn.bias,
        });
        expect({
          id,
          type,
          numbers: checks.numbers.violations.length,
          wording: checks.wording.violations,
        }).toEqual({
          id,
          type,
          numbers: 0,
          wording: 0,
        });

        const outcome = composeReport1Result({
          packet,
          dictionary,
          model,
          frame: FRAME,
        });
        const { result } = must(outcome);
        expect(validateReplyResult(result)).toEqual({
          ok: true,
          value: result,
        });
        composed += 1;
      }
    }
    expect(composed).toBe(32);
  });

  it('copies the direction from the synthesis reading on every golden scenario (5.14 item 7)', async () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const synthesis = packet.readings.synthesis as NonNullable<
          IntakePacket['readings']['synthesis']
        >;
        const reading = synthesis.reading as Rec;
        const out = must(
          composeReport1Result({
            packet,
            dictionary,
            model: modelReportFor(packet, dictionary),
            frame: FRAME,
          })
        );
        expect(out.directionEqualsSyn).toBe(true);
        expect(out.result.report.direction).toEqual({
          bias: reading['bias'],
          trend_relation: reading['trend_relation'] ?? null,
          rule_id: reading['rule_id'],
          archetype: reading['archetype'] ?? null,
          stand_aside: reading['stand_aside'],
          profile: type,
        });
        // and the same facts the board header carries
        expect(out.result.report.direction.bias).toBe(packet.board.syn.bias);
        expect(out.result.report.direction.rule_id).toBe(
          packet.board.syn.rule_id
        );
        expect(out.result.report.alignment.trend_relation).toBe(
          packet.board.syn.trend_relation
        );
      }
    }
  });

  it('shows the stored zones the model picked, field for field', async () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const stored = (packet.readings.synthesis?.zones ?? []) as Rec[];
        const { result } = must(
          composeReport1Result({
            packet,
            dictionary,
            model: modelReportFor(packet, dictionary),
            frame: FRAME,
          })
        );
        expect(result.report.zones).toHaveLength(stored.length);
        stored.forEach((zone, index) => {
          expect(result.report.zones[index]).toEqual({
            zone_id: zone['zone_id'],
            bias: zone['bias'],
            low: zone['low'],
            high: zone['high'],
            reference_price: zone['reference_price'],
            invalidation_price: zone['invalidation_price'],
            invalidation_basis: zone['invalidation_basis'],
            stop_distance: zone['stop_distance'],
            next_opposing_price: zone['next_opposing_level']?.price ?? null,
            runway: zone['runway'] ?? null,
            runway_ratio: zone['runway_ratio'] ?? null,
            source_sensors: zone['source_sensors'],
            confluence_count: zone['confluence_count'],
          });
        });
      }
    }
  });

  it('carries the data stamp, the calendar and the channels of the packet', async () => {
    for (const id of GOLDEN_IDS) {
      const { packet, dictionary } = await worldOf(id.slice(0, 2));
      const { result } = must(
        composeReport1Result({
          packet,
          dictionary,
          model: modelReportFor(packet, dictionary),
          frame: FRAME,
        })
      );
      expect(result.stamp).toEqual({
        as_of: packet.data.cycle_slot,
        data_status: 'FRESH',
        retuning: false,
        flags: packet.data.flags,
      });
      expect(result.report.news).toEqual({
        status: packet.events.status,
        calendar_age_seconds: packet.events.calendar_age_seconds,
        items: packet.events.items,
      });
      expect(result.report.alignment.channels.map((c) => c.mcd_id)).toEqual(
        packet.board.sensors
          .map((line) => line.mcd_id)
          .filter((mcd) => mcd === 'MCD1' || mcd === 'MCD2')
      );
      expect(result.reply_locale).toBe(packet.question.reply_locale);
      expect(result.intent).toBe('DIRECTION');
    }
  });

  it('leaves no brace and no id of the model in any text it composes', async () => {
    for (const id of GOLDEN_IDS) {
      const { packet, dictionary } = await worldOf(id.slice(0, 2));
      const { result } = must(
        composeReport1Result({
          packet,
          dictionary,
          model: modelReportFor(packet, dictionary),
          frame: FRAME,
        })
      );
      const texts = [
        result.report.headline,
        ...result.report.alignment.lines.map((l) => l.text),
        ...result.report.watch.map((l) => l.text),
        ...result.report.risks.map((l) => l.text),
      ];
      for (const text of texts) expect(text).not.toMatch(/[{}]/);
    }
  });
});

describe('the 18 Sep counter-trend rally, read out', () => {
  async function eighteenSep() {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const { result, addedInvalidation } = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    return { packet, dictionary, model, result, addedInvalidation };
  }

  it('states LONG, counter-trend, rule 1, archetype C, for the day trader', async () => {
    const { result } = await eighteenSep();
    expect(result.report.direction).toEqual({
      bias: 'LONG',
      trend_relation: 'COUNTER_TREND',
      rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
      archetype: 'C',
      stand_aside: false,
      profile: 'DAY_TRADER',
    });
  });

  it('composes the zone Z1 as it is stored: band, invalidation, room, confluence', async () => {
    const { result } = await eighteenSep();
    expect(result.report.zones[0]).toEqual({
      zone_id: 'Z1',
      bias: 'LONG',
      low: 4363.79,
      high: 4370.61,
      reference_price: 4367.2,
      invalidation_price: 4350.42,
      invalidation_basis: 'LEVEL',
      stop_distance: 16.78,
      next_opposing_price: 4369.57,
      runway: 2.37,
      runway_ratio: 0.14,
      source_sensors: ['MCD2'],
      confluence_count: 2,
    });
  });

  it("writes the model's lines with every figure filled, and the board's channels beside them", async () => {
    const { result } = await eighteenSep();
    expect(result.report.headline).toMatch(
      /^Price near 4,378\.31 inside the day range [\d,]+\.\d{2} to [\d,]+\.\d{2}$/
    );
    expect(result.report.alignment.lines.map((l) => l.text)).toEqual([
      'MCD1 reads MCD1_DOWN_UPPER_BREAKOUT',
      'MCD2 reads MCD2_UP_IN_CORRIDOR',
      'MCD3 reads MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
    ]);
    expect(result.report.alignment.channels).toEqual([
      {
        mcd_id: 'MCD1',
        timeframe: 'M15',
        status: 'CAUTIONARY',
        state_code: 'MCD1_DOWN_UPPER_BREAKOUT',
        bias: 'LONG',
      },
      {
        mcd_id: 'MCD2',
        timeframe: 'M5',
        status: 'CAUTIONARY',
        state_code: 'MCD2_UP_IN_CORRIDOR',
        bias: 'LONG',
      },
    ]);
    expect(result.report.watch.map((l) => l.text)).toEqual([
      'A close beyond 4,350.42 cancels the view for Z1',
      'A close beyond 4,334.06 cancels the view for Z2',
    ]);
    expect(result.report.risks.map((l) => l.text)).toEqual([
      'MCD1 is cautionary',
      'MCD2 is cautionary',
    ]);
  });

  it('lists the levels of the sensors and the context levels the zones lean on, each quoted by its id', async () => {
    const { result, dictionary } = await eighteenSep();
    const byId = new Map(result.report.levels.map((l) => [l.id, l]));
    expect(byId.get('MCD2.baseline')).toEqual({
      id: 'MCD2.baseline',
      kind: 'CHANNEL',
      timeframe: 'M5',
      name: 'baseline',
      price: 4367.2,
    });
    expect(byId.get('MCD1.UOEDT')).toMatchObject({
      kind: 'CHANNEL',
      timeframe: 'M15',
      price: 4279.46,
    });
    // the same name on two timeframes is quoted with its timeframe
    expect(byId.get('MCD3.M5.UOEDT')).toMatchObject({
      price: 4384.23,
      timeframe: 'M5',
    });
    expect(byId.get('MCD3.M15.UOEDT')).toMatchObject({
      price: 4279.46,
      timeframe: 'M15',
    });
    const context = result.report.levels.filter((l) => l.kind === 'CONTEXT');
    expect(
      context.map((l) => `${l.timeframe} ${l.name} ${l.price}`).sort()
    ).toEqual(expect.arrayContaining(['M15 sr_1 4369.57', 'M15 sr_2 4350.92']));
    // every level is a price the dictionary holds, at that price, under that id
    for (const level of result.report.levels) {
      const entry = dictionary.byId.get(level.id);
      expect(entry?.kind).toBe('PRICE');
      expect(entry?.value).toBe(level.price);
    }
    // highest price first, no id twice
    const prices = result.report.levels.map((l) => l.price);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
    expect(new Set(result.report.levels.map((l) => l.id)).size).toBe(
      result.report.levels.length
    );
  });

  it('never states a level the dictionary cannot vouch for', async () => {
    const { packet, dictionary } = await eighteenSep();
    const { result } = must(
      composeReport1Result({
        packet,
        dictionary: {
          entries: dictionary.entries.filter((e) => !e.id.includes('baseline')),
          byId: new Map(
            [...dictionary.byId].filter(([id]) => !id.includes('baseline'))
          ),
        },
        model: modelReportFor(packet, dictionary),
        frame: FRAME,
      })
    );
    expect(result.report.levels.some((l) => l.name === 'baseline')).toBe(false);
    expect(result.report.levels.length).toBeGreaterThan(0);
  });
});

describe("direction is never the model's", () => {
  it('keeps the synthesis direction whatever the headline says', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model: Report1Model = {
      ...modelReportFor(packet, dictionary),
      headline: 'Sell the rally, this is a short setup',
    };
    const { result } = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    expect(result.report.direction.bias).toBe('LONG');
    expect(result.report.headline).toBe(
      'Sell the rally, this is a short setup'
    );
  });

  it('refuses a model that writes a direction field (the contract of part 1 keeps it out)', async () => {
    const { packet, dictionary } = await worldOf('01');
    const verdict = validateReport1(
      { ...modelReportFor(packet, dictionary), direction: 'SHORT' },
      contextOf(packet, dictionary)
    );
    expect(verdict).toMatchObject({ ok: false });
    if (!verdict.ok)
      expect(verdict.issues.map((i) => i.code)).toContain('FORBIDDEN_KEY');
  });

  it('says so when a direction line and the reading differ', async () => {
    const { packet, dictionary } = await worldOf('01');
    const { result } = must(
      composeReport1Result({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
        frame: FRAME,
      })
    );
    const direction = result.report.direction;
    expect(directionEqualsSynthesis(packet, direction)).toBe(true);
    for (const change of [
      { bias: 'SHORT' },
      { trend_relation: 'WITH_TREND' },
      { trend_relation: null },
      { rule_id: 'R2_OTHER' },
      { archetype: 'D' },
      { archetype: null },
      { stand_aside: true },
      { profile: 'SCALPER' },
    ] as const) {
      expect(
        directionEqualsSynthesis(packet, {
          ...direction,
          ...change,
        } as typeof direction)
      ).toBe(false);
    }
    expect(
      directionEqualsSynthesis(
        { ...packet, readings: { ...packet.readings, synthesis: null } },
        direction
      )
    ).toBe(false);
  });

  it('states a stand-aside synthesis as stand-aside, with no zones, and a watch line', async () => {
    const { packet, dictionary } = await worldOf('09');
    const { result } = must(
      composeReport1Result({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
        frame: FRAME,
      })
    );
    expect(result.report.direction).toMatchObject({
      bias: 'STAND_ASIDE',
      stand_aside: true,
      rule_id: 'R4_RANGE',
      archetype: 'D',
    });
    expect(result.report.zones).toEqual([]);
    expect(result.report.watch.length).toBeGreaterThan(0);
  });
});

describe('the invalidation line (the structural row, decision D12)', () => {
  it('is added for every chosen zone whose invalidation the model did not give, in every language', async () => {
    const { packet: base, dictionary } = await worldOf('01');
    for (const locale of LOCALES) {
      const packet = overlay(base, { locale });
      const model = modelReportFor(packet, dictionary, {
        withInvalidation: false,
      });
      expect(model.zones).toEqual(['Z1', 'Z2']);
      const out = must(
        composeReport1Result({ packet, dictionary, model, frame: FRAME })
      );
      expect(out.addedInvalidation).toEqual(['Z1', 'Z2']);
      const watch = out.result.report.watch;
      expect(watch).toHaveLength(model.watch.length + 2);
      const added = watch.slice(model.watch.length);
      expect(added.map((l) => l.cites)).toEqual([['Z1'], ['Z2']]);

      // the line names the zone, carries the price in the notation of the language, and is
      // a sentence the wording check and the number check accept
      const prices = ['{Z1.invalidation}', '{Z2.invalidation}'].map((id) => {
        const r = resolveText(id, 't', dictionary, {
          locale,
          referenceSeconds: null,
        });
        if (!r.ok) throw new Error('unresolved');
        return r.text;
      });
      added.forEach((line, index) => {
        expect(line.text).toContain(`Z${index + 1}`);
        expect(line.text).toContain(prices[index] as string);
        expect(line.text).not.toMatch(/[{}]/);
        expect(
          checkWording([{ path: 'x', text: line.text }], locale, 'LONG')
            .violations
        ).toBe(0);
        expect(
          checkNumbers([{ path: 'x', text: line.text }], dictionary, locale)
            .violations
        ).toEqual([]);
      });
    }
  });

  it('is added only for the zones that lack one', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const partial: Report1Model = {
      ...model,
      watch: model.watch.filter((line) => line.cites[0] === 'Z1'),
    };
    const out = must(
      composeReport1Result({ packet, dictionary, model: partial, frame: FRAME })
    );
    expect(out.addedInvalidation).toEqual(['Z2']);
    expect(out.result.report.watch).toHaveLength(2);
    expect(out.result.report.watch[1]?.cites).toEqual(['Z2']);
  });

  it('is not added when the model gave every one', async () => {
    const { packet, dictionary } = await worldOf('01');
    const out = must(
      composeReport1Result({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
        frame: FRAME,
      })
    );
    expect(out.addedInvalidation).toEqual([]);
    expect(out.result.report.watch).toHaveLength(2);
  });

  it("keeps room for one line per zone beside the model's four: nine in all", async () => {
    const { packet, dayBars } = await fiveZones();
    const dictionary = buildValueDictionary(packet, dayBars);
    const model: Report1Model = {
      ...modelReportFor(packet, dictionary, { withInvalidation: false }),
      watch: [1, 2, 3, 4].map((n) => ({
        text: `Watch the M15 channel, line ${n}`,
        cites: ['MCD1'],
      })),
    };
    expect(model.zones).toHaveLength(5);
    const out = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    expect(out.result.report.watch).toHaveLength(RESULT_LIMITS.watchLines);
    expect(RESULT_LIMITS.watchLines).toBe(9);
    expect(out.addedInvalidation).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
  });
});

async function fiveZones() {
  const fx = await fixtureFor('01');
  const packet = clone(fx.packet) as IntakePacket;
  const synthesis = packet.readings.synthesis as NonNullable<
    IntakePacket['readings']['synthesis']
  >;
  const first = synthesis.zones[0] as Rec;
  synthesis.zones = [1, 2, 3, 4, 5].map((n) => ({
    ...first,
    zone_id: `Z${n}`,
    rank: n,
    low: 4300 + n,
    high: 4310 + n,
    reference_price: 4305 + n,
    invalidation_price: 4290 + n,
    stop_distance: 15 + n,
  }));
  return { packet, dayBars: fx.dayBars };
}

describe('the zones the model picked', () => {
  it('keeps the order the model chose, and only those', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const only2 = must(
      composeReport1({ packet, dictionary, model: { ...model, zones: ['Z2'] } })
    );
    expect(only2.report.zones.map((z) => z.zone_id)).toEqual(['Z2']);
    const swapped = must(
      composeReport1({
        packet,
        dictionary,
        model: { ...model, zones: ['Z2', 'Z1'] },
      })
    );
    expect(swapped.report.zones.map((z) => z.zone_id)).toEqual(['Z2', 'Z1']);
    const none = must(
      composeReport1({ packet, dictionary, model: { ...model, zones: [] } })
    );
    expect(none.report.zones).toEqual([]);
  });

  it('refuses a zone that is not in the reading', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = { ...modelReportFor(packet, dictionary), zones: ['Z4'] };
    expect(failuresOf(composeReport1({ packet, dictionary, model }))).toEqual([
      'UNKNOWN_ZONE|',
    ]);
  });

  const DAMAGE: [string, (zone: Rec) => void][] = [
    ['no zone id', (z) => delete z['zone_id']],
    ['a bias that is not a side', (z) => (z['bias'] = 'NEUTRAL')],
    [
      'a basis the contract does not know',
      (z) => (z['invalidation_basis'] = 'GUESS'),
    ],
    ['a missing basis', (z) => delete z['invalidation_basis']],
    ['a negative low', (z) => (z['low'] = -1)],
    ['a price that is a string', (z) => (z['reference_price'] = '4367.2')],
    ['a missing invalidation price', (z) => delete z['invalidation_price']],
    [
      'a stop distance that is not finite',
      (z) => (z['stop_distance'] = Number.POSITIVE_INFINITY),
    ],
    [
      'a band that starts above where it ends',
      (z) => ((z['low'] = 5000), (z['high'] = 4000)),
    ],
    ['a runway that is not a number', (z) => (z['runway'] = 'far')],
    ['a negative runway ratio', (z) => (z['runway_ratio'] = -0.5)],
    [
      'a next opposing level without a price',
      (z) => (z['next_opposing_level'] = { price: 'x' }),
    ],
    ['sources that are not a list', (z) => (z['source_sensors'] = 'MCD2')],
    ['a source that is not a sensor', (z) => (z['source_sensors'] = ['MCD99'])],
    ['a source twice', (z) => (z['source_sensors'] = ['MCD2', 'MCD2'])],
    [
      'sixteen sources',
      (z) =>
        (z['source_sensors'] = Array.from(
          { length: 16 },
          (_, i) => `MCD${(i % 15) + 1}`
        )),
    ],
    [
      'a confluence count that is not whole',
      (z) => (z['confluence_count'] = 1.5),
    ],
    ['a confluence count over 64', (z) => (z['confluence_count'] = 65)],
    ['a negative confluence count', (z) => (z['confluence_count'] = -1)],
  ];

  it.each(DAMAGE)(
    'refuses a stored zone with %s instead of repairing it',
    async (_what, damage) => {
      const { packet, dictionary } = await worldOf('01');
      const broken = clone(packet) as IntakePacket;
      damage((broken.readings.synthesis as any).zones[0]);
      const outcome = composeReport1({
        packet: broken,
        dictionary,
        model: { ...modelReportFor(packet, dictionary), zones: ['Z1'] },
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        // a zone with no id cannot be found by the id the model chose; every other damage is the zone's own
        expect(outcome.failures[0]?.code).toBe(
          _what === 'no zone id' ? 'UNKNOWN_ZONE' : 'BAD_ZONE'
        );
      }
    }
  );

  it('accepts a zone with no runway, no next level and no ratio (a null is not a number to refuse)', async () => {
    const { packet, dictionary } = await worldOf('01');
    const open = clone(packet) as IntakePacket;
    const zone = (open.readings.synthesis as any).zones[0] as Rec;
    zone['runway'] = null;
    zone['runway_ratio'] = null;
    zone['next_opposing_level'] = null;
    const { report } = must(
      composeReport1({
        packet: open,
        dictionary,
        model: { ...modelReportFor(packet, dictionary), zones: ['Z1'] },
      })
    );
    expect(report.zones[0]).toMatchObject({
      runway: null,
      runway_ratio: null,
      next_opposing_price: null,
    });
  });
});

describe('a synthesis that cannot be copied', () => {
  it('fails when the packet has none', async () => {
    const { packet, dictionary } = await worldOf('01');
    const none = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    expect(
      failuresOf(
        composeReport1({
          packet: none,
          dictionary,
          model: modelReportFor(packet, dictionary),
        })
      )
    ).toEqual(['NO_SYNTHESIS|']);
  });

  const BROKEN: [string, (reading: Rec) => void][] = [
    ['a bias the contract does not know', (r) => (r['bias'] = 'UP')],
    ['no bias', (r) => delete r['bias']],
    [
      'a trend relation it does not know',
      (r) => (r['trend_relation'] = 'SIDEWAYS'),
    ],
    ['no trend relation key', (r) => delete r['trend_relation']],
    ['a rule id that is malformed', (r) => (r['rule_id'] = 'rule one')],
    ['no rule id', (r) => delete r['rule_id']],
    ['an archetype it does not know', (r) => (r['archetype'] = 'Z')],
    ['an archetype that is a number', (r) => (r['archetype'] = 1)],
    ['no stand-aside flag', (r) => delete r['stand_aside']],
    ['a stand-aside flag that is a string', (r) => (r['stand_aside'] = 'no')],
  ];

  it.each(BROKEN)('fails, saying so, with %s', async (_what, damage) => {
    const { packet, dictionary } = await worldOf('01');
    const broken = clone(packet) as IntakePacket;
    damage((broken.readings.synthesis as any).reading);
    expect(
      failuresOf(
        composeReport1({
          packet: broken,
          dictionary,
          model: modelReportFor(packet, dictionary),
        })
      )
    ).toEqual(['BAD_SYNTHESIS|']);
  });

  it('takes a missing archetype as none, and a null trend relation (a no-match reading has neither)', async () => {
    const { packet, dictionary } = await worldOf('15');
    const reading = (packet.readings.synthesis as any).reading as Rec;
    expect(reading['archetype']).toBeNull();
    expect(reading['trend_relation']).toBeNull();
    delete reading['archetype'];
    const { report } = must(
      composeReport1({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
      })
    );
    expect(report.direction).toMatchObject({
      archetype: null,
      trend_relation: null,
      bias: 'NEUTRAL',
    });
  });
});

describe('a placeholder that cannot be filled', () => {
  it('fails the composition, naming the id and the place', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const outcome = composeReport1({
      packet,
      dictionary,
      model: {
        ...model,
        headline: 'Near {NOPE.price}',
        risks: [{ text: 'Room to {GONE.level}', cites: ['MCD1'] }],
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failures.map((f) => `${f.code}|${f.path}`)).toEqual([
        'UNKNOWN_ID|headline',
        'UNKNOWN_ID|risks[0].text',
      ]);
    }
  });

  it('names the place of a failure in the rationale lines and in the watch lines', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const outcome = composeReport1({
      packet,
      dictionary,
      model: {
        ...model,
        rationale: [{ text: 'Near {NOPE.a}', cites: ['MCD1'] }],
        watch: [
          { text: 'Fine', cites: ['MCD1'] },
          { text: 'Then {NOPE.b}', cites: ['MCD1'] },
        ],
      },
    });
    expect(failuresOf(outcome)).toEqual([
      'UNKNOWN_ID|rationale[0].text',
      'UNKNOWN_ID|watch[1].text',
    ]);
    const only = (patch: Partial<Report1Model>) =>
      failuresOf(
        composeReport1({ packet, dictionary, model: { ...model, ...patch } })
      );
    expect(
      only({ rationale: [{ text: '{NOPE.a}', cites: ['MCD1'] }] })
    ).toEqual(['UNKNOWN_ID|rationale[0].text']);
    expect(only({ watch: [{ text: '{NOPE.b}', cites: ['MCD1'] }] })).toEqual([
      'UNKNOWN_ID|watch[0].text',
    ]);
    expect(only({ risks: [{ text: '{NOPE.c}', cites: ['MCD1'] }] })).toEqual([
      'UNKNOWN_ID|risks[0].text',
    ]);
  });

  it('gives no result at all when the composition fails: the failures come through whole', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const unknown = composeReport1Result({
      packet,
      dictionary,
      model: { ...model, headline: '{NOPE.x}' },
      frame: FRAME,
    });
    expect(unknown.ok).toBe(false);
    expect(failuresOf(unknown)).toEqual(['UNKNOWN_ID|headline']);
    const none = composeReport1Result({
      packet: { ...packet, readings: { ...packet.readings, synthesis: null } },
      dictionary,
      model,
      frame: FRAME,
    });
    expect(failuresOf(none)).toEqual(['NO_SYNTHESIS|']);
    expect('value' in none).toBe(false);
  });

  it('fails for an id the dictionary has but the prompt never offered', async () => {
    const { packet, dictionary } = await worldOf('01');
    const matchOnly = dictionary.entries.find((e) => !e.addressable)
      ?.id as string;
    const outcome = composeReport1({
      packet,
      dictionary,
      model: {
        ...modelReportFor(packet, dictionary),
        headline: `See {${matchOnly}}`,
      },
    });
    expect(failuresOf(outcome)).toEqual(['NOT_OFFERED|headline']);
  });

  it("fails on a stray brace in the model's text", async () => {
    const { packet, dictionary } = await worldOf('01');
    const outcome = composeReport1({
      packet,
      dictionary,
      model: {
        ...modelReportFor(packet, dictionary),
        headline: 'Price {LAST_PRICE',
      },
    });
    expect(failuresOf(outcome)).toEqual(['BAD_BRACES|headline']);
  });

  it('fails for the invalidation line of a zone whose price the dictionary lacks', async () => {
    const { packet, dictionary } = await worldOf('01');
    const stripped = {
      entries: dictionary.entries.filter((e) => e.id !== 'Z2.invalidation'),
      byId: new Map(
        [...dictionary.byId].filter(([id]) => id !== 'Z2.invalidation')
      ),
    };
    const outcome = composeReport1({
      packet,
      dictionary: stripped,
      model: modelReportFor(packet, dictionary, { withInvalidation: false }),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failures.map((f) => `${f.code}|${f.path}`)).toEqual([
        'UNKNOWN_ID|watch[2].text',
      ]);
    }
  });
});

describe('numbers that stayed unverified (decision D11)', () => {
  const typed = (text: string): Report1Model => ({
    headline: text,
    zones: [],
    rationale: [{ text: 'MCD2 holds its baseline', cites: ['MCD2'] }],
    watch: [{ text: 'A new M15 state changes the picture', cites: ['MCD1'] }],
    risks: [],
  });

  it('are replaced by the "not verified" mark of the reply\'s language, in all 19 languages', async () => {
    const { packet: base, dictionary } = await worldOf('01');
    for (const locale of LOCALES) {
      const packet = overlay(base, { locale });
      const model = typed('Support near 4350.72 and price {LAST_PRICE}');
      const first = checkReport1(model, { dictionary, locale, bias: 'LONG' });
      expect(first.numbers.violations).toHaveLength(1);
      const out = must(
        composeReport1Result({
          packet,
          dictionary,
          model,
          flagged: first.numbers.violations,
          frame: FRAME,
        })
      );
      const headline = out.result.report.headline;
      expect(headline).toContain(notVerifiedMark(locale));
      expect(headline).not.toContain('4350.72');
      const last = resolveText('{LAST_PRICE}', 't', dictionary, {
        locale,
        referenceSeconds: null,
      });
      expect(last.ok && headline.endsWith(` and price ${last.text}`)).toBe(
        true
      );
      expect(out.result.checks.numbers_flagged).toBe(1);
      // the figure that WAS an id is still filled, and the reply is one the contract accepts
      expect(validateReplyResult(out.result)).toMatchObject({ ok: true });
    }
  });

  it('take their dollar sign with them, and flag every one of several', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model: Report1Model = {
      headline: 'Support near $4350.72, resistance 4400.10 and 61% odds',
      zones: [],
      rationale: [{ text: 'MCD2 holds 4301.55', cites: ['MCD2'] }],
      watch: [{ text: 'A new M15 state changes the picture', cites: ['MCD1'] }],
      risks: [{ text: 'A drop to 4290.4 hurts', cites: ['MCD1'] }],
    };
    const first = checkReport1(model, {
      dictionary,
      locale: 'en-US',
      bias: 'LONG',
    });
    expect(first.numbers.violations.length).toBe(5);
    const out = must(
      composeReport1Result({
        packet,
        dictionary,
        model,
        flagged: first.numbers.violations,
        frame: FRAME,
      })
    );
    const mark = notVerifiedMark('en-US');
    expect(out.result.report.headline).toBe(
      `Support near ${mark}, resistance ${mark} and ${mark} odds`
    );
    expect(out.result.report.alignment.lines[0]?.text).toBe(
      `MCD2 holds ${mark}`
    );
    expect(out.result.report.risks[0]?.text).toBe(`A drop to ${mark} hurts`);
    expect(out.result.checks.numbers_flagged).toBe(5);
  });

  it('flag nothing when nothing was flagged, and change no other text', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    expect(flagReport1(model, [], 'en-US')).toBe(model);
    const out = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    expect(out.result.checks.numbers_flagged).toBe(0);
  });

  it('count only the literals of texts this reply has', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = typed('Support near 4350.72');
    const real = checkReport1(model, {
      dictionary,
      locale: 'en-US',
      bias: 'LONG',
    }).numbers.violations;
    const stray = [
      { ...(real[0] as (typeof real)[number]), path: 'rationale[9].text' },
    ];
    const out = must(
      composeReport1Result({
        packet,
        dictionary,
        model,
        flagged: [...real, ...stray],
        frame: FRAME,
      })
    );
    expect(out.result.checks.numbers_flagged).toBe(1);
  });

  it("keep the model's zones, cites and the other lines as they were", async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = {
      ...modelReportFor(packet, dictionary),
      headline: 'Support near 4350.72',
    };
    const first = checkReport1(model, {
      dictionary,
      locale: 'en-US',
      bias: 'LONG',
    });
    const flagged = flagReport1(model, first.numbers.violations, 'en-US');
    expect(flagged.zones).toEqual(model.zones);
    expect(flagged.rationale.map((l) => l.cites)).toEqual(
      model.rationale.map((l) => l.cites)
    );
    expect(flagged.watch).toEqual(model.watch);
    expect(flagged.risks).toEqual(model.risks);
    expect(flagged.headline).not.toBe(model.headline);
    expect(model.headline).toBe('Support near 4350.72'); // the input is not changed
  });
});

describe('the news block', () => {
  it('says an unavailable calendar aloud and carries the age of a late one', async () => {
    const { packet, dictionary } = await worldOf('01');
    for (const [status, age, items] of [
      ['UNAVAILABLE', null, []],
      ['LATE', 4000, packet.events.items],
      ['OK', 120, packet.events.items],
    ] as const) {
      const p = clone(packet) as IntakePacket;
      p.events = {
        ...p.events,
        status,
        calendar_age_seconds: age,
        items: [...items],
      };
      const { result } = must(
        composeReport1Result({
          packet: p,
          dictionary,
          model: modelReportFor(p, dictionary),
          frame: FRAME,
        })
      );
      expect(result.report.news.status).toBe(status);
      expect(result.report.news.calendar_age_seconds).toBe(age);
      expect(result.report.news.items).toHaveLength(items.length);
    }
  });

  it("marks an event's time approximate when the calendar said so, and carries no forecast", async () => {
    const { packet, dictionary } = await worldOf('01');
    const p = clone(packet) as IntakePacket;
    (p.events.items[0] as Rec)['approximate'] = true;
    const { result } = must(
      composeReport1Result({
        packet: p,
        dictionary,
        model: modelReportFor(p, dictionary),
        frame: FRAME,
      })
    );
    const item = result.report.news.items[0] as Rec;
    expect(item['approximate']).toBe(true);
    expect(Object.keys(item).sort()).toEqual(
      [
        'approximate',
        'currency',
        'event_id',
        'importance',
        'name',
        'tier1',
        'time',
      ].sort()
    );
    expect('forecast' in item).toBe(false); // the packet carries none: nothing to call "not published"
  });

  it('says nothing when there are no events', async () => {
    const { packet, dictionary } = await worldOf('01');
    const p = clone(packet) as IntakePacket;
    p.events = { ...p.events, items: [] };
    const { result } = must(
      composeReport1Result({
        packet: p,
        dictionary,
        model: modelReportFor(p, dictionary),
        frame: FRAME,
      })
    );
    expect(result.report.news.items).toEqual([]);
    expect(result.report.news.status).toBe('OK');
  });
});

describe('the frame of the result', () => {
  it('carries the thread, the request, the model, the regeneration, the changes and the notes', async () => {
    const { packet, dictionary } = await worldOf('01');
    const change = { mcd_id: 'MCD2', from: 'MCD2_UP_IN_CORRIDOR', to: null };
    const { result } = must(
      composeReport1Result({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
        frame: {
          ...FRAME,
          regenerations: 1,
          changes: [change],
          notes: ['CHART_OTHER_CYCLE'],
        },
      })
    );
    expect(result.thread_id).toBe(FRAME.threadId);
    expect(result.provenance).toEqual({
      request_id: FRAME.requestId,
      model: FRAME.model,
      prompt_version: FRAME.promptVersion,
      reply_version: '1.0.0',
    });
    expect(result.checks).toEqual({ numbers_flagged: 0, regenerations: 1 });
    expect(result.changes).toEqual([change]);
    expect(result.notes).toEqual(['CHART_OTHER_CYCLE']);
    expect(result.disclaimer_version).toBe('disclaimer-1');
  });

  it('labels a delayed, a closed-market and a retuned cycle in the stamp', async () => {
    const { packet, dictionary } = await worldOf('01');
    for (const [patch, expected] of [
      [
        { status: 'DELAYED' as const },
        { data_status: 'DELAYED', retuning: false },
      ],
      [
        { status: 'MARKET_CLOSED' as const },
        { data_status: 'MARKET_CLOSED', retuning: false },
      ],
      [{ retuning: true }, { data_status: 'FRESH', retuning: true }],
      [
        { flags: ['GATEWAY_UNREACHABLE' as const] },
        { data_status: 'FRESH', retuning: false },
      ],
    ] as const) {
      const p = overlay(packet, patch);
      const { result } = must(
        composeReport1Result({
          packet: p,
          dictionary,
          model: modelReportFor(p, dictionary),
          frame: FRAME,
        })
      );
      expect(result.stamp).toMatchObject(expected);
      expect(result.stamp.as_of).toBe(packet.data.cycle_slot);
    }
  });

  it('is refused by the contract when the frame is wrong, and says where', async () => {
    const { packet, dictionary } = await worldOf('01');
    const outcome = composeReport1Result({
      packet,
      dictionary,
      model: modelReportFor(packet, dictionary),
      frame: { ...FRAME, threadId: 'a thread with spaces!' },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failures.every((f) => f.code === 'INVALID_RESULT')).toBe(
        true
      );
      expect(outcome.failures.map((f) => f.path)).toContain('thread_id');
    }
  });

  it('is refused by the contract when a composed text is out of bounds', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = {
      ...modelReportFor(packet, dictionary),
      headline: 'x'.repeat(401),
    };
    const outcome = composeReport1Result({
      packet,
      dictionary,
      model,
      frame: FRAME,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok)
      expect(outcome.failures.map((f) => f.path)).toContain('report.headline');
  });
});

describe('what the composer does not touch', () => {
  it('changes neither the packet nor the model, and shares nothing with them', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = modelReportFor(packet, dictionary);
    const before = JSON.stringify({ packet, model });
    const { result } = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    expect(JSON.stringify({ packet, model })).toBe(before);

    // changing the result changes nothing it was made from
    result.report.zones[0]!.source_sensors.push('MCD3');
    result.report.news.items.push(result.report.news.items[0]!);
    result.report.alignment.lines[0]!.cites.push('MCD3');
    result.stamp.flags.push('SENSORS_NOT_LIVE');
    expect(JSON.stringify({ packet, model })).toBe(before);
  });

  it('gives the same result twice', async () => {
    const { packet, dictionary } = await worldOf('02', 'SCALPER');
    const model = modelReportFor(packet, dictionary);
    const a = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    const b = must(
      composeReport1Result({ packet, dictionary, model, frame: FRAME })
    );
    expect(a).toEqual(b);
  });
});

describe('more levels than a result holds', () => {
  it('keeps the 40 nearest the last price, highest first', async () => {
    const fx = await fixtureFor('01');
    const packet = clone(fx.packet) as IntakePacket;
    const sensor = packet.readings.sensors.find(
      (s) => s.mcd_id === 'MCD2'
    ) as Rec;
    sensor['envelope']['levels'] = Array.from({ length: 60 }, (_, i) => ({
      name: `L${i + 1}`,
      tf: 'M5',
      price: 4000 + i * 10,
      role: 'support',
    }));
    const dictionary = buildValueDictionary(packet, fx.dayBars);
    const { report } = must(
      composeReport1({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
      })
    );
    expect(report.levels).toHaveLength(RESULT_LIMITS.levels);
    const last = packet.data.last_price?.price as number;
    const kept = report.levels.map((l) => Math.abs(l.price - last));
    const dropped = [...dictionary.byId.values()]
      .filter((e) => e.id.startsWith('MCD2.L'))
      .filter((e) => !report.levels.some((l) => l.id === e.id))
      .map((e) => Math.abs(e.value - last));
    expect(dropped.length).toBeGreaterThan(0);
    expect(Math.max(...kept)).toBeLessThanOrEqual(Math.min(...dropped) + 1e-9);
    const prices = report.levels.map((l) => l.price);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });

  it('keeps the first 40 by price when there is no last price to be near', async () => {
    const fx = await fixtureFor('01');
    const packet = clone(fx.packet) as IntakePacket;
    packet.data.last_price = null;
    const sensor = packet.readings.sensors.find(
      (s) => s.mcd_id === 'MCD2'
    ) as Rec;
    sensor['envelope']['levels'] = Array.from({ length: 60 }, (_, i) => ({
      name: `L${i + 1}`,
      tf: 'M5',
      price: 4000 + i * 10,
      role: 'support',
    }));
    const dictionary = buildValueDictionary(packet, fx.dayBars);
    const { report } = must(
      composeReport1({
        packet,
        dictionary,
        model: modelReportFor(packet, dictionary),
      })
    );
    expect(report.levels).toHaveLength(40);
    expect(Math.max(...report.levels.map((l) => l.price))).toBeGreaterThan(
      4500
    );
  });
});

describe('a short answer', () => {
  const answerOf = (
    text: string,
    action: 'OPEN_TRADE_SETUP' | null = null
  ) => ({
    locale: 'en-US',
    text,
    cites: ['MCD1'],
    action,
  });

  it('fills its text, keeps its cites and is accepted by the contract', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = answerOf(
      'UOEDT is the upper edge of the M15 corridor; it is {MCD1.UOEDT} now.'
    );
    expect(
      validateAnswer(model, {
        replyLocale: 'en-US',
        valueIds: addressableIds(dictionary),
        citeIds: ['MCD1'],
      })
    ).toMatchObject({ ok: true });
    const result = must(
      composeAnswerResult({
        packet: { ...packet, intent: 'EXPLAIN' },
        dictionary,
        model,
        report2Open: true,
        frame: FRAME,
      })
    );
    expect(result.kind).toBe('ANSWER');
    expect(result.answer).toEqual({
      text: 'UOEDT is the upper edge of the M15 corridor; it is 4,279.46 now.',
      cites: ['MCD1'],
    });
    expect(result.action).toBeNull();
    expect(result.intent).toBe('EXPLAIN');
    expect(validateReplyResult(result)).toMatchObject({ ok: true });
  });

  it("keeps the Trade Setup action only when the gate lets Report 2 open, with the server's cycle, trader type and zones", async () => {
    const { packet, dictionary } = await worldOf('01', 'SCALPER');
    const model = answerOf(
      'Open the trade setup to size it',
      'OPEN_TRADE_SETUP'
    );
    const open = must(
      composeAnswerResult({
        packet: { ...packet, intent: 'RISK_SIZING' },
        dictionary,
        model,
        report2Open: true,
        frame: FRAME,
      })
    );
    expect(open.action).toEqual({
      type: 'OPEN_TRADE_SETUP',
      cycle_slot: '2026-09-18T20:55Z',
      trader_type: 'SCALPER',
      zone_ids: ['Z1', 'Z2'],
    });
    const given = must(
      composeAnswerResult({
        packet: { ...packet, intent: 'RISK_SIZING' },
        dictionary,
        model,
        report2Open: true,
        zoneIds: ['Z2'],
        frame: FRAME,
      })
    );
    expect(given.action?.zone_ids).toEqual(['Z2']);
    const shut = must(
      composeAnswerResult({
        packet: { ...packet, intent: 'RISK_SIZING' },
        dictionary,
        model,
        report2Open: false,
        frame: FRAME,
      })
    );
    expect(shut.action).toBeNull();
    const none = must(
      composeAnswerResult({
        packet: {
          ...packet,
          intent: 'RISK_SIZING',
          data: { ...packet.data, cycle_slot: null },
        },
        dictionary,
        model,
        report2Open: true,
        frame: FRAME,
      })
    );
    expect(none.action).toBeNull();
  });

  it('flags an unverified number and counts it', async () => {
    const { packet, dictionary } = await worldOf('01');
    const model = answerOf('Support is near 4350.72 today');
    const flagged = checkNumbers(
      [{ path: 'text', text: model.text }],
      dictionary,
      'en-US'
    ).violations;
    expect(flagged).toHaveLength(1);
    const result = must(
      composeAnswerResult({
        packet: { ...packet, intent: 'EXPLAIN' },
        dictionary,
        model,
        flagged,
        report2Open: true,
        frame: FRAME,
      })
    );
    expect(result.answer.text).toBe(
      `Support is near ${notVerifiedMark('en-US')} today`
    );
    expect(result.checks.numbers_flagged).toBe(1);
  });

  it("fails on an unknown id, a language that is not the reply's, and a frame the contract refuses", async () => {
    const { packet, dictionary } = await worldOf('01');
    const base = {
      packet: { ...packet, intent: 'EXPLAIN' as const },
      dictionary,
      report2Open: true,
      frame: FRAME,
    };
    expect(
      failuresOf(
        composeAnswerResult({ ...base, model: answerOf('Near {GONE.id}') })
      )
    ).toEqual(['UNKNOWN_ID|text']);
    expect(
      failuresOf(
        composeAnswerResult({
          ...base,
          model: { ...answerOf('Hello'), locale: 'de' },
        })
      )
    ).toEqual(['LOCALE_MISMATCH|locale']);
    const refused = composeAnswerResult({
      ...base,
      model: answerOf('Hello'),
      frame: { ...FRAME, requestId: '' },
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.failures[0]?.code).toBe('INVALID_RESULT');
  });

  it('carries the notes of the frame', async () => {
    const { packet, dictionary } = await worldOf('01');
    const result = must(
      composeAnswerResult({
        packet: { ...packet, intent: 'EXPLAIN' },
        dictionary,
        model: answerOf('Hello'),
        report2Open: true,
        frame: { ...FRAME, notes: ['CHART_UNAVAILABLE'] },
      })
    );
    expect(result.notes).toEqual(['CHART_UNAVAILABLE']);
  });
});

describe('the language lines are exactly what the file says', () => {
  it('writes the zone id and the placeholder of its price into the sentence', () => {
    expect(invalidationText('en-US', 'Z3')).toBe(
      'A close beyond {Z3.invalidation} cancels the view for Z3'
    );
    expect(invalidationText('pt-BR', 'Z1')).toBe(invalidationText('pt', 'Z1'));
    expect(invalidationText('en-GB', 'Z1')).toBe(
      invalidationText('en-US', 'Z1')
    );
    expect(invalidationText('xx', 'Z1')).toBe(invalidationText('en-US', 'Z1'));
  });
});
