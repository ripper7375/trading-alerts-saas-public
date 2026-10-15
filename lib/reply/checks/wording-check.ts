/**
 * The wording guide as a check (build step 7 part 4; architecture 5.9, ADR-056, plan decisions D11
 * and D12).
 *
 * WHAT IS ENFORCED, AND HOW
 *  - The five "never" rows of 5.9 (advice, unmeasured probabilities and grades, guarantees, urgency,
 *    news that is not in the events feed) are LEXICAL: phrase lists in the 17 languages of the 19
 *    locales (`wording-lists.ts`). A text is checked against the list of the language it is written
 *    in AND the English list, because a reply in German can still say "risk-free".
 *  - The direction-word guard is lexical too and sits beside them: a headline or rationale that
 *    names the side OPPOSITE to the synthesis reading is a failure (category `DIRECTION_WORD`).
 *  - The "always" rows are STRUCTURAL where a language-neutral rule exists (decision D12): the
 *    invalidation line is the presence of `{Zn.invalidation}` in `watch` for every chosen zone
 *    (`missingInvalidationLines`); the data stamp and the disclaimer are added by the server; a
 *    statistic reaches the reply only through a placeholder; stand-aside is a synthesis fact the
 *    server states. Conditional phrasing has no language-neutral test and is NOT enforced.
 *
 * HOW A PHRASE MATCHES. Text and phrases go through the same folding (`foldForMatching`). A `word`
 * phrase must be bounded by a non-letter on both sides, a `prefix` phrase on the left only, a
 * `substring` phrase anywhere; a match inside one of the phrase's exception strings does not
 * count. "Letter" means any Unicode letter, digit or combining mark, so the rule holds for Arabic
 * and Urdu (right to left) and Hindi (vowel signs); the scripts written without spaces (Chinese,
 * Japanese, Thai, Korean) list their phrases as `substring`.
 *
 * WHAT THE DIRECTION GUARD READS. Three tiers of words per side: a `stance` (an instruction to take
 * the side: "go long", "sell the rally"), a `label` (the side as a noun: "a short setup") and a
 * `view` (the adjective: "bullish"). Opposite to LONG is short, and the other way round:
 *   headline   stance, label and view of the opposite side
 *   rationale  stance and label of the opposite side (a rationale may say "M15 is bearish": that is
 *              the reason the rally is counter-trend, not a call)
 *   answer     stance of the opposite side
 *   watch, risks  nothing ("a close below the invalidation turns this bearish" is what they are for)
 * When the synthesis says NEUTRAL or STAND_ASIDE (or does not run), the headline, the rationale and
 * an answer must carry no `stance` of EITHER side: a reply that says "go long" while SYN says
 * stand aside contradicts it.
 *
 * Pure.
 *
 * @module lib/reply/checks/wording-check
 */

import { scanPlaceholders } from '../contracts/shape';
import type { ReportLine } from '../contracts/shape';
import type { Bias, Locale } from '../contracts/intake';
import { WORDING_CATEGORIES } from '../contracts/trace-fields';
import type { WordingCategory } from '../contracts/trace-fields';
import {
  DIRECTION_SIDES,
  NEVER_CATEGORIES,
  WORDING,
  foldForMatching,
  wordingForLocale,
} from './wording-lists';
import type {
  DirectionSide,
  DirectionTier,
  LanguageWording,
  Phrase,
  WordingSet,
} from './wording-lists';

// ---------------------------------------------------------------------------
// The texts a check reads
// ---------------------------------------------------------------------------

/** A text the model wrote, with the path `report1Texts` and `answerTexts` give it. */
export interface ModelText {
  path: string;
  text: string;
}

/** Where in a reply a text sits; the direction guard holds each role to different words. */
export type TextRole = 'HEADLINE' | 'RATIONALE' | 'WATCH' | 'RISKS' | 'ANSWER';

/** `headline`, `rationale[0].text`, `watch[1].text`, `risks[2].text`, `text` (an answer). */
export function roleOfPath(path: string): TextRole {
  if (path === 'headline') return 'HEADLINE';
  if (path.startsWith('rationale')) return 'RATIONALE';
  if (path.startsWith('watch')) return 'WATCH';
  if (path.startsWith('risks')) return 'RISKS';
  return 'ANSWER';
}

// ---------------------------------------------------------------------------
// Matching one phrase
// ---------------------------------------------------------------------------

/** A letter, a digit or a combining mark, in any script: what a word is made of. */
const LETTER_LIKE = /[\p{L}\p{N}\p{M}]/u;

/** The code point that ends `text.slice(0, index)`, or '' at the start; a pair of surrogates is one. */
function codePointBefore(text: string, index: number): string {
  return [...text.slice(0, index)].pop() ?? '';
}

/** The code point that starts at `index`, or '' at the end. */
function codePointAt(text: string, index: number): string {
  const point = text.codePointAt(index);
  return point === undefined ? '' : String.fromCodePoint(point);
}

const leftBounded = (text: string, index: number): boolean =>
  !LETTER_LIKE.test(codePointBefore(text, index));

const rightBounded = (text: string, index: number): boolean =>
  !LETTER_LIKE.test(codePointAt(text, index));

/**
 * Whether the occurrence at `at` lies inside one of the phrase's exceptions: some exception
 * holds the phrase at an offset and the text holds the whole exception at `at` minus that offset.
 */
function insideException(text: string, at: number, phrase: Phrase): boolean {
  for (const exception of phrase.except) {
    let offset = exception.indexOf(phrase.text);
    while (offset !== -1) {
      const start = at - offset;
      if (start >= 0 && text.startsWith(exception, start)) return true;
      offset = exception.indexOf(phrase.text, offset + 1);
    }
  }
  return false;
}

/** Whether a folded text holds the phrase, under the phrase's mode. */
export function phraseOccurs(folded: string, phrase: Phrase): boolean {
  let from = 0;
  for (;;) {
    const at = folded.indexOf(phrase.text, from);
    if (at === -1) return false;
    from = at + phrase.text.length;
    if (phrase.mode !== 'substring' && !leftBounded(folded, at)) continue;
    if (
      phrase.mode === 'word' &&
      !rightBounded(folded, at + phrase.text.length)
    ) {
      continue;
    }
    if (insideException(folded, at, phrase)) continue;
    return true;
  }
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

export interface WordingFinding {
  path: string;
  category: WordingCategory;
  /** the concept of the "never" row (`recommend`), or `<side>.<tier>` for the direction guard */
  concept: string;
  /** the phrase as written in the list: words the model wrote, safe to send back */
  phrase: string;
  /** the language whose list holds the phrase */
  language: string;
}

export interface WordingResult {
  ok: boolean;
  findings: WordingFinding[];
  /** distinct (text, category, concept) hits */
  violations: number;
  categories: Record<WordingCategory, number>;
  /** the lists that were read */
  languages: string[];
  /** the locale was not one of the 19: only the English list was read */
  unsupportedLocale: boolean;
}

export function emptyCategoryCounts(): Record<WordingCategory, number> {
  const counts = {} as Record<WordingCategory, number>;
  for (const category of WORDING_CATEGORIES) counts[category] = 0;
  return counts;
}

// ---------------------------------------------------------------------------
// The direction guard
// ---------------------------------------------------------------------------

const OPPOSITE: Readonly<Record<DirectionSide, DirectionSide>> = {
  long: 'short',
  short: 'long',
};

/** The sides and tiers a role is held to for a bias (null: the synthesis does not run). */
export function guardedWords(
  role: TextRole,
  bias: Bias | null
): { side: DirectionSide; tier: DirectionTier }[] {
  if (role === 'WATCH' || role === 'RISKS') return [];
  const out: { side: DirectionSide; tier: DirectionTier }[] = [];
  if (bias === 'LONG' || bias === 'SHORT') {
    const side = OPPOSITE[bias === 'LONG' ? 'long' : 'short'];
    const tiers: DirectionTier[] =
      role === 'HEADLINE'
        ? ['stance', 'label', 'view']
        : role === 'RATIONALE'
          ? ['stance', 'label']
          : ['stance'];
    for (const tier of tiers) out.push({ side, tier });
    return out;
  }
  for (const side of DIRECTION_SIDES) out.push({ side, tier: 'stance' });
  return out;
}

function listsToRead(
  locale: Locale,
  set: WordingSet
): { lists: LanguageWording[]; unsupported: boolean } {
  const own = wordingForLocale(locale, set);
  if (own === null) return { lists: [set.languages.en], unsupported: true };
  return {
    lists: own.language === 'en' ? [own] : [own, set.languages.en],
    unsupported: false,
  };
}

export function checkDirection(
  texts: readonly ModelText[],
  locale: Locale,
  bias: Bias | null,
  set: WordingSet = WORDING
): WordingFinding[] {
  const { lists } = listsToRead(locale, set);
  const findings: WordingFinding[] = [];
  for (const item of texts) {
    const words = guardedWords(roleOfPath(item.path), bias);
    for (const list of lists) {
      const folded = foldForMatching(item.text, list.language);
      for (const { side, tier } of words) {
        for (const phrase of list.direction[side][tier]) {
          if (phraseOccurs(folded, phrase)) {
            findings.push({
              path: item.path,
              category: 'DIRECTION_WORD',
              concept: `${side}.${tier}`,
              phrase: phrase.source,
              language: list.language,
            });
            break;
          }
        }
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/**
 * Check the texts of a reply against the five "never" rows and the direction guard.
 * `bias` is the synthesis reading's bias (null when the synthesis is not running).
 */
export function checkWording(
  texts: readonly ModelText[],
  locale: Locale,
  bias: Bias | null,
  set: WordingSet = WORDING
): WordingResult {
  const { lists, unsupported } = listsToRead(locale, set);
  const findings: WordingFinding[] = [];
  const seen = new Set<string>();
  const add = (finding: WordingFinding): void => {
    const key = `${finding.path}|${finding.category}|${finding.concept}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
  };
  for (const item of texts) {
    for (const list of lists) {
      const folded = foldForMatching(item.text, list.language);
      for (const category of NEVER_CATEGORIES) {
        for (const [concept, phrases] of Object.entries(
          list.categories[category]
        )) {
          for (const phrase of phrases) {
            if (phraseOccurs(folded, phrase)) {
              add({
                path: item.path,
                category,
                concept,
                phrase: phrase.source,
                language: list.language,
              });
              break;
            }
          }
        }
      }
    }
  }
  for (const finding of checkDirection(texts, locale, bias, set)) add(finding);

  const categories = emptyCategoryCounts();
  for (const finding of findings) categories[finding.category] += 1;
  return {
    ok: findings.length === 0,
    findings,
    violations: findings.length,
    categories,
    languages: lists.map((list) => list.language),
    unsupportedLocale: unsupported,
  };
}

// ---------------------------------------------------------------------------
// The structural rows (decision D12)
// ---------------------------------------------------------------------------

/**
 * The zones the report chose whose invalidation level no `watch` line gives: "the invalidation
 * level with every direction" (5.9). Language-neutral: the line holds the placeholder
 * `{Zn.invalidation}`. The server adds the line itself for a zone that lacks one (the composer of
 * part 5), so this never costs a model call.
 */
export function missingInvalidationLines(
  zones: readonly string[],
  watch: readonly ReportLine[]
): string[] {
  const given = new Set<string>();
  for (const line of watch) {
    for (const id of scanPlaceholders(line.text).ids) given.add(id);
  }
  return zones.filter((zone) => !given.has(`${zone}.invalidation`));
}
