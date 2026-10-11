/**
 * A fixture adapter for the Understand port: it replays recorded model answers, so a test
 * (and the release gate of part 9) can run the whole intake path without a model and
 * without a network (plan part 2).
 *
 * A recording is the answer a real model gave to one question: `question` is the normalised
 * text the request carried, `output` is what the model returned (a parsed object, or the text
 * of the reply). The adapter finds the recording by the question in the request and returns
 * its output unchanged, validated by nothing, so a recording of a bad answer replays a bad
 * answer. A question with no recording REJECTS, which the step turns into a failed
 * understanding: a test that forgot a recording fails loudly instead of passing on a guess.
 *
 * It also keeps every request it received, so a test can count the calls (the proofs that a
 * refusal at the gate or the scope check never reached the model) and read the prompt.
 *
 * @module lib/intake/text/understand-fixture
 */

import type { UnderstandPort, UnderstandRequest } from './understand';

export interface FixtureRecording {
  /** the normalised question, exactly as the request carried it */
  question: string;
  /** what the model returned */
  output: unknown;
}

export interface FixtureUnderstandPort extends UnderstandPort {
  /** every request received, oldest first */
  readonly calls: readonly UnderstandRequest[];
}

/** The question a request carries (its user message is `{ question, glossary_hints }`). */
export function questionOf(request: UnderstandRequest): string {
  const body = JSON.parse(request.user) as { question: string };
  return body.question;
}

export function createFixtureUnderstand(
  recordings: readonly FixtureRecording[]
): FixtureUnderstandPort {
  const byQuestion = new Map<string, unknown>(
    recordings.map(({ question, output }) => [question, output])
  );
  const calls: UnderstandRequest[] = [];
  return {
    calls,
    understand(request: UnderstandRequest): Promise<unknown> {
      calls.push(request);
      const question = questionOf(request);
      if (!byQuestion.has(question)) {
        return Promise.reject(
          new Error(
            `no recorded answer for the question: ${question.slice(0, 80)}`
          )
        );
      }
      return Promise.resolve(byQuestion.get(question));
    },
  };
}
