import {
  isoToSlot,
  slotToIso,
  statsSlotFor,
  statsSlots,
} from '../src/sensors/inputs/stats-slot';
import { pythonAvailable, pythonJson } from './helpers/kit-runner';

/**
 * Slot arithmetic of the sensor inputs (rules 1 and 5), against the kit's own
 * (`mcd_common/cycle_inputs.py`: `slot_to_epoch`, `epoch_to_slot`, `stats_slot_for`).
 * The loader gives the runner ISO text and the statistics row's `captured_at` as unix
 * seconds; a disagreement here would make every tier-4 check answer STALE.
 */

describe('slotToIso / isoToSlot', () => {
  const pairs: Array<[number, string]> = [
    [1789764900, '2026-09-18T20:55Z'], // v1: the M5 statistics were captured here
    [1789764300, '2026-09-18T20:45Z'], // v1: the M15 statistics were captured here
    [1790637300, '2026-09-28T23:15Z'], // v4
    [0, '1970-01-01T00:00Z'],
    [1835481300, '2028-02-29T23:55Z'], // a leap day
    [1835481600, '2028-03-01T00:00Z'],
  ];

  it.each(pairs)('slot %i is %s, both ways', (slot, iso) => {
    expect(slotToIso(slot)).toBe(iso);
    expect(isoToSlot(iso)).toBe(slot);
  });

  it.each([1789764901, 1789764899, -300, 1.5, NaN, Infinity])(
    'refuses %p as a slot (a caller bug, loudly)',
    (value) => {
      expect(() => slotToIso(value)).toThrow(RangeError);
    }
  );

  it.each([
    '2026-09-18T20:56Z', // not a multiple of five
    '2026-09-18T20:55:00Z', // seconds
    '2026-09-18T20:55', // no zone
    '2026-09-18 20:55Z', // no T
    '2026-09-18T20:55+00:00',
    '2026-02-30T00:00Z', // a date that does not exist
    '2026-02-29T00:00Z', // 2026 is not a leap year
    '2026-09-18T24:00Z', // the kit's strptime refuses hour 24
    ' 2026-09-18T20:55Z',
    '2026-09-18T20:55Z ',
    '',
  ])('does not read %p as a slot', (text) => {
    expect(isoToSlot(text)).toBeNull();
  });

  it.each([null, undefined, 1789764900, {}, ['2026-09-18T20:55Z']])(
    'does not read %p as a slot',
    (value) => {
      expect(isoToSlot(value)).toBeNull();
    }
  );
});

describe('statsSlotFor: the slot a timeframe was last collected at (rule 5)', () => {
  // 21:00 UTC on 18 Sep 2026 is a refresh slot; the next ones are M5-only.
  const REFRESH = 1789765200;

  it.each([
    [0, 0, 0],
    [300, 300, 0],
    [600, 600, 0],
    [900, 900, 900],
    [1200, 1200, 900],
  ])(
    'slot offset %i: M5 %i, M15 %i (from the refresh slot)',
    (offset, m5, m15) => {
      const slot = REFRESH + offset;
      expect(statsSlotFor(slot, 'M5')).toBe(REFRESH + m5);
      expect(statsSlotFor(slot, 'M15')).toBe(REFRESH + m15);
    }
  );

  it('M15 at 20:55 is 20:45 (architecture 1.5)', () => {
    expect(slotToIso(statsSlotFor(1789764900, 'M15'))).toBe(
      '2026-09-18T20:45Z'
    );
    expect(slotToIso(statsSlotFor(1789764900, 'M5'))).toBe('2026-09-18T20:55Z');
  });

  it('statsSlots gives both, and refuses what is not a slot', () => {
    expect(statsSlots(REFRESH + 600)).toEqual({
      M5: REFRESH + 600,
      M15: REFRESH,
    });
    expect(() => statsSlots(REFRESH + 1)).toThrow(RangeError);
  });
});

// A deterministic spread of slots over 1970 to 2100, plus every awkward edge: month, year and
// leap-day boundaries and the quarter-hour positions.
function manySlots(): number[] {
  const slots = new Set<number>([0, 300, 900, 1835481300, 1835481600]);
  let seed = 20261003;
  for (let i = 0; i < 4000; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    slots.add(Math.floor(((seed / 2 ** 32) * 4_102_444_800) / 300) * 300);
  }
  for (const [year, month] of [
    [2026, 9],
    [2026, 12],
    [2027, 1],
    [2028, 2],
    [2028, 3],
    [2100, 1],
  ]) {
    const first = Date.UTC(year, month - 1, 1) / 1000;
    for (let back = -4; back <= 4; back += 1) slots.add(first + back * 300);
    for (let back = -4; back <= 4; back += 1) slots.add(first + back * 900);
  }
  return [...slots].sort((a, b) => a - b);
}

const maybe = pythonAvailable() ? describe : describe.skip;

maybe(
  'against the kit, over thousands of slots (needs Python with PyYAML and jsonschema)',
  () => {
    const slots = manySlots();

    it('slotToIso, isoToSlot and statsSlotFor give what cycle_inputs.py gives', () => {
      const kit = pythonJson<
        Array<{ iso: string; epoch: number; m5: string; m15: string }>
      >(
        [
          'import json, sys',
          'from mcd_common.cycle_inputs import epoch_to_slot, slot_to_epoch, stats_slot_for',
          'out = []',
          'for e in json.load(sys.stdin):',
          '    iso = epoch_to_slot(e)',
          '    out.append({"iso": iso, "epoch": slot_to_epoch(iso), "m5": stats_slot_for(iso, "M5"), "m15": stats_slot_for(iso, "M15")})',
          'print(json.dumps(out))',
        ].join('\n'),
        slots
      );
      expect(kit).toHaveLength(slots.length);
      slots.forEach((slot, index) => {
        expect(slotToIso(slot)).toBe(kit[index].iso);
        expect(isoToSlot(kit[index].iso)).toBe(kit[index].epoch);
        expect(slotToIso(statsSlotFor(slot, 'M5'))).toBe(kit[index].m5);
        expect(slotToIso(statsSlotFor(slot, 'M15'))).toBe(kit[index].m15);
      });
    });

    it('agrees with the kit on which texts are slots', () => {
      const texts = [
        '2026-09-18T20:55Z',
        '2026-09-18T20:56Z',
        '2026-02-30T00:00Z',
        '2026-02-29T00:00Z',
        '2028-02-29T00:00Z',
        '2026-09-18T24:00Z',
        '2026-09-18T20:55',
        '2026-09-18T20:55:00Z',
        '1999-12-31T23:55Z',
        '0001-01-01T00:00Z',
        '2026-13-01T00:00Z',
        '2026-00-10T00:00Z',
        '2026-09-31T00:00Z',
      ];
      const kit = pythonJson<Array<number | null>>(
        [
          'import json, sys',
          'from mcd_common.cycle_inputs import slot_to_epoch',
          'out = []',
          'for t in json.load(sys.stdin):',
          '    try:',
          '        out.append(slot_to_epoch(t))',
          '    except ValueError:',
          '        out.append(None)',
          'print(json.dumps(out))',
        ].join('\n'),
        texts
      );
      texts.forEach((text, index) => {
        // the kit accepts years before 1970 as negative epochs; the gateway refuses a negative slot (isSlot)
        const expected =
          kit[index] !== null && kit[index]! < 0 ? null : kit[index];
        expect(isoToSlot(text)).toBe(expected);
      });
    });
  }
);
