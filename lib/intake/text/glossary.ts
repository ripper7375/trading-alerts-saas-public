/**
 * The trading glossary and the pass that finds its terms in a question
 * (architecture 4.3, ADR-038, plan parts 2 and 3).
 *
 * The glossary is DATA (`config/intake/glossary.v1.json`, the contract `glossary/1`): one
 * entry per trading term, with its English form, a one-sentence definition, the sensors or
 * domains that explain it (`owners`, for the Explain intent), whether it is never translated
 * (the level names), and per locale one canonical form and the accepted variants, each
 * marked `draft` until a native speaker has read it.
 *
 * `parseGlossary` reads the file strictly and reports every problem; the committed file is
 * parsed at load and a bad file stops the module (a wrong glossary is wrong twice, on the
 * question side and on the answer side).
 *
 * SPOTTING runs BEFORE the Understand call, so the language of the question is not known:
 * a text is searched for the forms of EVERY language at once, and a hit says which languages
 * its form belongs to. The pass reads the normalised text (`normalizeQuestion`) and returns
 * offsets into it. It is case-insensitive without changing the length of the text, takes the
 * longest form at each place, and never overlaps two hits. How a form is bounded depends on
 * the script it is written in, because a word is not the same thing in every script:
 *
 *  - Latin, Arabic, Devanagari and others: a whole word, bounded by a character of the same
 *    script; a Latin term next to Chinese or Thai text still counts as a word. The Arabic
 *    script also allows the clitics that attach to a word (`و` and, `ف` so, `ب` with,
 *    `ل` to, `ك` like, `س` will, and the article `ال`, with `لل` for `ل` before it), so `والذهب`
 *    and `للذهب` find `ذهب`.
 *  - Hangul: the start of a word only. Korean attaches its particles to the end of a noun
 *    (`금을`, `매수하세요`), so a form is a stem.
 *  - Han (Chinese and Japanese kanji), Hiragana, Katakana and Thai: no spaces, so no
 *    boundary at all; the longest form wins at each position.
 *
 * A form must have at least two characters: a single character matches inside too many words.
 *
 * @module lib/intake/text/glossary
 */

import glossaryFile from '@/config/intake/glossary.v1.json';

import {
  Issues,
  at,
  exactObject,
  isRecord,
  join,
  list,
  oneOf,
  text,
  type Issue,
} from '../check';
import { familyOfLocale, isLocale, type Locale } from '../locales';
import { GLOSSARY_SCHEMA } from '../version';

import { MAX_GLOSSARY_HINTS } from './limits';
import { normalizeQuestion } from './normalize';

export const FORM_STATUSES = ['draft', 'approved'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export interface GlossaryForm {
  canonical: string;
  variants: string[];
  status: FormStatus;
}

export interface GlossaryTerm {
  id: string;
  /** the English term */
  en: string;
  /** other English wordings that count as the term in the translated question */
  en_variants: string[];
  definition: string;
  /** the sensors (`MCD1`) or domains (`D4`, `SYN`) that explain the term */
  owners: string[];
  /** a level name or a code: written the same in every language */
  never_translate: boolean;
  forms: Record<string, GlossaryForm>;
}

export interface Glossary {
  schema: typeof GLOSSARY_SCHEMA;
  version: string;
  terms: GlossaryTerm[];
}

export type GlossaryParse =
  | { ok: true; glossary: Glossary }
  | { ok: false; issues: Issue[] };

export const TERM_ID = /^[a-z][a-z0-9_]{0,39}$/;
export const OWNER = /^(MCD([0-9]|1[0-5])|SYN|D[1-5])$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export const GLOSSARY_MAX_TERMS = 400;
export const FORM_MAX_CHARS = 80;
export const DEFINITION_MAX_CHARS = 300;
export const VARIANTS_MAX = 12;
export const OWNERS_MAX = 4;
/** A form of one character matches inside too many words. */
export const FORM_MIN_CHARACTERS = 2;

// ---------------------------------------------------------------------------
// Case and matching keys
// ---------------------------------------------------------------------------

/**
 * Lower case that never changes the length of the text: a character whose lower case is
 * longer (the Turkish `İ` becomes two) is kept, so an offset in the folded text is an
 * offset in the text.
 */
export function foldCase(input: string): string {
  let out = '';
  for (const char of input) {
    const lower = char.toLowerCase();
    out += lower.length === char.length ? lower : char;
  }
  return out;
}

/** What two spellings must share to count as the same form: normalised, then lower case. */
export function matchKey(form: string): string {
  return foldCase(normalizeQuestion(form).text);
}

// ---------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------

function checkForm(
  value: unknown,
  path: string,
  locale: string,
  term: Record<string, unknown>,
  seen: Map<string, string>,
  termId: string,
  issues: Issues
): void {
  const record = exactObject(
    value,
    path,
    ['canonical', 'variants', 'status'],
    issues
  );
  if (record === undefined) return;
  oneOf(record['status'], join(path, 'status'), FORM_STATUSES, issues);

  const spellings: [string, string | undefined][] = [];
  spellings.push([
    join(path, 'canonical'),
    text(record['canonical'], join(path, 'canonical'), issues, {
      max: FORM_MAX_CHARS,
    }),
  ]);
  const variants = list(record['variants'], join(path, 'variants'), issues, {
    max: VARIANTS_MAX,
  });
  variants?.forEach((variant, index) => {
    const where = at(join(path, 'variants'), index);
    spellings.push([
      where,
      text(variant, where, issues, { max: FORM_MAX_CHARS }),
    ]);
  });

  for (const [where, spelling] of spellings) {
    if (spelling === undefined) continue;
    const key = matchKey(spelling);
    if ([...key].length < FORM_MIN_CHARACTERS) {
      issues.add(
        where,
        'TOO_SHORT',
        `must have at least ${FORM_MIN_CHARACTERS} characters once normalised`
      );
      continue;
    }
    const slot = `${locale}\u0000${key}`;
    const holder = seen.get(slot);
    if (holder === undefined) seen.set(slot, termId);
    else {
      issues.add(
        where,
        'DUPLICATE',
        holder === termId
          ? 'is written twice for this term in this locale'
          : `is already a form of the term ${holder} in this locale`
      );
    }
    if (term['never_translate'] === true && spelling !== term['en']) {
      issues.add(
        where,
        'INCONSISTENT',
        'a term that is never translated is written as its English form in every locale'
      );
    }
  }
}

function checkTerm(
  value: unknown,
  path: string,
  ids: Set<string>,
  english: Set<string>,
  seen: Map<string, string>,
  issues: Issues
): void {
  const record = exactObject(
    value,
    path,
    [
      'id',
      'en',
      'en_variants',
      'definition',
      'owners',
      'never_translate',
      'forms',
    ],
    issues
  );
  if (record === undefined) return;

  const id = text(record['id'], join(path, 'id'), issues, { pattern: TERM_ID });
  if (id !== undefined) {
    if (ids.has(id))
      issues.add(join(path, 'id'), 'DUPLICATE', `${id} appears twice`);
    ids.add(id);
  }
  const en = text(record['en'], join(path, 'en'), issues, {
    max: FORM_MAX_CHARS,
  });
  if (en !== undefined) {
    const key = matchKey(en);
    if (english.has(key)) {
      issues.add(
        join(path, 'en'),
        'DUPLICATE',
        'is the English form of another term'
      );
    }
    english.add(key);
  }
  const enVariants = list(
    record['en_variants'],
    join(path, 'en_variants'),
    issues,
    {
      max: VARIANTS_MAX,
    }
  );
  enVariants?.forEach((variant, index) => {
    text(variant, at(join(path, 'en_variants'), index), issues, {
      max: FORM_MAX_CHARS,
    });
  });
  text(record['definition'], join(path, 'definition'), issues, {
    max: DEFINITION_MAX_CHARS,
  });
  const owners = list(record['owners'], join(path, 'owners'), issues, {
    max: OWNERS_MAX,
    min: 1,
  });
  const seenOwners = new Set<string>();
  owners?.forEach((owner, index) => {
    const where = at(join(path, 'owners'), index);
    const found = text(owner, where, issues, { pattern: OWNER });
    if (found === undefined) return;
    if (seenOwners.has(found)) issues.add(where, 'DUPLICATE', `${found} twice`);
    seenOwners.add(found);
  });
  if (typeof record['never_translate'] !== 'boolean') {
    issues.add(
      join(path, 'never_translate'),
      'WRONG_TYPE',
      'must be true or false'
    );
  }

  const formsPath = join(path, 'forms');
  const forms = record['forms'];
  if (!isRecord(forms)) {
    issues.add(formsPath, 'WRONG_TYPE', 'must be an object');
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(forms, 'en-US')) {
    issues.add(join(formsPath, 'en-US'), 'REQUIRED', 'is required');
  }
  for (const locale of Object.keys(forms)) {
    const where = join(formsPath, locale);
    if (!isLocale(locale)) {
      issues.add(where, 'NOT_ONE_OF', 'must be one of the 19 locales');
      continue;
    }
    checkForm(forms[locale], where, locale, record, seen, id ?? path, issues);
  }
}

export function parseGlossary(value: unknown): GlossaryParse {
  const issues = new Issues();
  const record = exactObject(value, '', ['schema', 'version', 'terms'], issues);
  if (record === undefined) return { ok: false, issues: issues.list };

  if (record['schema'] !== GLOSSARY_SCHEMA) {
    issues.add('schema', 'NOT_ONE_OF', `must be ${GLOSSARY_SCHEMA}`);
  }
  text(record['version'], 'version', issues, { pattern: VERSION });
  const terms = list(record['terms'], 'terms', issues, {
    max: GLOSSARY_MAX_TERMS,
    min: 1,
  });
  const ids = new Set<string>();
  const english = new Set<string>();
  const seen = new Map<string, string>();
  terms?.forEach((term, index) =>
    checkTerm(term, at('terms', index), ids, english, seen, issues)
  );

  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, glossary: record as unknown as Glossary };
}

function load(): Glossary {
  const parsed = parseGlossary(glossaryFile);
  if (!parsed.ok) {
    const first = parsed.issues[0] as Issue;
    throw new Error(
      `config/intake/glossary.v1.json is not a valid glossary/1 file: ${first.path} ${first.code}: ${first.message}`
    );
  }
  return parsed.glossary;
}

/** The committed glossary. */
export const GLOSSARY: Glossary = load();

export function termById(
  glossary: Glossary,
  id: string
): GlossaryTerm | undefined {
  return glossary.terms.find((term) => term.id === id);
}

// ---------------------------------------------------------------------------
// Spotting
// ---------------------------------------------------------------------------

/** A term whose form is spelled like a hit, and the language families that have that form for it. */
export interface HitTerm {
  id: string;
  languages: string[];
}

export interface GlossaryHit {
  /** the terms with this spelling: more than one when two terms share it in different languages */
  terms: HitTerm[];
  /** offsets into the text that was searched */
  start: number;
  end: number;
  /** the text as typed at that place (its case kept) */
  matched: string;
}

export interface Spotter {
  readonly glossary: Glossary;
  /** Spot the terms in a NORMALISED text, left to right, longest first, never overlapping. */
  spot(text: string): GlossaryHit[];
}

type ScriptClass =
  | 'LATIN'
  | 'ARABIC'
  | 'DEVANAGARI'
  | 'OTHER'
  | 'HANGUL'
  | 'FREE';

/** Tested on ONE character (a code point), so they need no anchors. */
const SCRIPT_TESTS: [ScriptClass, RegExp][] = [
  [
    'FREE',
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u,
  ],
  ['HANGUL', /\p{Script=Hangul}/u],
  ['ARABIC', /\p{Script=Arabic}/u],
  ['DEVANAGARI', /\p{Script=Devanagari}/u],
  ['LATIN', /\p{Script=Latin}/u],
];

/** The script a form is written in: that of its first letter. */
function scriptOf(form: string): ScriptClass {
  for (const char of form) {
    if (!/\p{L}/u.test(char)) continue;
    for (const [name, test] of SCRIPT_TESTS) if (test.test(char)) return name;
    return 'OTHER';
  }
  return 'OTHER';
}

/** The characters that continue a word, per script. */
const WORD: Readonly<
  Record<'LATIN' | 'ARABIC' | 'DEVANAGARI' | 'OTHER' | 'HANGUL', string>
> = {
  LATIN: String.raw`[\p{Script=Latin}\p{M}\p{N}_]`,
  ARABIC: String.raw`[\p{Script=Arabic}\p{M}\p{N}]`,
  DEVANAGARI: String.raw`[\p{Script=Devanagari}\p{M}\p{N}]`,
  OTHER: String.raw`[\p{L}\p{M}\p{N}_]`,
  HANGUL: String.raw`[\p{Script=Hangul}\p{M}\p{N}]`,
};

/**
 * The clitics that attach to the start of an Arabic or Urdu word: و/ف, then ب/ل/ك/س, then the
 * article ال; `ل` before the article is written `لل` (للذهب, "for the gold").
 */
const ARABIC_CLITICS = '(?:[وف])?(?:لل|[بلكس]?(?:ال)?)';

const escapeRegExp = (form: string): string =>
  form.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** One regular expression for all the forms of a script class, the longest form first. */
function compile(script: ScriptClass, forms: readonly string[]): RegExp {
  const alternatives = [...forms]
    .sort((a, b) => [...b].length - [...a].length)
    .map(escapeRegExp)
    .join('|');
  let source: string;
  if (script === 'FREE') source = `(?:${alternatives})`;
  else if (script === 'HANGUL') {
    source = `(?<!${WORD.HANGUL})(?:${alternatives})`;
  } else if (script === 'ARABIC') {
    source = `(?<=(?<!${WORD.ARABIC})${ARABIC_CLITICS})(?:${alternatives})(?!${WORD.ARABIC})`;
  } else {
    source = `(?<!${WORD[script]})(?:${alternatives})(?!${WORD[script]})`;
  }
  return new RegExp(source, 'gu');
}

interface FormOwner {
  termId: string;
  locale: Locale;
}

export function createSpotter(glossary: Glossary): Spotter {
  const owners = new Map<string, FormOwner[]>();
  const byScript = new Map<ScriptClass, Set<string>>();
  for (const term of glossary.terms) {
    for (const [locale, form] of Object.entries(term.forms)) {
      for (const spelling of [form.canonical, ...form.variants]) {
        const key = matchKey(spelling);
        const holders = owners.get(key) ?? [];
        holders.push({ termId: term.id, locale });
        owners.set(key, holders);
        const script = scriptOf(key);
        const forms = byScript.get(script) ?? new Set<string>();
        forms.add(key);
        byScript.set(script, forms);
      }
    }
  }
  const matchers = [...byScript].map(([script, forms]) =>
    compile(script, [...forms])
  );

  return {
    glossary,
    spot(input: string): GlossaryHit[] {
      const folded = foldCase(input);
      const found: { start: number; end: number }[] = [];
      for (const regex of matchers) {
        for (const match of folded.matchAll(regex)) {
          const start = match.index as number;
          found.push({ start, end: start + match[0].length });
        }
      }
      found.sort((a, b) => a.start - b.start || b.end - a.end);

      const hits: GlossaryHit[] = [];
      let edge = 0;
      for (const { start, end } of found) {
        if (start < edge) continue;
        const holders = owners.get(folded.slice(start, end)) as FormOwner[];
        const terms: HitTerm[] = [];
        for (const holder of holders) {
          const family = familyOfLocale(holder.locale);
          const known = terms.find((term) => term.id === holder.termId);
          if (known === undefined) {
            terms.push({ id: holder.termId, languages: [family] });
          } else if (!known.languages.includes(family)) {
            known.languages.push(family);
          }
        }
        hits.push({ terms, start, end, matched: input.slice(start, end) });
        edge = end;
      }
      return hits;
    },
  };
}

let defaultSpotter: Spotter | undefined;

/** Spot the terms of the committed glossary in a normalised text. */
export function spotTerms(input: string): GlossaryHit[] {
  defaultSpotter ??= createSpotter(GLOSSARY);
  return defaultSpotter.spot(input);
}

// ---------------------------------------------------------------------------
// Hints for the Understand call
// ---------------------------------------------------------------------------

/** What the Understand prompt is told about a term it may meet: its id, the text and the English term. */
export interface GlossaryHint {
  id: string;
  /** the text of the question that matched */
  matched: string;
  en: string;
}

/**
 * One hint per distinct term, in the order the terms appear, at most `max` of them (the
 * prompt stays small).
 */
export function glossaryHints(
  hits: readonly GlossaryHit[],
  glossary: Glossary = GLOSSARY,
  max: number = MAX_GLOSSARY_HINTS
): GlossaryHint[] {
  const hints: GlossaryHint[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    for (const { id } of hit.terms) {
      if (seen.has(id)) continue;
      seen.add(id);
      const term = termById(glossary, id) as GlossaryTerm;
      hints.push({ id, matched: hit.matched, en: term.en });
      if (hints.length >= max) return hints;
    }
  }
  return hints;
}
