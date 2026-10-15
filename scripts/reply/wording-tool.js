#!/usr/bin/env node
/**
 * The wording lists of the reply path: check, parity, glossary, review sheet and approval
 * (build step 7 part 4; the pattern of scripts/reply/prompts-tool.js and scripts/intake/glossary_tool.py).
 *
 * `config/reply/wording/categories.json` and `config/reply/wording/phrases/<language>.json` are
 * what a person reads and approves: the phrases that the wording check (lib/reply/checks) looks
 * for in 17 languages (the 19 locales), by the five "never" rows of architecture 5.9, the words of
 * the direction guard, and the mark shown in place of a number that could not be verified. The
 * lists are DRAFTS until native readers and counsel have read them (architecture Appendix D).
 *
 * COMMANDS (from the repository root; `--root DIR` points any of them at another tree)
 *   record              write config/reply/wording/review.md and approval.json. It NEVER writes
 *                       APPROVED: a person edits status, approved_by and approved_on. The approval
 *                       holds the SHA-256 of the lists as they were read, so any later edit puts it
 *                       back to "changed after approval".
 *   check [--require-approved]
 *                       structure of every file, parity, glossary alignment, a fresh review sheet,
 *                       a valid approval; with the flag, also an APPROVED status.
 *   parity              the table of phrases per language and concept; exit 1 when a language lacks
 *                       a concept or has fewer than the minimum phrases for it.
 *   glossary            the buy and sell words of the intake glossary against the direction lists;
 *                       exit 1 when the glossary version differs from the one the lists were written
 *                       against, or a language's direction lists do not carry its glossary word.
 *
 * NO GENERATED FILE LISTS A STATUS, so signing approval.json makes nothing stale.
 * Exit codes: 0 fine; 1 a problem; 2 a file is unusable. Node standard library only.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WORDING_VERSION = 'wording.v1';
const APPROVAL_SCHEMA = 'wording-approval/1';
const CATEGORIES_SCHEMA = 'wording-categories/1';
const PHRASES_SCHEMA = 'wording-phrases/1';
const AREA = 'wording';
const PENDING = 'PENDING';
const APPROVED = 'APPROVED';

const FILES = {
  categories: 'config/reply/wording/categories.json',
  phrasesDir: 'config/reply/wording/phrases',
  glossary: 'config/intake/glossary.v1.json',
  review: 'config/reply/wording/review.md',
  approval: 'config/reply/wording/approval.json',
};

const NEVER = [
  'ADVICE',
  'PROBABILITY',
  'GUARANTEE',
  'URGENCY',
  'UNLISTED_NEWS',
];
const SIDES = ['long', 'short'];
const TIERS = ['stance', 'label', 'view'];
const MODES = ['word', 'prefix', 'substring'];
const LANGUAGES = [
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
];
const LATIN = new Set(['en', 'es', 'de', 'pt', 'it', 'fr', 'id', 'tr']);
const UNSPACED = new Set(['ja', 'zh', 'zh-TW', 'th', 'ko']);
/** The fewest phrases a concept may have in a language. */
const MIN_PHRASES = 2;
const PHRASE_CHARS = 60;

class ToolError extends Error {}

const lf = (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const sha256 = (text) =>
  crypto.createHash('sha256').update(text, 'utf8').digest('hex');

function readJson(root, rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new ToolError(`${rel} is missing`);
  try {
    return JSON.parse(lf(fs.readFileSync(full, 'utf8')));
  } catch (error) {
    throw new ToolError(`${rel} is not JSON: ${error.message}`);
  }
}

function loadAll(root) {
  const categories = readJson(root, FILES.categories);
  const languages = {};
  for (const language of LANGUAGES) {
    languages[language] = readJson(
      root,
      `${FILES.phrasesDir}/${language}.json`
    );
  }
  return { categories, languages };
}

// ---------------------------------------------------------------------------
// Folding: the same as lib/reply/checks/wording-lists.ts (a test holds the two together)
// ---------------------------------------------------------------------------

function fold(text, language) {
  let out = text.normalize('NFKC');
  out = out
    .replace(/[\s\u{85}]/gu, ' ')
    .replace(/[\p{Cf}\p{Variation_Selector}\u{D800}-\u{DFFF}]/gu, '');
  out = out.replace(/\p{Cc}/gu, ' ');
  out = out.toLowerCase();
  out = out.replace(/['\u{2018}\u{2019}\u{201B}\u{2BC}\u{60}]/gu, '');
  out = out.replace(/[\u{2D}\u{2010}-\u{2015}\u{2212}\u{2043}]/gu, ' ');
  if (LATIN.has(language)) {
    out = out.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
    const letters = {
      ß: 'ss',
      ı: 'i',
      ø: 'o',
      æ: 'ae',
      œ: 'oe',
      đ: 'd',
      ł: 'l',
    };
    out = out.replace(/[ßıøæœđł]/gu, (letter) => letters[letter] || letter);
  } else if (language === 'ar') {
    out = out
      .replace(/[\u{640}\u{64B}-\u{65F}\u{670}\u{6D6}-\u{6ED}]/gu, '')
      .replace(/[\u{623}\u{625}\u{622}\u{671}]/gu, '\u{627}')
      .replace(/[\u{649}\u{6CC}\u{6D2}]/gu, '\u{64A}')
      .replace(/\u{6A9}/gu, '\u{643}')
      .replace(/\u{6C1}/gu, '\u{647}');
  } else if (language === 'ur') {
    out = out
      .replace(/[\u{640}\u{64B}-\u{65F}\u{670}\u{6D6}-\u{6ED}]/gu, '')
      .replace(/[\u{623}\u{625}\u{622}\u{671}]/gu, '\u{627}')
      .replace(/[\u{64A}\u{649}\u{6D2}]/gu, '\u{6CC}')
      .replace(/\u{643}/gu, '\u{6A9}')
      .replace(/\u{647}/gu, '\u{6C1}');
  }
  return out.replace(/ +/g, ' ').trim();
}

/** `{ text, mode, viaStar, except }` for one entry, or `{ problem }`. */
function compileEntry(entry, defaultMode, language) {
  let written = entry;
  let exceptions = [];
  if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
    const extra = Object.keys(entry).filter(
      (key) => key !== 't' && key !== 'x'
    );
    if (extra.length > 0)
      return { problem: `an entry has the unknown key(s) ${extra.join(', ')}` };
    written = entry.t;
    if (entry.x !== undefined) {
      if (!Array.isArray(entry.x) || entry.x.length === 0) {
        return { problem: '"x" must be a non-empty list of strings' };
      }
      exceptions = entry.x;
    }
  }
  if (typeof written !== 'string')
    return { problem: 'an entry must be a string' };
  if (written === '' || written !== written.trim()) {
    return { problem: `"${written}" is empty or has white space at an end` };
  }
  const starts = written.startsWith('*');
  const ends = written.endsWith('*');
  const body = written.slice(starts ? 1 : 0, ends ? -1 : undefined);
  if (body === '' || body.includes('*')) {
    return { problem: `"${written}" may carry a star at its ends only` };
  }
  if (starts && !ends)
    return {
      problem: `"${written}" has a leading star without a trailing one`,
    };
  const text = fold(body, language);
  if (text === '') return { problem: `"${written}" is empty once folded` };
  const except = [];
  for (const raw of exceptions) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      return {
        problem: `an exception of "${written}" must be a non-empty string`,
      };
    }
    const folded = fold(raw, language);
    if (!folded.includes(text)) {
      return {
        problem: `the exception "${raw}" does not contain "${written}"`,
      };
    }
    except.push(folded);
  }
  const mode = starts && ends ? 'substring' : ends ? 'prefix' : defaultMode;
  return { text, mode, viaStar: starts || ends, except, source: written };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

const listOf = (value) => (Array.isArray(value) ? value : []);

function conceptsOf(categories) {
  const out = {};
  for (const item of listOf(categories.categories)) {
    out[item.id] = listOf(item.concepts).map((concept) => concept.id);
  }
  return out;
}

function structureProblems({ categories, languages }) {
  const problems = [];
  if (categories.schema !== CATEGORIES_SCHEMA)
    problems.push(`categories.json: schema must be ${CATEGORIES_SCHEMA}`);
  if (categories.version !== WORDING_VERSION)
    problems.push(`categories.json: version must be ${WORDING_VERSION}`);
  if (!Array.isArray(categories.categories))
    problems.push('categories.json: "categories" must be a list');
  if (!Array.isArray(categories.languages))
    problems.push('categories.json: "languages" must be a list');
  const ids = listOf(categories.categories).map((item) => item.id);
  if (JSON.stringify(ids) !== JSON.stringify(NEVER)) {
    problems.push(
      `categories.json: the categories must be ${NEVER.join(', ')}, in that order`
    );
  }
  const names = listOf(categories.languages).map((item) => item.language);
  if (JSON.stringify(names) !== JSON.stringify(LANGUAGES)) {
    problems.push(
      `categories.json: the languages must be ${LANGUAGES.join(', ')}, in that order`
    );
  }
  const concepts = conceptsOf(categories);
  for (const category of NEVER) {
    const list = concepts[category] || [];
    if (list.length === 0)
      problems.push(`categories.json: ${category} has no concepts`);
    if (new Set(list).size !== list.length)
      problems.push(`categories.json: ${category} lists a concept twice`);
  }
  for (const language of LANGUAGES) {
    const file = languages[language];
    const name = `${language}.json`;
    if (typeof file !== 'object' || file === null || Array.isArray(file)) {
      problems.push(`${name} is missing or is not an object`);
      continue;
    }
    if (file.schema !== PHRASES_SCHEMA)
      problems.push(`${name}: schema must be ${PHRASES_SCHEMA}`);
    if (file.language !== language)
      problems.push(`${name}: "language" must be ${language}`);
    if (!MODES.includes(file.default_mode))
      problems.push(`${name}: default_mode must be ${MODES.join(', ')}`);
    if (
      typeof file.not_verified !== 'string' ||
      file.not_verified.trim() === '' ||
      [...file.not_verified].length > 60
    ) {
      problems.push(`${name}: not_verified must be a short text`);
    }
    const known = [
      'schema',
      'language',
      'default_mode',
      'not_verified',
      'categories',
      'direction',
    ];
    for (const key of Object.keys(file))
      if (!known.includes(key)) problems.push(`${name}: unknown key ${key}`);
    const seen = new Map();
    const take = (entries, where) => {
      if (!Array.isArray(entries) || entries.length === 0) {
        problems.push(`${name}: ${where} must be a non-empty list`);
        return;
      }
      for (const entry of entries) {
        const compiled = compileEntry(entry, file.default_mode, language);
        if (compiled.problem !== undefined) {
          problems.push(`${name}: ${where}: ${compiled.problem}`);
          continue;
        }
        const chars = [...compiled.text].length;
        if (chars > PHRASE_CHARS)
          problems.push(
            `${name}: ${where}: "${compiled.source}" is longer than ${PHRASE_CHARS} characters`
          );
        const single = !compiled.text.includes(' ');
        if (UNSPACED.has(language)) {
          if (chars < 2)
            problems.push(
              `${name}: ${where}: "${compiled.source}" is a single character`
            );
        } else if (single && chars < 4) {
          problems.push(
            `${name}: ${where}: "${compiled.source}" is a very short single word (a substring trap)`
          );
        }
        if (
          compiled.mode === 'substring' &&
          compiled.viaStar &&
          !UNSPACED.has(language) &&
          chars < 6
        ) {
          problems.push(
            `${name}: ${where}: "${compiled.source}" is a short phrase matched anywhere in a word (a substring trap)`
          );
        }
        const key = `${compiled.mode}|${compiled.text}`;
        if (seen.has(key))
          problems.push(
            `${name}: ${where}: "${compiled.source}" repeats an entry of ${seen.get(key)}`
          );
        else seen.set(key, where);
      }
    };
    if (file.categories === null || typeof file.categories !== 'object') {
      problems.push(`${name}: "categories" must be an object`);
    } else {
      for (const key of Object.keys(file.categories)) {
        if (!NEVER.includes(key))
          problems.push(`${name}: unknown category ${key}`);
      }
      for (const category of NEVER) {
        const own = file.categories[category];
        if (own === null || typeof own !== 'object') {
          problems.push(`${name}: category ${category} is missing`);
          continue;
        }
        const wanted = concepts[category] || [];
        for (const key of Object.keys(own)) {
          if (!wanted.includes(key))
            problems.push(
              `${name}: ${category} has the unknown concept ${key}`
            );
        }
        for (const concept of wanted) {
          if (own[concept] === undefined)
            problems.push(`${name}: ${category}.${concept} is missing`);
          else take(own[concept], `${category}.${concept}`);
        }
      }
    }
    if (file.direction === null || typeof file.direction !== 'object') {
      problems.push(`${name}: "direction" must be an object`);
    } else {
      for (const side of SIDES) {
        const own = file.direction[side];
        if (own === null || typeof own !== 'object') {
          problems.push(`${name}: direction.${side} is missing`);
          continue;
        }
        for (const key of Object.keys(own)) {
          if (!TIERS.includes(key))
            problems.push(
              `${name}: direction.${side} has the unknown tier ${key}`
            );
        }
        for (const tier of TIERS) take(own[tier], `direction.${side}.${tier}`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Parity
// ---------------------------------------------------------------------------

function countOf(list) {
  return Array.isArray(list) ? list.length : 0;
}

/** The rows of the parity table: `{ language, key, count }` for every concept and tier. */
function parityRows({ categories, languages }) {
  const concepts = conceptsOf(categories);
  const keys = [];
  for (const category of NEVER)
    for (const concept of concepts[category] || [])
      keys.push({
        key: `${category}.${concept}`,
        get: (file) =>
          file.categories && file.categories[category]
            ? file.categories[category][concept]
            : undefined,
      });
  for (const side of SIDES)
    for (const tier of TIERS)
      keys.push({
        key: `direction.${side}.${tier}`,
        get: (file) =>
          file.direction && file.direction[side]
            ? file.direction[side][tier]
            : undefined,
      });
  return {
    keys,
    rows: LANGUAGES.map((language) => ({
      language,
      counts: keys.map((entry) => countOf(entry.get(languages[language]))),
    })),
  };
}

/** A single entry is enough when it is a stem (a star at an end) or the language matches anywhere by default. */
function coversByItself(entries, defaultMode) {
  if (entries.length !== 1) return false;
  const only = typeof entries[0] === 'string' ? entries[0] : entries[0].t;
  return defaultMode === 'substring' || only.endsWith('*');
}

function parityProblems(all) {
  const { keys, rows } = parityRows(all);
  const problems = [];
  for (const row of rows) {
    const file = all.languages[row.language];
    row.counts.forEach((count, index) => {
      if (
        count < MIN_PHRASES &&
        !coversByItself(keys[index].get(file) || [], file.default_mode)
      ) {
        problems.push(
          `${row.language}.json: ${keys[index].key} has ${count} phrase(s); the least is ${MIN_PHRASES} unless the one is a stem with a star`
        );
      }
    });
  }
  return problems;
}

function renderParity(all) {
  const { keys, rows } = parityRows(all);
  const lines = [
    [
      'language',
      ...keys.map((entry) => entry.key.replace('direction.', 'dir.')),
    ].join('\t'),
  ];
  for (const row of rows) lines.push([row.language, ...row.counts].join('\t'));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Glossary alignment
// ---------------------------------------------------------------------------

function glossaryRows(root, all) {
  const glossary = readJson(root, FILES.glossary);
  const rows = [];
  const problems = [];
  if (all.categories.glossary_version !== glossary.version) {
    problems.push(
      `the lists were written against glossary ${all.categories.glossary_version} and the glossary is ${glossary.version}: read both again, then change glossary_version in categories.json`
    );
  }
  const term = (id) => (glossary.terms || []).find((item) => item.id === id);
  for (const [id, side] of [
    ['buy', 'long'],
    ['sell', 'short'],
  ]) {
    const entry = term(id);
    if (entry === undefined) {
      problems.push(`the glossary has no term "${id}"`);
      continue;
    }
    for (const language of LANGUAGES) {
      const locales =
        (
          all.categories.languages.find((item) => item.language === language) ||
          {}
        ).locales || [];
      const file = all.languages[language];
      const phrases = [];
      for (const tier of TIERS)
        for (const item of (file.direction &&
          file.direction[side] &&
          file.direction[side][tier]) ||
          [])
          phrases.push(
            fold(typeof item === 'string' ? item : item.t, language)
          );
      for (const locale of locales) {
        const form = entry.forms && entry.forms[locale];
        const canonical = form ? form.canonical : null;
        const found =
          canonical !== null &&
          phrases.some((phrase) => phrase.includes(fold(canonical, language)));
        rows.push({ term: id, side, locale, language, canonical, found });
        if (canonical === null)
          problems.push(`the glossary has no ${locale} form of "${id}"`);
        else if (!found)
          problems.push(
            `${language}.json: no direction.${side} phrase carries the glossary word "${canonical}" (${id}, ${locale})`
          );
      }
    }
  }
  return { rows, problems };
}

function renderGlossary(rows) {
  const lines = ['term\tside\tlocale\tglossary word\tin the direction lists'];
  for (const row of rows)
    lines.push(
      [
        row.term,
        row.side,
        row.locale,
        row.canonical === null ? '-' : row.canonical,
        row.found ? 'yes' : 'NO',
      ].join('\t')
    );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Review sheet and approval
// ---------------------------------------------------------------------------

function contentSha256(all) {
  return sha256(
    JSON.stringify({
      version: WORDING_VERSION,
      categories: all.categories,
      languages: LANGUAGES.map((language) => all.languages[language]),
    })
  );
}

const cell = (text) => String(text).replace(/\|/g, '\\|');
const phraseText = (entry) =>
  typeof entry === 'string'
    ? entry
    : entry.x
      ? `${entry.t} (not inside: ${entry.x.join(', ')})`
      : entry.t;

function renderReview(all) {
  const concepts = conceptsOf(all.categories);
  const total = LANGUAGES.reduce((sum, language) => {
    const { counts } = parityRows(all).rows.find(
      (row) => row.language === language
    );
    return sum + counts.reduce((a, b) => a + b, 0);
  }, 0);
  const out = [];
  out.push(`# Wording lists ${WORDING_VERSION}: review sheet`);
  out.push('');
  out.push(
    'Generated by `node scripts/reply/wording-tool.js record`; do not edit. Read the lists below for the languages you can read, then sign `approval.json` (status, name, date). ' +
      '**What you approve is these words: the phrases the reply check refuses in a reply, in each of the 17 languages of the 19 locales.** They are drafts until a native reader and counsel have read them (architecture Appendix D).'
  );
  out.push('');
  out.push('## What to check');
  out.push('');
  out.push(
    '- **The five "never" rows of 5.9**: advice, unmeasured probabilities and grades, guarantees, urgency, news that is not in the events feed. Is each phrase something a reply must never say? Is a common, harmless word caught by mistake? (A reply that trips a phrase is asked again once, then replaced by a fixed answer.)'
  );
  out.push(
    '- **Is anything missing?** The usual ways of saying each concept in that language, including the forms a model writes (formal and informal address, the verb forms, the spellings with and without accents).'
  );
  out.push(
    '- **The matching mode**: `word` means bounded by non-letters on both sides, `prefix` (a trailing star) means the word may carry any ending, `substring` (a star at both ends, and the default of Chinese, Japanese, Thai and Korean, which have no spaces) means anywhere. Arabic is `substring` because its articles and conjunctions attach to the word.'
  );
  out.push(
    '- **The direction words**: for each side, `stance` (an instruction to take it), `label` (the side as a noun) and `view` (the adjective). A headline is held to all three of the OPPOSITE side, a rationale to stance and label, an answer to stance; with a stand-aside reading, to no stance of either side.'
  );
  out.push(
    '- **The "not verified" mark** shown in place of a number that could not be matched.'
  );
  out.push(
    '- **What is NOT here**: conditional phrasing ("if price holds above ...") has no language-neutral test and is measured, not enforced (decision D12). The invalidation level, the data stamp, the disclaimer, a statistic\'s n and the stand-aside statement are guaranteed by how the server composes the reply.'
  );
  out.push('');
  out.push('## Fingerprint');
  out.push('');
  out.push(`- version: \`${WORDING_VERSION}\``);
  out.push(
    `- glossary version the lists were written against: \`${all.categories.glossary_version}\``
  );
  out.push(`- languages: ${LANGUAGES.length}; phrases: ${total}`);
  out.push(
    `- content SHA-256 (what the approval refers to): \`${contentSha256(all)}\``
  );
  out.push('');
  out.push('## Phrases per language and concept');
  out.push('');
  const { keys, rows } = parityRows(all);
  out.push(
    `| language | locales | ${keys.map((entry) => entry.key.replace('direction.', 'dir.')).join(' | ')} |`
  );
  out.push(`| --- | --- | ${keys.map(() => '---:').join(' | ')} |`);
  for (const row of rows) {
    const locales =
      (
        all.categories.languages.find(
          (item) => item.language === row.language
        ) || {}
      ).locales || [];
    out.push(
      `| ${row.language} | ${locales.join(', ')} | ${row.counts.join(' | ')} |`
    );
  }
  out.push('');
  out.push('## Concepts');
  out.push('');
  out.push('| category | concept | meaning |');
  out.push('| --- | --- | --- |');
  for (const item of all.categories.categories) {
    for (const concept of item.concepts)
      out.push(`| ${item.id} | ${concept.id} | ${cell(concept.gloss)} |`);
  }
  for (const tier of all.categories.direction.tiers)
    out.push(`| DIRECTION_WORD | ${tier.id} | ${cell(tier.gloss)} |`);
  out.push('');
  for (const language of LANGUAGES) {
    const file = all.languages[language];
    const locales =
      (
        all.categories.languages.find((item) => item.language === language) ||
        {}
      ).locales || [];
    out.push(`## ${language} (${locales.join(', ')})`);
    out.push('');
    out.push(`- default matching: \`${file.default_mode}\``);
    out.push(`- "not verified" mark: \`${file.not_verified}\``);
    out.push('');
    out.push('| category | concept | phrases |');
    out.push('| --- | --- | --- |');
    for (const category of NEVER) {
      for (const concept of concepts[category]) {
        out.push(
          `| ${category} | ${concept} | ${(file.categories[category][concept] || []).map((entry) => `\`${cell(phraseText(entry))}\``).join(' ')} |`
        );
      }
    }
    for (const side of SIDES) {
      for (const tier of TIERS) {
        out.push(
          `| DIRECTION ${side} | ${tier} | ${(file.direction[side][tier] || []).map((entry) => `\`${cell(phraseText(entry))}\``).join(' ')} |`
        );
      }
    }
    out.push('');
  }
  return `${out.join('\n')}\n`;
}

function newApproval(digest, old) {
  const keep =
    old !== null &&
    old.status === APPROVED &&
    old.content_sha256 === digest &&
    typeof old.approved_by === 'string' &&
    old.approved_by !== '' &&
    typeof old.approved_on === 'string' &&
    old.approved_on !== '';
  return keep
    ? old
    : {
        schema: APPROVAL_SCHEMA,
        area: AREA,
        status: PENDING,
        approved_by: '',
        approved_on: '',
        content_sha256: digest,
        note: '',
      };
}

const dumpApproval = (approval) => `${JSON.stringify(approval, null, 2)}\n`;

function readApproval(root) {
  const full = path.join(root, FILES.approval);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(lf(fs.readFileSync(full, 'utf8')));
  } catch (error) {
    throw new ToolError(`${FILES.approval} is not JSON: ${error.message}`);
  }
}

const APPROVAL_KEYS = [
  'schema',
  'area',
  'status',
  'approved_by',
  'approved_on',
  'content_sha256',
  'note',
];

function approvalProblems(approval, digest) {
  const problems = [];
  if (
    approval === null ||
    typeof approval !== 'object' ||
    Array.isArray(approval)
  )
    return [`${FILES.approval} must be an object`];
  for (const key of APPROVAL_KEYS)
    if (!(key in approval)) problems.push(`${FILES.approval} lacks "${key}"`);
  for (const key of Object.keys(approval))
    if (!APPROVAL_KEYS.includes(key))
      problems.push(`${FILES.approval} has an unknown key "${key}"`);
  if (approval.schema !== APPROVAL_SCHEMA)
    problems.push(`schema must be ${APPROVAL_SCHEMA}`);
  if (approval.area !== AREA) problems.push(`area must be ${AREA}`);
  if (![PENDING, APPROVED].includes(approval.status))
    problems.push(`status must be ${PENDING} or ${APPROVED}`);
  if (approval.status === APPROVED) {
    if (
      typeof approval.approved_by !== 'string' ||
      approval.approved_by.trim() === ''
    )
      problems.push('an APPROVED area needs approved_by');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(approval.approved_on)))
      problems.push('an APPROVED area needs approved_on as YYYY-MM-DD');
  }
  if (approval.content_sha256 !== digest)
    problems.push(
      'the approval was written for other lists: run `record`, then read and sign again'
    );
  return problems;
}

function record(root) {
  const all = loadAll(root);
  const problems = [...structureProblems(all), ...parityProblems(all)];
  if (problems.length > 0)
    throw new ToolError(
      `the lists have problems; fix them first:\n- ${problems.join('\n- ')}`
    );
  const digest = contentSha256(all);
  let old = null;
  try {
    old = readApproval(root);
  } catch {
    old = null;
  }
  const writes = [
    [FILES.review, renderReview(all)],
    [FILES.approval, dumpApproval(newApproval(digest, old))],
  ];
  for (const [rel, text] of writes) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text, 'utf8');
  }
  return writes.map(([rel]) => rel);
}

function check(root, { requireApproved = false } = {}) {
  const all = loadAll(root);
  const problems = [
    ...structureProblems(all),
    ...parityProblems(all),
    ...glossaryRows(root, all).problems,
  ];
  const digest = contentSha256(all);
  const reviewPath = path.join(root, FILES.review);
  if (!fs.existsSync(reviewPath)) problems.push(`${FILES.review} is missing`);
  else if (lf(fs.readFileSync(reviewPath, 'utf8')) !== lf(renderReview(all)))
    problems.push(`${FILES.review} differs from a fresh run: run \`record\``);
  let approval = null;
  try {
    approval = readApproval(root);
  } catch (error) {
    problems.push(error.message);
  }
  if (approval === null) problems.push(`${FILES.approval} is missing`);
  else {
    problems.push(...approvalProblems(approval, digest));
    if (requireApproved && approval.status !== APPROVED)
      problems.push(
        'the wording lists are PENDING: the 19 locales do not ship unread'
      );
  }
  return { problems, status: approval === null ? null : approval.status };
}

function main(argv) {
  const args = argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root =
    rootIndex === -1
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(args[rootIndex + 1]);
  const command = args.find(
    (arg, index) => !arg.startsWith('--') && args[index - 1] !== '--root'
  );
  try {
    if (command === 'record') {
      for (const rel of record(root)) console.log(`wrote ${rel}`);
      return 0;
    }
    if (command === 'check') {
      const { problems, status } = check(root, {
        requireApproved: args.includes('--require-approved'),
      });
      if (problems.length > 0) {
        for (const problem of problems) console.error(`- ${problem}`);
        return 1;
      }
      console.log(
        `the wording lists are as they should be (approval ${status})`
      );
      return 0;
    }
    if (command === 'parity') {
      const all = loadAll(root);
      console.log(renderParity(all));
      const problems = parityProblems(all);
      for (const problem of problems) console.error(`- ${problem}`);
      return problems.length > 0 ? 1 : 0;
    }
    if (command === 'glossary') {
      const all = loadAll(root);
      const { rows, problems } = glossaryRows(root, all);
      console.log(renderGlossary(rows));
      for (const problem of problems) console.error(`- ${problem}`);
      return problems.length > 0 ? 1 : 0;
    }
    console.error(
      'usage: wording-tool.js record | check [--require-approved] | parity | glossary [--root DIR]'
    );
    return 2;
  } catch (error) {
    if (error instanceof ToolError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }
}

module.exports = {
  FILES,
  LANGUAGES,
  WORDING_VERSION,
  check,
  contentSha256,
  fold,
  glossaryRows,
  loadAll,
  parityProblems,
  parityRows,
  record,
  renderReview,
  structureProblems,
};

if (require.main === module) {
  process.exitCode = main(process.argv);
}
