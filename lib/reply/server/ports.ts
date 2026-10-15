/**
 * The real ports of the orchestrator (build step 7 part 7a): the model gateway, the quota meter
 * over the ledger, the market database, the chart in storage, the chat and trace stores, the
 * environment, the clock, a timer and a source of ids. Everything `runReply` asks for and cannot
 * make itself is made here, once, from the environment; a test builds its own `ReplyPorts`.
 *
 * WHAT IS NOT NEW. The intake path's ports are the ones `lib/intake/server/access.ts` already
 * builds (the session, the entitlement table, the chat thread check, the profile, the quota floor,
 * the snapshot, the calendar, the knowledge service); this file takes them, switches the gate's
 * flag from `INTAKE_ENABLED` to `REPLY_ENABLED` and puts the staging allow-list in front of the
 * session, and leaves the Understand model to the orchestrator, which wraps it to record its cost.
 *
 * WHAT THE HOLD IS BASED ON. `bounds(kind)` is the worst a request of this kind could cost: the
 * Understand call at its prompt ceiling, and the ANSWER at the full 19,600-token budget plus a
 * chart, on whichever of the launch pair would cost more (only one answers, so the dearer one
 * bounds the request; a failed first call is not charged, but the margin of the estimate and the
 * rule that a settlement never exceeds the balance make the rest the business's, not the
 * trader's). With no model launched, or a price missing, there is no bound and the request is
 * refused as unavailable: nothing is held for a call nobody can price.
 *
 * Server code only: it reads the environment, the clock, a database, the network and a timer.
 *
 * @module lib/reply/server/ports
 */

import { randomUUID } from 'crypto';

import { getChartImage, getChartStamp } from '@/lib/storage/r2';
import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { canSendChartToModel, quotaModeOf } from '@/lib/platform/entitlements';
import { productionPorts } from '@/lib/intake/server/access';

import { CONTEXT_CAPS, capOf } from '../context/caps';
import { launchPorts } from '../gateway/fallback';
import { gatewayConfigFromEnv } from '../gateway/openrouter';
import { disabledModelsFromEnv, planLaunch } from '../gateway/registry';
import type { LaunchPlan } from '../gateway/registry';
import {
  UNDERSTAND_MODEL_ENV,
  createGatewayUnderstandPort,
  understandConfigFromEnv,
  understandTarget,
} from '../gateway/understand-adapter';
import {
  UNDERSTAND_PROMPT_TOKENS_CEILING,
  boundOf,
  callWorstCaseUnits,
} from '../meter/estimate';
import type { CallBound, RequestBounds } from '../meter/estimate';
import { createMeter } from '../meter/quota-port';
import { proMonthlyUnitsFromEnv } from '../meter/units';
import { readDayBars } from '../read/day-bars';
import { readSnapshotAt } from '../read/snapshot-at';
import type { ReplyPorts } from '../run/types';
import { allowListSession, isReplyEnabled } from './flags';
import type { Env } from './flags';
import { createThreadsPort, createTracesPort } from './store-ports';

/** The most a prompt can hold, in estimator tokens: the total of the caps of 5.4. */
export const PROMPT_TOKENS_CEILING = CONTEXT_CAPS.total;

/** A chart is declared at its cap; a model that cannot see one pays nothing for it. */
export const CHART_TOKENS_CEILING = capOf('CHART').cap;

/** The bounds of a request of `kind`, or null when no model is launched or the Understand model is not priced. */
export function requestBounds(
  env: Env,
  kind: 'TYPED' | 'INSTANT',
  plan: LaunchPlan = planLaunch(disabledModelsFromEnv(env))
): RequestBounds | null {
  const answers = [plan.primary, plan.fallback].filter(
    (model): model is NonNullable<typeof model> => model !== null
  );
  if (answers.length === 0) return null;

  // only one of the pair answers, so the dearer bounds the request
  let dearest: CallBound | null = null;
  let dearestUnits = -1;
  for (const model of answers) {
    const bound = boundOf(model, PROMPT_TOKENS_CEILING, CHART_TOKENS_CEILING);
    const units = callWorstCaseUnits(bound);
    if (units === null) return null;
    if (units > dearestUnits) {
      dearest = bound;
      dearestUnits = units;
    }
  }

  if (kind === 'INSTANT') {
    return { understand: null, answer: dearest as CallBound };
  }
  const slug = env[UNDERSTAND_MODEL_ENV];
  if (typeof slug !== 'string' || slug.trim() === '') return null;
  const target = understandTarget(slug.trim());
  return {
    understand: boundOf(target, UNDERSTAND_PROMPT_TOKENS_CEILING),
    answer: dearest as CallBound,
  };
}

/** A deadline backed by a timer; `cancel` clears it, so a finished request leaves nothing running. */
function timerDeadline(ms: number): ReturnType<ReplyPorts['deadline']> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  // a timer must never keep a server process alive on its own
  timer.unref?.();
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/** The production ports of `runReply`, from the environment. */
export function createReplyPorts(env: Env = process.env): ReplyPorts {
  const base = productionPorts(env);
  const { understand: _understand, ...intake } = base;
  void _understand;

  const ledger = createLedgerPort();
  const meter = createMeter({
    ledger,
    now: () => Date.now(),
    allowanceOf: (tier) =>
      quotaModeOf(tier) === 'MONTHLY_UNITS' ? proMonthlyUnitsFromEnv(env) : 0,
    // the floor is the gate's check; the meter reserves the worst case
    floorOf: () => 1,
  });
  const disabled = disabledModelsFromEnv(env);

  return {
    intake: {
      ...intake,
      gate: {
        ...intake.gate,
        enabled: () => isReplyEnabled(env),
        session: allowListSession(intake.gate.session, env),
      },
    },
    understand: ({ onCall }) =>
      createGatewayUnderstandPort(understandConfigFromEnv(env), undefined, {
        onCall,
      }),
    bounds: (kind) => requestBounds(env, kind),
    meter,
    models: launchPorts(gatewayConfigFromEnv(env), planLaunch(disabled)),
    dayBars: (slot) => readDayBars({ slot }),
    chart: { getChartStamp, getChartImage },
    tierAllowsChart: (tier) => canSendChartToModel(tier),
    previousStates: async (slot) => {
      const read = await readSnapshotAt({ slot });
      return read.ok ? read.states : null;
    },
    threads: createThreadsPort(),
    traces: createTracesPort(),
    newThreadId: () => `th_${randomUUID().replace(/-/g, '')}`,
    anonymousRequestId: () => `anon_${randomUUID().replace(/-/g, '')}`,
    deadline: timerDeadline,
    log: (code, detail) => {
      // a code and numbers or words of ours: never the question, never a key
      console.error(`[reply] ${code}`, detail ?? {});
    },
  };
}
