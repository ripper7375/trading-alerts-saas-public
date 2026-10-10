/**
 * A fresh id for one submit (build step 5, part 7).
 *
 * The consent route wants 16 to 64 letters, digits, "-" or "_", made once per submit
 * (`lib/engine4/server/request.ts`). A UUID is 36 characters of that alphabet. Where
 * the browser has no `randomUUID`, 16 random bytes from `getRandomValues` give 32
 * hex characters; the id only has to differ between submits, and it is not a secret.
 *
 * @module components/report2/submission
 */

export function newSubmissionId(): string {
  const source = globalThis.crypto;
  if (source !== undefined && typeof source.randomUUID === 'function') {
    return source.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (source !== undefined && typeof source.getRandomValues === 'function') {
    source.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}
