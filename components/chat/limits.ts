/**
 * The words of the contracts the browser must know at run time (build step 7 part 8).
 *
 * `types.ts` may import only types from `lib/reply`, so the few lists and limits the panel needs as
 * VALUES are repeated here, and `__tests__/components/chat/limits.test.ts` holds each one to the
 * contract it repeats: the stages and their order, the refusal codes, the error codes, the longest
 * question the door takes, the instant labels. A contract that moves fails that test.
 *
 * @module components/chat/limits
 */

import type { InstantIntent, ReplyErrorCode, ReplyStage } from './types';

/** The most characters the door takes from a typed question (`QUESTION_MAX_CHARS`, 4.2). */
export const COMPOSER_MAX_CHARS = 500;

/** The stages a request goes through, in order (`REPLY_STAGES`). */
export const STAGES: readonly ReplyStage[] = [
  'GATE',
  'UNDERSTAND',
  'DATA',
  'CONTEXT',
  'MODEL',
  'CHECKS',
];

/** What can fail on our side after the stream began (`REPLY_ERROR_CODES`). */
export const SERVER_ERROR_CODES: readonly ReplyErrorCode[] = [
  'INTERNAL',
  'LEDGER_UNAVAILABLE',
  'PERSISTENCE_FAILED',
];

/** What can go wrong on the way, from the browser's side. */
export const CLIENT_ERROR_CODES = [
  /** the connection dropped, or no answer came */
  'NETWORK',
  /** the answer was not a stream of events we can read, or it stopped before its last event */
  'BAD_STREAM',
  /** a status we have no words for */
  'HTTP',
] as const;
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

/** The two buttons of Panel C (`INSTANT_INTENTS`). */
export const INSTANT_INTENTS_UI: readonly InstantIntent[] = [
  'INSTANT_M5_INSPECT',
  'INSTANT_M15_INSPECT',
];

/** The codes of `intake-refusal/1` (`REFUSAL_CODES`), in the order the gate decides. */
export const REFUSAL_CODES_UI = [
  'NOT_SIGNED_IN',
  'TIER_REQUIRED',
  'THREAD_INVALID',
  'PROFILE_NOT_SET',
  'QUOTA_INSUFFICIENT',
  'FEATURE_UNAVAILABLE',
  'QUESTION_EMPTY',
  'QUESTION_TOO_LONG',
  'UNDERSTANDING_FAILED',
  'OUT_OF_SCOPE',
] as const;
export type RefusalCodeUi = (typeof REFUSAL_CODES_UI)[number];

/** The longest thread title the server keeps (`TITLE_MAX_CHARS`, counted in code points). */
export const THREAD_TITLE_MAX_CHARS = 80;

/** How many threads Panel A asks for at a time (the server's default is 50, its largest 100). */
export const THREAD_PAGE_SIZE = 30;

/** The routes the panel talks to. */
export const CHAT_ROUTES = {
  message: '/api/chat/message',
  state: '/api/chat/state',
  threads: '/api/chat/threads',
  offer: '/api/engine4/offer',
} as const;
