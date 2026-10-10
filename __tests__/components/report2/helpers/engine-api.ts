/**
 * The server, for the Report 2 component tests: the real Engine 4 over the stored
 * cycles, answering in the shape the routes answer in.
 *
 * Nothing here invents a number. `offerAnswer` and `sizeAnswer` call the same
 * functions the route handlers call (`buildModalDefinition`, `validateSetup`,
 * `decideBadge`) over the same stored golden cycle (by default the real 18 Sep 20:55
 * one), and turn the result into JSON the way `respond.ts` does (a `Rational` writes
 * itself, a `bigint` is decimal text). `__tests__/components/report2/api-parity.test.ts`
 * holds this file to the real routes: for the same inputs the answers are equal byte
 * for byte, so a component rendered from them shows what the API would show.
 *
 * `EngineApi` is a `Report2Api` made from them. It records every call and can be told
 * to be slow, to fail, or to refuse a consent.
 */

import { createHash } from 'crypto';

import type { ConsentOutcome } from '@/components/report2/consent-bar';
import type {
  ConsentRequest,
  Report2Api,
  SetupRequest,
  SizeOutcome,
} from '@/components/report2/api-client';
import {
  badgeContextFromReading,
  buildModalDefinition,
  decideBadge,
  nextOpposingLevel,
  serializeValidatedSetup,
  validateSetup,
  type SetupFields,
  type ValidatedSetup,
} from '@/lib/engine4';
import type {
  WireOfferAnswer,
  WireOfferedModal,
  WireSizeAnswer,
} from '@/lib/engine4/templates/wire';

import {
  readingOf,
  setup as engineSetup,
  type Setup,
  type SetupOptions,
} from '../../../lib/engine4/helpers/setup';

/** JSON the way the routes write it: a `Rational` writes itself, a `bigint` is decimal text. */
export function toWire<T>(value: unknown): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item
    )
  ) as T;
}

export interface Scene {
  /** the engine's setup (profile, offer, blackout, broker row, zones, levels, day range) */
  s: Setup;
  gProfile: string;
}

export function scene(options: SetupOptions = {}): Scene {
  // the offer check reads the trader's style from the stored profile, as the route does
  const style = options.style ?? options.profile?.style;
  return {
    s: engineSetup({ ...options, ...(style === undefined ? {} : { style }) }),
    gProfile: options.gProfile ?? 'DAY_TRADER',
  };
}

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** What `POST /api/engine4/offer` answers. */
export function offerAnswer(world: Scene): WireOfferAnswer {
  const { ctx } = world.s;
  const modal = buildModalDefinition({
    profile: ctx.profile,
    offer: ctx.offer,
    zones: ctx.zones,
    structure: ctx.structure,
    range: ctx.range,
    livePrice: ctx.livePrice,
  });
  return toWire<WireOfferAnswer>({
    success: true,
    cycleSlot: ctx.offer.pinnedSlot,
    offer: ctx.offer,
    modal,
    blackout: ctx.blackout,
    profile: ctx.profile,
    synthesisFlag: 'live',
  });
}

/** The offered modal of an answer (a test that needs the form asks for the offered kind). */
export function offeredModal(answer: WireOfferAnswer): WireOfferedModal {
  if (answer.modal.status === 'NOT_OFFERED') {
    throw new Error('the scene is not offered');
  }
  return answer.modal;
}

function badgeView(world: Scene, setup: ValidatedSetup): unknown {
  const none = (unavailable: string): unknown => ({
    badge: null,
    result: null,
    unavailable,
  });
  if (setup.side === null || setup.entry.price === null)
    return none('NO_SETUP');
  if (setup.scenarios === null) return none('SETUP_NOT_SIZED');
  const context = badgeContextFromReading(
    readingOf(world.s.g, world.gProfile).reading
  );
  if (context === null) return none('SYNTHESIS_UNAVAILABLE');
  if (!world.s.ctx.structure.complete) return none('LEVELS_UNAVAILABLE');
  const result = decideBadge({
    side: setup.side,
    context,
    scenarios: setup.scenarios.scenarios,
    nextLevel: nextOpposingLevel(
      world.s.ctx.structure.levels,
      setup.side,
      setup.entry.price
    ),
  });
  return { badge: result.badge, result, unavailable: null };
}

/** The fields of a request the validator reads. */
export function fieldsOf(request: SetupRequest): SetupFields {
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

/** What `POST /api/engine4/size` answers (without the fields the components do not read). */
export function sizeAnswer(world: Scene, fields: SetupFields): WireSizeAnswer {
  const setup = validateSetup(world.s.ctx, fields);
  return toWire<WireSizeAnswer>({
    success: true,
    setup,
    setupSha256: sha256(serializeValidatedSetup(setup)),
    badge: badgeView(world, setup),
    offer: world.s.ctx.offer,
  });
}

export interface EngineApiOptions {
  /** milliseconds each size call takes (0: it answers at once) */
  sizeDelayMs?: number;
  /** the size call fails with this code */
  sizeFails?: string;
  /** decides what a consent press gets; the default records it */
  consent?: (
    request: ConsentRequest,
    call: number
  ) => ConsentOutcome | Promise<ConsentOutcome>;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class EngineApi implements Report2Api {
  readonly sizeCalls: SetupRequest[] = [];
  readonly consentCalls: ConsentRequest[] = [];
  /** the submission ids that were recorded, in order */
  readonly recorded: string[] = [];

  constructor(
    readonly world: Scene,
    readonly options: EngineApiOptions = {}
  ) {}

  async size(request: SetupRequest): Promise<SizeOutcome> {
    this.sizeCalls.push(request);
    if (
      this.options.sizeDelayMs !== undefined &&
      this.options.sizeDelayMs > 0
    ) {
      await wait(this.options.sizeDelayMs);
    }
    if (this.options.sizeFails !== undefined) {
      return { ok: false, code: this.options.sizeFails, retryable: false };
    }
    return { ok: true, answer: sizeAnswer(this.world, fieldsOf(request)) };
  }

  async consent(request: ConsentRequest): Promise<ConsentOutcome> {
    this.consentCalls.push(request);
    const call = this.consentCalls.length;
    if (this.options.consent !== undefined) {
      return this.options.consent(request, call);
    }
    // the server refuses a setup that is not the one shown
    const current = sizeAnswer(this.world, fieldsOf(request));
    if (current.setupSha256 !== request.shownSetupSha256) {
      return { ok: false, code: 'SETUP_CHANGED', retryable: false };
    }
    if (request.action === 'ACCEPT' && !current.setup.ok) {
      return { ok: false, code: 'CONSENT_REFUSED', retryable: false };
    }
    const duplicate = this.recorded.includes(request.submissionId);
    if (!duplicate) this.recorded.push(request.submissionId);
    return {
      ok: true,
      duplicate,
      action: request.action,
      recordedAt: '2026-09-18T20:57:30.000Z',
    };
  }
}

/**
 * What the modal sends for Z1 of the scene at the pre-set risk (a setup that passes
 * all eight checks on the 18 Sep cycle): the cycle's own slot, the zone's own price
 * and the stored invalidation's distance.
 */
export function z1Request(
  world: Scene,
  extra: Partial<SetupRequest> = {}
): SetupRequest {
  return {
    cycleSlot: String(world.s.slot),
    side: 'BUY',
    zoneId: 'Z1',
    entry: '4367.2',
    equity: '10000',
    riskPct: '0.75',
    stopDistance: '16.78',
    rrr: '1.75',
    language: 'en-US',
    ...extra,
  };
}
