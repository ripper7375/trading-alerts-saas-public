/**
 * @jest-environment node
 */

/**
 * The modal definition (build step 5, part 4; architecture 6.13, ADR-033,
 * ADR-061, ADR-062, ADR-064). Real stored cycles: the 18 Sep 20:55 one (a LONG
 * counter-trend rally, CAUTIONARY, two zones) and every zone of the signed-off
 * golden scenarios for the pills.
 */

import {
  Rational,
  buildModalDefinition,
  customEntryStopChoices,
  riskPreset,
  rrrBounds,
} from '@/lib/engine4';
import type {
  ModalDefinition,
  OfferedModal,
  StructureRead,
  ZoneInput,
} from '@/lib/engine4';

import { byRank } from '@/lib/engine4/zone';

import { loadGoldens } from './helpers/stored';
import {
  ROOMY_PROFILE,
  golden,
  readingOf,
  setup,
  structureOf,
  synthesisOf,
  zonesOf,
} from './helpers/setup';

function definition(over: Parameters<typeof setup>[0] = {}): ModalDefinition {
  const { ctx } = setup(over);
  return buildModalDefinition({
    profile: ctx.profile,
    offer: ctx.offer,
    zones: ctx.zones,
    structure: ctx.structure,
    range: ctx.range,
    livePrice: ctx.livePrice,
  });
}

function offered(over: Parameters<typeof setup>[0] = {}): OfferedModal {
  const modal = definition(over);
  if (modal.status === 'NOT_OFFERED') {
    throw new Error(`not offered: ${modal.reason?.code ?? 'no reason'}`);
  }
  return modal;
}

describe('riskPreset (6.4 row 3, 6.6, ADR-061)', () => {
  const halved = { halfRiskPreset: true, halfRiskReasons: ['MCD0_DEFECT_M5'] };
  const full = { halfRiskPreset: false, halfRiskReasons: [] };

  test('opens on Max RPT when nothing is wrong', () => {
    const preset = riskPreset({ maxRiskPct: '1.5' }, full);
    expect(preset.preset.toString()).toBe('1.5');
    expect(preset.max.toString()).toBe('1.5');
    expect(preset.halfRisk).toBe(false);
    expect(preset.reasons).toEqual([]);
  });

  test.each([
    ['1.5', '0.75'],
    ['2', '1'],
    ['0.5', '0.25'],
    ['1.75', '0.875'],
    ['1.25', '0.625'],
  ])('half of a Max RPT of %s is exactly %s, with the reason', (max, half) => {
    const preset = riskPreset({ maxRiskPct: max }, halved);
    expect(preset.preset.toString()).toBe(half);
    expect(preset.max.toString()).toBe(max);
    expect(preset.halfRisk).toBe(true);
    expect(preset.reasons).toEqual(['MCD0_DEFECT_M5']);
  });

  test('hands back its own copy of the reasons', () => {
    const reasons = ['A'];
    const preset = riskPreset(
      { maxRiskPct: '1' },
      { halfRiskPreset: true, halfRiskReasons: reasons }
    );
    reasons.push('B');
    expect(preset.reasons).toEqual(['A']);
  });
});

describe('rrrBounds (6.2, D5, ADR-064)', () => {
  test('a setup with the trend: 1.50 to 3.50, and the profile target', () => {
    const bounds = rrrBounds({ targetRrr: '1.75' }, false);
    expect(bounds.min.toString()).toBe('1.5');
    expect(bounds.max.toString()).toBe('3.5');
    expect(bounds.preset.toString()).toBe('1.75');
    expect(bounds.capped).toBe(false);
    expect(bounds.counterTrend).toBe(false);
  });

  test('a counter-trend setup: the cap is 2.50', () => {
    const bounds = rrrBounds({ targetRrr: '1.75' }, true);
    expect(bounds.max.toString()).toBe('2.5');
    expect(bounds.preset.toString()).toBe('1.75');
    expect(bounds.capped).toBe(false);
    expect(bounds.counterTrend).toBe(true);
  });

  test.each([
    ['2.5', '2.5', false],
    ['2.51', '2.5', true],
    ['3', '2.5', true],
    ['3.5', '2.5', true],
  ])(
    'a counter-trend setup and a target of %s opens on %s (capped %p)',
    (target, preset, capped) => {
      const bounds = rrrBounds({ targetRrr: target }, true);
      expect(bounds.preset.toString()).toBe(preset);
      expect(bounds.capped).toBe(capped);
    }
  );

  test('a target above the cap is not lowered for a setup with the trend', () => {
    const bounds = rrrBounds({ targetRrr: '3.5' }, false);
    expect(bounds.preset.toString()).toBe('3.5');
    expect(bounds.capped).toBe(false);
  });
});

describe('the stored 18 Sep cycle, offered', () => {
  const modal = offered();

  test('direction and side come from the synthesis', () => {
    expect(modal.status).toBe('OFFERED');
    expect(modal.direction).toBe('LONG');
    expect(modal.side).toBe('BUY');
    expect(modal.counterTrend).toBe(true);
    expect(modal.refresh).toBeNull();
  });

  test('one pill per zone, at the zone reference price, best first', () => {
    expect(modal.pills.map((p) => [p.zoneId, p.price.toString()])).toEqual([
      ['Z1', '4367.2'],
      ['Z2', '4350.16'],
    ]);
    expect(
      modal.pills.map((p) => [p.low.toString(), p.high.toString()])
    ).toEqual([
      ['4363.79', '4370.61'],
      ['4346.75', '4353.57'],
    ]);
    expect(modal.pills.every((p) => !p.invalidated)).toBe(true);
  });

  test('the stop options behind a pill are the structural ones for that entry', () => {
    const z1 = modal.pills[0]!;
    expect(z1.stop.mode).toBe('STRUCTURE');
    // six at Min SLD 13: $16.78, $17.54, $33.14, $88.24, $153.53, $241.46 from 4367.20
    expect(z1.stop.structural.map((o) => o.stopDistance.toString())).toEqual(
      expect.arrayContaining(['16.78', '17.54'])
    );
    expect(z1.stop.structural).toHaveLength(6);
    expect(z1.stop.preselected.kind).toBe('ZONE_INVALIDATION');
    expect(z1.stop.custom.minDistance.toString()).toBe('13');
  });

  test('the risk opens at half Max RPT, with the reason', () => {
    expect(modal.risk.halfRisk).toBe(true);
    expect(modal.risk.preset.toString()).toBe('0.75');
    expect(modal.risk.max.toString()).toBe('1.5');
    expect(modal.risk.reasons).toEqual(['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5']);
  });

  test('the RRR opens on the profile target, under the counter-trend cap', () => {
    expect(modal.rrr.counterTrend).toBe(true);
    expect(modal.rrr.min.toString()).toBe('1.5');
    expect(modal.rrr.max.toString()).toBe('2.5');
    expect(modal.rrr.preset.toString()).toBe('1.75');
  });

  test('equity and the profile figures come from the profile', () => {
    expect(modal.equity.toString()).toBe('10000');
    expect(modal.profile.minSld.toString()).toBe('13');
    expect(modal.profile.maxLeverage.toString()).toBe('5');
    expect(modal.profile.commission.toString()).toBe('4');
  });

  test('a custom entry has its bounds, a custom stop its minimum', () => {
    expect(modal.custom.entry.day?.lower.toString()).toBe('4282.525');
    expect(modal.custom.entry.day?.upper.toString()).toBe('4427.425');
    expect(modal.custom.entry.typo?.lower.toString()).toBe('4159.3945');
    expect(modal.custom.stopMinDistance.toString()).toBe('13');
  });

  test('the notices of the offer ride along', () => {
    expect(modal.notices.map((n) => n.code)).toContain('CAUTIONARY');
  });

  test('is plain data that survives JSON', () => {
    const text = JSON.stringify(modal);
    expect(text).toContain('"4367.2"');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

describe('a setup with the trend and no caution', () => {
  const plain = {
    pinned: {
      status: 'VALID',
      statusReasons: [],
      trendRelation: 'WITH_TREND',
    },
  };

  test('opens on the full Max RPT and allows RRR up to 3.50', () => {
    const modal = offered(plain);
    expect(modal.counterTrend).toBe(false);
    expect(modal.risk.halfRisk).toBe(false);
    expect(modal.risk.preset.toString()).toBe('1.5');
    expect(modal.risk.reasons).toEqual([]);
    expect(modal.rrr.max.toString()).toBe('3.5');
  });

  test('a RETUNING cycle halves the risk and says so', () => {
    const modal = offered({ ...plain, retuning: true });
    expect(modal.risk.halfRisk).toBe(true);
    expect(modal.risk.preset.toString()).toBe('0.75');
    expect(modal.risk.reasons).toEqual(['RETUNING']);
  });

  test('a caution and a retune together give both reasons, one half', () => {
    const modal = offered({
      pinned: { status: 'CAUTIONARY', statusReasons: ['MCD0_DEFECT_M5'] },
      retuning: true,
    });
    expect(modal.risk.preset.toString()).toBe('0.75');
    expect(modal.risk.reasons).toEqual(['MCD0_DEFECT_M5', 'RETUNING']);
  });

  test('a target RRR above the counter-trend cap is lowered only for a counter-trend setup', () => {
    const profile = { targetRrr: '3' };
    expect(offered({ ...plain, profile }).rrr.preset.toString()).toBe('3');
    const counter = offered({ profile });
    expect(counter.rrr.preset.toString()).toBe('2.5');
    expect(counter.rrr.capped).toBe(true);
  });
});

describe('pills', () => {
  test('are listed in rank order whatever order the zones come in', () => {
    const zones = zonesOf(golden('01-'));
    const reversed = offered({ zones: [...zones].reverse() });
    expect(reversed.pills.map((p) => p.zoneId)).toEqual(['Z1', 'Z2']);
  });

  test('a zone on the other side of the reading is not a pill', () => {
    const other = zonesOf(golden('03-'));
    const modal = offered({ zones: [...zonesOf(golden('01-')), ...other] });
    expect(modal.pills.map((p) => p.zoneId)).toEqual(['Z1', 'Z2']);
    expect(modal.pills.map((p) => p.price.toString())).toEqual([
      '4367.2',
      '4350.16',
    ]);
  });

  test('a zone past its invalidation stays listed, flagged', () => {
    // the newest price is at Z1's invalidation 4350.42; Z2's is 4334.06
    const modal = offered({ price: 4350.42 });
    expect(modal.pills.map((p) => [p.zoneId, p.invalidated])).toEqual([
      ['Z1', true],
      ['Z2', false],
    ]);
  });

  test('a zone the offer check did not look at is not selectable', () => {
    const { ctx } = setup();
    const modal = buildModalDefinition({
      profile: ctx.profile,
      offer: { ...ctx.offer, zones: [] },
      zones: ctx.zones,
      structure: ctx.structure,
      range: ctx.range,
      livePrice: ctx.livePrice,
    });
    if (modal.status === 'NOT_OFFERED') throw new Error('expected an offer');
    expect(modal.pills.every((p) => p.invalidated)).toBe(true);
  });

  test("degrade to the zone's own invalidation when the levels could not be read", () => {
    const broken: StructureRead = {
      complete: false,
      levels: [],
      problems: [{ code: 'BUNDLE_MISSING', detail: 'no bundle' }],
    };
    const modal = offered({ structure: broken });
    const z1 = modal.pills[0]!;
    expect(z1.stop.mode).toBe('DEGRADED');
    expect(z1.stop.degradedBy.map((p) => p.code)).toEqual(['BUNDLE_MISSING']);
    expect(z1.stop.structural).toHaveLength(1);
    expect(z1.stop.structural[0]?.stopPrice.toString()).toBe('4350.42');
  });
});

describe("pills equal the zones' reference prices in rank order: every golden zone", () => {
  const goldens = loadGoldens();
  let zonesSeen = 0;
  let pillsSeen = 0;

  const cases = goldens.flatMap((g) =>
    g.readings.map((reading) => ({
      id: g.id,
      prefix: g.id.slice(0, 3),
      profile: reading.profile,
      reading,
    }))
  );

  test.each(cases.map((c) => [`${c.id} ${c.profile}`, c] as const))(
    '%s',
    (_label, c) => {
      const { ctx } = setup({ golden: c.prefix, gProfile: c.profile });
      const modal = buildModalDefinition({
        profile: ctx.profile,
        offer: ctx.offer,
        zones: ctx.zones,
        structure: ctx.structure,
        range: ctx.range,
        livePrice: ctx.livePrice,
      });
      const stored = [...c.reading.zones].sort(
        (a, b) => Number(a['rank']) - Number(b['rank'])
      );
      zonesSeen += stored.length;

      if (modal.status === 'NOT_OFFERED') {
        // no direction (the synthesis stands aside), or no zone, or every zone past its invalidation
        expect(modal).not.toHaveProperty('pills');
        return;
      }
      pillsSeen += modal.pills.length;
      expect(modal.pills.map((p) => p.zoneId)).toEqual(
        stored.map((z) => z['zone_id'])
      );
      expect(modal.pills.map((p) => p.price.toString())).toEqual(
        stored.map((z) =>
          Rational.of(z['reference_price'] as number).toString()
        )
      );
      // the reading's own direction, and every pill's stop choices were built from levels that agree
      expect(modal.direction).toBe(c.reading.reading['bias']);
      for (const pill of modal.pills) expect(pill.stop.mode).toBe('STRUCTURE');
    }
  );

  test('the cases cover at least the 31 signed-off golden zones', () => {
    const zones = cases.reduce((n, c) => n + c.reading.zones.length, 0);
    expect(zones).toBeGreaterThanOrEqual(31);
    // the tests above ran first; every zone of an offered reading became a pill
    expect(pillsSeen).toBeGreaterThanOrEqual(31);
    expect(zonesSeen).toBe(zones);
  });

  test('a synthesis that stands aside has no pills and says why', () => {
    const modal = definition({ golden: '09-' });
    expect(modal.status).toBe('NOT_OFFERED');
    if (modal.status === 'NOT_OFFERED') {
      expect(modal.reason?.code).toBe('SYNTHESIS_STAND_ASIDE');
    }
  });
});

describe('not offered, offered with a refresh', () => {
  test('stale data: no pills, the first reason shown, all returned', () => {
    const modal = definition({
      dataStatus: { status: 'STALE', dataAsOfSlot: null },
      specs: null,
    });
    expect(modal.status).toBe('NOT_OFFERED');
    if (modal.status === 'NOT_OFFERED') {
      expect(modal.reason?.code).toBe('DATA_STALE');
      expect(modal.reasons.map((r) => r.code)).toEqual([
        'DATA_STALE',
        'SPECS_MISSING',
      ]);
    }
  });

  test('a newer cycle that changed the picture: the pills stay, a refresh is offered', () => {
    const g = golden('01-');
    const reading = readingOf(g);
    const newer = {
      ...synthesisOf(reading.reading),
      cycleSlot: Number(synthesisOf(reading.reading).cycleSlot) + 300,
      bias: 'SHORT',
    };
    const modal = offered({ newest: newer });
    expect(modal.status).toBe('REFRESH_OFFERED');
    expect(modal.refresh).toEqual({
      newSlot: String(newer.cycleSlot),
      changes: ['BIAS'],
    });
    expect(modal.pills).toHaveLength(2);
  });

  test('is plain data that survives JSON, a refresh included', () => {
    const g = golden('01-');
    const base = synthesisOf(readingOf(g).reading);
    const modal = offered({
      newest: {
        ...base,
        cycleSlot: Number(base.cycleSlot) + 300,
        bias: 'SHORT',
      },
    });
    expect(() => JSON.stringify(modal)).not.toThrow();
  });
});

describe('customEntryStopChoices', () => {
  const g = golden('01-');
  const structure = structureOf(g);
  const choices = (entry: string, side: 'BUY' | 'SELL' = 'BUY') =>
    customEntryStopChoices({ side, entry, minSld: '13', structure });

  test('the levels on the stop side of THAT entry at least Min SLD away, nearest first, nearest pre-selected', () => {
    const result = choices('4367.2');
    expect(result.mode).toBe('STRUCTURE');
    expect(result.degradedBy).toEqual([]);
    expect(result.structural).toHaveLength(6);
    const distances = result.structural.map((o) => o.stopDistance);
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]!.gt(distances[i - 1]!)).toBe(true);
    }
    expect(result.preselected.kind).toBe('NEAREST_OPTION');
    expect(result.minimumStop).toBeNull();
    expect(result.custom.minDistance.toString()).toBe('13');
  });

  test('another entry gives other options', () => {
    const near = choices('4367.2').structural.map((o) =>
      o.stopPrice.toString()
    );
    const far = choices('4400').structural.map((o) => o.stopPrice.toString());
    expect(far).not.toEqual(near);
    expect(far.length).toBeGreaterThanOrEqual(near.length);
  });

  test('a SELL looks above its entry', () => {
    const result = choices('4300', 'SELL');
    for (const option of result.structural) {
      expect(option.stopPrice.gt(Rational.of('4300'))).toBe(true);
    }
  });

  test('a larger Min SLD drops the nearest options', () => {
    const wide = customEntryStopChoices({
      side: 'BUY',
      entry: '4367.2',
      minSld: '20',
      structure,
    });
    expect(wide.structural.length).toBeLessThan(6);
    expect(wide.custom.minDistance.toString()).toBe('20');
  });

  test('levels that could not be read: only a custom stop, and why', () => {
    const result = customEntryStopChoices({
      side: 'BUY',
      entry: '4367.2',
      minSld: '13',
      structure: {
        complete: false,
        levels: [],
        problems: [{ code: 'BUNDLE_EXPIRED', detail: 'older than 90 days' }],
      },
    });
    expect(result.mode).toBe('DEGRADED');
    expect(result.degradedBy.map((p) => p.code)).toEqual(['BUNDLE_EXPIRED']);
    expect(result.structural).toEqual([]);
    expect(result.preselected.kind).toBe('CUSTOM_REQUIRED');
  });

  test('hands back its own copy of the problems', () => {
    const problems = [{ code: 'BUNDLE_EXPIRED' as const, detail: 'x' }];
    const result = customEntryStopChoices({
      side: 'BUY',
      entry: '4367.2',
      minSld: '13',
      structure: { complete: false, levels: [], problems },
    });
    problems.push({ code: 'BUNDLE_EXPIRED', detail: 'y' });
    expect(result.degradedBy).toHaveLength(1);
  });

  test('the same input twice gives the same choices', () => {
    expect(JSON.stringify(choices('4367.2'))).toBe(
      JSON.stringify(choices('4367.2'))
    );
  });
});

describe('byRank', () => {
  test('puts Z1 before Z2 and so on, and equal ids level', () => {
    expect(byRank({ zoneId: 'Z1' }, { zoneId: 'Z2' })).toBe(-1);
    expect(byRank({ zoneId: 'Z5' }, { zoneId: 'Z3' })).toBe(1);
    expect(byRank({ zoneId: 'Z4' }, { zoneId: 'Z4' })).toBe(0);
  });

  test('sorts a list into rank order', () => {
    const ids = ['Z3', 'Z1', 'Z5', 'Z2', 'Z4'].map((zoneId) => ({ zoneId }));
    expect(ids.sort(byRank).map((z) => z.zoneId)).toEqual([
      'Z1',
      'Z2',
      'Z3',
      'Z4',
      'Z5',
    ]);
  });
});

describe('a profile is only read, never changed', () => {
  test('building a definition leaves the profile as it was', () => {
    const { ctx } = setup();
    const before = JSON.stringify(ctx.profile);
    buildModalDefinition({
      profile: ctx.profile,
      offer: ctx.offer,
      zones: ctx.zones,
      structure: ctx.structure,
      range: ctx.range,
      livePrice: ctx.livePrice,
    });
    expect(JSON.stringify(ctx.profile)).toBe(before);
    expect(ctx.profile).toEqual(ROOMY_PROFILE);
  });

  test('building it does not reorder the zones it was given', () => {
    const { ctx } = setup();
    const zones: ZoneInput[] = [...ctx.zones].reverse();
    const ids = zones.map((z) => z.zoneId);
    buildModalDefinition({
      profile: ctx.profile,
      offer: ctx.offer,
      zones,
      structure: ctx.structure,
      range: ctx.range,
      livePrice: ctx.livePrice,
    });
    expect(zones.map((z) => z.zoneId)).toEqual(ids);
  });
});
