/**
 * DEVELOPMENT ONLY (build step 5, part 7; plan decision D9 (a)): the world the Report 2
 * preview runs in.
 *
 * It is the REAL Engine 4 over a STORED cycle: the sensors' envelopes, the zones and
 * the context levels come from the signed-off golden scenarios of the Python worker
 * (`davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/golden/`), read from disk; the
 * offer check, the blackout, the validator, the sizing and the badge are the functions
 * the production routes call, not copies. Nothing here invents market data. What a
 * golden does not hold is made here and LABELLED TEST, exactly as the tests label it:
 * the Tier-1 ids are test ids (900000xxx), the broker row is a test row, the M5 bars
 * are test bars built to reproduce the day's range of architecture 5.5 for 18 Sep.
 *
 * `__tests__/app/dev-report2-world.test.ts` holds this file to the stand-in of the
 * component tests, which `api-parity.test.ts` holds to the real routes, so what the
 * preview shows is what the API would answer for the same inputs.
 *
 * Nothing is recorded: a consent here answers as if it had been, and writes nothing.
 * Every entry point refuses to run in a production build.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import type {
  SetupRequest,
  SizeOutcome,
} from '@/components/report2/api-client';
import type { ConsentOutcome } from '@/components/report2/consent-bar';
import {
  PROFILE_DEFAULTS,
  badgeContextFromReading,
  buildModalDefinition,
  checkBlackout,
  checkOffer,
  dayRange,
  decideBadge,
  levelsFromReadings,
  nextOpposingLevel,
  readBrokerFigures,
  serializeValidatedSetup,
  srLevelsFromContext,
  validateSetup,
  zoneFromStored,
  type CalendarEvent,
  type DayBar,
  type OfferSynthesis,
  type SetupFields,
  type Tier1List,
  type TraderProfile,
  type ValidatedSetup,
  type ValidationContext,
  type ZoneInput,
} from '@/lib/engine4';
import type {
  WireOfferAnswer,
  WireSizeAnswer,
} from '@/lib/engine4/templates/wire';

import { scenarioById, type Scenario } from './scenarios';

const WORKER = join(
  process.cwd(),
  'davintrade-stack-d-and-e',
  'engine-1-5-new',
  'mcd_worker'
);

/** TEST ids, not MT5 event ids. */
const TEST_LIST: Tier1List = {
  schemaVersion: 1,
  listVersion: 4,
  events: [
    { eventId: '900000001', kind: 'CPI', name: 'TEST US CPI' },
    { eventId: '900000002', kind: 'CORE_PCE', name: 'TEST US Core PCE' },
    { eventId: '900000003', kind: 'FOMC_RATE_DECISION', name: 'TEST FOMC' },
    { eventId: '900000004', kind: 'NFP', name: 'TEST NFP' },
  ],
};

/** TEST figures, not a claim about any broker. */
const SPECS_ROW = {
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

/** The roomy test profile: 1:5 leverage so the risk limit, not the leverage limit, usually sets the lot. */
const ROOMY: TraderProfile = {
  ...PROFILE_DEFAULTS,
  style: 'BOTH',
  maxRiskPct: '1.5',
  maxLeverage: '5',
  targetRrr: '1.75',
  equity: '10000',
  minSld: '13',
  commission: '4',
};

interface Golden {
  slot: number;
  referencePrice: number | null;
  sensors: { mcd_id: string; envelope_json: string }[];
  context: unknown;
  reading: {
    reading: Record<string, unknown>;
    zones: Record<string, unknown>[];
  };
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function slotSeconds(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z$/.exec(iso);
  if (match === null) throw new Error(`not a cycle slot: ${iso}`);
  const part = (i: number): number => Number(match[i]);
  return Date.UTC(part(1), part(2) - 1, part(3), part(4), part(5)) / 1000;
}

function loadGolden(prefix: string): Golden {
  const dir = join(WORKER, 'golden');
  const name = readdirSync(dir)
    .sort()
    .find((entry) => entry.startsWith(prefix));
  if (name === undefined) throw new Error(`no golden scenario ${prefix}`);
  const scenario = readJson(join(dir, name, 'scenario.json'));
  const expected = readJson(join(dir, name, 'expected.json'));
  const real = scenario['kind'] === 'cycle';
  const context = real
    ? (readJson(
        join(WORKER, 'fixtures', `${String(scenario['bundle'])}.bundle.json`)
      )['context_levels'] ?? null)
    : (scenario['context_levels'] ?? null);
  const synthesis = expected['synthesis'] as {
    readings: { profile: string; reading_json: string; zones_json: string }[];
  };
  const day = synthesis.readings.find((r) => r.profile === 'DAY_TRADER');
  if (day === undefined) throw new Error(`no DAY_TRADER reading in ${name}`);
  return {
    slot: slotSeconds(String(expected['cycle_slot'])),
    referencePrice:
      typeof expected['reference_price'] === 'number'
        ? expected['reference_price']
        : null,
    sensors: expected['sensors'] as Golden['sensors'],
    context,
    reading: {
      reading: JSON.parse(day.reading_json) as Record<string, unknown>,
      zones: JSON.parse(day.zones_json) as Record<string, unknown>[],
    },
  };
}

/** The M5 bars of a day whose range is the given one (a TEST fixture; see the header). */
function testBars(now: number, high: string, low: string): DayBar[] {
  const lastClosed = Math.floor(now / 300) * 300 - 300;
  return [
    { openTime: lastClosed, high, low: '4380' },
    { openTime: lastClosed - 7200, high: '4330', low },
    { openTime: lastClosed - 3600, high: '4350', low: '4340' },
  ];
}

export interface DevScene {
  scenario: Scenario;
  ctx: ValidationContext;
  golden: Golden;
  slot: number;
  now: number;
}

function refuseInProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The Report 2 preview does not exist in a production build.'
    );
  }
}

export function buildScene(scenarioId: string): DevScene {
  refuseInProduction();
  const scenario = scenarioById(scenarioId);
  if (scenario === undefined) throw new Error(`no scenario ${scenarioId}`);
  const golden = loadGolden(scenario.golden);
  const slot = golden.slot;
  const now = slot + 150;
  const profile = { ...ROOMY, ...(scenario.profile ?? {}) } as TraderProfile;
  const zones: ZoneInput[] = golden.reading.zones.map((raw) => {
    const zone = zoneFromStored(raw);
    if (zone === null) throw new Error('a stored zone did not read');
    return zone;
  });
  const price = scenario.price ?? golden.referencePrice;

  const pinned: OfferSynthesis = {
    cycleSlot: slot,
    bias: String(golden.reading.reading['bias']),
    status: String(golden.reading.reading['status']),
    statusReasons: golden.reading.reading['status_reasons'] as string[],
    trendRelation:
      (golden.reading.reading['trend_relation'] as string | null) ?? null,
    ruleId: String(golden.reading.reading['rule_id']),
    branchId: (golden.reading.reading['branch_id'] as string | null) ?? null,
    retuning: false,
  };
  const newest: OfferSynthesis | null = scenario.newer
    ? {
        ...pinned,
        cycleSlot: slot + 300,
        bias: pinned.bias === 'LONG' ? 'SHORT' : 'LONG',
      }
    : null;

  const events: CalendarEvent[] = [];
  if (scenario.release === 'CPI_IN_5_MIN') {
    events.push({
      valueId: 'dev-cpi',
      eventId: '900000001',
      eventName: 'TEST US CPI',
      eventTime: now + 5 * 60,
      currency: 'USD',
      importance: 'HIGH',
      timeMode: 0,
      capturedAt: slot - 3600,
    });
  }
  if (scenario.release === 'RETAIL_SALES_IN_3_H') {
    events.push({
      valueId: 'dev-retail',
      eventId: '700000001',
      eventName: 'TEST US Retail Sales',
      eventTime: now + 3 * 3600,
      currency: 'USD',
      importance: 'HIGH',
      timeMode: 1,
      capturedAt: slot - 3600,
    });
  }

  const blackout = checkBlackout({
    nowSeconds: now,
    traderType: profile.traderType,
    list: TEST_LIST,
    events,
    newestCapturedAt: now - 600,
  });
  const specs = readBrokerFigures(
    { ...SPECS_ROW, captured_at: now - 3600 },
    now
  );
  const offer = checkOffer({
    nowSeconds: now,
    style: profile.style,
    pinned,
    newest,
    dataStatus: { status: scenario.dataStatus ?? 'FRESH', dataAsOfSlot: slot },
    blackout,
    specs,
    zones,
    price,
  });
  const sensors: Record<string, unknown> = {};
  for (const sensor of golden.sensors) {
    sensors[sensor.mcd_id] = JSON.parse(sensor.envelope_json);
  }
  return {
    scenario,
    golden,
    slot,
    now,
    ctx: {
      profile,
      offer,
      blackout,
      specs,
      zones,
      structure: {
        complete: true,
        levels: [
          ...levelsFromReadings(sensors),
          ...srLevelsFromContext(golden.context),
        ],
        problems: [],
      },
      range: dayRange(testBars(now, '4391.20', '4318.75'), now),
      livePrice: price,
    },
  };
}

/** JSON the way the routes write it: a `Rational` writes itself, a `bigint` is decimal text. */
function toWire<T>(value: unknown): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item
    )
  ) as T;
}

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** What `POST /api/engine4/offer` answers. */
export function offerAnswerOf(scene: DevScene): WireOfferAnswer {
  const { ctx } = scene;
  return toWire<WireOfferAnswer>({
    success: true,
    cycleSlot: ctx.offer.pinnedSlot,
    offer: ctx.offer,
    modal: buildModalDefinition({
      profile: ctx.profile,
      offer: ctx.offer,
      zones: ctx.zones,
      structure: ctx.structure,
      range: ctx.range,
      livePrice: ctx.livePrice,
    }),
    blackout: ctx.blackout,
    profile: ctx.profile,
    synthesisFlag: 'live',
  });
}

function badgeOf(scene: DevScene, setup: ValidatedSetup): unknown {
  const none = (unavailable: string): unknown => ({
    badge: null,
    result: null,
    unavailable,
  });
  if (setup.side === null || setup.entry.price === null)
    return none('NO_SETUP');
  if (setup.scenarios === null) return none('SETUP_NOT_SIZED');
  const context = badgeContextFromReading(scene.golden.reading.reading);
  if (context === null) return none('SYNTHESIS_UNAVAILABLE');
  if (!scene.ctx.structure.complete) return none('LEVELS_UNAVAILABLE');
  const result = decideBadge({
    side: setup.side,
    context,
    scenarios: setup.scenarios.scenarios,
    nextLevel: nextOpposingLevel(
      scene.ctx.structure.levels,
      setup.side,
      setup.entry.price
    ),
  });
  return { badge: result.badge, result, unavailable: null };
}

function fieldsOf(request: SetupRequest): SetupFields {
  return {
    side: request.side,
    ...(request.zoneId === undefined ? {} : { zoneId: request.zoneId }),
    entry: request.entry,
    equity: request.equity,
    riskPct: request.riskPct,
    stopDistance: request.stopDistance,
    rrr: request.rrr,
  };
}

/** What `POST /api/engine4/size` answers. */
export function sizeAnswerOf(
  scene: DevScene,
  request: SetupRequest
): WireSizeAnswer {
  const setup = validateSetup(scene.ctx, fieldsOf(request));
  return toWire<WireSizeAnswer>({
    success: true,
    setup,
    setupSha256: sha256(serializeValidatedSetup(setup)),
    badge: badgeOf(scene, setup),
    offer: scene.ctx.offer,
  });
}

export function sizeOutcomeOf(
  scene: DevScene,
  request: SetupRequest
): SizeOutcome {
  return { ok: true, answer: sizeAnswerOf(scene, request) };
}

/** the ids "recorded" in this server process, so a repeated press answers as a duplicate */
const recorded = new Set<string>();

/** A consent: checked the way the route checks it, and not written anywhere. */
export function consentOutcomeOf(
  scene: DevScene,
  request: SetupRequest & {
    action: 'ACCEPT' | 'MODIFY' | 'DECLINE';
    submissionId: string;
    shownSetupSha256: string;
  }
): ConsentOutcome {
  const current = sizeAnswerOf(scene, request);
  if (current.setupSha256 !== request.shownSetupSha256) {
    return { ok: false, code: 'SETUP_CHANGED', retryable: false };
  }
  if (request.action === 'ACCEPT' && !current.setup.ok) {
    return { ok: false, code: 'CONSENT_REFUSED', retryable: false };
  }
  const key = `${scene.scenario.id}:${request.submissionId}`;
  const duplicate = recorded.has(key);
  recorded.add(key);
  return {
    ok: true,
    duplicate,
    action: request.action,
    recordedAt: new Date().toISOString(),
  };
}
