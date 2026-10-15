/**
 * Test support for the backstops of build step 7 part 4: dictionaries for the golden cycles, a
 * dictionary written by hand, and the digits of other scripts.
 */

import { DIGIT_ZEROS } from '@/lib/reply/contracts/intake';
import type { IntakePacket, TraderType } from '@/lib/reply/contracts/intake';
import { buildValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type {
  DictionaryOptions,
  ValueDictionary,
  ValueEntry,
} from '@/lib/reply/checks/value-dictionary';
import type { DayBars } from '@/lib/reply/context/ohlc-compact';

import {
  dayBarsFor,
  goldenPacket,
  worldFor,
} from '../../context/helpers/context-fixtures';

export const NBSP = String.fromCharCode(0x00a0);
export const THIN_NBSP = String.fromCharCode(0x202f);
export const LRM = String.fromCharCode(0x200e);
export const ZWSP = String.fromCharCode(0x200b);

export interface Fixture {
  packet: IntakePacket;
  dayBars: DayBars;
  dictionary: ValueDictionary;
}

const days = new Map<string, DayBars>();

export async function dayFor(packet: IntakePacket): Promise<DayBars> {
  const slot = packet.data.cycle_slot as string;
  const found = days.get(slot);
  if (found !== undefined) return found;
  const made = await dayBarsFor(slot, worldFor(slot));
  days.set(slot, made);
  return made;
}

/** The packet of a golden cycle, its day of bars, and the dictionary built from both. */
export async function fixtureFor(
  prefix: string,
  traderType: TraderType = 'DAY_TRADER',
  options: DictionaryOptions = {}
): Promise<Fixture> {
  const packet = goldenPacket(prefix, { traderType });
  const dayBars = await dayFor(packet);
  return {
    packet,
    dayBars,
    dictionary: buildValueDictionary(packet, dayBars, options),
  };
}

/** A dictionary written by hand. */
export function dictOf(
  entries: readonly (Partial<ValueEntry> & { id: string; value: number })[]
): ValueDictionary {
  const full: ValueEntry[] = entries.map((entry) => {
    const kind = entry.kind ?? 'PRICE';
    return {
      id: entry.id,
      kind,
      value: entry.value,
      tolerance:
        entry.tolerance ?? (kind === 'PRICE' || kind === 'DISTANCE' ? 0.05 : 0),
      addressable: entry.addressable ?? false,
    };
  });
  return { entries: full, byId: new Map(full.map((e) => [e.id, e])) };
}

/** `4350.72` written with the decimal digits that start at `zero` (a code point from `DIGIT_ZEROS`). */
export function withDigits(text: string, zero: number): string {
  return text.replace(/\d/g, (digit) =>
    String.fromCodePoint(zero + Number(digit))
  );
}

export const DIGIT_RUNS: readonly number[] = DIGIT_ZEROS;

/** The same number in the notations the 19 locales use. */
export const NOTATIONS: readonly { name: string; text: string }[] = [
  { name: 'point decimal', text: '4350.72' },
  { name: 'English thousands', text: '4,350.72' },
  { name: 'German thousands', text: '4.350,72' },
  { name: 'decimal comma', text: '4350,72' },
  { name: 'French thin space', text: `4${THIN_NBSP}350,72` },
  { name: 'Russian-style no-break space', text: `4${NBSP}350,72` },
  { name: 'plain space', text: '4 350,72' },
  { name: 'Swiss apostrophe', text: "4'350.72" },
];

/** Digit scripts the app's locales use, as the first digit of each run. */
export const SCRIPTS: readonly { name: string; zero: number }[] = [
  { name: 'Arabic-Indic', zero: 0x0660 },
  { name: 'Extended Arabic-Indic (Urdu)', zero: 0x06f0 },
  { name: 'Devanagari (Hindi)', zero: 0x0966 },
  { name: 'Thai', zero: 0x0e50 },
  { name: 'full-width', zero: 0xff10 },
  { name: 'Bengali', zero: 0x09e6 },
  { name: 'mathematical bold', zero: 0x1d7ce },
];
