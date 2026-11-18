// Side-effect-free limits the worker applies to a job before it spends quota or
// calls the LLM. The server checks the same shape before it enqueues
// (apps/server/src/security.ts); the worker repeats the length check because a
// job is the last stop before the provider bills for the text.
//
// MAX_MESSAGE_TEXT_LENGTH mirrors MAX_CLIENT_MESSAGE_LENGTH in
// apps/server/src/types.ts. The two packages share no code (see ./types.ts), so
// a test holds the copies equal.

export const MAX_MESSAGE_TEXT_LENGTH = 1_000;

/**
 * Whether `text` may be sent to the LLM: a string that is not blank and has at
 * most MAX_MESSAGE_TEXT_LENGTH characters, measured as sent.
 */
export function isProcessableText(text: unknown): text is string {
  return (
    typeof text === 'string' &&
    text.length <= MAX_MESSAGE_TEXT_LENGTH &&
    text.trim().length > 0
  );
}

export const REJECTED_TEXT_MESSAGE =
  'Your message could not be processed. Please keep it to ' +
  `${MAX_MESSAGE_TEXT_LENGTH.toLocaleString('en-US')} characters or fewer and try again.`;
