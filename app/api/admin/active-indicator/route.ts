/**
 * Admin Active-Indicator API Route (build step 2 part 6; rule 6, ADR-010).
 *
 * GET  /api/admin/active-indicator  the audit trail (every setting ever written),
 *                                   the earliest slot a new one may name, and what
 *                                   the newest READY cycle is using now.
 * POST /api/admin/active-indicator  schedule a change: one channel indicator for one
 *                                   timeframe, effective from a named FUTURE slot.
 *
 * Admin only, through the existing guard unchanged (`requireAdmin` from
 * `lib/auth/session`, which also checks the database for a stale JWT). No page: this
 * route is the whole admin surface of the setting (decision 7).
 *
 * AUDITED. The author recorded on the row is the signed-in administrator, taken from
 * the session; a `setBy` in the request is refused, so nobody can write a change in
 * someone else's name. The row also carries the reason and the time, and nothing ever
 * updates or deletes one (the gateway's table is append-only).
 *
 * The rules (a slot on a boundary, in the future, not more than a week ahead, a real
 * source) are the gateway's and are applied to every caller there; this route does not
 * restate them, it passes the gateway's refusal and its reason on.
 *
 * @module app/api/admin/active-indicator/route
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  fetchActiveIndicatorHistory,
  fetchCurrentCycle,
  GatewayError,
  setActiveIndicator,
  type ActiveIndicatorRecord,
  type CurrentCycleResponse,
} from '@/lib/active-indicator/gateway-client';
import {
  isActiveIndicatorTimeframe,
  isChannelSource,
} from '@/lib/active-indicator/sources';
import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';

const MAX_REASON_LENGTH = 500;
const MAX_SET_BY_LENGTH = 200;
const ALLOWED_FIELDS = ['timeframe', 'source', 'effectiveSlot', 'reason'];

type AdminActiveIndicatorResponse =
  | { status: 'restricted'; message: string }
  | { status: 'not_configured'; message: string }
  | { status: 'unavailable'; message: string }
  | {
      status: 'ok';
      now: number;
      earliestSettableSlot: number;
      settings: ActiveIndicatorRecord[];
      current: {
        cycleSlot: number | null;
        resolvedAtSlot: number;
        basis: CurrentCycleResponse['activeIndicators']['basis'];
        byTimeframe: CurrentCycleResponse['activeIndicators']['byTimeframe'];
        dataStatus: CurrentCycleResponse['dataStatus']['status'];
      };
    }
  | { status: 'invalid'; errors: string[] }
  | { status: 'refused'; reason: string; detail: string }
  | { status: 'gateway_error'; message: string }
  | { status: 'set'; setting: ActiveIndicatorRecord };

/** What a gateway failure means for the admin: not configured here, or the gateway did not complete the request. */
function describeGatewayFailure(error: GatewayError): {
  httpStatus: 503 | 502;
  kind: 'not_configured' | 'gateway_error';
  message: string;
} {
  if (error.kind === 'NOT_CONFIGURED') {
    return {
      httpStatus: 503,
      kind: 'not_configured',
      message:
        'MARKET_GATEWAY_URL and MARKET_GATEWAY_API_KEY are not both set in this environment -- the gateway cannot be reached.',
    };
  }
  return {
    httpStatus: 502,
    kind: 'gateway_error',
    message: `The gateway could not complete the request (${error.kind}): ${error.message}`,
  };
}

async function authorize(): Promise<
  | { ok: true; setBy: string }
  | { ok: false; response: NextResponse<AdminActiveIndicatorResponse> }
> {
  try {
    const session = await requireAdmin();
    const identity = `${session.user.email ?? 'no-email'} (${session.user.id})`;
    return { ok: true, setBy: identity.slice(0, MAX_SET_BY_LENGTH) };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        response: NextResponse.json(
          { status: 'restricted', message: error.message },
          { status: error.statusCode }
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          status: 'restricted',
          message: 'Unable to verify administrator status',
        },
        { status: 403 }
      ),
    };
  }
}

/**
 * GET /api/admin/active-indicator
 *
 * Never throws for a gateway failure: every failure mode is a 200 with an honest
 * `status` (`not_configured`, `unavailable`), like the other admin read routes, so
 * a screen can show a real alert instead of an error boundary.
 */
export async function GET(): Promise<
  NextResponse<AdminActiveIndicatorResponse>
> {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  try {
    const [history, current] = await Promise.all([
      fetchActiveIndicatorHistory(),
      fetchCurrentCycle(),
    ]);
    return NextResponse.json({
      status: 'ok',
      now: history.now,
      earliestSettableSlot: history.earliestSettableSlot,
      settings: history.settings,
      current: {
        cycleSlot: current.cycle ? current.cycle.slot : null,
        resolvedAtSlot: current.activeIndicators.resolvedAtSlot,
        basis: current.activeIndicators.basis,
        byTimeframe: current.activeIndicators.byTimeframe,
        dataStatus: current.dataStatus.status,
      },
    });
  } catch (error) {
    if (!(error instanceof GatewayError)) throw error;
    const failure = describeGatewayFailure(error);
    return NextResponse.json({
      status:
        failure.kind === 'not_configured' ? 'not_configured' : 'unavailable',
      message: failure.message,
    });
  }
}

/**
 * POST /api/admin/active-indicator
 * Body: { timeframe: 'M5' | 'M15', source: <channel source>, effectiveSlot: <unix seconds, a future slot>, reason?: string }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AdminActiveIndicatorResponse>> {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: 'invalid', errors: ['the body is not valid JSON'] },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  let input: Record<string, unknown> = {};
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    input = body as Record<string, unknown>;
  } else {
    errors.push('the body must be an object');
  }
  for (const field of Object.keys(input)) {
    if (!ALLOWED_FIELDS.includes(field)) {
      errors.push(
        field === 'setBy'
          ? 'setBy is not accepted: the author is the signed-in administrator'
          : `unknown field ${field}`
      );
    }
  }
  const { timeframe, source, effectiveSlot, reason } = input;
  if (!isActiveIndicatorTimeframe(timeframe))
    errors.push('timeframe must be M5 or M15');
  if (!isChannelSource(source))
    errors.push('source is not a channel indicator');
  if (typeof effectiveSlot !== 'number' || !Number.isInteger(effectiveSlot)) {
    errors.push('effectiveSlot must be an integer (unix seconds)');
  }
  if (
    reason !== undefined &&
    (typeof reason !== 'string' || reason.length > MAX_REASON_LENGTH)
  ) {
    errors.push(
      `reason must be text of at most ${MAX_REASON_LENGTH} characters`
    );
  }
  if (errors.length > 0) {
    return NextResponse.json({ status: 'invalid', errors }, { status: 400 });
  }

  try {
    const outcome = await setActiveIndicator({
      timeframe: timeframe as 'M5' | 'M15',
      source: source as Parameters<typeof setActiveIndicator>[0]['source'],
      effectiveSlot: effectiveSlot as number,
      setBy: auth.setBy,
      reason:
        typeof reason === 'string' && reason.trim() !== '' ? reason : null,
    });
    if (outcome.status === 'REFUSED') {
      return NextResponse.json(
        { status: 'refused', reason: outcome.reason, detail: outcome.detail },
        { status: 400 }
      );
    }
    console.info(
      `[admin] active indicator ${outcome.setting.timeframe} -> ${outcome.setting.source} ` +
        `from slot ${outcome.setting.effectiveSlot} set by ${outcome.setting.setBy}`
    );
    return NextResponse.json(
      { status: 'set', setting: outcome.setting },
      { status: 201 }
    );
  } catch (error) {
    if (!(error instanceof GatewayError)) throw error;
    const failure = describeGatewayFailure(error);
    return NextResponse.json(
      { status: failure.kind, message: failure.message },
      { status: failure.httpStatus }
    );
  }
}
