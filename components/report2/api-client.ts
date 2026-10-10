/**
 * The browser's side of the routes (build step 5, part 7).
 *
 * The modal does not know about `fetch`: it is handed a `Report2Api`, so the same
 * modal runs against the real routes, against a fixture on the development route,
 * and against a stand-in in a test. `createHttpApi` is the real one: it posts JSON
 * to `/api/engine4/size` and `/api/engine4/consent` and turns every way they can
 * fail into one shape, `{ ok: false, code, retryable }`.
 *
 * `retryable` is the one fact the consent bar needs: when no answer came (the
 * connection dropped, the server failed) the outcome is UNKNOWN, a second press must
 * send the same `submissionId` so a record that was written is returned and not
 * written twice. A definitive refusal (a 4xx the server answered) is not retryable.
 *
 * @module components/report2/api-client
 */

import type {
  ConsentAction,
  WireSizeAnswer,
} from '@/lib/engine4/templates/wire';

import type { ConsentOutcome } from './consent-bar';

/** What the trader entered, as exact text, for one sizing. */
export interface SetupRequest {
  /** the cycle the setup is pinned to (unix seconds as text) */
  cycleSlot: string;
  side: 'BUY' | 'SELL';
  /** set when a zone's pill was picked */
  zoneId?: string;
  entry: string;
  equity: string;
  riskPct: string;
  stopDistance: string;
  rrr: string;
  language: string;
}

export interface ConsentRequest extends SetupRequest {
  action: ConsentAction;
  /** one per submit */
  submissionId: string;
  /** the `setupSha256` of the setup the trader was shown */
  shownSetupSha256: string;
}

export type SizeOutcome =
  | { ok: true; answer: WireSizeAnswer }
  | { ok: false; code: string; retryable: boolean };

export interface Report2Api {
  size: (request: SetupRequest) => Promise<SizeOutcome>;
  consent: (request: ConsentRequest) => Promise<ConsentOutcome>;
}

type Fetch = typeof fetch;

interface Reply {
  status: number;
  body: unknown;
}

async function post(
  fetchImpl: Fetch,
  path: string,
  payload: unknown
): Promise<Reply | null> {
  let response: Response;
  try {
    response = await fetchImpl(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }
  try {
    return { status: response.status, body: await response.json() };
  } catch {
    return { status: response.status, body: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The refusal in a reply: its code, and whether pressing again is the same request. */
function refusal(reply: Reply | null): { code: string; retryable: boolean } {
  if (reply === null) return { code: 'NETWORK', retryable: true };
  const error =
    isRecord(reply.body) && isRecord(reply.body['error'])
      ? reply.body['error']
      : null;
  const code =
    error !== null && typeof error['code'] === 'string'
      ? error['code']
      : 'INTERNAL';
  return {
    code,
    retryable: reply.status >= 500 || code === 'SUBMISSION_IN_FLIGHT',
  };
}

export function createHttpApi(fetchImpl: Fetch = fetch): Report2Api {
  return {
    async size(request) {
      const reply = await post(fetchImpl, '/api/engine4/size', request);
      if (
        reply !== null &&
        reply.status === 200 &&
        isRecord(reply.body) &&
        reply.body['success'] === true &&
        isRecord(reply.body['setup'])
      ) {
        return { ok: true, answer: reply.body as unknown as WireSizeAnswer };
      }
      return { ok: false, ...refusal(reply) };
    },

    async consent(request) {
      const reply = await post(fetchImpl, '/api/engine4/consent', request);
      if (
        reply !== null &&
        (reply.status === 200 || reply.status === 201) &&
        isRecord(reply.body) &&
        reply.body['success'] === true &&
        isRecord(reply.body['consent'])
      ) {
        const consent = reply.body['consent'];
        return {
          ok: true,
          duplicate: reply.body['duplicate'] === true,
          action: request.action,
          recordedAt:
            typeof consent['recordedAt'] === 'string'
              ? consent['recordedAt']
              : new Date(0).toISOString(),
        };
      }
      return { ok: false, ...refusal(reply) };
    },
  };
}
