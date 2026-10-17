/**
 * `GET /api/chat/state` (build step 7 part 7b; plan part 7; ADR-072, ADR-073; architecture 5.6 and 5.12):
 * everything the chat panel needs to draw itself, in ONE call.
 *
 *   models   the models a trader may choose from: only those that PASSED the evaluation (none until
 *            the first recorded run), each with the units a message costs, MEASURED, or null until it
 *            is ("not measured yet"), and whether it is the default
 *   quota    this month's balance: what the month allows, what is used, what is held by requests in
 *            flight, what is free. The interface shows a share and "about N analyses left" computed
 *            from the measured cost; it never prints a raw token number (ADR-073). `configured` is
 *            false while `PRO_MONTHLY_UNITS` is unset: the ledger then refuses everything
 *   profile  the trader's type (the badge), or null while no profile is confirmed
 *   cycle    the cycle the data is on and its status (the badge), or null when the cycle cannot be read
 *
 * Who may ask is the same as the other chat routes: flag, session, tier. The trader is the session's;
 * nothing in the request says who. A part that cannot be read (a ledger that is down, a cycle that cannot
 * be found) is null with the rest still answered; the panel is useful with a model list and no balance,
 * and an honest "unknown" is better than an error page.
 *
 * Server code only.
 *
 * @module lib/reply/server/state-api
 */

import 'server-only';

import type { AiModel } from '@/config/ai-models';
import { profilePort } from '@/lib/intake/server/access';
import { readSnapshot } from '@/lib/intake/read/snapshot';
import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { monthOf } from '@/lib/platform/metering/period';
import { quotaModeOf } from '@/lib/platform/entitlements';

import type {
  DataStatus,
  ProfileGateRead,
  TraderType,
} from '../contracts/intake';
import {
  AI_MODEL_REGISTRY,
  disabledModelsFromEnv,
  pickerModels,
  planLaunch,
} from '../gateway/registry';
import type { LedgerPort } from '../meter/quota-port';
import { proMonthlyUnitsFromEnv } from '../meter/units';
import { jsonResponse } from './errors';
import { type Env } from './flags';
import { authorize, createChatAuth } from './threads-api';
import type { ChatAuth } from './threads-api';

export interface CycleBadge {
  slot: string | null;
  data_status: DataStatus;
}

export interface StateApiDeps {
  auth: ChatAuth;
  /** the models a PRO trader may choose from */
  models(): readonly AiModel[];
  /** the slug of the default model, or null when none is launched */
  defaultSlug(): string | null;
  /** the monthly allowance in units for a tier; null while it is not set */
  allowanceOf(tier: string): number | null;
  ledger: LedgerPort;
  now(): number;
  profile(userId: string): Promise<ProfileGateRead>;
  cycle(traderType: TraderType): Promise<CycleBadge | null>;
}

/** The production dependencies; `registry` is the models' table (a test passes its own). */
export function createStateApiDeps(
  env: Env = process.env,
  registry: readonly AiModel[] = AI_MODEL_REGISTRY
): StateApiDeps {
  const disabled = disabledModelsFromEnv(env);
  const units = proMonthlyUnitsFromEnv(env);
  return {
    auth: createChatAuth(env),
    models: () => pickerModels('PRO', disabled, registry),
    defaultSlug: () => planLaunch(disabled, registry).primary?.slug ?? null,
    allowanceOf: (tier) => (quotaModeOf(tier) === 'MONTHLY_UNITS' ? units : 0),
    ledger: createLedgerPort(),
    now: () => Date.now(),
    profile: (userId) => profilePort.read(userId),
    cycle: async (traderType) => {
      const snapshot = await readSnapshot({ traderType });
      return {
        slot: snapshot.data.cycle_slot,
        data_status: snapshot.data.status,
      };
    },
  };
}

/** Run a read that may fail; a failure is "unknown", never an error page. */
async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export async function handleState(
  _request: Request,
  deps: StateApiDeps
): Promise<Response> {
  const auth = await authorize(deps.auth);
  if (!auth.ok) return auth.response;
  const { userId, tier } = auth.caller;

  const defaultSlug = deps.defaultSlug();
  const models = deps.models().map((model) => ({
    slug: model.slug,
    name: model.name,
    multiplier: model.multiplier,
    vision: model.vision,
    units_per_msg: model.units_per_msg,
    default: model.slug === defaultSlug,
  }));

  const nowMs = deps.now();
  const allowance = deps.allowanceOf(tier);
  const configured = allowance !== null && allowance > 0;
  const balance = configured
    ? await orNull(() =>
        deps.ledger.balance({ userId, nowMs, allowanceUnits: allowance })
      )
    : null;
  const quota = {
    configured,
    month: monthOf(nowMs),
    limit_units: balance?.limit ?? null,
    used_units: balance?.used ?? null,
    reserved_units: balance?.reserved ?? null,
    available_units: balance?.available ?? null,
  };

  const profileRead = await orNull(() => deps.profile(userId));
  const traderType =
    profileRead !== null && profileRead.ok
      ? profileRead.profile.trader_type
      : null;
  const cycle =
    traderType === null ? null : await orNull(() => deps.cycle(traderType));

  return jsonResponse({
    success: true,
    models,
    quota,
    profile: traderType === null ? null : { trader_type: traderType },
    cycle,
  });
}
