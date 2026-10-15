/**
 * @jest-environment node
 */

import {
  DICTIONARY_LIMITS,
  PRICE_TOLERANCE,
  addressableIds,
  buildValueDictionary,
  countByKind,
  secondsOfInstant,
} from '@/lib/reply/checks/value-dictionary';
import { matchLiteral } from '@/lib/reply/checks/matcher';
import { extractNumbers } from '@/lib/reply/checks/extract';
import { assemble } from '@/lib/reply/context/assemble';
import { FIXED_VALUE_IDS } from '@/lib/reply/context/values';
import { VALUE_ID } from '@/lib/reply/contracts/shape';
import { NUMBER_CLASSES } from '@/lib/reply/contracts/trace-fields';

import { clone } from '../../intake/helpers/packets';
import {
  ALL_GOLDEN_IDS,
  TRADER_TYPES_FOR_TESTS,
  goldenPacket,
} from '../context/helpers/context-fixtures';
import { dayFor, fixtureFor } from './helpers/checks-fixtures';

const BIG = 200_000;

const judge = (
  text: string,
  fixture: Awaited<ReturnType<typeof fixtureFor>>
) => {
  const literal = extractNumbers(text, 'p', 'en')[0];
  if (literal === undefined) throw new Error(`no number in ${text}`);
  return matchLiteral(literal, fixture.dictionary);
};

describe('the ids are the ids of the prompt', () => {
  const cases = ALL_GOLDEN_IDS.flatMap((id) =>
    TRADER_TYPES_FOR_TESTS.map((trader) => [id, trader] as const)
  );

  it.each(cases)(
    '%s as %s: every {id} the prompt shows is addressable, and every id but an event is in the prompt',
    async (golden, trader) => {
      const fixture = await fixtureFor(golden.slice(0, 2), trader);
      const result = assemble({
        packet: fixture.packet,
        dayBars: fixture.dayBars,
        modelBudget: BIG,
      });
      if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
      const text = result.segments
        .filter((segment) => segment.id !== 'STATIC')
        .map((segment) => segment.text ?? '')
        .join('\n');
      const shown = [...text.matchAll(/\{([A-Za-z0-9_.]+)\}/g)].map(
        (m) => m[1] as string
      );
      const addressable = new Set(addressableIds(fixture.dictionary));
      for (const id of shown) {
        expect({ id, known: addressable.has(id) }).toEqual({ id, known: true });
      }
      expect(new Set(shown).size).toBe(shown.length);
      const fixed = new Set(FIXED_VALUE_IDS);
      for (const id of addressable) {
        if (fixed.has(id)) continue;
        expect({ id, shown: shown.includes(id) }).toEqual({ id, shown: true });
      }
    }
  );

  it('offers the fixed ids when the cycle has a last price and a day of bars', async () => {
    const { dictionary } = await fixtureFor('01');
    const ids = addressableIds(dictionary);
    for (const id of FIXED_VALUE_IDS) expect(ids).toContain(id);
    for (const field of [
      'max_risk_pct',
      'max_leverage',
      'target_rrr',
      'min_sld',
    ]) {
      expect(ids).toContain(`PROFILE.${field}`);
    }
  });

  it('writes every addressable id in the grammar the contract holds the model to', async () => {
    for (const golden of ALL_GOLDEN_IDS) {
      const { dictionary } = await fixtureFor(golden.slice(0, 2));
      for (const id of addressableIds(dictionary)) {
        expect(VALUE_ID.test(id)).toBe(true);
      }
    }
  });

  it('has one entry for each id', async () => {
    for (const golden of ALL_GOLDEN_IDS) {
      const { dictionary } = await fixtureFor(golden.slice(0, 2));
      expect(new Set(dictionary.entries.map((e) => e.id)).size).toBe(
        dictionary.entries.length
      );
      expect(dictionary.byId.size).toBe(dictionary.entries.length);
    }
  });
});

describe('kinds and tolerances', () => {
  it('gives the values of the 18 Sep cycle their kinds', async () => {
    const { dictionary } = await fixtureFor('01');
    const kind = (id: string) => dictionary.byId.get(id);
    expect(kind('LAST_PRICE')).toMatchObject({
      kind: 'PRICE',
      value: 4378.31,
      tolerance: PRICE_TOLERANCE,
      addressable: true,
    });
    expect(kind('MCD2.LOEDT')).toMatchObject({
      kind: 'PRICE',
      value: 4350.16,
      addressable: true,
    });
    expect(kind('MCD3.M5.UOEDT')).toMatchObject({
      kind: 'PRICE',
      value: 4384.23,
      addressable: true,
    });
    expect(kind('Z1.reference')).toMatchObject({
      kind: 'PRICE',
      value: 4367.2,
    });
    expect(kind('Z1.invalidation')).toMatchObject({
      kind: 'PRICE',
      value: 4350.42,
    });
    expect(kind('Z1.stop_distance')).toMatchObject({
      kind: 'DISTANCE',
      value: 16.78,
      tolerance: PRICE_TOLERANCE,
    });
    expect(kind('Z1.runway')).toMatchObject({ kind: 'DISTANCE', value: 2.37 });
    expect(kind('PROFILE.max_risk_pct')).toMatchObject({
      kind: 'PCT',
      value: 1.5,
      tolerance: 0,
    });
    expect(kind('PROFILE.max_leverage')).toMatchObject({
      kind: 'RATIO',
      value: 1.5,
      tolerance: 0,
    });
    expect(kind('PROFILE.target_rrr')).toMatchObject({
      kind: 'RATIO',
      value: 2,
      tolerance: 0,
    });
    expect(kind('PROFILE.min_sld')).toMatchObject({
      kind: 'DISTANCE',
      value: 5,
    });
    expect(kind('EVENT1.time')).toMatchObject({
      kind: 'TIME',
      tolerance: 0,
      addressable: true,
    });
    expect(kind('EVENT1.time')?.value).toBe(
      Date.UTC(2026, 8, 18, 21, 30, 0) / 1000
    );
  });

  it('takes the day line from the day of bars, as the prompt prints it', async () => {
    const { dictionary, dayBars } = await fixtureFor('01');
    const highs = dayBars.m5
      .map((b) => b.high)
      .concat(dayBars.m15.map((b) => b.high));
    const lows = dayBars.m5
      .map((b) => b.low)
      .concat(dayBars.m15.map((b) => b.low));
    expect(dictionary.byId.get('DAY.high')?.value).toBe(Math.max(...highs));
    expect(dictionary.byId.get('DAY.low')?.value).toBe(Math.min(...lows));
    expect(dictionary.byId.get('DAY.open')?.kind).toBe('PRICE');
  });

  it('adds the distance from the last price to each level and zone price, absolute', async () => {
    const { dictionary } = await fixtureFor('01');
    const last = 4378.31;
    for (const id of [
      'MCD2.LOEDT',
      'MCD1.UOEDT',
      'MCD3.M5.baseline',
      'Z1.low',
      'Z1.invalidation',
      'Z2.reference',
    ]) {
      const price = dictionary.byId.get(id)?.value as number;
      const distance = dictionary.byId.get(`DIST.${id}`);
      expect(distance).toMatchObject({
        kind: 'DISTANCE',
        addressable: false,
        tolerance: PRICE_TOLERANCE,
      });
      expect(distance?.value).toBeCloseTo(Math.abs(last - price), 6);
    }
    expect(dictionary.byId.get('DIST.MCD2.LOEDT')?.value).toBeCloseTo(28.15, 6);
    expect(dictionary.byId.has('DIST.LAST_PRICE')).toBe(false);
    expect(dictionary.byId.has('DIST.DAY.high')).toBe(false);
    expect(dictionary.byId.has('DIST.Z1.stop_distance')).toBe(false);
  });

  it('never makes a distance addressable, and never a figure of a sentence or of the details', async () => {
    const { dictionary } = await fixtureFor('01');
    for (const entry of dictionary.entries) {
      if (
        /^(DIST|BOARD|SYN)\./.test(entry.id) ||
        /\.(note|commentary|details)\./.test(entry.id)
      ) {
        expect(entry.addressable).toBe(false);
      }
    }
  });

  it('holds only kinds the trace knows', async () => {
    const { dictionary } = await fixtureFor('01');
    for (const entry of dictionary.entries) {
      expect(NUMBER_CLASSES).toContain(entry.kind);
      expect(Number.isFinite(entry.value)).toBe(true);
      expect(entry.tolerance).toBe(
        entry.kind === 'PRICE' || entry.kind === 'DISTANCE'
          ? PRICE_TOLERANCE
          : 0
      );
    }
    const counts = countByKind(dictionary);
    expect(Object.keys(counts).sort()).toEqual([...NUMBER_CLASSES].sort());
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(
      dictionary.entries.length
    );
    expect(counts.PRICE).toBeGreaterThan(20);
    expect(counts.DISTANCE).toBeGreaterThan(20);
    expect(counts.PCT).toBeGreaterThan(0);
    expect(counts.TIME).toBeGreaterThan(0);
  });

  it('keeps the whole dictionary within its limit', async () => {
    for (const golden of ALL_GOLDEN_IDS) {
      const { dictionary } = await fixtureFor(golden.slice(0, 2));
      expect(dictionary.entries.length).toBeLessThanOrEqual(
        DICTIONARY_LIMITS.entries
      );
    }
  });
});

describe('what the model may type and not be called wrong', () => {
  it('accepts a level, a zone price, a distance and a profile value as typed', async () => {
    const fixture = await fixtureFor('01');
    expect(judge('4350.16', fixture).matched).toBe(true);
    expect(judge('4350.2', fixture).matched).toBe(true);
    expect(judge('4367.2', fixture).entry?.id).toMatch(
      /baseline|reference|lvl|confluence/
    );
    expect(judge('16.78', fixture).matched).toBe(true);
    expect(judge('28.15', fixture).matched).toBe(true);
    expect(judge('1.5%', fixture).entry?.id).toBe('PROFILE.max_risk_pct');
    expect(judge('4378.31', fixture).entry?.id).toBe('LAST_PRICE');
  });

  it('accepts the time of an event, the cycle and the last bar', async () => {
    const fixture = await fixtureFor('01');
    expect(judge('21:30', fixture).entry?.id).toBe('EVENT1.time');
    expect(judge('20:55', fixture).matched).toBe(true);
    expect(judge('20:50', fixture).entry?.id).toBe('LAST_PRICE.bar');
    expect(judge('21:31', fixture).matched).toBe(false);
  });

  it('accepts the figures of a reading the prompt shows in full, but not a bar of the day', async () => {
    const fixture = await fixtureFor('01');
    expect(judge('101.47', fixture).matched).toBe(true);
    expect(judge('73.95%', fixture).matched).toBe(true);
    expect(judge('0.8192', fixture).matched).toBe(true);
    expect(judge('288 bars', fixture).matched).toBe(true);
    const close = fixture.dayBars.m5[100]?.close as number;
    const nearby = [4350.72, 4351.5, 4390.1].filter(
      (price) =>
        !fixture.dictionary.entries.some(
          (e) => Math.abs(e.value - price) <= 0.05
        )
    );
    expect(nearby.length).toBeGreaterThan(0);
    // a close from the day's bars is NOT a value of the context: it matches only by luck
    const alone = (price: number) =>
      fixture.dictionary.entries.filter(
        (e) => Math.abs(e.value - price) <= e.tolerance
      );
    expect(alone(close).every((e) => e.id !== 'BAR')).toBe(true);
    expect(
      fixture.dictionary.entries.some((e) => /bar\d|close/i.test(e.id))
    ).toBe(false);
  });

  it('does not accept the example of 5.8: support near 4350.72 against 4350.22', async () => {
    const fixture = await fixtureFor('01');
    expect(judge('4350.72', fixture).matched).toBe(false);
  });
});

describe('a cycle with less in it', () => {
  it('has no day line when the bars could not be read, and says nothing about them', async () => {
    const packet = goldenPacket('01');
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.has('DAY.high')).toBe(false);
    expect(dictionary.byId.has('LAST_PRICE')).toBe(true);
    expect(addressableIds(dictionary)).not.toContain('DAY.open');
  });

  it('has no last price and no distances when the packet has none', async () => {
    const packet = clone(goldenPacket('01'));
    packet.data.last_price = null;
    const dictionary = buildValueDictionary(packet, await dayFor(packet));
    expect(dictionary.byId.has('LAST_PRICE')).toBe(false);
    expect(dictionary.byId.has('LAST_PRICE.bar')).toBe(false);
    expect(dictionary.entries.some((e) => e.id.startsWith('DIST.'))).toBe(
      false
    );
    expect(dictionary.byId.has('MCD2.LOEDT')).toBe(true);
  });

  it('has no zones when the synthesis is not running', async () => {
    const packet = clone(goldenPacket('01'));
    packet.readings.synthesis = null;
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.entries.some((e) => /^Z\d/.test(e.id))).toBe(false);
  });

  it('has no events when the calendar is unavailable', async () => {
    const packet = clone(goldenPacket('01'));
    packet.events.status = 'UNAVAILABLE';
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.entries.some((e) => e.id.startsWith('EVENT'))).toBe(
      false
    );
  });

  it('offers an id only to the events the prompt listed', async () => {
    const packet = clone(goldenPacket('01'));
    const first = packet.events.items[0];
    if (first === undefined) throw new Error('the golden packet has an event');
    packet.events.items = [
      first,
      { ...first, event_id: 'EV-2', time: '2026-09-18T22:00:00Z' },
      { ...first, event_id: 'EV-3', time: '2026-09-18T23:15:00Z' },
    ];
    const some = buildValueDictionary(packet, null, { eventsShown: 2 });
    expect(addressableIds(some).filter((id) => id.startsWith('EVENT'))).toEqual(
      ['EVENT1.time', 'EVENT2.time']
    );
    expect(some.byId.get('EVENT3.time')).toMatchObject({
      addressable: false,
      kind: 'TIME',
    });
    const none = buildValueDictionary(packet, null, { eventsShown: 0 });
    expect(addressableIds(none).some((id) => id.startsWith('EVENT'))).toBe(
      false
    );
    const all = buildValueDictionary(packet, null);
    expect(
      addressableIds(all).filter((id) => id.startsWith('EVENT'))
    ).toHaveLength(3);
  });

  it('leaves out a profile value that is not a number', async () => {
    const packet = clone(goldenPacket('01'));
    packet.profile.min_sld = '';
    packet.profile.target_rrr = 'abc';
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.has('PROFILE.min_sld')).toBe(false);
    expect(dictionary.byId.has('PROFILE.target_rrr')).toBe(false);
    expect(dictionary.byId.has('PROFILE.max_leverage')).toBe(true);
  });

  it('keeps a level it cannot name as a match-only entry', async () => {
    const packet = clone(goldenPacket('01'));
    const sensor = packet.readings.sensors.find((s) => s.mcd_id === 'MCD2');
    if (sensor === undefined) throw new Error('MCD2 is in the packet');
    (
      sensor.envelope['levels'] as { name: string; tf: string; price: number }[]
    ).push({
      name: 'odd name!',
      tf: 'M5',
      price: 4400.5,
    });
    const dictionary = buildValueDictionary(packet, null);
    const odd = dictionary.entries.find((e) => e.id.startsWith('MCD2.lvl_'));
    expect(odd).toMatchObject({
      kind: 'PRICE',
      value: 4400.5,
      addressable: false,
    });
  });

  it('names two levels of one name by their timeframe, as the prompt does', async () => {
    const { dictionary } = await fixtureFor('01');
    expect(dictionary.byId.has('MCD3.M15.UOEDT')).toBe(true);
    expect(dictionary.byId.has('MCD3.M5.UOEDT')).toBe(true);
    expect(dictionary.byId.has('MCD3.UOEDT')).toBe(false);
    expect(dictionary.byId.has('MCD2.UOEDT')).toBe(true);
  });

  it('suffixes an id that would repeat', async () => {
    const packet = clone(goldenPacket('01'));
    const first = packet.readings.synthesis?.zones[0];
    if (first === undefined || packet.readings.synthesis === null)
      throw new Error('a zone');
    packet.readings.synthesis.zones.push(clone(first));
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.has('Z1.low')).toBe(true);
    expect(dictionary.byId.has('Z1.low_2')).toBe(true);
    expect(dictionary.byId.get('Z1.low_2')?.addressable).toBe(true);
  });

  it('does not grow past its limit', async () => {
    const packet = clone(goldenPacket('01'));
    const sensor = packet.readings.sensors[0];
    if (sensor === undefined) throw new Error('a sensor');
    const details: Record<string, number> = {};
    for (let i = 0; i < 500; i += 1) details[`k${i}`] = i + 0.5;
    sensor.envelope['details'] = details;
    packet.readings.sensors = Array.from({ length: 12 }, (_, i) => ({
      mcd_id: `MCD${i + 1}`,
      envelope: clone(sensor.envelope),
    }));
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.entries.length).toBeLessThanOrEqual(
      DICTIONARY_LIMITS.entries
    );
  });
});

describe('secondsOfInstant', () => {
  it.each([
    ['2026-09-18T20:55Z', Date.UTC(2026, 8, 18, 20, 55) / 1000],
    ['2026-09-18T20:55:03Z', Date.UTC(2026, 8, 18, 20, 55, 3) / 1000],
    ['2026-09-18T21:30:00Z', Date.UTC(2026, 8, 18, 21, 30) / 1000],
  ])('reads %s', (text, expected) => {
    expect(secondsOfInstant(text)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    5,
    '',
    '2026-09-18',
    '2026-09-18 20:55Z',
    '2026-13-45T25:61Z',
    '2026-09-18T20:55+01:00',
  ])('reads %p as nothing', (value) => {
    expect(secondsOfInstant(value)).toBeNull();
  });
});

describe('the figures of the readings, by id', () => {
  it('names the details of a reading, the sentences of the sensors, and the stamps', async () => {
    const { dictionary } = await fixtureFor('01');
    const entry = (id: string) => dictionary.byId.get(id);
    expect(entry('CYCLE.slot')).toMatchObject({
      kind: 'TIME',
      addressable: false,
      value: Date.UTC(2026, 8, 18, 20, 55) / 1000,
    });
    expect(entry('LAST_PRICE.bar')).toMatchObject({
      kind: 'TIME',
      addressable: false,
      value: Date.UTC(2026, 8, 18, 20, 50) / 1000,
    });
    expect(entry('MCD1.details.containment_rate')).toMatchObject({
      kind: 'PCT',
      value: 73.95,
      tolerance: 0,
      addressable: false,
    });
    expect(entry('MCD1.details.n_micro')).toMatchObject({
      kind: 'COUNT',
      value: 96,
    });
    expect(entry('MCD1.details.lower_breach_count')).toMatchObject({
      kind: 'COUNT',
      value: 0,
    });
    expect(entry('MCD1.details.regression_angle_deg')).toMatchObject({
      kind: 'RATIO',
      value: -29.72,
    });
    expect(entry('MCD2.details.channel_position')).toMatchObject({
      kind: 'RATIO',
      value: 0.8192,
    });
    expect(entry('MCD2.details.window_bars')).toMatchObject({
      kind: 'COUNT',
      value: 288,
    });
    expect(entry('MCD1.commentary.n2')).toMatchObject({
      kind: 'DISTANCE',
      value: 101.47,
      addressable: false,
    });
    expect(entry('MCD1.commentary.n3')).toMatchObject({
      kind: 'PRICE',
      value: 4279.46,
    });
    expect(entry('MCD1.commentary.n4')).toMatchObject({
      kind: 'RATIO',
      value: 1.6622,
    });
    expect(entry('MCD1.commentary.n5')).toMatchObject({
      kind: 'COUNT',
      value: 96,
    });
    expect(entry('Z1.runway_ratio')).toMatchObject({
      kind: 'RATIO',
      value: 0.14,
    });
    expect(entry('Z1.rank')).toMatchObject({ kind: 'COUNT', value: 1 });
    expect(entry('Z1.confluence_count')).toMatchObject({
      kind: 'COUNT',
      value: 2,
    });
    expect(entry('Z1.invalidation_level')).toMatchObject({
      kind: 'PRICE',
      value: 4350.92,
    });
    expect(entry('Z1.next_opposing')).toMatchObject({
      kind: 'PRICE',
      value: 4369.57,
    });
    expect(entry('Z1.confluence_1')).toMatchObject({
      kind: 'PRICE',
      value: 4367.2,
    });
    expect(entry('Z1.confluence_2')).toMatchObject({
      kind: 'PRICE',
      value: 4369.57,
    });
  });

  it('takes the figures of a sentence by how each was written', async () => {
    const packet = clone(goldenPacket('01'));
    const sensor = packet.readings.sensors.find((s) => s.mcd_id === 'MCD2');
    if (sensor === undefined) throw new Error('MCD2');
    sensor.envelope['summary_line'] =
      'at 21:30:15 UTC 82% and 1:2.5 and $5 and $1500 and 288 bars and 4400.5 and 12.5 and 0.25 and 4.377';
    sensor.envelope['commentary'] = '';
    packet.readings.synthesis = {
      ...(packet.readings.synthesis as NonNullable<
        typeof packet.readings.synthesis
      >),
      reading: {
        ...(packet.readings.synthesis?.reading ?? {}),
        reasons: ['MCD2 inside by 3.50 of 7', 'second 99.5%'],
      },
    };
    packet.board.sensors = [
      {
        mcd_id: 'MCD2',
        status: 'VALID',
        state_code: 'MCD2_UP_IN_CORRIDOR',
        bias: 'LONG',
        summary: 'width 42.5',
        reasons: [],
      },
    ];
    packet.board.syn = { ...packet.board.syn, summary: 'rule hit 3 of 9' };
    const dictionary = buildValueDictionary(packet, null);
    const note = dictionary.entries.filter((e) =>
      e.id.startsWith('MCD2.note.')
    );
    expect(note.map((e) => [e.id, e.kind, e.value])).toEqual([
      ['MCD2.note.n1', 'TIME', 21 * 3600 + 30 * 60 + 15],
      ['MCD2.note.n2', 'PCT', 82],
      ['MCD2.note.n3', 'RATIO', 2.5],
      ['MCD2.note.n3_2', 'RATIO', 0.4],
      ['MCD2.note.n4', 'DISTANCE', 5],
      ['MCD2.note.n5', 'PRICE', 1500],
      ['MCD2.note.n6', 'COUNT', 288],
      ['MCD2.note.n7', 'PRICE', 4400.5],
      ['MCD2.note.n8', 'DISTANCE', 12.5],
      ['MCD2.note.n9', 'RATIO', 0.25],
      ['MCD2.note.n10', 'RATIO', 4.377],
      ['MCD2.note.n10_2', 'PRICE', 4377],
    ]);
    expect(dictionary.byId.get('SYN.reason1.n1')).toMatchObject({
      kind: 'RATIO',
      value: 3.5,
    });
    expect(dictionary.byId.get('SYN.reason2.n1')).toMatchObject({
      kind: 'PCT',
      value: 99.5,
    });
    expect(dictionary.byId.get('BOARD.MCD2.n1')).toMatchObject({
      kind: 'DISTANCE',
      value: 42.5,
    });
    expect(dictionary.byId.get('BOARD.SYN.n1')).toMatchObject({
      kind: 'COUNT',
      value: 3,
    });
    expect(dictionary.byId.get('BOARD.SYN.n2')).toMatchObject({
      kind: 'COUNT',
      value: 9,
    });
    expect(
      dictionary.entries.every((e) => !e.id.startsWith('MCD2.commentary.'))
    ).toBe(true);
  });

  it('takes at most 12 figures of one sentence', async () => {
    const packet = clone(goldenPacket('01'));
    const sensor = packet.readings.sensors.find((s) => s.mcd_id === 'MCD2');
    if (sensor === undefined) throw new Error('MCD2');
    sensor.envelope['commentary'] = Array.from(
      { length: 30 },
      (_, i) => 100 + i
    ).join(', ');
    const dictionary = buildValueDictionary(packet, null);
    expect(
      dictionary.entries.filter((e) => e.id.startsWith('MCD2.commentary.'))
    ).toHaveLength(12);
    expect(DICTIONARY_LIMITS.narrativePerSource).toBe(12);
  });

  it('takes the leaves of the details by path, keeps their kind by the name, and stops at the depth and the count it allows', async () => {
    const packet = clone(goldenPacket('01'));
    const sensor = packet.readings.sensors.find((s) => s.mcd_id === 'MCD2');
    if (sensor === undefined) throw new Error('MCD2');
    sensor.envelope['details'] = {
      hit_rate: 61.5,
      pct: 12.5,
      share_percent: 0.4,
      n: 30,
      ratio: 1.25,
      deep: { a: { b: { c: { d: 6, e: { f: 7 } } } } },
      'odd key!': 8,
      flag: true,
      text: 'no',
      nothing: null,
      list: [1, 2],
    };
    sensor.envelope['commentary'] = '';
    sensor.envelope['summary_line'] = '';
    const dictionary = buildValueDictionary(packet, null);
    const details = dictionary.entries.filter((e) =>
      e.id.startsWith('MCD2.details.')
    );
    expect(details.map((e) => [e.id, e.kind, e.value])).toEqual([
      ['MCD2.details.hit_rate', 'PCT', 61.5],
      ['MCD2.details.pct', 'PCT', 12.5],
      ['MCD2.details.share_percent', 'PCT', 0.4],
      ['MCD2.details.n', 'COUNT', 30],
      ['MCD2.details.ratio', 'RATIO', 1.25],
      ['MCD2.details.deep_a_b_c_d', 'COUNT', 6],
      ['MCD2.details.odd_key_', 'COUNT', 8],
    ]);

    const wide: Record<string, number> = {};
    for (let i = 0; i < 100; i += 1) wide['k' + i] = i + 0.5;
    sensor.envelope['details'] = wide;
    const many = buildValueDictionary(packet, null);
    expect(
      many.entries.filter((e) => e.id.startsWith('MCD2.details.'))
    ).toHaveLength(DICTIONARY_LIMITS.detailsPerSensor);
    expect(DICTIONARY_LIMITS.detailsPerSensor).toBe(60);
  });

  it('cuts the dictionary at exactly its limit', async () => {
    const packet = clone(goldenPacket('01'));
    const details: Record<string, number> = {};
    for (let i = 0; i < 60; i += 1) details['k' + i] = i + 0.5;
    packet.readings.sensors = Array.from({ length: 15 }, (_, i) => ({
      mcd_id: 'MCD' + (i + 1),
      envelope: { details },
    }));
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.entries).toHaveLength(DICTIONARY_LIMITS.entries);
    expect(DICTIONARY_LIMITS.entries).toBe(600);
  });
});

describe('secondsOfInstant, field by field', () => {
  it.each([
    '2026-02-31T10:00Z',
    '2026-04-31T10:00Z',
    '2026-00-10T10:00Z',
    '2026-13-10T10:00Z',
    '2026-09-00T10:00Z',
    '2026-09-32T10:00Z',
    '2026-09-18T24:00Z',
    '2026-09-18T23:60Z',
    '2026-09-18T23:59:60Z',
  ])('refuses %s', (text) => {
    expect(secondsOfInstant(text)).toBeNull();
  });

  it.each([
    ['2026-02-28T10:00Z', Date.UTC(2026, 1, 28, 10, 0) / 1000],
    ['2028-02-29T23:59:59Z', Date.UTC(2028, 1, 29, 23, 59, 59) / 1000],
    ['2026-12-31T00:00Z', Date.UTC(2026, 11, 31, 0, 0) / 1000],
    ['2026-01-01T00:00:00Z', Date.UTC(2026, 0, 1, 0, 0, 0) / 1000],
  ])('reads %s', (text, expected) => {
    expect(secondsOfInstant(text)).toBe(expected);
  });
});

describe('what a damaged packet cannot put into the dictionary', () => {
  it('leaves out a zone field that is not a finite number', async () => {
    const packet = clone(goldenPacket('01'));
    const zone = packet.readings.synthesis?.zones[0];
    if (zone === undefined) throw new Error('a zone');
    zone['low'] = Number.NaN;
    zone['high'] = Number.POSITIVE_INFINITY;
    zone['reference_price'] = '4367.2';
    zone['invalidation_price'] = null;
    const dictionary = buildValueDictionary(packet, null);
    for (const field of ['low', 'high', 'reference', 'invalidation']) {
      expect(dictionary.byId.has('Z1.' + field)).toBe(false);
    }
    expect(dictionary.byId.has('Z1.stop_distance')).toBe(true);
  });

  it('leaves out a zone with no usable id', async () => {
    for (const bad of ['', 5, null, undefined]) {
      const packet = clone(goldenPacket('01'));
      const synthesis = packet.readings.synthesis;
      if (synthesis === null) throw new Error('synthesis');
      synthesis.zones = [{ ...synthesis.zones[0], zone_id: bad }];
      const dictionary = buildValueDictionary(packet, null);
      expect(
        dictionary.entries.some((e) => /^(Z\d|5|null|undefined)\./.test(e.id))
      ).toBe(false);
    }
  });

  it('suffixes a repeated id again and again', async () => {
    const packet = clone(goldenPacket('01'));
    const synthesis = packet.readings.synthesis;
    if (synthesis === null) throw new Error('synthesis');
    const first = synthesis.zones[0];
    if (first === undefined) throw new Error('a zone');
    synthesis.zones = [first, clone(first), clone(first), clone(first)];
    const dictionary = buildValueDictionary(packet, null);
    for (const id of ['Z1.low', 'Z1.low_2', 'Z1.low_3', 'Z1.low_4']) {
      expect(dictionary.byId.has(id)).toBe(true);
    }
    expect(dictionary.byId.has('Z1.low_5')).toBe(false);
  });
});

describe('the corners of the dictionary, pinned by the mutation check', () => {
  const sensorOf = (packet: ReturnType<typeof goldenPacket>, id = 'MCD2') => {
    const sensor = packet.readings.sensors.find((s) => s.mcd_id === id);
    if (sensor === undefined) throw new Error(id);
    return sensor;
  };

  it('takes a time as the seconds of the day when a sentence gives no seconds', () => {
    const packet = clone(goldenPacket('01'));
    sensorOf(packet).envelope['summary_line'] = 'at 21:30 UTC and 07:05:09 UTC';
    sensorOf(packet).envelope['commentary'] = '';
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.get('MCD2.note.n1')).toMatchObject({
      kind: 'TIME',
      value: 21 * 3600 + 30 * 60,
      addressable: false,
    });
    expect(dictionary.byId.get('MCD2.note.n2')).toMatchObject({
      kind: 'TIME',
      value: 7 * 3600 + 5 * 60 + 9,
      addressable: false,
    });
  });

  it('puts a figure of a sentence in the kind its writing and size give, at every boundary', () => {
    const packet = clone(goldenPacket('01'));
    sensorOf(packet).envelope['summary_line'] =
      'a 1000.5 b 999.5 c 10.5 d 9.5 e 10.0 f 9.99 g $1000 h $999 i 1:100 j 12 k 82% l 12:30';
    sensorOf(packet).envelope['commentary'] = '';
    const note = buildValueDictionary(packet, null).entries.filter((e) =>
      e.id.startsWith('MCD2.note.')
    );
    expect(note.map((e) => [e.value, e.kind, e.addressable])).toEqual([
      [1000.5, 'PRICE', false],
      [999.5, 'DISTANCE', false],
      [10.5, 'DISTANCE', false],
      [9.5, 'RATIO', false],
      [10, 'DISTANCE', false],
      [9.99, 'RATIO', false],
      [1000, 'PRICE', false],
      [999, 'DISTANCE', false],
      [100, 'RATIO', false],
      [0.01, 'RATIO', false],
      [12, 'COUNT', false],
      [82, 'PCT', false],
      [12 * 3600 + 30 * 60, 'TIME', false],
    ]);
  });

  it('keeps the key of a detail short, plain and never empty', () => {
    const packet = clone(goldenPacket('01'));
    const sensor = sensorOf(packet);
    sensor.envelope['commentary'] = '';
    sensor.envelope['summary_line'] = '';
    sensor.envelope['details'] = {
      __lead: 1,
      ___: 2,
      ['k'.repeat(40)]: 3,
      ['a'.repeat(32)]: 4,
      rate_limit: 5.5,
      percent_of: 6.5,
      'hit pct': 7.5,
    };
    const dictionary = buildValueDictionary(packet, null);
    const details = dictionary.entries.filter((e) =>
      e.id.startsWith('MCD2.details.')
    );
    expect(details.map((e) => e.id)).toEqual([
      'MCD2.details.lead',
      'MCD2.details.x',
      'MCD2.details.' + 'k'.repeat(32),
      'MCD2.details.' + 'a'.repeat(32),
      'MCD2.details.rate_limit',
      'MCD2.details.percent_of',
      'MCD2.details.hit_pct',
    ]);
    expect(details.map((e) => e.kind)).toEqual([
      'COUNT',
      'COUNT',
      'COUNT',
      'COUNT',
      'RATIO',
      'RATIO',
      'PCT',
    ]);
  });

  it('names an unnameable level by its place in the envelope', () => {
    const packet = clone(goldenPacket('01'));
    const levels = sensorOf(packet).envelope['levels'] as {
      name: string;
      tf: string;
      price: number;
    }[];
    levels.push({ name: 'odd name!', tf: 'M5', price: 4400.5 });
    levels.push({ name: 'another one', tf: 'M5', price: 4500.5 });
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.get('MCD2.lvl_4')).toMatchObject({
      value: 4400.5,
      addressable: false,
    });
    expect(dictionary.byId.get('MCD2.lvl_5')).toMatchObject({
      value: 4500.5,
      addressable: false,
    });
    expect(dictionary.byId.get('DIST.MCD2.lvl_4')?.value).toBeCloseTo(
      Math.abs(4378.31 - 4400.5),
      6
    );
  });

  it('reads a zone with fields missing, of the wrong type, or odd', () => {
    const packet = clone(goldenPacket('01'));
    const synthesis = packet.readings.synthesis;
    if (synthesis === null) throw new Error('synthesis');
    synthesis.zones = [
      {
        zone_id: 'Z1',
        low: 1,
        high: 2,
        confluence_levels: [
          null,
          5,
          { price: 7 },
          { price: 'x' },
          { name: 'n' },
        ],
      },
      {
        zone_id: 'Z2',
        confluence_levels: 'none',
        invalidation_level: 5,
        next_opposing_level: { price: null },
      },
      {
        zone_id: 'Z3',
        rank: 'first',
        confluence_count: null,
        runway_ratio: Number.NaN,
      },
    ];
    const dictionary = buildValueDictionary(packet, null);
    const ids = dictionary.entries
      .filter((e) => /^Z\d\./.test(e.id))
      .map((e) => e.id);
    expect(ids).toEqual(['Z1.low', 'Z1.high', 'Z1.confluence_3']);
  });

  it('reads a day with no closed bar as no day line', async () => {
    const packet = goldenPacket('01');
    const dictionary = buildValueDictionary(packet, {
      symbol: 'XAUUSD',
      slotSeconds: 1,
      m5: [],
      m15: [],
    });
    expect(dictionary.entries.some((e) => e.id.startsWith('DAY.'))).toBe(false);
    expect(dictionary.byId.has('LAST_PRICE')).toBe(true);
  });

  it('keeps an event with a time it cannot read out, and the events after it in their place', () => {
    const packet = clone(goldenPacket('01'));
    const first = packet.events.items[0];
    if (first === undefined) throw new Error('an event');
    packet.events.items = [
      { ...first, time: 'tomorrow' },
      { ...first, event_id: 'EV-2', time: '2026-09-18T22:00:00Z' },
    ];
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.has('EVENT1.time')).toBe(false);
    expect(dictionary.byId.get('EVENT2.time')).toMatchObject({
      kind: 'TIME',
      addressable: true,
    });
  });

  it('gives a packet with no cycle slot and a last price with no bar time no stamp', () => {
    const packet = clone(goldenPacket('01'));
    packet.data.cycle_slot = null;
    packet.data.last_price = {
      price: 4378.31,
      timeframe: 'M5',
      bar: 'last night',
    };
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.has('CYCLE.slot')).toBe(false);
    expect(dictionary.byId.has('LAST_PRICE.bar')).toBe(false);
    expect(dictionary.byId.has('LAST_PRICE')).toBe(true);
  });

  it('does not read a non-number last price', () => {
    const packet = clone(goldenPacket('01'));
    packet.data.last_price = {
      price: Number.NaN,
      timeframe: 'M5',
      bar: '2026-09-18T20:50Z',
    };
    const dictionary = buildValueDictionary(packet, null);
    expect(dictionary.byId.has('LAST_PRICE')).toBe(false);
    expect(dictionary.entries.some((e) => e.id.startsWith('DIST.'))).toBe(
      false
    );
  });

  it('refuses a time that is not a string, or has anything around it', () => {
    const lookalike = { toString: () => '2026-09-18T20:55Z' };
    expect(secondsOfInstant(lookalike)).toBeNull();
    for (const text of [
      ' 2026-09-18T20:55Z',
      '2026-09-18T20:55Z ',
      'x2026-09-18T20:55Zx',
      '2026-09-18T20:55Z\n',
      '20:55',
    ]) {
      expect(secondsOfInstant(text)).toBeNull();
    }
  });
});

describe('round four of the mutation check', () => {
  it('puts a decimal of exactly 1,000 in the kind of a price', () => {
    const packet = clone(goldenPacket('01'));
    const sensor = packet.readings.sensors.find((s) => s.mcd_id === 'MCD2');
    if (sensor === undefined) throw new Error('MCD2');
    sensor.envelope['summary_line'] = 'a 1000.0 b 999.9';
    sensor.envelope['commentary'] = '';
    const note = buildValueDictionary(packet, null).entries.filter((e) =>
      e.id.startsWith('MCD2.note.')
    );
    expect(note.map((e) => [e.value, e.kind])).toEqual([
      [1000, 'PRICE'],
      [999.9, 'DISTANCE'],
    ]);
  });

  it('leaves out a zone whose id cannot be written in the grammar of an id, with all its fields', () => {
    const packet = clone(goldenPacket('01'));
    const synthesis = packet.readings.synthesis;
    if (synthesis === null) throw new Error('synthesis');
    synthesis.zones = [{ ...synthesis.zones[0], zone_id: 'odd zone!' }];
    const dictionary = buildValueDictionary(packet, null);
    for (const entry of dictionary.entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.includes('null')).toBe(false);
    }
    expect(dictionary.entries.some((e) => e.id.includes('zone'))).toBe(true); // its other facts keep the quoted name
    expect(addressableIds(dictionary).some((id) => id.includes('zone'))).toBe(
      false
    );
  });
});
