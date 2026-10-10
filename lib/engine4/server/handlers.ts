/**
 * The four handlers behind `app/api/engine4/{profile,offer,size,consent}/route.ts`.
 *
 * A handler runs INSIDE `runRoute` (`respond.ts`): the flag, the session, the tier
 * and the body have already been dealt with, so it starts from a signed-in Pro
 * trader's id and a parsed JSON object, and it either returns the fields of a
 * success or throws an `Engine4HttpError`.
 *
 * The rule every handler keeps: the client names a CYCLE (`cycleSlot`), a ZONE
 * (`zoneId`) and the trader's own inputs, and the server works out the rest. A price,
 * a lot, a scenario, a profile, a verdict or a badge in a body is never read
 * (`request.ts` builds each input from named keys), the profile comes from the
 * database, and the numbers come from `validateSetup` on server-read data.
 *
 * @module lib/engine4/server/handlers
 */

import { buildModalDefinition } from '../modal-definition';
import { PROFILE_DEFAULTS } from '../profile';
import { recordConsent } from '../store/consent-store';
import { readProfile, saveProfile } from '../store/profile-store';
import {
  loadWorld,
  traceDataOf,
  defaultDeps,
  type ContextDeps,
} from './context';
import { Engine4HttpError } from './errors';
import {
  claimSubmission,
  completeSubmission,
  fingerprintOf,
  releaseSubmission,
  type RedisLike,
} from './idempotency';
import {
  readConsentAction,
  readCycleSlot,
  readLanguage,
  readProfileCandidate,
  readSetupFields,
  readShownSha256,
  readSubmissionId,
  readZoneId,
  type Read,
} from './request';
import type { RouteContext, RouteOutput } from './respond';
import { traceRiskOf, validateInWorld } from './setup';
import {
  REPORT2_DISCLAIMER_VERSION,
  REPORT2_TEMPLATE_VERSION,
} from './versions';

/** V8 has one symbol. */
export const SYMBOL = 'XAUUSD';

/** What the handlers reach outside themselves for; a test passes its own. */
export interface HandlerDeps {
  world: ContextDeps;
  redis?: RedisLike;
}

export const defaultHandlerDeps: HandlerDeps = { world: defaultDeps };

function need<T>(read: Read<T>): T {
  if (!read.ok) throw new Engine4HttpError('BAD_REQUEST', read.message);
  return read.value;
}

function bodyOf(context: RouteContext): Record<string, unknown> {
  if (context.body === null) {
    throw new Engine4HttpError('BAD_REQUEST', 'The body is required.');
  }
  return context.body;
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

/** The trader's profile, or the defaults to pre-fill the card when none was ever confirmed. */
export async function handleProfileGet(
  context: RouteContext
): Promise<RouteOutput<object>> {
  const stored = await context.trace.stage('profile', () =>
    readProfile(context.caller.userId)
  );
  if (stored === null) {
    return {
      fields: {
        stored: false,
        profile: { ...PROFILE_DEFAULTS },
        snapshotId: null,
        updatedAt: null,
      },
    };
  }
  return {
    fields: {
      stored: true,
      profile: stored.profile,
      snapshotId: stored.snapshotId,
      updatedAt: stored.updatedAt.toISOString(),
    },
  };
}

/** Confirm the profile: validate, then save it and append a snapshot of the change in one transaction. */
export async function handleProfilePost(
  context: RouteContext
): Promise<RouteOutput<object>> {
  const candidate = need(readProfileCandidate(bodyOf(context)));
  const saved = await context.trace.stage('save', () =>
    saveProfile(context.caller.userId, candidate)
  );
  if (!saved.ok) {
    throw new Engine4HttpError('INVALID_PROFILE', 'The profile is not valid.', {
      issues: saved.issues,
    });
  }
  return {
    fields: {
      stored: true,
      profile: saved.profile,
      snapshotId: saved.snapshotId,
      changed: saved.changed,
    },
  };
}

// ---------------------------------------------------------------------------
// offer
// ---------------------------------------------------------------------------

/** Is Report 2 offered for this cycle, and if so the modal definition the trader fills in. */
export async function handleOffer(
  context: RouteContext,
  deps: HandlerDeps = defaultHandlerDeps
): Promise<RouteOutput<object>> {
  const body = bodyOf(context);
  const cycleSlot = need(readCycleSlot(body, false));
  const zoneId = need(readZoneId(body));
  const world = await loadWorld(
    { userId: context.caller.userId, cycleSlot, zoneId },
    context.trace,
    deps.world
  );
  const { ctx } = world;
  const modal = buildModalDefinition({
    profile: ctx.profile,
    offer: ctx.offer,
    zones: ctx.zones,
    structure: ctx.structure,
    range: ctx.range,
    livePrice: ctx.livePrice,
  });
  context.trace.set({
    data: traceDataOf(world),
    risk: traceRiskOf(world, null),
  });
  return {
    fields: {
      /** the cycle every later call names: the pinned one, or the newest when none was asked for */
      cycleSlot: ctx.offer.pinnedSlot,
      offer: ctx.offer,
      modal,
      blackout: ctx.blackout,
      profile: ctx.profile,
      profileSnapshotId: world.stored.snapshotId,
      synthesisFlag: world.synthesis === null ? null : world.synthesis.flag,
    },
  };
}

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

/** Validate and size a setup from the trader's inputs; the answer is a RESULT even when the setup fails its checks. */
export async function handleSize(
  context: RouteContext,
  deps: HandlerDeps = defaultHandlerDeps
): Promise<RouteOutput<object>> {
  const body = bodyOf(context);
  const cycleSlot = need(readCycleSlot(body, true));
  const zoneId = need(readZoneId(body));
  const language = need(readLanguage(body));
  const fields = readSetupFields(body);
  context.trace.set({ language });
  const world = await loadWorld(
    { userId: context.caller.userId, cycleSlot, zoneId },
    context.trace,
    deps.world
  );
  const validated = validateInWorld(world, fields);
  context.trace.set({
    data: traceDataOf(world),
    risk: traceRiskOf(world, validated),
  });
  return {
    fields: {
      setup: validated.setup,
      setupSha256: validated.setupSha256,
      badge: validated.badge,
      offer: world.ctx.offer,
      profileSnapshotId: world.stored.snapshotId,
    },
  };
}

// ---------------------------------------------------------------------------
// consent
// ---------------------------------------------------------------------------

/**
 * Record what the trader did with a setup: Accept, Modify or Decline. The setup
 * is RECOMPUTED here from the cycle, the zone and the trader's inputs, and recorded
 * only if it is the one the trader was shown (`shownSetupSha256` is the
 * `setupSha256` the `size` route gave); if the picture moved, nothing is written and
 * the trader is told. One `submissionId` writes at most one record.
 */
export async function handleConsent(
  context: RouteContext,
  deps: HandlerDeps = defaultHandlerDeps
): Promise<RouteOutput<object>> {
  const body = bodyOf(context);
  const action = need(readConsentAction(body));
  const submissionId = need(readSubmissionId(body));
  const shown = need(readShownSha256(body));
  const cycleSlot = need(readCycleSlot(body, true));
  const zoneId = need(readZoneId(body));
  const language = need(readLanguage(body));
  const fields = readSetupFields(body);
  const userId = context.caller.userId;
  context.trace.set({ language, submissionId });

  // the same press, sent again, is the same request: the fingerprint says so
  // (the picked zone is one of `fields`, so it is part of the fingerprint without a name of its own)
  const fingerprint = fingerprintOf({
    action,
    cycleSlot,
    shown,
    language,
    fields,
  });
  const claim = await context.trace.stage('claim', () =>
    claimSubmission(userId, submissionId, fingerprint, deps.redis)
  );
  if (claim.state === 'DONE') {
    context.trace.set({
      risk: {
        offerVerdict: null,
        offerReasons: [],
        notices: [],
        checks: null,
        ok: null,
        halfRisk: null,
        override: null,
        badge: null,
        setupSha256: claim.outcome.setupSha256,
        consentAction: claim.outcome.action,
        consentRecordId: claim.outcome.id,
      },
    });
    return {
      fields: {
        duplicate: true,
        consent: {
          id: claim.outcome.id,
          action: claim.outcome.action,
          recordedAt: claim.outcome.recordedAt,
          setupSha256: claim.outcome.setupSha256,
          cycleSlot: claim.outcome.cycleSlot,
        },
      },
      status: 200,
    };
  }
  if (claim.state === 'IN_FLIGHT') {
    throw new Engine4HttpError(
      'SUBMISSION_IN_FLIGHT',
      'This submit is already being recorded.'
    );
  }
  if (claim.state === 'REUSED') {
    throw new Engine4HttpError(
      'SUBMISSION_ID_REUSED',
      'This submission id was used for a different request.'
    );
  }

  const claimed = claim.state === 'CLAIMED';
  try {
    const world = await loadWorld(
      { userId, cycleSlot, zoneId },
      context.trace,
      deps.world
    );
    const validated = validateInWorld(world, fields);
    context.trace.set({
      data: traceDataOf(world),
      risk: traceRiskOf(world, validated, { action, recordId: null }),
    });
    if (validated.setupSha256 !== shown) {
      throw new Engine4HttpError(
        'SETUP_CHANGED',
        'The setup changed since it was shown. Review it again.',
        { currentSetupSha256: validated.setupSha256 }
      );
    }
    if (validated.setup.pinnedSlot === null) {
      throw new Engine4HttpError(
        'CONSENT_REFUSED',
        'This setup cannot be recorded.',
        {
          code: 'SETUP_NOT_PINNED',
          detail: 'there is no synthesis reading for that cycle',
        }
      );
    }
    if (world.synthesis === null) {
      throw new Engine4HttpError(
        'DATA_UNAVAILABLE',
        'The synthesis reading this setup is pinned to could not be read.',
        {
          code:
            world.synthesisProblem === null
              ? 'NO_PINNED_READING'
              : world.synthesisProblem.code,
        }
      );
    }
    const synthesis = world.synthesis;
    const recorded = await context.trace.stage('record', () =>
      recordConsent({
        userId,
        action,
        symbol: SYMBOL,
        setup: validated.setup,
        synthesis: {
          ruleId: synthesis.ruleId,
          rulesVersion: synthesis.rulesVersion,
        },
        profileSnapshotId: world.stored.snapshotId,
        badge: validated.badge.badge,
        templateVersion: REPORT2_TEMPLATE_VERSION,
        disclaimerVersion: REPORT2_DISCLAIMER_VERSION,
        language,
      })
    );
    if (!recorded.ok) {
      throw new Engine4HttpError(
        'CONSENT_REFUSED',
        'This setup cannot be recorded.',
        { code: recorded.code, detail: recorded.detail }
      );
    }
    const outcome = {
      id: recorded.id,
      recordedAt: recorded.recordedAt.toISOString(),
      setupSha256: recorded.setupSha256,
      action,
      cycleSlot: String(cycleSlot),
    };
    if (claimed) {
      await completeSubmission(
        userId,
        submissionId,
        fingerprint,
        outcome,
        deps.redis
      );
    }
    context.trace.set({
      risk: traceRiskOf(world, validated, { action, recordId: recorded.id }),
    });
    return {
      fields: { duplicate: false, consent: outcome },
      status: 201,
    };
  } catch (error) {
    // nothing was recorded: let the trader press the button again
    if (claimed) await releaseSubmission(userId, submissionId, deps.redis);
    throw error;
  }
}
