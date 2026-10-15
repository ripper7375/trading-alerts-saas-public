/**
 * What the model is told when it is asked again (build step 7 part 7a; architecture 5.8 and 5.9,
 * decision D11).
 *
 * THERE IS ONE EXTRA CALL per request, shared by everything that can go wrong with the first
 * reply: JSON that does not parse or does not fit the schema, a number that is not in the
 * context, a phrase from the wording lists. The quota hold covers the answer twice and no more
 * (`reservationLadder`), so a second extra call would be unpaid for. The message names what was
 * wrong in the model's own words (a literal it wrote, a phrase from our list) and nothing the
 * trader typed.
 *
 * The message is English whatever the reader's language: it is an instruction to a model, not
 * text a trader reads. It is deterministic, so the same failure gives the same message.
 *
 * Pure.
 *
 * @module lib/reply/run/regenerate
 */

import type { Issue } from '../contracts/intake';
import type { RegenerationRequest } from '../checks/report';

/** At most this many items of one kind are listed; a long list would not help the model and costs tokens. */
export const MAX_LISTED = 8;
const MAX_ISSUE_CHARS = 160;
const MAX_LITERAL_CHARS = 40;

const clip = (text: string, max: number): string => {
  const flat = text.replace(/\s+/gu, ' ').trim();
  const chars = Array.from(flat);
  return chars.length <= max ? flat : `${chars.slice(0, max - 1).join('')}…`;
};

/** The reasons a reply was refused, as short lines: a path and what is wrong with it. */
export function issueLines(issues: readonly Issue[]): string[] {
  return issues
    .slice(0, MAX_LISTED)
    .map((issue) =>
      clip(
        `${issue.path === '' ? '(the reply)' : issue.path}: ${issue.message}`,
        MAX_ISSUE_CHARS
      )
    );
}

/** The message that asks for the reply again because it did not parse or did not fit the schema. */
export function schemaRetryMessage(issues: readonly Issue[]): string {
  const lines = issueLines(issues);
  return [
    'Your previous reply was not accepted: it is not valid JSON for the required schema.',
    ...(lines.length === 0
      ? []
      : ['What is wrong:', ...lines.map((l) => `- ${l}`)]),
    'Write the whole reply again as one JSON object with exactly the required keys and nothing else.',
  ].join('\n');
}

/** The message that asks for the reply again because a number or a phrase failed its check. */
export function checkRetryMessage(request: RegenerationRequest): string {
  const lines: string[] = ['Your previous reply was not accepted.'];
  if (request.numbers.length > 0) {
    lines.push(
      'These numbers are not in the context you were given, so they cannot be shown:',
      ...request.numbers
        .slice(0, MAX_LISTED)
        .map((n) => `- ${clip(n, MAX_LITERAL_CHARS)}`),
      'Write every figure as a {id} placeholder from the context. Do not type a figure yourself.'
    );
  }
  if (request.wording.length > 0) {
    lines.push(
      'These kinds of phrase are not allowed:',
      ...request.wording
        .slice(0, MAX_LISTED)
        .map((w) => `- ${w.category}: ${clip(w.phrase, MAX_LITERAL_CHARS)}`),
      'Describe what the data shows. Do not advise, promise, rate a probability or press for speed.'
    );
  }
  lines.push(
    'Write the whole reply again as one JSON object with exactly the required keys and nothing else.'
  );
  return lines.join('\n');
}
