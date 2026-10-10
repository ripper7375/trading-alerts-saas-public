/**
 * The world the route tests run in: the real 18 Sep 20:55 cycle (a stored,
 * signed-off golden scenario: a LONG counter-trend rally, CAUTIONARY, Z1 4367.20,
 * Z2 4350.16, last closed M5 close 4378.31) as the readers would hand it back.
 *
 * The routes, the handlers, the engine and the stores run for real. What is replaced
 * is the EDGE: the readers that talk to the market database and the gateway
 * (`ReaderWorld`), the session, Redis (`redis.ts`) and the user database (the
 * in-memory stand-in of part 5). Nothing here invents market data; what a golden
 * does not hold is labelled TEST in `lib/engine4/helpers/setup.ts` (the Tier-1 ids,
 * the broker row, the M5 bars).
 *
 * `reset()` puts every knob back; a test turns one knob and makes a request.
 */

import {
  badgeContextFromReading,
  readBrokerFigures,
  type BrokerResult,
  type CalendarEvent,
  type OfferSynthesis,
  type Tier1List,
} from '@/lib/engine4';
import type { BarsRead } from '@/lib/engine4/read/bars';
import type { CalendarRead } from '@/lib/engine4/read/events';
import type { OfferSnapshot } from '@/lib/engine4/read/cycle';
import type { StructureReadResult } from '@/lib/engine4/read/structure-levels';
import type { SynthesisDetailRead } from '@/lib/engine4/read/synthesis';
import type { CurrentCycleResponse } from '@/lib/active-indicator/gateway-client';

import {
  SPECS_ROW,
  TEST_LIST,
  golden,
  readingOf,
  structureOf,
  synthesisOf,
  testBars,
  zonesOf,
} from '../../../lib/engine4/helpers/setup';
import { slotSeconds } from '../../../lib/engine4/helpers/stored';

export interface Knobs {
  /** the gateway's live status; 'THROWS' makes the call fail, 'GARBAGE' answers a status that is not one */
  gateway:
    | 'FRESH'
    | 'DELAYED'
    | 'STALE'
    | 'MARKET_CLOSED'
    | 'THROWS'
    | 'GARBAGE';
  /** the broker row: usable, absent, or older than 7 days */
  specs: 'OK' | 'NONE' | 'STALE';
  list: Tier1List | null;
  events: CalendarEvent[];
  calendarFails: boolean;
  /** how long ago the newest calendar observation was, seconds */
  calendarAge: number;
  barsFail: boolean;
  /** the pinned synthesis reading's columns, overridden */
  pinned: Partial<OfferSynthesis>;
  /** the newest reading, when it is from a later cycle */
  newest: OfferSynthesis | null;
  /** no reading exists for the cycle that was asked for */
  readingMissing: boolean;
  /** the newest price: a number, null for the cycle's own, or 'NONE' for no price at all */
  price: number | null | 'NONE';
  flag: 'shadow' | 'live';
  detail: 'OK' | 'TAMPERED' | 'DATABASE_ERROR';
  structure: 'OK' | 'INCOMPLETE';
  /** milliseconds past the cycle's slot at which the request arrives */
  secondsAfterSlot: number;
}

const DEFAULTS: Knobs = {
  gateway: 'FRESH',
  specs: 'OK',
  list: TEST_LIST,
  events: [],
  calendarFails: false,
  calendarAge: 600,
  barsFail: false,
  pinned: {},
  newest: null,
  readingMissing: false,
  price: null,
  flag: 'live',
  detail: 'OK',
  structure: 'OK',
  secondsAfterSlot: 150,
};

export class ReaderWorld {
  g = golden('01-');
  reading = readingOf(this.g);
  slot = slotSeconds(String(this.reading.reading['cycle_slot']));
  zones = zonesOf(this.g);
  knobs: Knobs = { ...DEFAULTS };

  /** run the routes against another stored golden cycle (its DAY_TRADER reading) */
  use(prefix: string): void {
    this.g = golden(prefix);
    this.reading = readingOf(this.g);
    this.slot = slotSeconds(String(this.reading.reading['cycle_slot']));
    this.zones = zonesOf(this.g);
  }

  reset(): void {
    this.use('01-');
    this.knobs = { ...DEFAULTS, pinned: {}, events: [] };
  }

  /** the request's clock in unix seconds */
  get now(): number {
    return this.slot + this.knobs.secondsAfterSlot;
  }

  /** the request's clock in milliseconds: what `Date.now` answers */
  get nowMs(): number {
    return this.now * 1000;
  }

  private get price(): number | null {
    if (this.knobs.price === 'NONE') return null;
    return this.knobs.price === null
      ? (this.g.referencePrice ?? null)
      : this.knobs.price;
  }

  snapshot(request: { profile: string; pinnedSlot?: number }): OfferSnapshot {
    const missing =
      this.knobs.readingMissing ||
      (request.pinnedSlot !== undefined && request.pinnedSlot !== this.slot);
    const pinned: OfferSynthesis = {
      ...synthesisOf(this.reading.reading, false),
      ...this.knobs.pinned,
    };
    return {
      pinned: missing ? null : pinned,
      newest: this.knobs.newest,
      zones: missing ? [] : this.zones,
      price: this.price,
      flag: missing ? null : this.knobs.flag,
      cycle: {
        slot: BigInt(this.slot),
        storedDataStatus: 'FRESH',
        retuning: false,
        readyAt: BigInt(this.slot + 30),
      },
      problems: missing
        ? [
            {
              code: 'PINNED_READING_MISSING',
              detail: 'there is no synthesis reading for that cycle',
            },
          ]
        : [],
    };
  }

  specs(): BrokerResult {
    if (this.knobs.specs === 'NONE') return readBrokerFigures(null, this.now);
    const age = this.knobs.specs === 'STALE' ? 8 * 86400 : 3600;
    return readBrokerFigures(
      { ...SPECS_ROW, captured_at: this.now - age },
      this.now
    );
  }

  tier1(): { list: Tier1List | null; problems: string[] } {
    return this.knobs.list === null
      ? { list: null, problems: ['the Tier-1 list is not set'] }
      : { list: this.knobs.list, problems: [] };
  }

  calendar(): CalendarRead {
    if (this.knobs.calendarFails) {
      return {
        events: null,
        newestCapturedAt: null,
        problems: ['the news calendar could not be read'],
      };
    }
    return {
      events: this.knobs.events,
      newestCapturedAt: this.now - this.knobs.calendarAge,
      problems: [],
    };
  }

  bars(): BarsRead {
    return this.knobs.barsFail
      ? { ok: false, code: 'DATABASE_ERROR', detail: 'the M5 bars failed' }
      : { ok: true, bars: testBars(this.now, '4391.20', '4318.75') };
  }

  detail(): SynthesisDetailRead {
    if (this.knobs.detail === 'TAMPERED') {
      return {
        ok: false,
        code: 'READING_TAMPERED',
        detail: 'the stored reading does not hash to its stored hash',
      };
    }
    if (this.knobs.detail === 'DATABASE_ERROR') {
      return {
        ok: false,
        code: 'DATABASE_ERROR',
        detail: 'the synthesis reading could not be read',
      };
    }
    const reading = this.reading.reading;
    return {
      ok: true,
      detail: {
        ruleId: String(reading['rule_id']),
        rulesVersion: String(reading['rules_version']),
        branchId: (reading['branch_id'] as string | null) ?? null,
        flag: this.knobs.flag,
        badge: badgeContextFromReading(reading),
        inputsSha256: null,
        envelopeSha256: { MCD1: null, MCD2: null, MCD3: null },
      },
    };
  }

  structure(): StructureReadResult {
    if (this.knobs.structure === 'INCOMPLETE') {
      return {
        complete: false,
        levels: [],
        problems: [
          {
            code: 'BUNDLE_MISSING',
            detail: 'no bundle is stored for this cycle',
          },
        ],
        sensors: [],
        inputsSha256: null,
      };
    }
    return {
      ...structureOf(this.g),
      sensors: [
        {
          mcdId: 'MCD1',
          status: 'VALID',
          available: true,
          envelopeSha256: 'a',
        },
        {
          mcdId: 'MCD2',
          status: 'VALID',
          available: true,
          envelopeSha256: 'b',
        },
        {
          mcdId: 'MCD3',
          status: 'CAUTIONARY',
          available: true,
          envelopeSha256: 'c',
        },
      ],
      inputsSha256: null,
    };
  }

  /** the body of the gateway's `GET /api/v1/cycles/current` as far as Engine 4 reads it */
  gatewayBody(): CurrentCycleResponse {
    const status = this.knobs.gateway;
    if (status === 'THROWS') {
      throw Object.assign(new Error('the gateway could not be reached'), {
        kind: 'UNREACHABLE',
      });
    }
    return {
      contract: 'cycles-current/1',
      now: this.now,
      cycle: null,
      dataStatus: {
        status: (status === 'GARBAGE' ? 'WARM' : status) as 'FRESH',
        reason: 'test',
        dataAsOfSlot: this.slot,
        secondsSinceReady: 120,
      },
      activeIndicators: {
        resolvedAtSlot: this.slot,
        basis: 'CYCLE',
        byTimeframe: { M5: null, M15: null },
      },
    };
  }
}

export const world = new ReaderWorld();

/** The fields the modal sends for Z1 at the pre-set risk: a setup that passes all eight checks. */
export const Z1_FIELDS = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

/** The profile with room that the validator tests start from (1:5 leverage, equity 10,000). */
export const ROOMY = {
  traderType: 'DAY_TRADER',
  style: 'BOTH',
  maxRiskPct: '1.5',
  maxLeverage: '5',
  targetRrr: '1.75',
  equity: '10000',
  minSld: '13',
  commission: '4',
};
