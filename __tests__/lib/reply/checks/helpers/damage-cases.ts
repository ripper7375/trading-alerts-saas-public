/**
 * The ways a set of wording files can be damaged, with the message each must give. The code's
 * loader (`wording-lists.test.ts`) and the tool (`wording-tool.test.ts`) are held to the same table,
 * so the two cannot drift apart.
 */

import {
  CATEGORIES_SCHEMA,
  WORDING_VERSION,
} from '@/lib/reply/checks/wording-lists';

import { clone } from '../../../intake/helpers/packets';

type Any = any;

export const LANGUAGE_FILE_DAMAGE: [string, (raw: Any) => void, RegExp][] = [
  [
    'a wrong schema',
    (r) => (r.languages.de.schema = 'x'),
    /de\.json: schema must be/,
  ],
  [
    'the wrong language',
    (r) => (r.languages.de.language = 'fr'),
    /de\.json: "language" must be de/,
  ],
  [
    'a bad default mode',
    (r) => (r.languages.de.default_mode = 'regex'),
    /default_mode must be/,
  ],
  [
    'no default mode',
    (r) => delete r.languages.de.default_mode,
    /default_mode must be/,
  ],
  [
    'an empty mark',
    (r) => (r.languages.de.not_verified = '  '),
    /not_verified must be a short text/,
  ],
  [
    'a long mark',
    (r) => (r.languages.de.not_verified = 'x'.repeat(61)),
    /not_verified must be a short text/,
  ],
  [
    'a mark that is not text',
    (r) => (r.languages.de.not_verified = 5),
    /not_verified must be a short text/,
  ],
  [
    'an unknown key',
    (r) => (r.languages.de.extra = 1),
    /de\.json: unknown key extra/,
  ],
  ['a missing language', (r) => delete r.languages.tr, /tr\.json is missing/],
  [
    'a language that is not an object',
    (r) => (r.languages.tr = []),
    /tr\.json is missing or is not an object/,
  ],
  [
    'no categories',
    (r) => delete r.languages.de.categories,
    /"categories" must be an object/,
  ],
  [
    'a missing category',
    (r) => delete r.languages.de.categories.URGENCY,
    /category URGENCY is missing/,
  ],
  [
    'an unknown category',
    (r) => (r.languages.de.categories.MOOD = {}),
    /unknown category MOOD/,
  ],
  [
    'a missing concept',
    (r) => delete r.languages.de.categories.ADVICE.advise,
    /ADVICE\.advise is missing/,
  ],
  [
    'an unknown concept',
    (r) => (r.languages.de.categories.ADVICE.extra = ['abcdef']),
    /ADVICE has the unknown concept extra/,
  ],
  [
    'an empty list',
    (r) => (r.languages.de.categories.ADVICE.advise = []),
    /ADVICE\.advise must be a non-empty list/,
  ],
  [
    'a list that is not a list',
    (r) => (r.languages.de.categories.ADVICE.advise = 'ratschlag'),
    /must be a non-empty list/,
  ],
  [
    'no direction',
    (r) => delete r.languages.de.direction,
    /"direction" must be an object/,
  ],
  [
    'a missing side',
    (r) => delete r.languages.de.direction.short,
    /direction\.short is missing/,
  ],
  [
    'a missing tier',
    (r) => delete r.languages.de.direction.long.view,
    /direction\.long\.view must be a non-empty list/,
  ],
  [
    'an unknown tier',
    (r) => (r.languages.de.direction.long.mood = ['abcdef']),
    /unknown tier mood/,
  ],
];

export const PHRASE_DAMAGE: [string, unknown, RegExp][] = [
  ['a number', 5, /an entry must be a string/],
  ['null', null, /an entry must be a string/],
  ['an empty string', '', /empty or has white space/],
  ['a blank string', '   ', /empty or has white space/],
  ['white space at an end', ' counsel', /empty or has white space/],
  ['a star in the middle', 'coun*sel', /star at its ends only/],
  ['only stars', '**', /star at its ends only/],
  ['a leading star alone', '*counsel', /leading star without a trailing one/],
  ['a phrase empty once folded', '​​', /empty once folded/],
  [
    'an object with an unknown key',
    { t: 'counsel', y: 1 },
    /unknown key\(s\) y/,
  ],
  [
    'an exception that is not a list',
    { t: 'counsel', x: 'a' },
    /"x" must be a non-empty list/,
  ],
  [
    'an empty exception list',
    { t: 'counsel', x: [] },
    /"x" must be a non-empty list/,
  ],
  [
    'an exception that is not text',
    { t: 'counsel', x: [1] },
    /exception of "counsel" must be a non-empty string/,
  ],
  [
    'an exception that does not hold the phrase',
    { t: 'counsel', x: ['advice'] },
    /does not contain "counsel"/,
  ],
  ['a phrase that is too long', 'x'.repeat(61), /longer than 60 characters/],
  ['a very short single word', 'ab', /very short single word/],
  ['a three-letter word', 'the', /very short single word/],
  ['a short word matched anywhere', '*abcd*', /matched anywhere in a word/],
];

export const CATEGORIES_DAMAGE: [string, (raw: Any) => void, RegExp][] = [
  [
    'not an object',
    (r) => (r.categories = []),
    /categories\.json must be an object/,
  ],
  [
    'a wrong schema',
    (r) => (r.categories.schema = 'x'),
    new RegExp(`schema must be ${CATEGORIES_SCHEMA}`),
  ],
  [
    'a wrong version',
    (r) => (r.categories.version = 'wording.v0'),
    new RegExp(`version must be ${WORDING_VERSION}`),
  ],
  [
    'no category list',
    (r) => (r.categories.categories = 'x'),
    /"categories" must be a list/,
  ],
  [
    'a category with no id',
    (r) => (r.categories.categories[0] = {}),
    /needs an "id"/,
  ],
  [
    'an unknown category',
    (r) => (r.categories.categories[0].id = 'MOOD'),
    /unknown category MOOD/,
  ],
  [
    'a missing category',
    (r) => r.categories.categories.pop(),
    /UNLISTED_NEWS is missing/,
  ],
  [
    'a category listed twice',
    (r) => r.categories.categories.push(clone(r.categories.categories[0])),
    /listed twice/,
  ],
  [
    'no concepts',
    (r) => (r.categories.categories[0].concepts = []),
    /ADVICE has no concepts/,
  ],
  [
    'a concept with a bad id',
    (r) => (r.categories.categories[0].concepts[0].id = 'Bad Id'),
    /a concept with a bad id/,
  ],
  [
    'a concept listed twice',
    (r) => (r.categories.categories[0].concepts[1].id = 'recommend'),
    /lists recommend twice/,
  ],
  [
    'a concept with no gloss',
    (r) => delete r.categories.categories[0].concepts[0].gloss,
    /needs a gloss/,
  ],
  [
    'languages that are not a list',
    (r) => (r.categories.languages = {}),
    /"languages" must be a list/,
  ],
  [
    'languages in another order',
    (r) => r.categories.languages.reverse(),
    /the languages must be/,
  ],
  [
    'locales that are not the 19',
    (r) => r.categories.languages[0].locales.pop(),
    /exactly the 19 locales/,
  ],
  [
    'a locale of another language',
    (r) => r.categories.languages[0].locales.push('de'),
    /is not a locale of en/,
  ],
  ['no modes', (r) => delete r.categories.modes, /"modes" is missing/],
  [
    'other modes',
    (r) => (r.categories.modes = { word: '' }),
    /"modes" must name/,
  ],
];
