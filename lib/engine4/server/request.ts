/**
 * Reading a request body, and what the routes accept from it.
 *
 * A body is JSON, an object, small, and sent as `application/json` (a browser
 * form cannot send that without a CORS preflight, which is the cheap CSRF guard
 * the session cookie's SameSite setting backs up). The routes then take FIVE
 * kinds of thing from it and nothing else:
 *
 *  - `cycleSlot`: the cycle the setup is pinned to (a multiple of 300);
 *  - `zoneId`: the pill that was picked;
 *  - the trader's own inputs: side, entry, equity, riskPct, stopDistance, rrr;
 *  - for a profile: the eight metrics; and for a consent: the action, the
 *    submission id, the language and the hash of the setup the trader was shown.
 *
 * Every other field is ignored, by construction: the readers below build a new
 * object from the named keys, they never spread or merge the body. A lot, a
 * scenario, a profile, a verdict or a price a client sends has nowhere to go.
 *
 * @module lib/engine4/server/request
 */

import { isSupportedLanguage } from '@/lib/i18n/languages';

import type { SetupFields } from '../validate';
import type { Engine4ErrorCode } from './errors';

/** 16 KiB: a setup is a handful of figures. */
export const MAX_BODY_CHARS = 16_384;

const SLOT_TEXT = /^[1-9][0-9]{0,9}$/;
const ZONE_ID = /^[A-Za-z0-9_-]{1,32}$/;
const SUBMISSION_ID = /^[A-Za-z0-9_-]{16,64}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const MAX_SLOT = 2_147_483_647n;
const SLOT_STEP = 300n;
export const DEFAULT_LANGUAGE = 'en-US';

export type BodyRead =
  | { ok: true; body: Record<string, unknown> }
  | {
      ok: false;
      code: Extract<
        Engine4ErrorCode,
        'BAD_REQUEST' | 'UNSUPPORTED_MEDIA_TYPE' | 'PAYLOAD_TOO_LARGE'
      >;
      message: string;
    };

export async function readJsonBody(request: Request): Promise<BodyRead> {
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(type)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The body must be sent as application/json.',
    };
  }
  const declared = request.headers.get('content-length');
  if (declared !== null && /^[0-9]+$/.test(declared)) {
    if (BigInt(declared) > BigInt(MAX_BODY_CHARS)) {
      return {
        ok: false,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The body is too large.',
      };
    }
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message: 'The body is unreadable.',
    };
  }
  if (text.length > MAX_BODY_CHARS) {
    return {
      ok: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The body is too large.',
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: 'BAD_REQUEST', message: 'The body is not JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message: 'The body must be a JSON object.',
    };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

function own(body: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(body, key)
    ? body[key]
    : undefined;
}

export type Read<T> = { ok: true; value: T } | { ok: false; message: string };

/** The cycle slot as the integer a database query takes; absent is allowed only when `required` is false. */
export function readCycleSlot(
  body: Record<string, unknown>,
  required: boolean
): Read<number | null> {
  const raw = own(body, 'cycleSlot');
  if (raw === undefined || raw === null) {
    return required
      ? { ok: false, message: 'cycleSlot is required.' }
      : { ok: true, value: null };
  }
  const text =
    typeof raw === 'number' || typeof raw === 'bigint'
      ? String(raw)
      : typeof raw === 'string'
        ? raw.trim()
        : '';
  if (!SLOT_TEXT.test(text)) {
    return {
      ok: false,
      message: 'cycleSlot must be a whole number of unix seconds.',
    };
  }
  const slot = BigInt(text);
  if (slot > MAX_SLOT || slot % SLOT_STEP !== 0n) {
    return {
      ok: false,
      message: 'cycleSlot must be a cycle: a multiple of 300 seconds.',
    };
  }
  return { ok: true, value: Number(slot) };
}

export function readZoneId(body: Record<string, unknown>): Read<string | null> {
  const raw = own(body, 'zoneId');
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string' || !ZONE_ID.test(raw)) {
    return { ok: false, message: 'zoneId is not a zone id.' };
  }
  return { ok: true, value: raw };
}

/**
 * The trader's own inputs for the validator. Only these keys are read, and the
 * values stay loose: `validateSetup` reads them as numbers or decimal text and
 * refuses the rest as a RESULT.
 */
export function readSetupFields(body: Record<string, unknown>): SetupFields {
  const fields: SetupFields = {};
  for (const key of [
    'side',
    'zoneId',
    'entry',
    'equity',
    'riskPct',
    'stopDistance',
    'rrr',
  ] as const) {
    const value = own(body, key);
    if (value !== undefined) fields[key] = value;
  }
  return fields;
}

/** The eight profile metrics, by name, from `body.profile`. */
export function readProfileCandidate(
  body: Record<string, unknown>
): Read<Record<string, unknown>> {
  const raw = own(body, 'profile');
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, message: 'profile must be an object.' };
  }
  const source = raw as Record<string, unknown>;
  const candidate: Record<string, unknown> = {};
  for (const key of [
    'traderType',
    'style',
    'maxRiskPct',
    'maxLeverage',
    'targetRrr',
    'equity',
    'minSld',
    'commission',
  ]) {
    const value = own(source, key);
    if (value !== undefined) candidate[key] = value;
  }
  return { ok: true, value: candidate };
}

export function readLanguage(body: Record<string, unknown>): Read<string> {
  const raw = own(body, 'language');
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: DEFAULT_LANGUAGE };
  }
  if (typeof raw !== 'string' || !isSupportedLanguage(raw)) {
    return { ok: false, message: 'language is not a language the app offers.' };
  }
  return { ok: true, value: raw };
}

export function readSubmissionId(body: Record<string, unknown>): Read<string> {
  const raw = own(body, 'submissionId');
  if (typeof raw !== 'string' || !SUBMISSION_ID.test(raw)) {
    return {
      ok: false,
      message:
        'submissionId is required: 16 to 64 letters, digits, "-" or "_", made once per submit.',
    };
  }
  return { ok: true, value: raw };
}

export function readShownSha256(body: Record<string, unknown>): Read<string> {
  const raw = own(body, 'shownSetupSha256');
  if (typeof raw !== 'string' || !SHA256_HEX.test(raw)) {
    return {
      ok: false,
      message:
        'shownSetupSha256 is required: the setupSha256 of the setup the trader was shown.',
    };
  }
  return { ok: true, value: raw };
}

export type ConsentActionName = 'ACCEPT' | 'MODIFY' | 'DECLINE';

export function readConsentAction(
  body: Record<string, unknown>
): Read<ConsentActionName> {
  const raw = own(body, 'action');
  if (raw === 'ACCEPT' || raw === 'MODIFY' || raw === 'DECLINE') {
    return { ok: true, value: raw };
  }
  return { ok: false, message: 'action must be ACCEPT, MODIFY or DECLINE.' };
}
