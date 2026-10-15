/**
 * The fixed answer (build step 7 part 5; architecture 5.9, 7.6, ADR-055, plan decision D20,
 * finding S7-F11): what the trader gets when a model cannot or may not answer, built from the
 * sensor board alone, with NO model call and no free text.
 *
 * It carries: the direction (the synthesis reading's, or none), the rule id inside it, each
 * sensor's status and state code, the levels, the data stamp and the disclaimer. A direction word,
 * a rule id, a status, a state code and a price are the same in all 19 languages and the interface
 * words the rest; the sensors' own one-line summaries are English prose with no translation, so
 * they are never carried (D20).
 *
 * WHEN THERE IS NO DIRECTION. The gate is the authority on whether a direction may be stated: on a
 * STALE or UNKNOWN cycle none is, whatever the reason the fixed answer is given for (a deadline
 * that passes on a stale cycle still states nothing), and `DATA_STALE` and `NO_SYNTHESIS` never
 * state one by definition. On a STALE or UNKNOWN cycle the levels are left out too: a price of
 * data that stopped is the most dangerous thing a trader can be handed. The sensors' last states
 * stay, labelled by the stamp, whose `as_of` is the time the data stopped. With no synthesis
 * reading on a live cycle there is no direction, but the sensors' levels are shown.
 *
 * A fixed answer names no model (none wrote it) and has flagged nothing; it keeps the count of
 * regenerations (a wording failure that came after the one regeneration says so).
 *
 * Pure.
 *
 * @module lib/reply/report1/fixed-answer
 */

import type { ValueDictionary } from '../checks/value-dictionary';
import type { IntakePacket } from '../contracts/intake';
import { validateReplyResult } from '../contracts/result';
import type {
  DirectionLine,
  FixedAnswerResult,
  FixedReason,
  LevelLine,
} from '../contracts/result';
import { rowOf } from '../gate/answer-gate';
import type { ComposeFailure, ComposeOutcome, ReplyFrame } from './compose';
import { boardLines, directionLine, levelLines } from './sections';
import { buildResultBase } from './stamp';

export interface FixedAnswerInput {
  packet: IntakePacket;
  reason: FixedReason;
  /** for the levels; null when none could be built */
  dictionary: ValueDictionary | null;
  frame: ReplyFrame;
}

/** The reasons for which a fixed answer states no direction whatever the data says. */
const NO_DIRECTION_REASONS: readonly FixedReason[] = [
  'DATA_STALE',
  'NO_SYNTHESIS',
];

/** Is the data live enough to show a price? The gate's row for the status decides, not the reason. */
export function dataIsLive(packet: IntakePacket): boolean {
  return rowOf(packet.data.status).direction !== 'NO';
}

/** May a direction be stated on this packet for this reason? */
export function directionAllowed(
  packet: IntakePacket,
  reason: FixedReason
): boolean {
  return !NO_DIRECTION_REASONS.includes(reason) && dataIsLive(packet);
}

export function composeFixedAnswer(
  input: FixedAnswerInput
): ComposeOutcome<FixedAnswerResult> {
  const { packet, reason } = input;

  let direction: DirectionLine | null = null;
  if (directionAllowed(packet, reason)) {
    const line = directionLine(packet);
    direction = line.ok ? line.value : null;
  }
  // a price of data that stopped is never shown; the sensors' levels of a live cycle are, with or
  // without a synthesis reading
  const levels: LevelLine[] =
    dataIsLive(packet) && input.dictionary !== null
      ? levelLines(packet, input.dictionary)
      : [];

  const result: FixedAnswerResult = {
    ...buildResultBase(
      packet,
      {
        ...input.frame,
        model: null,
        promptVersion: null,
        numbersFlagged: 0,
      },
      'FIXED_ANSWER'
    ),
    fixed: { reason, direction, board: boardLines(packet), levels },
  };

  const verdict = validateReplyResult(result);
  if (!verdict.ok) {
    const failures: ComposeFailure[] = verdict.issues.map((issue) => ({
      code: 'INVALID_RESULT',
      path: issue.path,
      detail: `${issue.code}: ${issue.message}`,
    }));
    return { ok: false, failures };
  }
  return { ok: true, value: result };
}
