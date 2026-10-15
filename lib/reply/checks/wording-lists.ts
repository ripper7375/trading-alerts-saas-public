/**
 * The 19-locale wording lists of architecture 5.9 as the checker reads them (build step 7 part 4,
 * ADR-056).
 *
 * `config/reply/wording/categories.json` names the five "never" categories of 5.9, the concepts each
 * one is written out in, and the 17 languages (the 19 locales: `en-US` and `en-GB` share the English
 * list, `pt` and `pt-BR` the Portuguese one). `config/reply/wording/phrases/<language>.json` holds the
 * phrases of one language, concept by concept, plus the words of the direction guard and the mark
 * that replaces a number that could not be verified. The files are drafts for a person to read
 * (`review.md`, `approval.json`); this module only turns them into something a matcher can run, and
 * refuses a damaged set.
 *
 * HOW A PHRASE IS WRITTEN. A string is matched the way the language's `default_mode` says. A trailing
 * star (`recommend*`) means the phrase must start a word and anything may follow it (inflection, a
 * suffix); a star at both ends (`*empfehl*`) means anywhere in the text. An object
 * `{ "t": "...", "x": ["..."] }` adds exceptions: strings that contain the phrase and make a match
 * inside them not count. Text and phrases go through the SAME folding (`foldForMatching`), so what
 * is written in the file is what is looked for after case, accents, apostrophes and hyphens are
 * set aside.
 *
 * `loadWording` checks everything a damaged file could get wrong and throws one error that names
 * every problem; the shipped set is loaded through it when this module is imported, so a bad list
 * stops the route that uses it, and a test damages a good set in every way it checks.
 *
 * Pure: the JSON files are imported at build time.
 *
 * @module lib/reply/checks/wording-lists
 */

import categoriesFile from '@/config/reply/wording/categories.json';
import ar from '@/config/reply/wording/phrases/ar.json';
import de from '@/config/reply/wording/phrases/de.json';
import en from '@/config/reply/wording/phrases/en.json';
import es from '@/config/reply/wording/phrases/es.json';
import fr from '@/config/reply/wording/phrases/fr.json';
import hi from '@/config/reply/wording/phrases/hi.json';
import id from '@/config/reply/wording/phrases/id.json';
import it from '@/config/reply/wording/phrases/it.json';
import ja from '@/config/reply/wording/phrases/ja.json';
import ko from '@/config/reply/wording/phrases/ko.json';
import pt from '@/config/reply/wording/phrases/pt.json';
import th from '@/config/reply/wording/phrases/th.json';
import tr from '@/config/reply/wording/phrases/tr.json';
import ur from '@/config/reply/wording/phrases/ur.json';
import vi from '@/config/reply/wording/phrases/vi.json';
import zh from '@/config/reply/wording/phrases/zh.json';
import zhTW from '@/config/reply/wording/phrases/zh-TW.json';

import { LOCALES, familyOfLocale } from '../contracts/intake';
import type { Locale } from '../contracts/intake';

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const WORDING_VERSION = 'wording.v1';
export const CATEGORIES_SCHEMA = 'wording-categories/1';
export const PHRASES_SCHEMA = 'wording-phrases/1';

/** The five "never" rows of 5.9 (the direction guard's `DIRECTION_WORD` is a sixth, below). */
export const NEVER_CATEGORIES = [
  'ADVICE',
  'PROBABILITY',
  'GUARANTEE',
  'URGENCY',
  'UNLISTED_NEWS',
] as const;
export type NeverCategory = (typeof NEVER_CATEGORIES)[number];

export const MATCH_MODES = ['word', 'prefix', 'substring'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const DIRECTION_SIDES = ['long', 'short'] as const;
export type DirectionSide = (typeof DIRECTION_SIDES)[number];
export const DIRECTION_TIERS = ['stance', 'label', 'view'] as const;
export type DirectionTier = (typeof DIRECTION_TIERS)[number];

/** The languages of the 19 locales, in the order the files are listed. */
export const WORDING_LANGUAGES = [
  'en',
  'es',
  'de',
  'pt',
  'it',
  'ja',
  'ar',
  'fr',
  'ko',
  'zh',
  'zh-TW',
  'ur',
  'hi',
  'vi',
  'id',
  'th',
  'tr',
] as const;
export type WordingLanguage = (typeof WORDING_LANGUAGES)[number];

/** Limits the files are held to. */
export const WORDING_LIMITS = {
  phraseChars: 60,
  /** a phrase of a spaced script that is a single short token is a substring trap */
  minTokenChars: 4,
  /** a phrase of the scripts written without spaces */
  minUnspacedChars: 2,
  notVerifiedChars: 60,
} as const;

/** The languages whose phrases are not cut into words by spaces. */
const UNSPACED: ReadonlySet<string> = new Set([
  'ja',
  'zh',
  'zh-TW',
  'th',
  'ko',
]);

// ---------------------------------------------------------------------------
// Folding: what text and phrases both go through
// ---------------------------------------------------------------------------

const LATIN: ReadonlySet<string> = new Set([
  'en',
  'es',
  'de',
  'pt',
  'it',
  'fr',
  'id',
  'tr',
]);

const INVISIBLE = /[\p{Cf}\p{Variation_Selector}\uD800-\uDFFF]/gu;
const CONTROL = /\p{Cc}/gu;
const APOSTROPHES = /['\u2018\u2019\u201B\u02BC\u0060]/g;
const DASHES = /[\u002D\u2010-\u2015\u2212\u2043]/g;
const COMBINING = /\p{M}/gu;
// Arabic and Urdu: the vowel marks, the tatweel and the Quranic marks
const ARABIC_MARKS = /[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/g;

const LATIN_LETTERS: Readonly<Record<string, string>> = {
  ß: 'ss',
  ı: 'i',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  đ: 'd',
  ł: 'l',
};

/**
 * Bring a text (or a phrase) to the one form the matcher compares:
 *  - Unicode NFKC, invisible and control characters out, every kind of white space one space;
 *  - lower case;
 *  - apostrophes gone and hyphens and dashes a space, so `don't` is `dont` and `risk-free` is
 *    `risk free` in both the phrase and the text;
 *  - the Latin-script languages without accents (`recomendación` is `recomendacion`), with the
 *    few letters that are not accents spelled out (`ß` is `ss`);
 *  - Arabic and Urdu without vowel marks and tatweel, the alef and yeh and kaf variants as one letter.
 * Vietnamese keeps its tone marks (they separate words); Hindi and Thai keep their vowel signs.
 */
export function foldForMatching(text: string, language: string): string {
  let out = text.normalize('NFKC');
  out = out.replace(/[\s\u0085]/gu, ' ').replace(INVISIBLE, '');
  out = out.replace(CONTROL, ' ');
  out = out.toLowerCase();
  out = out.replace(APOSTROPHES, '').replace(DASHES, ' ');
  if (LATIN.has(language)) {
    out = out.normalize('NFD').replace(COMBINING, '').normalize('NFC');
    out = out.replace(
      /[ßıøæœđł]/g,
      (letter) => LATIN_LETTERS[letter] ?? letter
    );
  } else if (language === 'ar') {
    out = out
      .replace(ARABIC_MARKS, '')
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
      .replace(/[\u0649\u06cc\u06d2]/g, '\u064a')
      .replace(/\u06a9/g, '\u0643')
      .replace(/\u06c1/g, '\u0647');
  } else if (language === 'ur') {
    out = out
      .replace(ARABIC_MARKS, '')
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
      .replace(/[\u064a\u0649\u06d2]/g, '\u06cc')
      .replace(/\u0643/g, '\u06a9')
      .replace(/\u0647/g, '\u06c1');
  }
  return out.replace(/ +/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// A compiled phrase
// ---------------------------------------------------------------------------

export interface Phrase {
  /** the phrase as written in the file (for messages and the review sheet) */
  source: string;
  /** the phrase after folding, without its stars */
  text: string;
  mode: MatchMode;
  /** folded strings that contain the phrase and make a match inside them not count */
  except: readonly string[];
}

export type DirectionLists = Readonly<
  Record<DirectionSide, Readonly<Record<DirectionTier, readonly Phrase[]>>>
>;

export interface LanguageWording {
  language: WordingLanguage;
  locales: readonly string[];
  /** the mark shown in place of a number that could not be verified (5.8) */
  notVerified: string;
  /** concept id to its phrases, for each of the five categories */
  categories: Readonly<
    Record<NeverCategory, Readonly<Record<string, readonly Phrase[]>>>
  >;
  direction: DirectionLists;
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One entry of a phrase file, compiled: a problem to report, or the phrase. */
type Compiled =
  | { problem: string }
  | {
      problem: null;
      phrase: Phrase;
      /** the phrase is matched anywhere because the file says so with a star at both ends */
      starred: boolean;
    };

function compilePhrase(
  entry: unknown,
  defaultMode: MatchMode,
  language: string,
  where: string
): Compiled {
  let written: unknown = entry;
  let exceptions: unknown[] = [];
  if (isRec(entry)) {
    const extra = Object.keys(entry).filter(
      (key) => key !== 't' && key !== 'x'
    );
    if (extra.length > 0) {
      return {
        problem: `${where}: an entry has the unknown key(s) ${extra.join(', ')}`,
      };
    }
    written = entry['t'];
    if (entry['x'] !== undefined) {
      if (!Array.isArray(entry['x']) || entry['x'].length === 0) {
        return { problem: `${where}: "x" must be a non-empty list of strings` };
      }
      exceptions = entry['x'];
    }
  }
  if (typeof written !== 'string') {
    return { problem: `${where}: an entry must be a string` };
  }
  if (written !== written.trim() || written === '') {
    return {
      problem: `${where}: "${written}" is empty or has white space at an end`,
    };
  }
  const starts = written.startsWith('*');
  const ends = written.endsWith('*');
  const body = written.slice(starts ? 1 : 0, ends ? -1 : undefined);
  if (body.includes('*') || body === '') {
    return {
      problem: `${where}: "${written}" may carry a star at its ends only`,
    };
  }
  if (starts && !ends) {
    return {
      problem: `${where}: "${written}" has a leading star without a trailing one`,
    };
  }
  const mode: MatchMode =
    starts && ends ? 'substring' : ends ? 'prefix' : defaultMode;
  const text = foldForMatching(body, language);
  if (text === '') {
    return { problem: `${where}: "${written}" is empty once folded` };
  }
  const except: string[] = [];
  for (const raw of exceptions) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      return {
        problem: `${where}: an exception of "${written}" must be a non-empty string`,
      };
    }
    const folded = foldForMatching(raw, language);
    if (!folded.includes(text)) {
      return {
        problem: `${where}: the exception "${raw}" does not contain "${written}"`,
      };
    }
    except.push(folded);
  }
  return {
    phrase: { source: written, text, mode, except },
    starred: starts && ends,
    problem: null,
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export interface RawWording {
  categories: unknown;
  languages: Readonly<Record<string, unknown>>;
}

export interface WordingSet {
  version: string;
  /** concept ids of each category, in the file's order */
  concepts: Readonly<Record<NeverCategory, readonly string[]>>;
  languages: Readonly<Record<WordingLanguage, LanguageWording>>;
}

const CONCEPT_ID = /^[a-z][a-z_]{1,31}$/;

function checkCategories(
  raw: unknown,
  problems: string[]
): Record<NeverCategory, string[]> | null {
  const concepts = {} as Record<NeverCategory, string[]>;
  if (!isRec(raw)) {
    problems.push('categories.json must be an object');
    return null;
  }
  if (raw['schema'] !== CATEGORIES_SCHEMA) {
    problems.push(`categories.json: schema must be ${CATEGORIES_SCHEMA}`);
  }
  if (raw['version'] !== WORDING_VERSION) {
    problems.push(`categories.json: version must be ${WORDING_VERSION}`);
  }
  const list = raw['categories'];
  if (!Array.isArray(list)) {
    problems.push('categories.json: "categories" must be a list');
    return null;
  }
  const seen: string[] = [];
  for (const item of list) {
    if (!isRec(item) || typeof item['id'] !== 'string') {
      problems.push('categories.json: a category needs an "id"');
      continue;
    }
    const id = item['id'];
    seen.push(id);
    if (!(NEVER_CATEGORIES as readonly string[]).includes(id)) {
      problems.push(`categories.json: unknown category ${id}`);
      continue;
    }
    const ids: string[] = [];
    const entries = item['concepts'];
    if (!Array.isArray(entries) || entries.length === 0) {
      problems.push(`categories.json: ${id} has no concepts`);
      continue;
    }
    for (const concept of entries) {
      const conceptId = isRec(concept) ? concept['id'] : undefined;
      if (typeof conceptId !== 'string' || !CONCEPT_ID.test(conceptId)) {
        problems.push(`categories.json: ${id} has a concept with a bad id`);
      } else if (ids.includes(conceptId)) {
        problems.push(`categories.json: ${id} lists ${conceptId} twice`);
      } else {
        ids.push(conceptId);
      }
      if (
        !isRec(concept) ||
        typeof concept['gloss'] !== 'string' ||
        concept['gloss'] === ''
      ) {
        problems.push(
          `categories.json: ${id}.${String(conceptId)} needs a gloss`
        );
      }
    }
    concepts[id as NeverCategory] = ids;
  }
  for (const id of NEVER_CATEGORIES) {
    if (!seen.includes(id)) problems.push(`categories.json: ${id} is missing`);
  }
  if (seen.length !== new Set(seen).size) {
    problems.push('categories.json: a category is listed twice');
  }
  const languages = raw['languages'];
  if (!Array.isArray(languages)) {
    problems.push('categories.json: "languages" must be a list');
  } else {
    const names = languages.map((entry) =>
      isRec(entry) ? entry['language'] : undefined
    );
    if (JSON.stringify(names) !== JSON.stringify([...WORDING_LANGUAGES])) {
      problems.push(
        `categories.json: the languages must be ${WORDING_LANGUAGES.join(', ')}, in that order`
      );
    }
    const locales = languages.flatMap((entry) =>
      isRec(entry) && Array.isArray(entry['locales']) ? entry['locales'] : []
    );
    if (
      JSON.stringify([...locales].sort()) !==
      JSON.stringify([...LOCALES].sort())
    ) {
      problems.push(
        'categories.json: the locales of the languages must be exactly the 19 locales of the app'
      );
    }
    for (const entry of languages) {
      if (!isRec(entry)) continue;
      const language = entry['language'];
      const own = Array.isArray(entry['locales']) ? entry['locales'] : [];
      for (const locale of own) {
        if (
          typeof language === 'string' &&
          familyOfLocale(String(locale)) !== language
        ) {
          problems.push(
            `categories.json: the locale ${String(locale)} is not a locale of ${language}`
          );
        }
      }
    }
  }
  if (isRec(raw['modes'])) {
    const modes = Object.keys(raw['modes']);
    if (JSON.stringify(modes) !== JSON.stringify([...MATCH_MODES])) {
      problems.push(
        `categories.json: "modes" must name ${MATCH_MODES.join(', ')}`
      );
    }
  } else {
    problems.push('categories.json: "modes" is missing');
  }
  return concepts;
}

/** Every kind of problem with one phrase, in one place (also used by the tool's parity check in JS). */
function phraseProblems(
  phrase: Phrase,
  language: string,
  where: string,
  starred: boolean
): string[] {
  const problems: string[] = [];
  const chars = [...phrase.text].length;
  if (chars > WORDING_LIMITS.phraseChars) {
    problems.push(
      `${where}: "${phrase.source}" is longer than ${WORDING_LIMITS.phraseChars} characters`
    );
  }
  const unspaced = UNSPACED.has(language);
  const single = !phrase.text.includes(' ');
  if (unspaced) {
    if (chars < WORDING_LIMITS.minUnspacedChars) {
      problems.push(`${where}: "${phrase.source}" is a single character`);
    }
  } else if (single && chars < WORDING_LIMITS.minTokenChars) {
    problems.push(
      `${where}: "${phrase.source}" is a very short single word (a substring trap)`
    );
  }
  if (
    phrase.mode === 'substring' &&
    starred &&
    !unspaced &&
    chars < WORDING_LIMITS.minTokenChars + 2
  ) {
    problems.push(
      `${where}: "${phrase.source}" is a short phrase matched anywhere in a word (a substring trap)`
    );
  }
  return problems;
}

/**
 * Check a raw set and compile it. Returns the compiled set, or null with every problem listed.
 * `raw.languages` is keyed by language code.
 */
export function compileWording(raw: RawWording): {
  set: WordingSet | null;
  problems: string[];
} {
  const problems: string[] = [];
  const concepts = checkCategories(raw.categories, problems);
  const languages = {} as Record<WordingLanguage, LanguageWording>;
  const locales = new Map<string, string[]>();
  if (isRec(raw.categories) && Array.isArray(raw.categories['languages'])) {
    for (const entry of raw.categories['languages']) {
      if (isRec(entry) && typeof entry['language'] === 'string') {
        locales.set(
          entry['language'],
          Array.isArray(entry['locales']) ? entry['locales'].map(String) : []
        );
      }
    }
  }
  for (const language of WORDING_LANGUAGES) {
    const file = raw.languages[language];
    const name = `${language}.json`;
    if (!isRec(file)) {
      problems.push(`${name} is missing or is not an object`);
      continue;
    }
    if (file['schema'] !== PHRASES_SCHEMA) {
      problems.push(`${name}: schema must be ${PHRASES_SCHEMA}`);
    }
    if (file['language'] !== language) {
      problems.push(`${name}: "language" must be ${language}`);
    }
    const defaultMode = file['default_mode'];
    if (!(MATCH_MODES as readonly unknown[]).includes(defaultMode)) {
      problems.push(`${name}: default_mode must be ${MATCH_MODES.join(', ')}`);
    }
    const mode = (defaultMode as MatchMode) ?? 'word';
    const mark = file['not_verified'];
    if (
      typeof mark !== 'string' ||
      mark.trim() === '' ||
      [...mark].length > WORDING_LIMITS.notVerifiedChars
    ) {
      problems.push(`${name}: not_verified must be a short text`);
    }
    const keys = Object.keys(file);
    for (const key of keys) {
      if (
        ![
          'schema',
          'language',
          'default_mode',
          'not_verified',
          'categories',
          'direction',
        ].includes(key)
      ) {
        problems.push(`${name}: unknown key ${key}`);
      }
    }
    const seen = new Map<string, string>();
    const take = (entries: unknown, where: string): Phrase[] => {
      if (!Array.isArray(entries) || entries.length === 0) {
        problems.push(`${name}: ${where} must be a non-empty list`);
        return [];
      }
      const out: Phrase[] = [];
      for (const entry of entries) {
        const compiled = compilePhrase(
          entry,
          mode,
          language,
          `${name}: ${where}`
        );
        if (compiled.problem !== null) {
          problems.push(compiled.problem);
          continue;
        }
        const phrase = compiled.phrase;
        problems.push(
          ...phraseProblems(
            phrase,
            language,
            `${name}: ${where}`,
            compiled.starred
          )
        );
        const key = `${phrase.mode}|${phrase.text}`;
        const earlier = seen.get(key);
        if (earlier !== undefined) {
          problems.push(
            `${name}: ${where}: "${phrase.source}" repeats an entry of ${earlier}`
          );
        } else {
          seen.set(key, where);
        }
        out.push(phrase);
      }
      return out;
    };

    const categories = {} as Record<NeverCategory, Record<string, Phrase[]>>;
    const fileCategories = file['categories'];
    if (!isRec(fileCategories)) {
      problems.push(`${name}: "categories" must be an object`);
    } else {
      for (const key of Object.keys(fileCategories)) {
        if (!(NEVER_CATEGORIES as readonly string[]).includes(key)) {
          problems.push(`${name}: unknown category ${key}`);
        }
      }
      for (const category of NEVER_CATEGORIES) {
        const wanted = concepts?.[category] ?? [];
        const own = fileCategories[category];
        categories[category] = {};
        if (!isRec(own)) {
          problems.push(`${name}: category ${category} is missing`);
          continue;
        }
        for (const key of Object.keys(own)) {
          if (!wanted.includes(key)) {
            problems.push(
              `${name}: ${category} has the unknown concept ${key}`
            );
          }
        }
        for (const concept of wanted) {
          if (own[concept] === undefined) {
            problems.push(`${name}: ${category}.${concept} is missing`);
            continue;
          }
          categories[category][concept] = take(
            own[concept],
            `${category}.${concept}`
          );
        }
      }
    }

    const direction = {} as Record<
      DirectionSide,
      Record<DirectionTier, Phrase[]>
    >;
    const fileDirection = file['direction'];
    if (!isRec(fileDirection)) {
      problems.push(`${name}: "direction" must be an object`);
    } else {
      for (const side of DIRECTION_SIDES) {
        direction[side] = {} as Record<DirectionTier, Phrase[]>;
        const own = fileDirection[side];
        if (!isRec(own)) {
          problems.push(`${name}: direction.${side} is missing`);
          continue;
        }
        for (const key of Object.keys(own)) {
          if (!(DIRECTION_TIERS as readonly string[]).includes(key)) {
            problems.push(
              `${name}: direction.${side} has the unknown tier ${key}`
            );
          }
        }
        for (const tier of DIRECTION_TIERS) {
          direction[side][tier] = take(own[tier], `direction.${side}.${tier}`);
        }
      }
    }
    languages[language] = {
      language,
      locales: locales.get(language) ?? [],
      notVerified: mark as string,
      categories,
      direction,
    };
  }

  if (problems.length > 0 || concepts === null) return { set: null, problems };
  return {
    set: { version: WORDING_VERSION, concepts, languages },
    problems,
  };
}

/** Compile a set or throw one error that lists every problem. */
export function loadWording(raw: RawWording): WordingSet {
  const { set, problems } = compileWording(raw);
  if (set === null) {
    throw new Error(
      `the wording lists are damaged (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}`
    );
  }
  return set;
}

/** The files as shipped, keyed by language. */
export const SHIPPED_WORDING_FILES: RawWording = {
  categories: categoriesFile,
  languages: {
    en,
    es,
    de,
    pt,
    it,
    ja,
    ar,
    fr,
    ko,
    zh,
    'zh-TW': zhTW,
    ur,
    hi,
    vi,
    id,
    th,
    tr,
  },
};

export const WORDING: WordingSet = loadWording(SHIPPED_WORDING_FILES);

/** The wording of the language a locale is written in; null for a value that is not one of the 19. */
export function wordingForLocale(
  locale: Locale,
  set: WordingSet = WORDING
): LanguageWording | null {
  const family = familyOfLocale(locale);
  return (WORDING_LANGUAGES as readonly string[]).includes(family) &&
    (LOCALES as readonly string[]).includes(locale)
    ? set.languages[family as WordingLanguage]
    : null;
}

/** The "not verified" mark of a locale; English when the locale is not one of the 19. */
export function notVerifiedMark(
  locale: Locale,
  set: WordingSet = WORDING
): string {
  return (wordingForLocale(locale, set) ?? set.languages.en).notVerified;
}
