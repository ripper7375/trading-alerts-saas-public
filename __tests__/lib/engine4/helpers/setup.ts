/**
 * The setup the validator and modal tests start from: a stored, signed-off
 * golden cycle (by default the real 18 Sep 20:55 one: a LONG counter-trend rally,
 * CAUTIONARY from the MCD0 defect, zones Z1 4367.20 and Z2 4350.16, last closed
 * M5 close 4378.31) with the pieces `validateSetup` and `buildModalDefinition`
 * are handed: the offer check run on it, a clear blackout, a broker row, the
 * stored levels and a day range.
 *
 * What is NOT stored and so is made here, and labelled so:
 *  - the Tier-1 ids (9000000xx) are TEST IDS, not MT5 event ids;
 *  - the `symbol_specs` row holds TEST figures, not a claim about any broker;
 *  - the M5 bars are TEST bars built to reproduce the DAY line of architecture 5.5
 *    for the 18 Sep cycle (high 4391.20, low 4318.75): the stored bundle keeps only
 *    closes, not highs and lows, so a real 24-hour range cannot be read from it.
 */

import {
  PROFILE_DEFAULTS,
  checkBlackout,
  checkOffer,
  dayRange,
  levelsFromReadings,
  readBrokerFigures,
  srLevelsFromContext,
  zoneFromStored,
} from '@/lib/engine4';
import type {
  CalendarEvent,
  DayBar,
  DayRange,
  OfferResult,
  OfferSynthesis,
  StructureRead,
  Tier1List,
  TraderProfile,
  ValidationContext,
  ZoneInput,
} from '@/lib/engine4';

import { loadGoldens, readingsOf, slotSeconds, type Golden } from './stored';

export const MIN = 60;
export const HOUR = 3600;

export const TEST_LIST: Tier1List = {
  schemaVersion: 1,
  listVersion: 4,
  events: [
    { eventId: '900000001', kind: 'CPI', name: 'TEST US CPI' },
    { eventId: '900000002', kind: 'CORE_PCE', name: 'TEST US Core PCE' },
    { eventId: '900000003', kind: 'FOMC_RATE_DECISION', name: 'TEST FOMC' },
    { eventId: '900000004', kind: 'NFP', name: 'TEST NFP' },
  ],
};

/** TEST figures. */
export const SPECS_ROW = {
  symbol: 'XAUUSD',
  version: 3,
  captured_at: 0,
  contract_size: 100,
  volume_min: 0.01,
  volume_step: 0.01,
  volume_max: 100,
  tick_size: 0.01,
  typical_spread: 25,
  swap_long: -66.5,
  swap_short: 34.2,
  point: 0.01,
  digits: 2,
  swap_mode: 1,
};

/** A profile with room: 1:5 leverage so the risk limit, not the leverage limit, usually sets the lot. */
export const ROOMY_PROFILE: TraderProfile = {
  ...PROFILE_DEFAULTS,
  style: 'BOTH',
  maxRiskPct: '1.5',
  maxLeverage: '5',
  targetRrr: '1.75',
  equity: '10000',
  minSld: '13',
  commission: '4',
};

export function golden(prefix: string): Golden {
  const found = loadGoldens().find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden scenario ${prefix}`);
  return found;
}

export function readingOf(g: Golden, profile = 'DAY_TRADER') {
  const found = g.readings.find((r) => r.profile === profile);
  if (found === undefined) throw new Error(`no ${profile} reading in ${g.id}`);
  return found;
}

export function synthesisOf(
  reading: Record<string, unknown>,
  retuning = false
): OfferSynthesis {
  return {
    cycleSlot: slotSeconds(String(reading['cycle_slot'])),
    bias: String(reading['bias']),
    status: String(reading['status']),
    statusReasons: reading['status_reasons'] as string[],
    trendRelation: (reading['trend_relation'] as string | null) ?? null,
    ruleId: String(reading['rule_id']),
    branchId: (reading['branch_id'] as string | null) ?? null,
    retuning,
  };
}

export function zonesOf(g: Golden, profile = 'DAY_TRADER'): ZoneInput[] {
  return readingOf(g, profile).zones.map((raw) => {
    const zone = zoneFromStored(raw);
    if (zone === null) throw new Error('a golden zone did not read');
    return zone;
  });
}

/** The levels of the cycle, as `readStructureLevels` would hand them back. */
export function structureOf(g: Golden): StructureRead {
  return {
    complete: true,
    levels: [
      ...levelsFromReadings(readingsOf(g)),
      ...srLevelsFromContext(g.context),
    ],
    problems: [],
  };
}

/**
 * TEST bars: the highest high and the lowest low of the last 24 hours are the
 * given ones; a bar still forming and a bar older than 24 hours carry absurd
 * figures that must be ignored.
 */
export function testBars(now: number, high: string, low: string): DayBar[] {
  const lastClosed = Math.floor(now / 300) * 300 - 300;
  return [
    { openTime: lastClosed, high, low: '4380' },
    { openTime: lastClosed - 7200, high: '4330', low },
    { openTime: lastClosed - 3600, high: '4350', low: '4340' },
    // still forming at `now`
    { openTime: lastClosed + 300, high: '9999', low: '4000' },
    // older than 24 hours
    { openTime: now - 86400 - 3600, high: '5000', low: '1000' },
  ];
}

export interface SetupOptions {
  golden?: string;
  gProfile?: string;
  profile?: Partial<TraderProfile>;
  /** overrides of the pinned synthesis reading */
  pinned?: Partial<OfferSynthesis>;
  newest?: OfferSynthesis | null;
  retuning?: boolean;
  dataStatus?: { status: string; dataAsOfSlot: number | null } | null;
  events?: CalendarEvent[];
  list?: Tier1List | null;
  /** null: no broker row; an object: fields of the test row replaced */
  specs?: Record<string, unknown> | null;
  /** how old the broker row is, seconds (default one hour) */
  specsAge?: number;
  /** the newest observation of the calendar, seconds before now (default ten minutes); null: an empty calendar */
  calendarAge?: number | null;
  price?: number | null;
  /** the day range, instead of the test bars */
  range?: DayRange;
  zones?: ZoneInput[];
  structure?: StructureRead;
  zoneId?: string;
  style?: TraderProfile['style'];
}

export interface Setup {
  ctx: ValidationContext;
  now: number;
  slot: number;
  offer: OfferResult;
  g: Golden;
}

export function setup(over: SetupOptions = {}): Setup {
  const g = golden(over.golden ?? '01-');
  const reading = readingOf(g, over.gProfile ?? 'DAY_TRADER');
  const slot = slotSeconds(String(reading.reading['cycle_slot']));
  const now = slot + 150;
  const profile: TraderProfile = { ...ROOMY_PROFILE, ...over.profile };
  const zones = over.zones ?? zonesOf(g, over.gProfile ?? 'DAY_TRADER');
  const price = over.price === undefined ? g.referencePrice : over.price;
  const pinned = {
    ...synthesisOf(reading.reading, over.retuning ?? false),
    ...over.pinned,
  };
  const specsResult =
    over.specs === null
      ? readBrokerFigures(null, now)
      : readBrokerFigures(
          {
            ...SPECS_ROW,
            captured_at: now - (over.specsAge ?? 3600),
            ...over.specs,
          },
          now
        );
  const blackout = checkBlackout({
    nowSeconds: now,
    traderType: profile.traderType,
    list: over.list === undefined ? TEST_LIST : over.list,
    events: over.events ?? [],
    newestCapturedAt:
      over.calendarAge === null ? null : now - (over.calendarAge ?? 600),
  });
  const offer = checkOffer({
    nowSeconds: now,
    style: over.style ?? 'BOTH',
    pinned,
    newest: over.newest ?? null,
    dataStatus:
      over.dataStatus === undefined
        ? { status: 'FRESH', dataAsOfSlot: slot }
        : over.dataStatus,
    blackout,
    specs: specsResult,
    zones,
    ...(over.zoneId === undefined ? {} : { zoneId: over.zoneId }),
    price,
  });
  const range =
    over.range ?? dayRange(testBars(now, '4391.20', '4318.75'), now);
  return {
    ctx: {
      profile,
      offer,
      blackout,
      specs: specsResult,
      zones,
      structure: over.structure ?? structureOf(g),
      range,
      livePrice: price,
    },
    now,
    slot,
    offer,
    g,
  };
}
