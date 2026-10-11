/**
 * The limits of the typed-question door (architecture 4.2, plan assumption A5 and part 2).
 *
 * §5.4 says the question is never cut, so the door REFUSES a question that is too long
 * instead of trimming it. Two sizes are counted, both in UTF-16 code units (JavaScript
 * `.length`, the same unit the packet validator uses for `question.original`):
 *
 *  - the question as typed, at most `QUESTION_MAX_CHARS` (500, about 300 tokens even for
 *    Chinese and Thai). It is checked BEFORE anything else runs, so a huge body costs one
 *    comparison and no normalising;
 *  - the question after normalising, at most `NORMALIZED_MAX_CHARS` (1,000). Unicode NFKC
 *    can widen one character into many (the Arabic ligature U+FDFA becomes 18), so a
 *    question within the first limit could otherwise grow without bound before the model
 *    reads it.
 *
 * A question with nothing left after normalising (only spaces, control or zero-width
 * characters) is empty. Both outcomes are refusal codes of `intake-refusal/1`; the fixed
 * replies are part 3's and the HTTP statuses part 5's.
 *
 * @module lib/intake/text/limits
 */

import { ENGLISH_MAX_CHARS, QUESTION_MAX_CHARS } from '../packet';
import type { RefusalCode } from '../refusal';

import { normalizeQuestion, type NormalizedText } from './normalize';

export { ENGLISH_MAX_CHARS, QUESTION_MAX_CHARS };

/** The widest a question may be once normalised (see the note above). */
export const NORMALIZED_MAX_CHARS = 1000;

/** How many glossary hints one Understand call carries: the prompt stays small. */
export const MAX_GLOSSARY_HINTS = 16;

/** The most symbols or timeframes an Understand result may name (the schema's `maxItems`). */
export const MAX_RESULT_TOKENS = 8;

export type DoorCode = Extract<
  RefusalCode,
  'QUESTION_EMPTY' | 'QUESTION_TOO_LONG'
>;

export type DoorResult =
  | { ok: true; question: NormalizedText }
  | { ok: false; code: DoorCode };

/**
 * Let a typed question in, or say why not. On success the question is normalised: every
 * later step reads `question.text`, and the packet keeps `question.original`.
 */
export function passTheDoor(raw: string): DoorResult {
  if (raw.length > QUESTION_MAX_CHARS) {
    return { ok: false, code: 'QUESTION_TOO_LONG' };
  }
  const question = normalizeQuestion(raw);
  if (question.text === '') return { ok: false, code: 'QUESTION_EMPTY' };
  if (question.text.length > NORMALIZED_MAX_CHARS) {
    return { ok: false, code: 'QUESTION_TOO_LONG' };
  }
  return { ok: true, question };
}
