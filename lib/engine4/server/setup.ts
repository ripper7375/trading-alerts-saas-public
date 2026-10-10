/**
 * Validate a setup against a loaded world, and decide its badge, the way the
 * `size` route and the `consent` route both need it. One implementation, so the
 * setup the trader is SHOWN and the setup that is RECORDED are made by the same
 * code from the same kind of inputs.
 *
 * The badge is decided here, on the server, from the validated setup's own
 * scenarios and the stored levels. It is not part of `ValidatedSetup` (part 4), and
 * a badge a client sends is not read. When the levels could not be read the badge is
 * NOT decided: "room to the next opposing level" is unknown, and a badge on unknown
 * room would claim more than the data says. The reason is returned beside the empty
 * badge.
 *
 * @module lib/engine4/server/setup
 */

import { createHash } from 'crypto';

import { decideBadge, type BadgeResult } from '../badge';
import { nextOpposingLevel } from '../room';
import type { ScenarioName } from '../types';
import {
  serializeValidatedSetup,
  validateSetup,
  type SetupFields,
  type ValidatedSetup,
} from '../validate';
import type { World } from './context';
import type { TraceRisk } from './trace';

export interface ValidatedWorld {
  setup: ValidatedSetup;
  /** SHA-256 (hex) of `serializeValidatedSetup(setup)`: the id of the setup the trader sees */
  setupSha256: string;
  badge: BadgeView;
}

export type BadgeUnavailable =
  /** the setup has no side or entry yet */
  | 'NO_SETUP'
  /** the numbers were not acceptable, so no scenarios were built */
  | 'SETUP_NOT_SIZED'
  /** the pinned reading could not be read, or has no direction */
  | 'SYNTHESIS_UNAVAILABLE'
  /** the stored levels could not be read: the room ahead is unknown */
  | 'LEVELS_UNAVAILABLE';

export interface BadgeView {
  /** the scenario that carries the badge, or null (no badge, or not decided: see `unavailable`) */
  badge: ScenarioName | null;
  /** the table row, the cap, the fitting scenarios and the level named; null when not decided */
  result: BadgeResult | null;
  unavailable: BadgeUnavailable | null;
}

export function sha256Of(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function badgeOf(world: World, setup: ValidatedSetup): BadgeView {
  const none = (unavailable: BadgeUnavailable): BadgeView => ({
    badge: null,
    result: null,
    unavailable,
  });
  if (setup.side === null || setup.entry.price === null) {
    return none('NO_SETUP');
  }
  if (setup.scenarios === null) return none('SETUP_NOT_SIZED');
  const context = world.synthesis === null ? null : world.synthesis.badge;
  if (context === null) return none('SYNTHESIS_UNAVAILABLE');
  if (!world.ctx.structure.complete) return none('LEVELS_UNAVAILABLE');
  const result = decideBadge({
    side: setup.side,
    context,
    scenarios: setup.scenarios.scenarios,
    nextLevel: nextOpposingLevel(
      world.ctx.structure.levels,
      setup.side,
      setup.entry.price
    ),
  });
  return { badge: result.badge, result, unavailable: null };
}

/** Run the eight checks of 6.10 on what the trader entered, and decide the badge. */
export function validateInWorld(
  world: World,
  fields: SetupFields
): ValidatedWorld {
  const setup = validateSetup(world.ctx, fields);
  return {
    setup,
    setupSha256: sha256Of(serializeValidatedSetup(setup)),
    badge: badgeOf(world, setup),
  };
}

/** The Risk group of the trace for a validated setup. */
export function traceRiskOf(
  world: World,
  validated: ValidatedWorld | null,
  consent: { action: string | null; recordId: string | null } = {
    action: null,
    recordId: null,
  }
): TraceRisk {
  const offer = world.ctx.offer;
  const setup = validated === null ? null : validated.setup;
  return {
    offerVerdict: offer.verdict,
    offerReasons: offer.reasons.map((reason) => reason.code),
    notices: offer.notices.map((notice) => notice.code),
    checks:
      setup === null
        ? null
        : setup.checks.map((check) => ({
            id: check.id,
            name: check.name,
            status: check.status,
            codes: check.codes,
          })),
    ok: setup === null ? null : setup.ok,
    halfRisk: setup === null ? offer.halfRiskPreset : setup.risk.halfRisk,
    override: setup === null ? null : setup.overrides.defectFlag,
    badge:
      validated === null || validated.badge.badge === null
        ? null
        : validated.badge.badge,
    setupSha256: validated === null ? null : validated.setupSha256,
    consentAction: consent.action,
    consentRecordId: consent.recordId,
  };
}
