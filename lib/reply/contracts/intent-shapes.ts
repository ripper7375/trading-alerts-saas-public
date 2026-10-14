/**
 * Which shape the model writes for each intent, and which intents run on a STALE cycle
 * (build step 7 plan decision D9, approved; finding S7-F10).
 *
 * Architecture 5.2 says the model returns "Report 1 JSON or a short answer" but defines only
 * Report 1. So: a full analysis (`report1.v1`) for the questions about direction and entry and
 * for the two instant prompts of Panel C; a short answer (`answer.v1`) for targets, sizing,
 * explanations and news; and NO model at all for `REPORT_2`, which opens the Trade Setup modal
 * (Section 6). RISK_SIZING gets a short answer that points to Report 2 and never sizes: sizing
 * is Engine 4's, and the model never computes a position.
 *
 * On a STALE cycle (5.3) only Explain and general questions are answered; News reads the
 * calendar, which has its own status, so it is allowed too. Everything else gets the fixed
 * "data stopped at hh:mm UTC" text and no model call. The answer gate of part 5 reads these two
 * tables; they are data so the approved decision is one place and a test.
 *
 * Pure.
 *
 * @module lib/reply/contracts/intent-shapes
 */

import type { PacketIntent } from './intake';
import type { ReplyShape } from './trace-fields';

export const SHAPE_OF_INTENT: Readonly<Record<PacketIntent, ReplyShape>> = {
  DIRECTION: 'REPORT1',
  ENTRY_TIMING: 'REPORT1',
  INSTANT_M5_INSPECT: 'REPORT1',
  INSTANT_M15_INSPECT: 'REPORT1',
  EXIT_TARGETS: 'ANSWER',
  RISK_SIZING: 'ANSWER',
  EXPLAIN: 'ANSWER',
  NEWS: 'ANSWER',
  REPORT_2: 'NONE',
};

/** The intents that are answered when the cycle's data is STALE. */
export const INTENTS_ALLOWED_ON_STALE: readonly PacketIntent[] = [
  'EXPLAIN',
  'NEWS',
];
