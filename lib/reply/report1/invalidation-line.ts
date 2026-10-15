/**
 * The invalidation line the server adds (build step 7 part 5; architecture 5.9, decision D12).
 *
 * Every zone a report shows must say where it is cancelled. The model is told to write that line
 * (`{Zn.invalidation}` in a `watch` line); when it forgot, `missingInvalidationLines`
 * (`checks/wording-check.ts`) names the zones, and the composer adds the line itself from the
 * stored zone, in the reader's language, with the price filled by the same resolver as every other
 * figure. The sentence is language-specific, so it lives in a data file of 17 lines (one per
 * language of the 19 locales) with the zone id and the price as placeholders; a line is direction
 * neutral ("beyond"), because a LONG zone is cancelled below its invalidation and a SHORT one above.
 *
 * The lines are drafts nobody native has read, like the wording lists (`config/reply/report1/
 * invalidation-line.v1.json` says so); the loader refuses a file that lacks a language, holds an
 * unknown one, or has a line without exactly one `{zone}` and one `{price}` or with any other brace.
 *
 * Pure: the file is read once, at import.
 *
 * @module lib/reply/report1/invalidation-line
 */

import file from '@/config/reply/report1/invalidation-line.v1.json';

import { LOCALES, familyOfLocale } from '../contracts/intake';
import type { Locale } from '../contracts/intake';
import { FORBIDDEN_TEXT_CHARS } from '../contracts/shape';

export const INVALIDATION_LINE_SCHEMA = 'invalidation-line/1';
export const INVALIDATION_LINE_MAX_CHARS = 160;

/** The language families of the 19 locales. */
export const LINE_LANGUAGES: readonly string[] = [
  ...new Set(LOCALES.map(familyOfLocale)),
];

export interface InvalidationLines {
  version: string;
  lines: Readonly<Record<string, string>>;
}

/** The problems with a file, each named; an empty list is a good file. */
export function checkInvalidationLines(value: unknown): string[] {
  const problems: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['the file is not an object'];
  }
  const record = value as Record<string, unknown>;
  if (record['schema'] !== INVALIDATION_LINE_SCHEMA) {
    problems.push(`the schema is not ${INVALIDATION_LINE_SCHEMA}`);
  }
  if (typeof record['version'] !== 'string' || record['version'] === '') {
    problems.push('the version is missing');
  }
  const lines = record['lines'];
  if (typeof lines !== 'object' || lines === null || Array.isArray(lines)) {
    problems.push('lines is not an object');
    return problems;
  }
  const given = lines as Record<string, unknown>;
  for (const family of LINE_LANGUAGES) {
    if (!Object.prototype.hasOwnProperty.call(given, family)) {
      problems.push(`${family}: no line`);
    }
  }
  for (const key of Object.keys(given)) {
    if (!LINE_LANGUAGES.includes(key))
      problems.push(`${key}: not a language of the 19 locales`);
  }
  for (const family of LINE_LANGUAGES) {
    const line = given[family];
    if (line === undefined) continue;
    if (typeof line !== 'string' || line.trim() === '') {
      problems.push(`${family}: the line is not text`);
      continue;
    }
    if (line.length > INVALIDATION_LINE_MAX_CHARS) {
      problems.push(
        `${family}: longer than ${INVALIDATION_LINE_MAX_CHARS} characters`
      );
    }
    if (FORBIDDEN_TEXT_CHARS.test(line)) {
      problems.push(`${family}: holds a control, override or tag character`);
    }
    const zone = line.split('{zone}').length - 1;
    const price = line.split('{price}').length - 1;
    if (zone !== 1 || price !== 1) {
      problems.push(`${family}: needs exactly one {zone} and one {price}`);
    }
    if (/[{}]/.test(line.split('{zone}').join('').split('{price}').join(''))) {
      problems.push(`${family}: holds a brace that is not {zone} or {price}`);
    }
  }
  return problems;
}

function load(): InvalidationLines {
  const problems = checkInvalidationLines(file);
  if (problems.length > 0) {
    throw new Error(`invalidation-line.v1.json: ${problems.join('; ')}`);
  }
  return {
    version: file.version,
    lines: file.lines as Readonly<Record<string, string>>,
  };
}

export const INVALIDATION_LINES: InvalidationLines = load();

/**
 * The sentence for a zone in a locale, with the zone id written in and the price left as the
 * placeholder `{Zn.invalidation}` for the resolver. A locale that is not one of the 19 is read in
 * English.
 */
export function invalidationText(locale: Locale, zoneId: string): string {
  const family = familyOfLocale(locale);
  const template =
    INVALIDATION_LINES.lines[family] ??
    (INVALIDATION_LINES.lines['en'] as string);
  return template
    .replace('{zone}', () => zoneId)
    .replace('{price}', () => `{${zoneId}.invalidation}`);
}
