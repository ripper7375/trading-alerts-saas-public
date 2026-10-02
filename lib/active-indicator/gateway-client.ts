/**
 * Server-side client for the gateway's cycle and active-indicator endpoints
 * (build step 2 part 6; decision: the monolith calls the gateway instead of
 * re-implementing the readers, so "READY only" and the resolver live in one place).
 *
 * Server code only: it sends a service API key that must never reach a browser.
 * Configuration (names only, values are set per environment):
 *   MARKET_GATEWAY_URL      base URL of railway-gateway, e.g. https://gateway.example
 *   MARKET_GATEWAY_API_KEY  one of the gateway's API_KEYS
 *
 * Every failure is a typed GatewayError so a caller can fail closed: a response
 * that does not match the contract is BAD_RESPONSE, never best-effort parsed. A
 * chart that shows a different indicator than the sensors is the very thing rule 6
 * exists to prevent, so callers answer "unavailable", not a guess.
 *
 * @module lib/active-indicator/gateway-client
 */

import {
  isActiveIndicatorTimeframe,
  isChannelSource,
  type ActiveIndicatorTimeframe,
  type ChannelSource,
} from './sources';

const TIMEOUT_MS = 5000;

export type GatewayErrorKind =
  | 'NOT_CONFIGURED'
  | 'UNREACHABLE'
  | 'TIMEOUT'
  | 'REJECTED'
  | 'SERVER_ERROR'
  | 'BAD_RESPONSE';

export class GatewayError extends Error {
  constructor(
    public readonly kind: GatewayErrorKind,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/** One row of the setting, as the gateway reports it. */
export interface ActiveIndicatorRecord {
  settingId: string;
  timeframe: ActiveIndicatorTimeframe;
  source: ChannelSource;
  /** The setting applies to every slot at or after this one (unix UTC seconds). */
  effectiveSlot: number;
  setBy: string;
  reason: string | null;
  createdAt: number;
}

/** The body of `GET /api/v1/cycles/current` (`cycles-current/1`). */
export interface CurrentCycleResponse {
  contract: 'cycles-current/1';
  now: number;
  cycle: {
    slot: number;
    status: 'FRESH' | 'DELAYED';
    attempts: number;
    retuning: boolean;
    closedBarsDigest: string | null;
    checkReason: string | null;
    timings: {
      readyAt: number;
      manifestReceivedAt: number;
      slotToReadySec: number;
      gatewaySec: number;
      collectorStartedAt: number | null;
      collectorValidatedAt: number | null;
      m5ExportAt: number | null;
      m15ExportAt: number | null;
    };
  } | null;
  dataStatus: {
    status: 'FRESH' | 'DELAYED' | 'STALE' | 'MARKET_CLOSED';
    reason: string;
    dataAsOfSlot: number | null;
    secondsSinceReady: number | null;
  };
  activeIndicators: {
    resolvedAtSlot: number;
    basis: 'CYCLE' | 'WALL_CLOCK' | 'REQUESTED_SLOT';
    byTimeframe: Record<ActiveIndicatorTimeframe, ActiveIndicatorRecord | null>;
  };
}

export interface ActiveIndicatorHistory {
  now: number;
  earliestSettableSlot: number;
  settings: ActiveIndicatorRecord[];
}

export type SetActiveIndicatorOutcome =
  | { status: 'SET'; setting: ActiveIndicatorRecord }
  | { status: 'REFUSED'; reason: string; detail: string };

// ------------------------------------------------------------------ parsing

function bad(what: string): never {
  throw new GatewayError(
    'BAD_RESPONSE',
    `the gateway's answer does not match the contract: ${what}`
  );
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNullableInt = (v: unknown): v is number | null =>
  v === null || isInt(v);

export function parseActiveIndicatorRecord(
  value: unknown,
  where = 'setting'
): ActiveIndicatorRecord {
  if (!isObject(value)) return bad(`${where} is not an object`);
  const {
    settingId,
    timeframe,
    source,
    effectiveSlot,
    setBy,
    reason,
    createdAt,
  } = value;
  if (typeof settingId !== 'string') return bad(`${where}.settingId`);
  if (!isActiveIndicatorTimeframe(timeframe)) return bad(`${where}.timeframe`);
  if (!isChannelSource(source)) return bad(`${where}.source`);
  if (!isInt(effectiveSlot)) return bad(`${where}.effectiveSlot`);
  if (typeof setBy !== 'string') return bad(`${where}.setBy`);
  if (reason !== null && typeof reason !== 'string')
    return bad(`${where}.reason`);
  if (!isInt(createdAt)) return bad(`${where}.createdAt`);
  return {
    settingId,
    timeframe,
    source,
    effectiveSlot,
    setBy,
    reason,
    createdAt,
  };
}

export function parseCurrentCycle(value: unknown): CurrentCycleResponse {
  if (!isObject(value)) return bad('the body is not an object');
  if (value['contract'] !== 'cycles-current/1') {
    return bad(
      `contract is ${String(value['contract'])}, expected cycles-current/1`
    );
  }
  if (!isInt(value['now'])) return bad('now');

  let cycle: CurrentCycleResponse['cycle'] = null;
  const rawCycle = value['cycle'];
  if (rawCycle !== null) {
    if (!isObject(rawCycle)) return bad('cycle');
    const t = rawCycle['timings'];
    if (!isObject(t)) return bad('cycle.timings');
    if (
      !isInt(rawCycle['slot']) ||
      (rawCycle['status'] !== 'FRESH' && rawCycle['status'] !== 'DELAYED') ||
      !isInt(rawCycle['attempts']) ||
      typeof rawCycle['retuning'] !== 'boolean' ||
      !(
        rawCycle['closedBarsDigest'] === null ||
        typeof rawCycle['closedBarsDigest'] === 'string'
      ) ||
      !(
        rawCycle['checkReason'] === null ||
        typeof rawCycle['checkReason'] === 'string'
      ) ||
      !isInt(t['readyAt']) ||
      !isInt(t['manifestReceivedAt']) ||
      !isInt(t['slotToReadySec']) ||
      !isInt(t['gatewaySec']) ||
      !isNullableInt(t['collectorStartedAt']) ||
      !isNullableInt(t['collectorValidatedAt']) ||
      !isNullableInt(t['m5ExportAt']) ||
      !isNullableInt(t['m15ExportAt'])
    ) {
      return bad('cycle');
    }
    cycle = rawCycle as unknown as NonNullable<CurrentCycleResponse['cycle']>;
  }

  const status = value['dataStatus'];
  if (
    !isObject(status) ||
    !['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED'].includes(
      String(status['status'])
    ) ||
    typeof status['reason'] !== 'string' ||
    !isNullableInt(status['dataAsOfSlot']) ||
    !isNullableInt(status['secondsSinceReady'])
  ) {
    return bad('dataStatus');
  }

  const indicators = value['activeIndicators'];
  if (!isObject(indicators)) return bad('activeIndicators');
  if (!isInt(indicators['resolvedAtSlot']))
    return bad('activeIndicators.resolvedAtSlot');
  if (
    indicators['basis'] !== 'CYCLE' &&
    indicators['basis'] !== 'WALL_CLOCK' &&
    indicators['basis'] !== 'REQUESTED_SLOT'
  ) {
    return bad('activeIndicators.basis');
  }
  const by = indicators['byTimeframe'];
  if (!isObject(by)) return bad('activeIndicators.byTimeframe');
  const byTimeframe =
    {} as CurrentCycleResponse['activeIndicators']['byTimeframe'];
  for (const timeframe of ['M5', 'M15'] as const) {
    const record = by[timeframe];
    if (record === undefined)
      return bad(`activeIndicators.byTimeframe.${timeframe} is missing`);
    byTimeframe[timeframe] =
      record === null
        ? null
        : parseActiveIndicatorRecord(
            record,
            `activeIndicators.byTimeframe.${timeframe}`
          );
    if (record !== null && byTimeframe[timeframe]!.timeframe !== timeframe) {
      return bad(
        `activeIndicators.byTimeframe.${timeframe} describes ${byTimeframe[timeframe]!.timeframe}`
      );
    }
  }

  return {
    contract: 'cycles-current/1',
    now: value['now'] as number,
    cycle,
    dataStatus: status as unknown as CurrentCycleResponse['dataStatus'],
    activeIndicators: {
      resolvedAtSlot: indicators['resolvedAtSlot'] as number,
      basis: indicators['basis'],
      byTimeframe,
    },
  };
}

export function parseHistory(value: unknown): ActiveIndicatorHistory {
  if (!isObject(value)) return bad('the body is not an object');
  if (!isInt(value['now'])) return bad('now');
  if (!isInt(value['earliestSettableSlot'])) return bad('earliestSettableSlot');
  const list = value['settings'];
  if (!Array.isArray(list)) return bad('settings');
  return {
    now: value['now'] as number,
    earliestSettableSlot: value['earliestSettableSlot'] as number,
    settings: list.map((s, i) =>
      parseActiveIndicatorRecord(s, `settings[${i}]`)
    ),
  };
}

// ---------------------------------------------------------------- transport

function configuration(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env['MARKET_GATEWAY_URL'];
  const apiKey = process.env['MARKET_GATEWAY_API_KEY'];
  if (!baseUrl || !apiKey) {
    throw new GatewayError(
      'NOT_CONFIGURED',
      'MARKET_GATEWAY_URL and MARKET_GATEWAY_API_KEY must both be set to reach the gateway'
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function gatewayRequest(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' }
): Promise<Response> {
  const { baseUrl, apiKey } = configuration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GatewayError(
        'TIMEOUT',
        `the gateway did not answer within ${TIMEOUT_MS} ms`
      );
    }
    throw new GatewayError('UNREACHABLE', 'the gateway could not be reached');
  } finally {
    clearTimeout(timeout);
  }
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return bad('the body is not JSON');
  }
}

function assertSuccess(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new GatewayError(
      'REJECTED',
      `the gateway rejected the configured API key (${response.status})`,
      response.status
    );
  }
  if (response.status >= 500) {
    throw new GatewayError(
      'SERVER_ERROR',
      `the gateway answered ${response.status}`,
      response.status
    );
  }
  if (!response.ok) {
    throw new GatewayError(
      'REJECTED',
      `the gateway refused the request (${response.status})`,
      response.status
    );
  }
}

/** The newest READY cycle, its status and timings, and the active indicators in force at its slot. */
export async function fetchCurrentCycle(): Promise<CurrentCycleResponse> {
  const response = await gatewayRequest('/api/v1/cycles/current');
  assertSuccess(response);
  return parseCurrentCycle(await jsonOf(response));
}

/** Every setting ever written (the audit trail), and the earliest slot a new one may name. */
export async function fetchActiveIndicatorHistory(
  options: { timeframe?: ActiveIndicatorTimeframe; limit?: number } = {}
): Promise<ActiveIndicatorHistory> {
  const query = new URLSearchParams();
  if (options.timeframe) query.set('timeframe', options.timeframe);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  // `toString()`, not `URLSearchParams.size`: not every runtime has `size`.
  const queryString = query.toString();
  const suffix = queryString === '' ? '' : `?${queryString}`;
  const response = await gatewayRequest(`/api/v1/active-indicator${suffix}`);
  assertSuccess(response);
  return parseHistory(await jsonOf(response));
}

/**
 * Ask the gateway to append a setting. The gateway applies the rules (a future
 * slot on a boundary, not a week ahead, a real source) and answers REFUSED with a
 * reason; anything else unexpected is a GatewayError.
 */
export async function setActiveIndicator(input: {
  timeframe: ActiveIndicatorTimeframe;
  source: ChannelSource;
  effectiveSlot: number;
  setBy: string;
  reason?: string | null;
}): Promise<SetActiveIndicatorOutcome> {
  const response = await gatewayRequest('/api/v1/active-indicator', {
    method: 'POST',
    body: {
      timeframe: input.timeframe,
      source: input.source,
      effectiveSlot: input.effectiveSlot,
      setBy: input.setBy,
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
  if (response.status === 400) {
    const body = await jsonOf(response);
    if (isObject(body) && body['status'] === 'REFUSED') {
      return {
        status: 'REFUSED',
        reason: String(body['reason']),
        detail: String(body['detail']),
      };
    }
    throw new GatewayError(
      'REJECTED',
      'the gateway rejected the shape of the request (400)',
      400
    );
  }
  assertSuccess(response);
  const body = await jsonOf(response);
  if (!isObject(body) || body['status'] !== 'SET') return bad('status');
  return {
    status: 'SET',
    setting: parseActiveIndicatorRecord(body['setting']),
  };
}
