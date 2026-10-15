/**
 * @jest-environment node
 */

import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  SHIPPED_WORDING_FILES,
  WORDING,
  WORDING_LANGUAGES,
  compileWording,
  foldForMatching,
} from '@/lib/reply/checks/wording-lists';
import type { RawWording } from '@/lib/reply/checks/wording-lists';

import { clone } from '../../intake/helpers/packets';
import { CORPUS_LANGUAGES } from './helpers/corpus';
import {
  CATEGORIES_DAMAGE,
  LANGUAGE_FILE_DAMAGE,
  PHRASE_DAMAGE,
} from './helpers/damage-cases';

type Any = any;

const tool = require('../../../../scripts/reply/wording-tool.js') as {
  FILES: Record<
    'categories' | 'phrasesDir' | 'glossary' | 'review' | 'approval',
    string
  >;
  LANGUAGES: string[];
  WORDING_VERSION: string;
  check: (
    root: string,
    options?: { requireApproved?: boolean }
  ) => { problems: string[]; status: string | null };
  contentSha256: (all: Any) => string;
  fold: (text: string, language: string) => string;
  glossaryRows: (root: string, all: Any) => { rows: Any[]; problems: string[] };
  loadAll: (root: string) => Any;
  parityProblems: (all: Any) => string[];
  parityRows: (all: Any) => {
    keys: Any[];
    rows: { language: string; counts: number[] }[];
  };
  record: (root: string) => string[];
  renderReview: (all: Any) => string;
  structureProblems: (all: Any) => string[];
};

const ROOT = join(__dirname, '..', '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'reply', 'wording-tool.js');
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

let sandbox: string;
let copies = 0;

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'wording-tool-'));
});
afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A tree with the lists, the glossary, and (unless told not to) the generated files. */
function copyTree(withGenerated = true): string {
  copies += 1;
  const root = join(sandbox, `tree-${copies}`);
  mkdirSync(join(root, 'config', 'reply'), { recursive: true });
  mkdirSync(join(root, 'config', 'intake'), { recursive: true });
  cpSync(
    join(ROOT, 'config', 'reply', 'wording'),
    join(root, 'config', 'reply', 'wording'),
    { recursive: true }
  );
  cpSync(
    join(ROOT, 'config', 'intake', 'glossary.v1.json'),
    join(root, 'config', 'intake', 'glossary.v1.json')
  );
  if (!withGenerated) {
    rmSync(join(root, tool.FILES.review), { force: true });
    rmSync(join(root, tool.FILES.approval), { force: true });
  }
  return root;
}

const readJson = (root: string, rel: string): Any =>
  JSON.parse(readFileSync(join(root, rel), 'utf8'));
const writeJson = (root: string, rel: string, value: unknown): void =>
  writeFileSync(join(root, rel), `${JSON.stringify(value, null, 2)}\n`);
const phraseFile = (language: string): string =>
  `${tool.FILES.phrasesDir}/${language}.json`;

const run = (root: string, ...args: string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args, '--root', root], {
    encoding: 'utf8',
  });

describe('the committed lists, review sheet and approval', () => {
  it("are in step: the tool's own check passes", () => {
    const { problems, status } = tool.check(ROOT);
    expect(problems).toEqual([]);
    expect(['PENDING', 'APPROVED']).toContain(status);
  });

  it('have a review sheet that is exactly what a fresh run writes', () => {
    const all = tool.loadAll(ROOT);
    expect(lf(readFileSync(join(ROOT, tool.FILES.review), 'utf8'))).toBe(
      lf(tool.renderReview(all))
    );
  });

  it('have an approval written for these lists, and it has never been set by the tool', () => {
    const approval = readJson(ROOT, tool.FILES.approval);
    expect(approval.schema).toBe('wording-approval/1');
    expect(approval.area).toBe('wording');
    expect(approval.content_sha256).toBe(
      tool.contentSha256(tool.loadAll(ROOT))
    );
    if (approval.status === 'PENDING') {
      expect(approval.approved_by).toBe('');
      expect(approval.approved_on).toBe('');
    }
  });

  it('are PENDING until a person signs, so the gate refuses them', () => {
    const approval = readJson(ROOT, tool.FILES.approval);
    const gate = tool.check(ROOT, { requireApproved: true });
    if (approval.status === 'PENDING') {
      expect(gate.problems.some((p) => /PENDING/.test(p))).toBe(true);
    } else {
      expect(gate.problems).toEqual([]);
    }
  });

  it('list in the review sheet every phrase of every language and the mark', () => {
    const review = lf(readFileSync(join(ROOT, tool.FILES.review), 'utf8'));
    for (const language of WORDING_LANGUAGES) {
      const file = readJson(ROOT, phraseFile(language));
      expect(review).toContain(`## ${language} (`);
      expect(review).toContain(file.not_verified);
      for (const concept of Object.values<Any>(file.categories.ADVICE)) {
        for (const entry of concept as Any[]) {
          expect(review).toContain(typeof entry === 'string' ? entry : entry.t);
        }
      }
    }
    expect(review).toContain(
      'Draft'.toLowerCase() === 'draft' ? 'drafts until a native reader' : ''
    );
  });
});

describe('the tool and the code fold alike', () => {
  it('fold every phrase of every language to the same text', () => {
    for (const language of WORDING_LANGUAGES) {
      const file = readJson(ROOT, phraseFile(language));
      const compiled = WORDING.languages[language];
      const written: string[] = [];
      for (const category of Object.values<Any>(file.categories)) {
        for (const list of Object.values<Any>(category)) {
          for (const entry of list as Any[])
            written.push(typeof entry === 'string' ? entry : entry.t);
        }
      }
      for (const side of Object.values<Any>(file.direction)) {
        for (const list of Object.values<Any>(side)) {
          for (const entry of list as Any[])
            written.push(typeof entry === 'string' ? entry : entry.t);
        }
      }
      const texts = [
        ...Object.values(compiled.categories).flatMap((c) =>
          Object.values(c).flat()
        ),
        ...Object.values(compiled.direction).flatMap((s) =>
          Object.values(s).flat()
        ),
      ].map((p) => p.text);
      expect(texts).toHaveLength(written.length);
      written.forEach((entry, index) => {
        const stripped = entry.replace(/^\*|\*$/g, '');
        expect({
          language,
          entry,
          folded: tool.fold(stripped, language),
        }).toEqual({
          language,
          entry,
          folded: texts[index],
        });
      });
    }
  });

  it('fold awkward texts the same way', () => {
    const texts = [
      "Don't Miss THIS — risk-free!",
      'Straße ǅ ß İstanbul Iı',
      'ＲＩＳＫ １００％',
      'أُعلن للتو شراءً كــتاب',
      'كيك ملکی ہم هم',
      'Dépêchez-vous, recomendación',
      're​co­mmend‑this',
      'सलाह  \t  नुक्ता क़',
      'Xác Suất   rất cao',
    ];
    for (const language of WORDING_LANGUAGES) {
      for (const text of texts) {
        expect({ language, text, folded: tool.fold(text, language) }).toEqual({
          language,
          text,
          folded: foldForMatching(text, language),
        });
      }
    }
  });

  it('agree the shipped lists have no problem, and a damaged one has', () => {
    expect(tool.structureProblems(tool.loadAll(ROOT))).toEqual([]);
    expect(compileWording(SHIPPED_WORDING_FILES).problems).toEqual([]);
    const damage: [string, (r: Any) => void][] = [
      [
        'a repeated phrase',
        (r) => r.languages.en.categories.ADVICE.advise.push('Advice'),
      ],
      [
        'an unknown concept',
        (r) => (r.languages.en.categories.ADVICE.mood = ['feelings']),
      ],
      [
        'a short word',
        (r) => r.languages.en.categories.ADVICE.advise.push('ab'),
      ],
      ['a bad mode', (r) => (r.languages.es.default_mode = 'regex')],
      ['a missing category', (r) => delete r.languages.fr.categories.URGENCY],
      [
        'a star in the middle',
        (r) => r.languages.de.categories.ADVICE.advise.push('rat*schlag'),
      ],
      ['a missing tier', (r) => delete r.languages.ja.direction.long.view],
      [
        'an exception without the phrase',
        (r) =>
          r.languages.en.categories.ADVICE.advise.push({
            t: 'counsel',
            x: ['advice'],
          }),
      ],
      [
        'a long phrase',
        (r) => r.languages.en.categories.ADVICE.advise.push('x'.repeat(61)),
      ],
      [
        'a single character in Japanese',
        (r) => r.languages.ja.categories.ADVICE.advise.push('噂'),
      ],
    ];
    for (const [name, change] of damage) {
      const raw: Any = clone(SHIPPED_WORDING_FILES);
      change(raw);
      const all = { categories: raw.categories, languages: raw.languages };
      expect({
        name,
        ts: compileWording(raw as RawWording).problems.length > 0,
      }).toEqual({ name, ts: true });
      expect({ name, js: tool.structureProblems(all).length > 0 }).toEqual({
        name,
        js: true,
      });
    }
  });
});

describe('record', () => {
  it('writes the review sheet and a PENDING approval, never an APPROVED one', () => {
    const root = copyTree(false);
    expect(tool.record(root)).toEqual([tool.FILES.review, tool.FILES.approval]);
    const approval = readJson(root, tool.FILES.approval);
    expect(approval).toMatchObject({
      schema: 'wording-approval/1',
      area: 'wording',
      status: 'PENDING',
      approved_by: '',
      approved_on: '',
      note: '',
    });
    expect(approval.content_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(tool.check(root).problems).toEqual([]);
  });

  it('keeps a valid signature, and puts it back to PENDING when a list changes', () => {
    const root = copyTree();
    const approval = readJson(root, tool.FILES.approval);
    writeJson(root, tool.FILES.approval, {
      ...approval,
      status: 'APPROVED',
      approved_by: 'Davin',
      approved_on: '2026-10-15',
    });
    tool.record(root);
    expect(readJson(root, tool.FILES.approval)).toMatchObject({
      status: 'APPROVED',
      approved_by: 'Davin',
    });
    expect(tool.check(root, { requireApproved: true }).problems).toEqual([]);

    const file = readJson(root, phraseFile('en'));
    file.categories.ADVICE.advise.push('counsel');
    writeJson(root, phraseFile('en'), file);
    expect(
      tool.check(root).problems.some((p) => /differs from a fresh run/.test(p))
    ).toBe(true);
    expect(
      tool
        .check(root)
        .problems.some((p) => /approval was written for other lists/.test(p))
    ).toBe(true);
    tool.record(root);
    expect(readJson(root, tool.FILES.approval)).toMatchObject({
      status: 'PENDING',
      approved_by: '',
    });
  });

  it('does not write anything when the lists have a problem', () => {
    const root = copyTree(false);
    const file = readJson(root, phraseFile('en'));
    file.default_mode = 'regex';
    writeJson(root, phraseFile('en'), file);
    expect(() => tool.record(root)).toThrow(/the lists have problems/);
    expect(existsSync(join(root, tool.FILES.review))).toBe(false);
    expect(existsSync(join(root, tool.FILES.approval))).toBe(false);
  });

  it('ignores how the JSON files are laid out: the approval refers to the words', () => {
    const root = copyTree();
    const before = tool.contentSha256(tool.loadAll(root));
    const file = readJson(root, phraseFile('en'));
    writeFileSync(join(root, phraseFile('en')), JSON.stringify(file), 'utf8');
    expect(tool.contentSha256(tool.loadAll(root))).toBe(before);
    expect(tool.check(root).problems).toEqual([]);
  });
});

describe('check', () => {
  it('names a review sheet that is missing, edited, or stale', () => {
    const root = copyTree();
    rmSync(join(root, tool.FILES.review));
    expect(tool.check(root).problems).toContain(
      `${tool.FILES.review} is missing`
    );
    tool.record(root);
    writeFileSync(
      join(root, tool.FILES.review),
      `${readFileSync(join(root, tool.FILES.review), 'utf8')}\nan edit\n`
    );
    expect(
      tool.check(root).problems.some((p) => /differs from a fresh run/.test(p))
    ).toBe(true);
  });

  it('names an approval that is missing or damaged', () => {
    const root = copyTree();
    rmSync(join(root, tool.FILES.approval));
    expect(tool.check(root).problems).toEqual([
      `${tool.FILES.approval} is missing`,
    ]);
    writeFileSync(join(root, tool.FILES.approval), '{not json');
    expect(tool.check(root).problems.some((p) => /is not JSON/.test(p))).toBe(
      true
    );
    for (const [name, change, expected] of [
      ['a missing key', (a: Any) => delete a.note, /lacks "note"/],
      ['an unknown key', (a: Any) => (a.extra = 1), /unknown key "extra"/],
      ['a wrong schema', (a: Any) => (a.schema = 'x'), /schema must be/],
      ['a wrong area', (a: Any) => (a.area = 'x'), /area must be/],
      ['a wrong status', (a: Any) => (a.status = 'DONE'), /status must be/],
      [
        'APPROVED without a name',
        (a: Any) => ((a.status = 'APPROVED'), (a.approved_on = '2026-10-15')),
        /needs approved_by/,
      ],
      [
        'APPROVED without a date',
        (a: Any) => (
          (a.status = 'APPROVED'),
          (a.approved_by = 'D'),
          (a.approved_on = '15 Oct')
        ),
        /needs approved_on/,
      ],
      [
        'another digest',
        (a: Any) => (a.content_sha256 = 'f'.repeat(64)),
        /written for other lists/,
      ],
    ] as [string, (a: Any) => void, RegExp][]) {
      const fresh = copyTree();
      const approval = readJson(fresh, tool.FILES.approval);
      change(approval);
      writeJson(fresh, tool.FILES.approval, approval);
      const found = tool.check(fresh).problems;
      expect({ name, found: found.some((p) => expected.test(p)) }).toEqual({
        name,
        found: true,
      });
    }
  });

  it('refuses an APPROVED status only with the gate, and passes a signed one', () => {
    const root = copyTree();
    expect(tool.check(root).problems).toEqual([]);
    expect(
      tool
        .check(root, { requireApproved: true })
        .problems.some((p) => /PENDING/.test(p))
    ).toBe(true);
    const approval = readJson(root, tool.FILES.approval);
    writeJson(root, tool.FILES.approval, {
      ...approval,
      status: 'APPROVED',
      approved_by: 'Davin',
      approved_on: '2026-10-15',
    });
    expect(tool.check(root, { requireApproved: true })).toEqual({
      problems: [],
      status: 'APPROVED',
    });
  });

  it('stops at a list file that is missing or is not JSON', () => {
    const root = copyTree();
    rmSync(join(root, phraseFile('th')));
    expect(() => tool.check(root)).toThrow(/th\.json is missing/);
    writeFileSync(join(root, phraseFile('th')), '{');
    expect(() => tool.check(root)).toThrow(/is not JSON/);
  });
});

describe('parity', () => {
  it('has a row per language and a column per concept and tier', () => {
    const { keys, rows } = tool.parityRows(tool.loadAll(ROOT));
    expect(rows.map((r) => r.language)).toEqual([...WORDING_LANGUAGES]);
    expect(keys).toHaveLength(18 + 6);
    for (const row of rows) {
      expect(row.counts).toHaveLength(24);
      expect(Math.min(...row.counts)).toBeGreaterThanOrEqual(1);
    }
    expect(tool.parityProblems(tool.loadAll(ROOT))).toEqual([]);
  });

  it('names a language that lacks a concept or has too few phrases for it', () => {
    const all = tool.loadAll(ROOT);
    const thin = clone(all);
    thin.languages.de.categories.URGENCY.act_now = ['jetzt handeln'];
    expect(
      tool
        .parityProblems(thin)
        .some((p) => /de\.json: URGENCY\.act_now has 1 phrase/.test(p))
    ).toBe(true);
    const missing = clone(all);
    delete missing.languages.fr.direction.short.label;
    expect(
      tool
        .parityProblems(missing)
        .some((p) => /fr\.json: direction\.short\.label has 0 phrase/.test(p))
    ).toBe(true);
  });

  it('lets one stem stand for a concept, and a language that matches anywhere by default', () => {
    const all = tool.loadAll(ROOT);
    const stem = clone(all);
    stem.languages.en.categories.ADVICE.recommend = ['recommend*'];
    expect(tool.parityProblems(stem)).toEqual([]);
    const plain = clone(all);
    plain.languages.en.categories.ADVICE.recommend = ['recommend'];
    expect(tool.parityProblems(plain)).toHaveLength(1);
    const unspaced = clone(all);
    unspaced.languages.ja.categories.ADVICE.recommend = ['おすすめ'];
    expect(tool.parityProblems(unspaced)).toEqual([]);
    const object = clone(all);
    object.languages.en.categories.ADVICE.recommend = [
      { t: 'recommend*', x: ['not recommended'] },
    ];
    expect(tool.parityProblems(object)).toEqual([]);
  });
});

describe('glossary alignment', () => {
  it('finds the glossary word for buy and sell in the direction lists of all 19 locales', () => {
    const { rows, problems } = tool.glossaryRows(ROOT, tool.loadAll(ROOT));
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(2 * 19);
    expect(rows.every((r) => r.found && r.canonical !== null)).toBe(true);
    expect(
      rows
        .filter((r) => r.side === 'long')
        .map((r) => r.locale)
        .sort()
    ).toEqual(
      rows
        .filter((r) => r.side === 'short')
        .map((r) => r.locale)
        .sort()
    );
  });

  it('names a language whose direction lists lost the glossary word', () => {
    const all = tool.loadAll(ROOT);
    const lost = clone(all);
    for (const tier of ['stance', 'label', 'view'])
      lost.languages.es.direction.long[tier] = ['ir en largo', 'sesgo largo'];
    const { problems } = tool.glossaryRows(ROOT, lost);
    expect(
      problems.some((p) =>
        /es\.json: no direction\.long phrase carries the glossary word "comprar"/.test(
          p
        )
      )
    ).toBe(true);
  });

  it('names the glossary changing under the lists', () => {
    const root = copyTree();
    const glossary = readJson(root, tool.FILES.glossary);
    glossary.version = '2.0.0';
    writeJson(root, tool.FILES.glossary, glossary);
    const { problems } = tool.glossaryRows(root, tool.loadAll(root));
    expect(
      problems.some((p) =>
        /written against glossary 1\.0\.0-draft and the glossary is 2\.0\.0/.test(
          p
        )
      )
    ).toBe(true);
    expect(
      tool.check(root).problems.some((p) => /glossary is 2\.0\.0/.test(p))
    ).toBe(true);
  });

  it('names a glossary that no longer has the term, or a locale it has no form for', () => {
    const root = copyTree();
    const glossary = readJson(root, tool.FILES.glossary);
    glossary.terms = glossary.terms.filter((t: Any) => t.id !== 'sell');
    writeJson(root, tool.FILES.glossary, glossary);
    expect(tool.glossaryRows(root, tool.loadAll(root)).problems).toContain(
      'the glossary has no term "sell"'
    );
    const other = copyTree();
    const second = readJson(other, tool.FILES.glossary);
    delete second.terms.find((t: Any) => t.id === 'buy').forms.th;
    writeJson(other, tool.FILES.glossary, second);
    expect(tool.glossaryRows(other, tool.loadAll(other)).problems).toContain(
      'the glossary has no th form of "buy"'
    );
  });
});

describe('the command line', () => {
  it('exits 0 on the committed lists for check, parity and glossary, and prints what it found', () => {
    for (const command of ['check', 'parity', 'glossary']) {
      const result = run(ROOT, command);
      expect({ command, status: result.status, error: result.stderr }).toEqual({
        command,
        status: 0,
        error: '',
      });
    }
    expect(run(ROOT, 'parity').stdout.split('\n')[0]).toContain(
      'ADVICE.recommend'
    );
    expect(run(ROOT, 'check').stdout).toMatch(
      /the wording lists are as they should be \(approval (PENDING|APPROVED)\)/
    );
    expect(run(ROOT, 'glossary').stdout).toContain('comprar');
  });

  it('exits 1 for the gate on a PENDING approval, and 0 once signed', () => {
    const root = copyTree();
    const gate = run(root, 'check', '--require-approved');
    expect(gate.status).toBe(1);
    expect(gate.stderr).toContain('PENDING');
    const approval = readJson(root, tool.FILES.approval);
    writeJson(root, tool.FILES.approval, {
      ...approval,
      status: 'APPROVED',
      approved_by: 'Davin',
      approved_on: '2026-10-15',
    });
    expect(run(root, 'check', '--require-approved').status).toBe(0);
  });

  it('exits 1 on a problem and 2 on a file it cannot use or a command it does not know', () => {
    const root = copyTree();
    const file = readJson(root, phraseFile('de'));
    file.categories.URGENCY.act_now = ['jetzt handeln'];
    writeJson(root, phraseFile('de'), file);
    expect(run(root, 'parity').status).toBe(1);
    expect(run(root, 'check').status).toBe(1);
    rmSync(join(root, phraseFile('de')));
    expect(run(root, 'check').status).toBe(2);
    expect(run(root, 'frobnicate').status).toBe(2);
    expect(run(root).status).toBe(2);
  });

  it('records through the command line', () => {
    const root = copyTree(false);
    const result = run(root, 'record');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`wrote ${tool.FILES.review}`);
    expect(run(root, 'check').status).toBe(0);
  });
});

describe('the corpus and the lists agree on the languages', () => {
  it('cover the same 17 languages', () => {
    expect([...CORPUS_LANGUAGES].sort()).toEqual([...tool.LANGUAGES].sort());
    expect([...WORDING_LANGUAGES].sort()).toEqual([...tool.LANGUAGES].sort());
    expect(tool.WORDING_VERSION).toBe('wording.v1');
  });
});

describe('the tool holds an entry to the same rules as the code', () => {
  const problemsIn = (
    entry: unknown,
    extra: (raw: Any) => void = () => undefined
  ): string[] => {
    const all: Any = clone(tool.loadAll(ROOT));
    all.languages.en.categories.ADVICE.advise = ['advice', entry];
    extra(all);
    return tool.structureProblems(all);
  };

  it.each([
    ['a number', 5, /an entry must be a string/],
    ['an empty string', '', /empty or has white space/],
    ['white space at an end', ' counsel', /empty or has white space/],
    ['a star in the middle', 'coun*sel', /star at its ends only/],
    ['only stars', '**', /star at its ends only/],
    ['a leading star alone', '*counsel', /leading star without a trailing one/],
    ['an unknown key', { t: 'counsel', y: 1, z: 2 }, /unknown key\(s\) y, z/],
    [
      'x that is not a list',
      { t: 'counsel', x: 'a' },
      /"x" must be a non-empty list/,
    ],
    ['an empty x', { t: 'counsel', x: [] }, /"x" must be a non-empty list/],
    [
      'an exception that is not text',
      { t: 'counsel', x: [1] },
      /exception of "counsel" must be a non-empty string/,
    ],
    [
      'an exception of white space',
      { t: 'counsel', x: ['  '] },
      /exception of "counsel" must be a non-empty string/,
    ],
    [
      'an exception without the phrase',
      { t: 'counsel', x: ['advice'] },
      /does not contain "counsel"/,
    ],
    ['a long phrase', 'x'.repeat(61), /longer than 60 characters/],
    ['a short word', 'ab', /very short single word/],
    [
      'a short phrase matched anywhere',
      '*abcde*',
      /matched anywhere in a word/,
    ],
    ['a repeat', 'Advice', /repeats an entry/],
  ])('refuses %s', (_name, entry, expected) => {
    expect(problemsIn(entry).some((p) => expected.test(p))).toBe(true);
  });

  it('accepts the forms the code accepts', () => {
    for (const entry of [
      'counsel',
      'counsel*',
      '*counsel*',
      '*abcdef*',
      { t: 'counsel', x: ['legal counsel'] },
      'abcd',
      'a b',
      'a+ rating',
    ]) {
      expect({ entry, problems: problemsIn(entry) }).toEqual({
        entry,
        problems: [],
      });
    }
  });

  it('accepts a prefix default and refuses another', () => {
    expect(
      problemsIn('counsel', (r) => (r.languages.en.default_mode = 'prefix'))
    ).toEqual([]);
    expect(
      problemsIn('counsel', (r) => (r.languages.en.default_mode = 'substring'))
    ).toEqual([]);
    expect(
      problemsIn(
        'counsel',
        (r) => (r.languages.en.default_mode = 'regex')
      ).some((p) => /default_mode must be word, prefix, substring/.test(p))
    ).toBe(true);
  });

  it('names the languages it expects, separated by commas', () => {
    const all: Any = clone(tool.loadAll(ROOT));
    all.categories.languages.reverse();
    expect(
      tool
        .structureProblems(all)
        .some((p: string) =>
          p.includes(
            'en, es, de, pt, it, ja, ar, fr, ko, zh, zh-TW, ur, hi, vi, id, th, tr'
          )
        )
    ).toBe(true);
  });

  it('folds a control character and a run of white space like the code', () => {
    for (const text of [
      'a' + String.fromCharCode(1) + 'b',
      'a \t\n b',
      'a' + String.fromCharCode(1) + String.fromCharCode(1) + ' - b',
    ]) {
      for (const language of ['en', 'tr', 'ar', 'ja']) {
        expect(tool.fold(text, language)).toBe(foldForMatching(text, language));
      }
    }
    expect(tool.fold('a' + String.fromCharCode(1) + 'b', 'en')).toBe('a b');
  });

  it('reads a review sheet with Windows line endings the same', () => {
    const root = copyTree();
    const review = lf(readFileSync(join(root, tool.FILES.review), 'utf8'));
    writeFileSync(join(root, tool.FILES.review), review.replace(/\n/g, '\r\n'));
    expect(tool.check(root).problems).toEqual([]);
    writeFileSync(join(root, tool.FILES.review), review.replace(/\n/g, '\r'));
    expect(tool.check(root).problems).toEqual([]);
  });
});

describe('the tool names the same damage, with the same words, as the code', () => {
  const damagedAll = (change: (raw: Any) => void): Any => {
    const all: Any = clone(tool.loadAll(ROOT));
    change(all);
    return all;
  };

  it.each(LANGUAGE_FILE_DAMAGE)(
    'a language file: %s',
    (_name, change, expected) => {
      const found = tool.structureProblems(damagedAll(change));
      expect(found.some((p: string) => expected.test(p))).toBe(true);
    }
  );

  it.each(PHRASE_DAMAGE)('a phrase: %s', (_name, entry, expected) => {
    const found = tool.structureProblems(
      damagedAll(
        (raw) => (raw.languages.en.categories.ADVICE.advise = ['advice', entry])
      )
    );
    expect(found.some((p: string) => expected.test(p))).toBe(true);
  });

  // The tool reads categories.json for the review sheet and the parity table, so it polices the shape
  // those need (the ids, their order, the concepts); the finer rules (glosses, locales, modes) belong to
  // the code's loader alone. Where the tool names a fault in other words the table says so here.
  const TOOL_WORDS: Record<string, RegExp | null> = {
    'not an object': /schema must be/,
    'a category with no id': /the categories must be ADVICE/,
    'an unknown category': /the categories must be ADVICE/,
    'a missing category': /the categories must be ADVICE/,
    'a category listed twice': /the categories must be ADVICE/,
    'a concept with a bad id': /Bad Id is missing/,
    'a concept listed twice': /lists a concept twice/,
    'a concept with no gloss': null,
    'locales that are not the 19': null,
    'a locale of another language': null,
    'no modes': null,
    'other modes': null,
  };

  it.each(CATEGORIES_DAMAGE)(
    'categories.json: %s',
    (name, change, expected) => {
      const found = tool.structureProblems(damagedAll(change));
      const words = name in TOOL_WORDS ? TOOL_WORDS[name] : expected;
      if (words === null) {
        expect(found).toEqual([]);
        return;
      }
      expect(found.some((p: string) => words.test(p))).toBe(true);
    }
  );

  it('counts the same problems for a damaged file as the code does, for a sample', () => {
    for (const change of [
      (r: Any) => (r.languages.de.default_mode = 'regex'),
      (r: Any) => delete r.languages.fr.categories.URGENCY,
      (r: Any) => (r.languages.en.not_verified = ''),
    ]) {
      const raw: Any = clone(SHIPPED_WORDING_FILES);
      change(raw);
      expect(tool.structureProblems(raw).length).toBe(
        compileWording(raw as RawWording).problems.length
      );
    }
  });
});

describe('the tool says what it found, in the words and the layout a person reads', () => {
  const ALL_KEYS = (all: Any): string[] => {
    const keys: string[] = [];
    for (const item of all.categories.categories)
      for (const concept of item.concepts)
        keys.push(item.id + '.' + concept.id);
    for (const side of ['long', 'short'])
      for (const tier of ['stance', 'label', 'view'])
        keys.push('dir.' + side + '.' + tier);
    return keys;
  };

  it('prints the parity table with a tab between cells and a newline between rows', () => {
    const all = tool.loadAll(ROOT);
    const out = run(ROOT, 'parity').stdout.split('\n');
    expect(out[0]).toBe(['language', ...ALL_KEYS(all)].join('\t'));
    expect(out).toHaveLength(1 + 17 + 1);
    expect(out[out.length - 1]).toBe('');
    const en = readJson(ROOT, phraseFile('en'));
    const counts = [
      ...Object.values<Any>(en.categories).flatMap((c) =>
        Object.values<Any>(c).map((l) => l.length)
      ),
      ...['long', 'short'].flatMap((side) =>
        ['stance', 'label', 'view'].map(
          (tier) => en.direction[side][tier].length
        )
      ),
    ];
    expect(out[1]).toBe(['en', ...counts].join('\t'));
    expect(out.slice(1, 18).map((row) => row.split('\t')[0])).toEqual([
      ...WORDING_LANGUAGES,
    ]);
  });

  it('prints the glossary table, with yes, NO and a dash', () => {
    const out = run(ROOT, 'glossary').stdout.split('\n');
    expect(out[0]).toBe(
      'term\tside\tlocale\tglossary word\tin the direction lists'
    );
    expect(out[1]).toBe('buy\tlong\ten-US\tbuy\tyes');
    expect(out).toHaveLength(1 + 38 + 1);
    expect(out.filter((row) => row.endsWith('\tyes'))).toHaveLength(38);

    const root = copyTree();
    const file = readJson(root, phraseFile('es'));
    for (const tier of ['stance', 'label', 'view'])
      file.direction.long[tier] = ['ir en largo', 'sesgo largo'];
    writeJson(root, phraseFile('es'), file);
    const glossary = readJson(root, tool.FILES.glossary);
    delete glossary.terms.find((t: Any) => t.id === 'sell').forms.th;
    writeJson(root, tool.FILES.glossary, glossary);
    const result = run(root, 'glossary');
    expect(result.status).toBe(1);
    expect(result.stdout.split('\n')).toContain('buy\tlong\tes\tcomprar\tNO');
    expect(result.stdout.split('\n')).toContain('sell\tshort\tth\t-\tNO');
    expect(result.stderr).toContain(
      '- es.json: no direction.long phrase carries the glossary word "comprar" (buy, es)'
    );
    expect(result.stderr).toContain('- the glossary has no th form of "sell"');
  });

  it('prints the usage when it is given nothing to do, and exits 2', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr.trim()).toBe(
      'usage: wording-tool.js record | check [--require-approved] | parity | glossary [--root DIR]'
    );
  });

  it('finds the repository by itself, and takes --root before or after the command', () => {
    const alone = spawnSync(process.execPath, [SCRIPT, 'check'], {
      encoding: 'utf8',
      cwd: sandbox,
    });
    expect(alone.status).toBe(0);
    const root = copyTree();
    expect(
      spawnSync(process.execPath, [SCRIPT, '--root', root, 'check'], {
        encoding: 'utf8',
        cwd: sandbox,
      }).status
    ).toBe(0);
    expect(
      spawnSync(process.execPath, [SCRIPT, 'check', '--root', root], {
        encoding: 'utf8',
        cwd: sandbox,
      }).status
    ).toBe(0);
    rmSync(join(root, tool.FILES.approval));
    expect(
      spawnSync(process.execPath, [SCRIPT, '--root', root, 'check'], {
        encoding: 'utf8',
        cwd: sandbox,
      }).status
    ).toBe(1);
    expect(
      spawnSync(process.execPath, [SCRIPT, 'check'], {
        encoding: 'utf8',
        cwd: sandbox,
      }).status
    ).toBe(0);
  });

  it('writes the approval with two spaces of indent and a newline at the end', () => {
    const root = copyTree(false);
    tool.record(root);
    const text = readFileSync(join(root, tool.FILES.approval), 'utf8');
    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2) + '\n');
    expect(text.split('\n')[1]).toBe('  "schema": "wording-approval/1",');
  });

  it('writes the review sheet in the layout the reader expects', () => {
    const review = readFileSync(join(ROOT, tool.FILES.review), 'utf8');
    expect(
      lf(review).startsWith('# Wording lists wording.v1: review sheet\n\n')
    ).toBe(true);
    expect(review).toContain('| language | locales | ADVICE.recommend |');
    expect(review).toContain('| DIRECTION long | stance |');
    expect(review).toContain('| DIRECTION short | view |');
    expect(review).toContain('`recommend*`');
    const root = copyTree(false);
    const file = readJson(root, phraseFile('en'));
    file.categories.ADVICE.advise = [
      'advice',
      'pipe | in it',
      { t: 'counsel', x: ['legal counsel', 'free counsel'] },
    ];
    writeJson(root, phraseFile('en'), file);
    tool.record(root);
    const sheet = readFileSync(join(root, tool.FILES.review), 'utf8');
    expect(sheet).toContain('`pipe \\| in it`');
    expect(sheet).toContain(
      '`counsel (not inside: legal counsel, free counsel)`'
    );
  });

  it('names the problems it stops a record for, one to a line', () => {
    const root = copyTree(false);
    const file = readJson(root, phraseFile('en'));
    file.default_mode = 'regex';
    file.not_verified = '';
    writeJson(root, phraseFile('en'), file);
    try {
      tool.record(root);
      throw new Error('record should have stopped');
    } catch (error) {
      const message = (error as Error).message;
      expect(
        message.startsWith('the lists have problems; fix them first:\n- ')
      ).toBe(true);
      expect(message.split('\n- ')).toHaveLength(3);
    }
  });

  it('holds an approval to its own shape, field by field', () => {
    const change = (edit: (a: Any) => void): string[] => {
      const root = copyTree();
      const approval = readJson(root, tool.FILES.approval);
      edit(approval);
      writeJson(root, tool.FILES.approval, approval);
      return tool.check(root).problems;
    };
    expect(
      change((a) => (a.status = 'APPROVED')).some((p) =>
        /needs approved_by/.test(p)
      )
    ).toBe(true);
    expect(
      change(
        (a) => (
          (a.status = 'APPROVED'),
          (a.approved_by = '   '),
          (a.approved_on = '2026-10-15')
        )
      ).some((p) => /needs approved_by/.test(p))
    ).toBe(true);
    for (const date of [
      'x2026-10-15',
      '2026-10-15x',
      '2026-1-15',
      '15-10-2026',
      '',
    ]) {
      expect({
        date,
        found: change(
          (a) => (
            (a.status = 'APPROVED'),
            (a.approved_by = 'D'),
            (a.approved_on = date)
          )
        ).some((p) => /needs approved_on/.test(p)),
      }).toEqual({ date, found: true });
    }
    expect(
      change(
        (a) => (
          (a.status = 'APPROVED'),
          (a.approved_by = 'D'),
          (a.approved_on = '2026-10-15')
        )
      )
    ).toEqual([]);
    const root = copyTree();
    writeFileSync(join(root, tool.FILES.approval), '[]');
    expect(tool.check(root).problems).toContain(
      tool.FILES.approval + ' must be an object'
    );
    writeFileSync(join(root, tool.FILES.approval), 'null');
    expect(
      tool
        .check(root)
        .problems.some((p) => /is missing|must be an object/.test(p))
    ).toBe(true);
    writeFileSync(join(root, tool.FILES.approval), '5');
    expect(tool.check(root).problems).toContain(
      tool.FILES.approval + ' must be an object'
    );
  });

  it('refuses a mark of 61 characters and takes one of 60, and a phrase on the same edge', () => {
    const edit = (change: (r: Any) => void): string[] =>
      tool.structureProblems(damagedAll(change));
    const damagedAll = (change: (raw: Any) => void): Any => {
      const all: Any = clone(tool.loadAll(ROOT));
      change(all);
      return all;
    };
    expect(edit((r) => (r.languages.en.not_verified = 'x'.repeat(60)))).toEqual(
      []
    );
    expect(
      edit((r) => (r.languages.en.not_verified = 'x'.repeat(61))).length
    ).toBeGreaterThan(0);
    expect(
      edit((r) =>
        r.languages.en.categories.ADVICE.advise.push(
          'x'.repeat(30) + ' ' + 'y'.repeat(29)
        )
      )
    ).toEqual([]);
    expect(
      edit((r) =>
        r.languages.en.categories.ADVICE.advise.push(
          'x'.repeat(30) + ' ' + 'y'.repeat(30)
        )
      ).length
    ).toBeGreaterThan(0);
    expect(
      edit((r) => r.languages.en.categories.ADVICE.advise.push('abcd'))
    ).toEqual([]);
    expect(
      edit((r) => r.languages.en.categories.ADVICE.advise.push('abc')).length
    ).toBeGreaterThan(0);
    expect(
      edit((r) => r.languages.en.categories.ADVICE.advise.push('*abcdef*'))
    ).toEqual([]);
    expect(
      edit((r) => r.languages.en.categories.ADVICE.advise.push('*abcde*'))
        .length
    ).toBeGreaterThan(0);
  });

  it('lets a lone stem or a default-substring language stand for a concept, and nothing else', () => {
    const all: Any = clone(tool.loadAll(ROOT));
    all.languages.en.categories.ADVICE.recommend = ['*recommend*'];
    expect(tool.parityProblems(all)).toEqual([]);
    all.languages.en.categories.ADVICE.recommend = ['recommend'];
    expect(tool.parityProblems(all)).toHaveLength(1);
    all.languages.en.categories.ADVICE.recommend = [
      { t: 'recommend', x: ['not recommended'] },
    ];
    expect(tool.parityProblems(all)).toHaveLength(1);
    all.languages.en.categories.ADVICE.recommend = [];
    expect(tool.parityProblems(all)).toHaveLength(1);
  });

  it('reads a glossary entry whose forms are missing entirely', () => {
    const root = copyTree();
    const glossary = readJson(root, tool.FILES.glossary);
    delete glossary.terms.find((t: Any) => t.id === 'buy').forms;
    writeJson(root, tool.FILES.glossary, glossary);
    const { problems } = tool.glossaryRows(root, tool.loadAll(root));
    expect(problems).toContain('the glossary has no en-US form of "buy"');
  });
});

describe('the fine points of an entry, of a file and of the command line', () => {
  const asAll = (change: (all: Any) => void): Any => {
    const all: Any = clone(tool.loadAll(ROOT));
    change(all);
    return all;
  };

  it('folds the letters that have no accent to strip, and the ends of a text, like the code', () => {
    expect(tool.fold('Ørsted Æon Œuvre Đà Łódź', 'en')).toBe(
      'orsted aeon oeuvre da lodz'
    );
    expect(tool.fold('  sell   buy  ', 'en')).toBe('sell buy');
    for (const text of [
      'Ørsted Æon Œuvre Đà Łódź Straße ısı',
      '  sell   buy  ',
    ]) {
      expect(tool.fold(text, 'en')).toBe(foldForMatching(text, 'en'));
    }
  });

  it('accepts an entry written as an object with no exceptions, and shows it plain', () => {
    const all = asAll(
      (r) =>
        (r.languages.en.categories.ADVICE.advise = ['advice', { t: 'counsel' }])
    );
    expect(tool.structureProblems(all)).toEqual([]);
    const sheet: string = tool.renderReview(all);
    expect(sheet).toContain('`counsel`');
    expect(sheet).not.toContain('undefined');
  });

  it('takes an entry and its stem for two entries where whole words are matched, and for a repeat where a prefix is the default', () => {
    const put = (mode: string) =>
      asAll((r) => {
        r.languages.en.default_mode = mode;
        r.languages.en.categories.ADVICE.advise = ['advice', 'advice*'];
      });
    const repeats = (all: Any): string[] =>
      tool
        .structureProblems(all)
        .filter((p) =>
          /ADVICE\.advise: "advice\*" repeats an entry of ADVICE\.advise/.test(
            p
          )
        );
    expect(repeats(put('word'))).toEqual([]);
    expect(repeats(put('prefix'))).toHaveLength(1);
  });

  it('writes the categories of a wrong list in the order they must keep, with commas', () => {
    const found = tool.structureProblems(
      asAll((r) => (r.categories.categories[0].id = 'MOOD'))
    );
    expect(found).toContain(
      'categories.json: the categories must be ADVICE, PROBABILITY, GUARANTEE, URGENCY, UNLISTED_NEWS, in that order'
    );
  });

  it('counts nothing, and does not fall over, for a file without its categories or direction lists', () => {
    const keys: string[] = tool
      .parityRows(tool.loadAll(ROOT))
      .keys.map((k: Any) => k.key);
    const counts = (change: (all: Any) => void): Record<string, number> => {
      const row = tool
        .parityRows(asAll(change))
        .rows.find((r) => r.language === 'en');
      return Object.fromEntries(
        keys.map((key, index) => [key, row?.counts[index] ?? -1])
      );
    };
    const zeroOf = (found: Record<string, number>, prefix: string): boolean =>
      keys.filter((k) => k.startsWith(prefix)).every((k) => found[k] === 0);
    const aliveOf = (found: Record<string, number>, prefix: string): boolean =>
      keys.filter((k) => k.startsWith(prefix)).every((k) => found[k] > 0);

    const noCategories = counts((r) => delete r.languages.en.categories);
    expect(zeroOf(noCategories, 'ADVICE.')).toBe(true);
    expect(zeroOf(noCategories, 'UNLISTED_NEWS.')).toBe(true);
    expect(aliveOf(noCategories, 'direction.')).toBe(true);

    const noAdvice = counts((r) => delete r.languages.en.categories.ADVICE);
    expect(zeroOf(noAdvice, 'ADVICE.')).toBe(true);
    expect(aliveOf(noAdvice, 'URGENCY.')).toBe(true);

    const noDirection = counts((r) => delete r.languages.en.direction);
    expect(zeroOf(noDirection, 'direction.')).toBe(true);
    expect(aliveOf(noDirection, 'ADVICE.')).toBe(true);

    const noLong = counts((r) => delete r.languages.en.direction.long);
    expect(zeroOf(noLong, 'direction.long.')).toBe(true);
    expect(aliveOf(noLong, 'direction.short.')).toBe(true);

    for (const change of [
      (r: Any) => delete r.languages.en.categories,
      (r: Any) => delete r.languages.en.categories.ADVICE,
      (r: Any) => delete r.languages.en.direction,
      (r: Any) => delete r.languages.en.direction.long,
    ]) {
      expect(() => tool.parityProblems(asAll(change))).not.toThrow();
      expect(tool.parityProblems(asAll(change)).length).toBeGreaterThan(0);
    }
  });

  it('lets a lone stem with a star at its end stand for a concept, written plain or as an object', () => {
    for (const lone of [
      'recommend*',
      { t: 'recommend*' },
      { t: 'recommend*', x: ['recommended'] },
    ]) {
      const all = asAll(
        (r) => (r.languages.en.categories.ADVICE.recommend = [lone])
      );
      expect(tool.parityProblems(all)).toEqual([]);
    }
  });

  it('reads a direction phrase written as an object when it looks for the glossary word', () => {
    const all = asAll((r) => {
      for (const tier of ['stance', 'label', 'view']) {
        r.languages.es.direction.long[tier] = r.languages.es.direction.long[
          tier
        ].map((p: Any) => (typeof p === 'string' ? { t: p } : p));
      }
    });
    const { problems } = tool.glossaryRows(ROOT, all);
    expect(problems).toEqual([]);
  });

  it('exits 1 for one problem alone, in the glossary and in the parity table', () => {
    const root = copyTree();
    const glossary = readJson(root, tool.FILES.glossary);
    delete glossary.terms.find((t: Any) => t.id === 'sell').forms.th;
    writeJson(root, tool.FILES.glossary, glossary);
    const one = run(root, 'glossary');
    expect(one.stderr.trim().split('\n')).toEqual([
      '- the glossary has no th form of "sell"',
    ]);
    expect(one.status).toBe(1);

    const thin = copyTree();
    const file = readJson(thin, phraseFile('en'));
    file.categories.ADVICE.recommend = ['recommend'];
    writeJson(thin, phraseFile('en'), file);
    const result = run(thin, 'parity');
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.status).toBe(1);
  });

  it('lets an error that is not its own go up with its stack, and gives its own as a message', () => {
    const root = copyTree();
    rmSync(join(root, tool.FILES.review));
    mkdirSync(join(root, tool.FILES.review));
    const result = run(root, 'check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EISDIR');
    const missing = run(join(root, 'nowhere'), 'check');
    expect(missing.status).toBe(2);
    expect(missing.stderr.trim()).toBe(tool.FILES.categories + ' is missing');
  });

  it('takes the first --root when it is given twice', () => {
    const good = copyTree();
    const result = spawnSync(
      process.execPath,
      [SCRIPT, 'check', '--root', good, '--root', join(sandbox, 'nowhere')],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
  });
});
