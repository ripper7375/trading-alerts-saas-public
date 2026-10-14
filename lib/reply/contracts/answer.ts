/**
 * `answer.v1`: what the MODEL writes for a question that is not a full analysis (ADR-052:
 * "Report 1 JSON or a short answer"; build step 7 plan, finding S7-F10 and decision D9).
 *
 * Report 1 is for DIRECTION, ENTRY_TIMING and the two instant prompts. EXIT_TARGETS,
 * RISK_SIZING, EXPLAIN and NEWS get this: a short text with `{value id}` placeholders, the
 * lines it rests on, the locale it is written in, and at most one ACTION from a closed
 * list. A model cannot invent an action: the list has one entry, `OPEN_TRADE_SETUP` (the
 * button that opens Report 2's modal; RISK_SIZING points there instead of sizing, because
 * sizing is Engine 4's and the model never computes a position). The server fills the
 * cycle, the trader type and the zones into the action it delivers.
 *
 * The locale is declared by the model so that the wording check picks the phrase list of
 * the language the text is really in; with a context the declared locale must equal the
 * one the packet says the reply is written in.
 *
 * Plain code, no `ajv`; `config/reply/answer-1.schema.json` is the same contract.
 *
 * Pure.
 *
 * @module lib/reply/contracts/answer
 */

import { Issues, isLocale, oneOf } from './intake';
import type { Locale } from './intake';
import { checkCites, exactModelObject, finish, modelText } from './shape';
import type { ReplyContext, Validation } from './shape';

export const ANSWER_KEYS = ['locale', 'text', 'cites', 'action'] as const;

/** The actions a short answer may carry. One today. */
export const ANSWER_ACTIONS = ['OPEN_TRADE_SETUP'] as const;
export type AnswerAction = (typeof ANSWER_ACTIONS)[number];

export const ANSWER_LIMITS = {
  /** a short answer: about 800 characters is four sentences */
  text: 800,
} as const;

export interface AnswerModel {
  /** the locale the text is written in: one of the 19 */
  locale: Locale;
  text: string;
  cites: string[];
  /** `null` for no action */
  action: AnswerAction | null;
}

export type AnswerValidation = Validation<AnswerModel>;

export function validateAnswer(
  value: unknown,
  context: ReplyContext = {}
): AnswerValidation {
  const issues = new Issues();
  const record = exactModelObject(value, '', ANSWER_KEYS, issues);
  if (record === undefined) return { ok: false, issues: issues.list };

  let locale: Locale | undefined;
  if (typeof record['locale'] !== 'string') {
    issues.add('locale', 'WRONG_TYPE', 'must be a string');
  } else if (!isLocale(record['locale'])) {
    issues.add('locale', 'NOT_ONE_OF', 'must be one of the 19 locales');
  } else {
    locale = record['locale'];
    if (context.replyLocale !== undefined && locale !== context.replyLocale) {
      issues.add(
        'locale',
        'INCONSISTENT',
        `the reply is written in ${context.replyLocale}, not ${locale}`
      );
    }
  }

  const valueIds =
    context.valueIds === undefined ? undefined : new Set(context.valueIds);
  const body = modelText(
    record['text'],
    'text',
    issues,
    { max: ANSWER_LIMITS.text },
    valueIds
  );
  const cites = checkCites(record['cites'], 'cites', issues, context);

  let action: AnswerAction | null | undefined;
  if (record['action'] === null) {
    action = null;
  } else {
    action = oneOf(record['action'], 'action', ANSWER_ACTIONS, issues);
  }

  return finish(issues, () => ({
    locale: locale as Locale,
    text: body as string,
    cites: cites as string[],
    action: action as AnswerAction | null,
  }));
}

/** The text of an answer with its path (the checks of part 4 walk these, as they walk Report 1's). */
export function answerTexts(
  answer: AnswerModel
): { path: string; text: string }[] {
  return [{ path: 'text', text: answer.text }];
}
