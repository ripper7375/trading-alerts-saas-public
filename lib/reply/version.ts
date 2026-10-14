/**
 * The ids and versions the reply path names (architecture chapter 5, build step 7).
 *
 * The SHAPE ids move only when a field's meaning changes, never for a new value of an
 * enum: `report1.v1` and `answer.v1` are what the MODEL writes (the JSON Schema twins are
 * `config/reply/report1-1.schema.json` and `config/reply/answer-1.schema.json`),
 * `reply-result/1` is what the SERVER delivers once the checks have passed (ADR-054), and
 * every NDJSON line of the stream is one of the `stream` events of `stage-events.ts`.
 *
 * `REPLY_VERSION` is the release of the reply RULES (the assembler, the checks, the
 * composer): change it, and say why in the commit, whenever one of them changes what a
 * trader reads for the same inputs. The trace records it.
 *
 * @module lib/reply/version
 */

export const REPORT1_SCHEMA = 'report1.v1';
export const ANSWER_SCHEMA = 'answer.v1';
export const REPLY_RESULT_SCHEMA = 'reply-result/1';

/**
 * 1.0.0: the contracts, the trace and the chat tables (build step 7, part 1).
 */
export const REPLY_VERSION = '1.0.0';
