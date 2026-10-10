/**
 * Everything a route needs to answer about one trader's setup, read ONCE from
 * the server's own sources and handed to the engine: the trader's stored profile,
 * the pinned synthesis reading and its zones (`readOfferSnapshot`), the live data
 * status (asked of the gateway, never copied), the broker figures, the news
 * calendar and the Tier-1 list, the closed M5 bars of the last 24 hours, the
 * stored levels of the pinned cycle, and the clock.
 *
 * This is the "server recomputes everything" rule in one function. The inputs are
 * a user id (from the session), a cycle slot and a zone id; nothing the client
 * could send is a price, a lot, a verdict or a profile. Every reader that can fail
 * answers with a problem instead of throwing, and the engine fails closed on each:
 * no live status is `DATA_STATUS_UNKNOWN`, no calendar is `CALENDAR_UNAVAILABLE`, no
 * broker row is `SPECS_MISSING`, no bars is a range that is UNKNOWN (a custom entry is
 * refused), unreadable levels degrade the stop options to the zone's own invalidation.
 *
 * The only thing that throws is a trader with no stored profile (`PROFILE_NOT_SET`):
 * there is nothing to size against until the trader has confirmed one.
 *
 * @module lib/engine4/server/context
 */

import {
  fetchCurrentCycle,
  type CurrentCycleResponse,
} from '@/lib/active-indicator/gateway-client';

import { checkBlackout, type BlackoutResult } from '../blackout';
import { dayRange, type DayRange } from '../entry-bound';
import type { StructureRead } from '../levels';
import {
  checkOffer,
  parseLiveDataStatus,
  type LiveDataStatus,
  type OfferResult,
} from '../offer';
import { readClosedM5Bars } from '../read/bars';
import { readOfferSnapshot, type OfferSnapshot } from '../read/cycle';
import { loadTier1List, readCalendar } from '../read/events';
import { readNewestBrokerFigures } from '../read/specs';
import {
  readStructureLevels,
  type StructureSensorInfo,
} from '../read/structure-levels';
import {
  readSynthesisDetail,
  type SynthesisDetail,
  type SynthesisDetailRead,
} from '../read/synthesis';
import { readProfile, type StoredProfile } from '../store/profile-store';
import { toDbInt } from '../time';
import type { ValidationContext } from '../validate';
import { Engine4HttpError } from './errors';
import type { TraceBuilder, TraceData } from './trace';

/** The readers the loader calls; a test passes its own, a route uses `defaultDeps`. */
export interface ContextDeps {
  /** milliseconds since the epoch */
  clock(): number;
  readProfile(userId: string): Promise<StoredProfile | null>;
  fetchCurrentCycle(): Promise<CurrentCycleResponse>;
  readOfferSnapshot: typeof readOfferSnapshot;
  readNewestBrokerFigures: typeof readNewestBrokerFigures;
  loadTier1List: typeof loadTier1List;
  readCalendar: typeof readCalendar;
  readClosedM5Bars: typeof readClosedM5Bars;
  readSynthesisDetail: typeof readSynthesisDetail;
  readStructureLevels: typeof readStructureLevels;
}

export const defaultDeps: ContextDeps = {
  clock: () => Date.now(),
  readProfile: (userId) => readProfile(userId),
  fetchCurrentCycle,
  readOfferSnapshot,
  readNewestBrokerFigures,
  loadTier1List,
  readCalendar,
  readClosedM5Bars,
  readSynthesisDetail,
  readStructureLevels,
};

export interface WorldRequest {
  userId: string;
  /** the cycle the setup is pinned to; null before Report 1 is made (the newest reading is then the pinned one) */
  cycleSlot: number | null;
  /** the pill that was picked, when one was */
  zoneId: string | null;
}

export interface World {
  stored: StoredProfile;
  /** unix UTC seconds, taken once, used by every check */
  nowSeconds: bigint;
  /** what `validateSetup` and `buildModalDefinition` are handed */
  ctx: ValidationContext;
  snapshot: OfferSnapshot;
  blackout: BlackoutResult;
  /** the pinned reading's rule, version, badge context and recorded hashes; null when it could not be read */
  synthesis: SynthesisDetail | null;
  synthesisProblem: { code: string; detail: string } | null;
  sensors: StructureSensorInfo[];
  liveStatus: LiveDataStatus | null;
  /** codes of everything the readers could not give */
  problems: string[];
}

const INCOMPLETE_STRUCTURE = (detail: string): StructureRead => ({
  complete: false,
  levels: [],
  problems: [{ code: 'NO_SENSOR_READINGS', detail }],
});

export async function loadWorld(
  request: WorldRequest,
  trace: TraceBuilder,
  deps: ContextDeps = defaultDeps
): Promise<World> {
  const stored = await trace.stage('profile', () =>
    deps.readProfile(request.userId)
  );
  if (stored === null) {
    throw new Engine4HttpError(
      'PROFILE_NOT_SET',
      'Confirm your trading profile first.'
    );
  }
  const profile = stored.profile;
  const nowSeconds = BigInt(deps.clock()) / 1000n;
  const problems: string[] = [];

  const tier1 = deps.loadTier1List();
  for (const problem of tier1.problems) problems.push(`TIER1_LIST: ${problem}`);

  const [gateway, snapshot, specs, calendar, bars] = await Promise.all([
    trace.stage('gateway', async () => {
      try {
        return await deps.fetchCurrentCycle();
      } catch (error) {
        const kind =
          typeof error === 'object' && error !== null && 'kind' in error
            ? String((error as { kind: unknown }).kind)
            : 'UNKNOWN';
        problems.push(`GATEWAY_${kind}`);
        return null;
      }
    }),
    trace.stage('cycle', () =>
      deps.readOfferSnapshot({
        profile: profile.traderType,
        ...(request.cycleSlot === null
          ? {}
          : { pinnedSlot: request.cycleSlot }),
      })
    ),
    trace.stage('specs', () => deps.readNewestBrokerFigures({ nowSeconds })),
    trace.stage('calendar', () =>
      deps.readCalendar({
        nowSeconds,
        traderType: profile.traderType,
        list: tier1.list,
      })
    ),
    trace.stage('bars', () => deps.readClosedM5Bars({ nowSeconds })),
  ]);

  for (const problem of snapshot.problems) problems.push(problem.code);
  for (const problem of calendar.problems)
    problems.push(`CALENDAR: ${problem}`);
  if (!specs.ok) problems.push(specs.code);

  const liveStatus =
    gateway === null ? null : parseLiveDataStatus(gateway.dataStatus);
  if (gateway !== null && liveStatus === null) {
    problems.push('GATEWAY_BAD_STATUS');
  }

  const blackout = checkBlackout({
    nowSeconds,
    traderType: profile.traderType,
    list: tier1.list,
    events: calendar.events,
    newestCapturedAt: calendar.newestCapturedAt,
  });

  const offer: OfferResult = checkOffer({
    nowSeconds,
    style: profile.style,
    pinned: snapshot.pinned,
    newest: snapshot.newest,
    dataStatus: liveStatus,
    blackout,
    specs,
    zones: snapshot.zones,
    ...(request.zoneId === null ? {} : { zoneId: request.zoneId }),
    price: snapshot.price,
  });

  const range: DayRange = bars.ok
    ? dayRange(bars.bars, nowSeconds)
    : { ok: false, code: 'NO_CLOSED_BARS', detail: bars.detail };
  if (!bars.ok) problems.push(bars.code);
  else if (!range.ok) problems.push(range.code);

  // -- the pinned cycle's reading and levels (only when there is a pinned cycle) -----------------
  let synthesis: SynthesisDetail | null = null;
  let synthesisProblem: World['synthesisProblem'] = null;
  let structure: StructureRead = INCOMPLETE_STRUCTURE(
    'there is no pinned cycle to read levels for'
  );
  let sensors: StructureSensorInfo[] = [];
  if (offer.pinnedSlot !== null) {
    const pinnedSlot = toDbInt('pinnedSlot', offer.pinnedSlot);
    const detail: SynthesisDetailRead = await trace.stage('synthesis', () =>
      deps.readSynthesisDetail({
        profile: profile.traderType,
        cycleSlot: pinnedSlot,
      })
    );
    if (detail.ok) {
      synthesis = detail.detail;
    } else {
      synthesisProblem = { code: detail.code, detail: detail.detail };
      problems.push(`SYNTHESIS_${detail.code}`);
    }
    const read = await trace.stage('structure', () =>
      deps.readStructureLevels({
        cycleSlot: pinnedSlot,
        nowSeconds: toDbInt('nowSeconds', nowSeconds),
        ...(synthesis === null
          ? {}
          : {
              expectedInputsSha256: synthesis.inputsSha256,
              expectedEnvelopeSha256: synthesis.envelopeSha256,
            }),
      })
    );
    structure = {
      complete: read.complete,
      levels: read.levels,
      problems: read.problems,
    };
    sensors = read.sensors;
    for (const problem of read.problems) problems.push(problem.code);
  }

  return {
    stored,
    nowSeconds,
    ctx: {
      profile,
      offer,
      blackout,
      specs,
      zones: snapshot.zones,
      structure,
      range,
      livePrice: snapshot.price,
    },
    snapshot,
    blackout,
    synthesis,
    synthesisProblem,
    sensors,
    liveStatus,
    problems,
  };
}

/** The Data group of the trace, from what was loaded. */
export function traceDataOf(world: World): TraceData {
  const { ctx, snapshot, synthesis } = world;
  const pinned = snapshot.pinned;
  return {
    cycleSlot:
      ctx.offer.pinnedSlot === null ? null : ctx.offer.pinnedSlot.toString(),
    dataStatus: world.liveStatus === null ? null : world.liveStatus.status,
    dataAsOfSlot:
      ctx.offer.dataAsOfSlot === null
        ? null
        : ctx.offer.dataAsOfSlot.toString(),
    sensors: world.sensors.map((sensor) => ({
      mcdId: sensor.mcdId,
      status: sensor.status,
      available: sensor.available,
    })),
    synthesis:
      pinned === null || synthesis === null
        ? null
        : {
            ruleId: synthesis.ruleId,
            rulesVersion: synthesis.rulesVersion,
            branchId: synthesis.branchId,
            flag: synthesis.flag,
            bias: pinned.bias,
            status: pinned.status,
            trendRelation: pinned.trendRelation,
          },
    specsVersion:
      ctx.offer.specsVersion === null
        ? null
        : ctx.offer.specsVersion.toString(),
    tier1ListVersion: ctx.offer.tier1ListVersion,
    problems: world.problems,
  };
}
