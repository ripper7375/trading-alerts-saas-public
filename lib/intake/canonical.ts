/**
 * Canonical JSON and the fingerprint of a packet (plan part 1, decision D9 (e)).
 *
 * `canonicalJson` writes a JSON value the one way: object keys in ascending
 * order of their UTF-16 code units, no whitespace, strings and numbers as
 * `JSON.stringify` writes them (the ECMAScript form RFC 8785 also uses). Two
 * values that differ only in the order their keys were built in give the same
 * text, so they give the same hash.
 *
 * It REFUSES what JSON would silently change: `undefined` (a key that vanishes),
 * `NaN` and the infinities (written as `null`), big integers, functions, symbols,
 * class instances (a `Date` would become a string), a value that contains itself,
 * and nesting deeper than 32 levels. A packet that would not survive a round trip
 * through JSON must fail where it is built, not where it is compared.
 *
 * The hash is SHA-256 by the platform's Web Crypto (`globalThis.crypto.subtle`:
 * Node, the browser and the edge runtime have it), so this file imports nothing
 * and a client component may import the barrel. It is the hash of the TypeScript
 * text. It is NOT comparable with a hash the Python side makes of a document
 * (`json.dumps` writes a float another way: `1e-05` against `0.00001`); the
 * sensors' own `envelope_sha256` is carried verbatim and never recomputed here.
 *
 * @module lib/intake/canonical
 */

import { MAX_DEPTH, isRecord } from './check';

export type CanonicalErrorCode =
  | 'UNDEFINED'
  | 'NOT_FINITE'
  | 'BIGINT'
  | 'FUNCTION'
  | 'SYMBOL'
  | 'NOT_PLAIN'
  | 'CYCLE'
  | 'TOO_DEEP';

/** A value that has no single JSON text. `path` says where it sits. */
export class CanonicalError extends Error {
  readonly code: CanonicalErrorCode;
  readonly path: string;

  constructor(code: CanonicalErrorCode, path: string, message: string) {
    super(`${path === '' ? '(root)' : path}: ${message}`);
    this.name = 'CanonicalError';
    this.code = code;
    this.path = path;
  }
}

function write(value: unknown, path: string, seen: unknown[]): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new CanonicalError('NOT_FINITE', path, 'is NaN or infinite');
      }
      return JSON.stringify(value);
    case 'undefined':
      throw new CanonicalError('UNDEFINED', path, 'is undefined');
    case 'bigint':
      throw new CanonicalError('BIGINT', path, 'is a bigint');
    case 'function':
      throw new CanonicalError('FUNCTION', path, 'is a function');
    case 'symbol':
      throw new CanonicalError('SYMBOL', path, 'is a symbol');
    default:
      break;
  }
  if (seen.length >= MAX_DEPTH) {
    throw new CanonicalError(
      'TOO_DEEP',
      path,
      `is nested deeper than ${MAX_DEPTH} levels`
    );
  }
  if (seen.includes(value)) {
    throw new CanonicalError('CYCLE', path, 'contains itself');
  }
  seen.push(value);
  try {
    if (Array.isArray(value)) {
      const items = value.map((item, index) =>
        write(item, `${path}[${index}]`, seen)
      );
      return `[${items.join(',')}]`;
    }
    if (!isRecord(value)) {
      throw new CanonicalError('NOT_PLAIN', path, 'is not a plain object');
    }
    const members = Object.keys(value)
      .sort()
      .map((key) => {
        const here = path === '' ? key : `${path}.${key}`;
        return `${JSON.stringify(key)}:${write(value[key], here, seen)}`;
      });
    return `{${members.join(',')}}`;
  } finally {
    seen.pop();
  }
}

/** The canonical text of a JSON value, or a `CanonicalError`. */
export function canonicalJson(value: unknown): string {
  return write(value, '', []);
}

const HEX = '0123456789abcdef';

/** SHA-256 of the UTF-8 bytes of `text`, as 64 lowercase hex characters. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  let out = '';
  for (const byte of new Uint8Array(digest)) {
    out += HEX.charAt(byte >> 4) + HEX.charAt(byte & 15);
  }
  return out;
}

/** The fingerprint of a JSON value: SHA-256 of its canonical text. */
export async function canonicalSha256(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}
