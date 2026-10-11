/**
 * @jest-environment node
 */

/**
 * The review tool (`scripts/intake/glossary_tool.py`, build step 6 part 3).
 *
 * The committed glossary and the `intake.*` texts are drafts until a person who reads each
 * language has approved them. The tool writes the review tables, holds the approvals, and
 * makes the status of every form in the glossary follow them. These tests hold three things:
 *
 *  1. the committed files are what a fresh run makes, and the rules hold for them;
 *  2. the approval gate works: an area counts only when a person wrote APPROVED over the exact
 *     content they read, a later change puts it back to PENDING, and `--require-approved`
 *     refuses while any area is PENDING;
 *  3. each rule of the tool refuses what it should (a missing locale, a wrong script, a lost
 *     placeholder, a tampered approval), on a scratch copy of the tree.
 *
 * The gate is also a switch: `INTAKE_REQUIRE_APPROVED=1 npx jest __tests__/lib/intake/glossary-tool.test.ts`
 * (the Jest twin of `python scripts/intake/glossary_tool.py check --require-approved`) fails
 * while any area is PENDING. Without it, PENDING is the expected state of a new draft.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { LOCALES, parseGlossary } from '@/lib/intake';

import { PYTHON, REPO_ROOT, runPython } from './helpers/python';

const TOOL = 'scripts/intake/glossary_tool.py';
const REQUIRE_APPROVED = process.env['INTAKE_REQUIRE_APPROVED'] === '1';
const AREAS = ['terms', ...LOCALES];
const LABELS = [
  'Ask AI about M5 Chart',
  'Ask AI about M15 Chart',
  'Click to ask AI about M5 chart situation',
  'Click to ask AI about M15 chart situation',
];

const describeTool = PYTHON === null ? describe.skip : describe;

const tool = (args: string[], root?: string) =>
  runPython([TOOL, ...(root === undefined ? [] : ['--root', root]), ...args]);

// ---------------------------------------------------------------------------------------
// A scratch copy of the tree: the glossary, and the dictionaries cut to the keys the tool reads
// ---------------------------------------------------------------------------------------

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'glossary-tool-'));
  made.push(root);
  mkdirSync(join(root, 'config', 'intake'), { recursive: true });
  mkdirSync(join(root, 'lib', 'i18n', 'dictionaries'), { recursive: true });
  cpSync(
    join(REPO_ROOT, 'config', 'intake', 'glossary.v1.json'),
    join(root, 'config', 'intake', 'glossary.v1.json')
  );
  for (const locale of LOCALES) {
    const rows = JSON.parse(
      readFileSync(
        join(REPO_ROOT, 'lib', 'i18n', 'dictionaries', `${locale}.json`),
        'utf8'
      )
    ) as Record<string, string>;
    const kept = Object.fromEntries(
      Object.entries(rows).filter(
        ([key]) => key.startsWith('intake.') || LABELS.includes(key)
      )
    );
    writeFileSync(
      join(root, 'lib', 'i18n', 'dictionaries', `${locale}.json`),
      JSON.stringify(kept, null, 2) + '\n'
    );
  }
  return root;
}

const glossaryPath = (root: string) =>
  join(root, 'config', 'intake', 'glossary.v1.json');
const readGlossary = (root: string): any =>
  JSON.parse(readFileSync(glossaryPath(root), 'utf8'));
const writeGlossary = (root: string, glossary: unknown) =>
  writeFileSync(glossaryPath(root), JSON.stringify(glossary, null, 2) + '\n');
const dictionaryPath = (root: string, locale: string) =>
  join(root, 'lib', 'i18n', 'dictionaries', `${locale}.json`);
const readDictionary = (root: string, locale: string): Record<string, string> =>
  JSON.parse(readFileSync(dictionaryPath(root, locale), 'utf8'));
const writeDictionary = (
  root: string,
  locale: string,
  rows: Record<string, string>
) =>
  writeFileSync(
    dictionaryPath(root, locale),
    JSON.stringify(rows, null, 2) + '\n'
  );
const approvalPath = (root: string, area: string) =>
  join(root, 'config', 'intake', 'review', area, 'approval.json');
const readApproval = (root: string, area: string): any =>
  JSON.parse(readFileSync(approvalPath(root, area), 'utf8'));
const writeApproval = (root: string, area: string, approval: unknown) =>
  writeFileSync(
    approvalPath(root, area),
    JSON.stringify(approval, null, 2) + '\n'
  );

function approve(
  root: string,
  area: string,
  by = 'A. Reader',
  on = '2026-10-11'
) {
  const approval = readApproval(root, area);
  writeApproval(root, area, {
    ...approval,
    status: 'APPROVED',
    approved_by: by,
    approved_on: on,
  });
}

/** A recorded tree is built once (the tool runs once) and copied for every test that wants one. */
let recordedBase: string | undefined;

function recorded(): string {
  if (recordedBase === undefined) {
    recordedBase = makeTree();
    const run = tool(['record'], recordedBase);
    expect(run.status).toBe(0);
  }
  const root = mkdtempSync(join(tmpdir(), 'glossary-tool-'));
  made.push(root);
  cpSync(recordedBase, root, { recursive: true });
  return root;
}

const statusesOf = (root: string, locale: string): string[] => [
  ...new Set(
    (readGlossary(root).terms as any[]).map(
      (t) => t.forms[locale].status as string
    )
  ),
];

// ---------------------------------------------------------------------------------------
// The committed files
// ---------------------------------------------------------------------------------------

describeTool('the committed review files', () => {
  it('are what a fresh run makes, and the rules hold: 20 areas, no problem', () => {
    const run = tool(['check']);
    expect(run.stderr).toBe('');
    expect(run.stdout).not.toMatch(/DIFFERENT/);
    expect(run.stdout).toMatch(
      /20 area\(s\), \d+ approved, \d+ pending approval, 0 problem\(s\)/
    );
    expect(run.status).toBe(0);
  });

  it('list the 20 areas: the English term list and the 19 locales', () => {
    const run = tool(['list']);
    expect(run.status).toBe(0);
    const lines = run.stdout.trim().split('\n');
    expect(lines).toHaveLength(20);
    expect(lines.map((l) => l.split(/\s+/)[0])).toEqual(AREAS);
    expect(lines[0]).toMatch(/73 terms/);
    expect(lines[1]).toMatch(/73 forms, 28 texts/);
  });

  it('have a folder with review.md and approval.json for each area, and an INDEX.md', () => {
    const base = join(REPO_ROOT, 'config', 'intake', 'review');
    expect(readdirSync(base).sort()).toEqual(['INDEX.md', ...AREAS].sort());
    for (const area of AREAS) {
      expect(readdirSync(join(base, area)).sort()).toEqual([
        'approval.json',
        'review.md',
      ]);
    }
  });

  it('are kept out of Prettier, which would change what the approvals hash', () => {
    const ignore = readFileSync(join(REPO_ROOT, '.prettierignore'), 'utf8');
    expect(ignore).toMatch(/^config\/intake\/glossary\.v1\.json\r?$/m);
    expect(ignore).toMatch(/^config\/intake\/review\/\*\*\r?$/m);
  });

  it('hold only approvals the gate would accept or PENDING ones, each with the SHA-256 of its content', () => {
    for (const area of AREAS) {
      const approval = readApproval(REPO_ROOT, area);
      expect(approval).toMatchObject({
        schema: 'glossary-approval/1',
        area,
      });
      expect(['PENDING', 'APPROVED']).toContain(approval.status);
      expect(approval.content_sha256).toMatch(/^[0-9a-f]{64}$/);
      if (approval.status === 'PENDING') {
        expect(approval.approved_by).toBeNull();
        expect(approval.approved_on).toBeNull();
      }
    }
  });

  it('show the English term list and the review tables a person signs', () => {
    const terms = readFileSync(
      join(REPO_ROOT, 'config', 'intake', 'review', 'terms', 'review.md'),
      'utf8'
    );
    expect(terms).toContain('**73 terms**');
    expect(terms).toContain('| 1 | `buy` | buy |');
    expect(terms).toContain('`uoedt`');
    const french = readFileSync(
      join(REPO_ROOT, 'config', 'intake', 'review', 'fr', 'review.md'),
      'utf8'
    );
    expect(french).toContain('| Canonical form |');
    expect(french).toContain('intake.refusal.out_of_scope');
    expect(french).toContain('The Panel C labels translated in part 3');
    const spanish = readFileSync(
      join(REPO_ROOT, 'config', 'intake', 'review', 'es', 'review.md'),
      'utf8'
    );
    expect(spanish).not.toContain('The Panel C labels translated in part 3');
  });

  // the release gate (the flags stay off until a native read, plan decision D14)
  it(
    REQUIRE_APPROVED
      ? 'RELEASE GATE: every area is approved'
      : 'gate: --require-approved passes exactly when no area is PENDING',
    () => {
      const pending = AREAS.filter(
        (area) => readApproval(REPO_ROOT, area).status !== 'APPROVED'
      );
      const run = tool(['check', '--require-approved']);
      if (REQUIRE_APPROVED) {
        expect({ pending, status: run.status }).toEqual({
          pending: [],
          status: 0,
        });
      } else {
        expect(run.status).toBe(pending.length > 0 ? 1 : 0);
      }
    }
  );
});

// ---------------------------------------------------------------------------------------
// record and the approval gate, on a scratch tree
// ---------------------------------------------------------------------------------------

describeTool('record and the approval gate', () => {
  it('record writes review.md and a PENDING approval.json for each area, and INDEX.md; a second run writes nothing', () => {
    const root = makeTree();
    const first = tool(['record'], root);
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/41 file\(s\) written/);
    for (const area of AREAS) {
      expect(readApproval(root, area)).toMatchObject({
        status: 'PENDING',
        approved_by: null,
        approved_on: null,
        note: '',
      });
      expect(
        existsSync(join(root, 'config', 'intake', 'review', area, 'review.md'))
      ).toBe(true);
    }
    expect(
      existsSync(join(root, 'config', 'intake', 'review', 'INDEX.md'))
    ).toBe(true);
    const second = tool(['record'], root);
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/nothing to write/);
  });

  it('check passes on what record wrote, and the gate refuses while 20 areas are PENDING', () => {
    const root = recorded();
    const run = tool(['check'], root);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(
      /20 area\(s\), 0 approved, 20 pending approval, 0 problem\(s\)/
    );
    const gate = tool(['check', '--require-approved'], root);
    expect(gate.status).toBe(1);
    expect(gate.stderr).toMatch(/20 area\(s\) are not approved yet/);
  });

  it('record never writes APPROVED: only a person does', () => {
    const root = recorded();
    for (const area of AREAS) {
      expect(readApproval(root, area).status).toBe('PENDING');
    }
    approve(root, 'es');
    approve(root, 'ja');
    // a second record keeps the two approvals that are still true and writes no third
    tool(['record'], root);
    expect(
      AREAS.filter((a) => readApproval(root, a).status === 'APPROVED')
    ).toEqual(['es', 'ja']);
  });

  it('counts an area approved the moment a person wrote APPROVED: no generated file goes stale', () => {
    const root = recorded();
    const generated = (): string[] =>
      ['INDEX.md', ...AREAS.map((area) => join(area, 'review.md'))].map(
        (name) =>
          readFileSync(join(root, 'config', 'intake', 'review', name), 'utf8')
      );
    const before = generated();
    approve(root, 'fr');
    // nothing a person did not write has to be written for the gate to see the signature
    expect(generated()).toEqual(before);
    const check = tool(['check'], root);
    expect(check.status).toBe(0);
    expect(check.stdout).toMatch(
      /1 approved, 19 pending approval, 0 problem\(s\)/
    );
    // the form statuses are the one stored copy: draft is the safe direction, so it is a note
    expect(check.stdout).toMatch(
      /note {2}fr: 73 form\(s\) are still draft though the area is approved/
    );
    expect(
      tool(['check', '--require-approved', '--only', 'fr'], root).status
    ).toBe(0);
    expect(tool(['list'], root).stdout).toMatch(/^fr {5}\[APPROVED\]/m);
  });

  it('marks the forms of an approved area approved when record runs, and no other', () => {
    const root = recorded();
    approve(root, 'fr');
    const run = tool(['record'], root);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/wrote {2}config\/intake\/glossary\.v1\.json/);
    expect(run.stdout).not.toMatch(/review\.md|INDEX\.md/);
    expect(statusesOf(root, 'fr')).toEqual(['approved']);
    expect(statusesOf(root, 'es')).toEqual(['draft']);
    expect(statusesOf(root, 'en-US')).toEqual(['draft']);
    const after = tool(['check'], root);
    expect(after.status).toBe(0);
    expect(after.stdout).not.toMatch(/note /);
    expect(after.stdout).toMatch(/1 approved, 19 pending approval/);
    expect(parseGlossary(readGlossary(root)).ok).toBe(true);
  });

  it('lists no approval status in a generated file', () => {
    const root = recorded();
    for (const area of AREAS) approve(root, area);
    tool(['record'], root);
    const base = join(root, 'config', 'intake', 'review');
    const files = [
      join(base, 'INDEX.md'),
      ...AREAS.map((area) => join(base, area, 'review.md')),
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/\|\s*(APPROVED|PENDING)\s*\|/);
      expect(text).not.toMatch(/A\. Reader/);
    }
  });

  it('refuses a form that claims an approval nobody gave', () => {
    const root = recorded();
    const glossary = readGlossary(root);
    for (const term of glossary.terms.slice(0, 3))
      term.forms.de.status = 'approved';
    writeGlossary(root, glossary);
    const run = tool(['check'], root);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /DIFFERENT {2}de: 3 form\(s\) are marked approved but the area de is not approved/
    );
    // record puts the statuses right
    tool(['record'], root);
    expect(statusesOf(root, 'de')).toEqual(['draft']);
    expect(tool(['check'], root).status).toBe(0);
  });

  it('keeps the hash an approval holds when the status flips: the status is not part of what is read', () => {
    const root = recorded();
    const hash = readApproval(root, 'de').content_sha256;
    approve(root, 'de');
    tool(['record'], root);
    expect(readApproval(root, 'de').content_sha256).toBe(hash);
    expect(readApproval(root, 'de').status).toBe('APPROVED');
  });

  it('opens the gate only when all 20 areas are approved; --only checks the areas named', () => {
    const root = recorded();
    for (const area of AREAS) approve(root, area);
    // the signatures alone open the gate: nothing generated has to be written first
    const early = tool(['check', '--require-approved'], root);
    expect(early.status).toBe(0);
    expect(early.stdout).toMatch(
      /20 area\(s\), 20 approved, 0 pending approval, 0 problem\(s\)/
    );
    expect(tool(['record'], root).status).toBe(0);
    const gate = tool(['check', '--require-approved'], root);
    expect(gate.status).toBe(0);
    expect(gate.stdout).toMatch(
      /20 area\(s\), 20 approved, 0 pending approval, 0 problem\(s\)/
    );
    expect(gate.stdout).not.toMatch(/note /);
    for (const locale of LOCALES)
      expect(statusesOf(root, locale)).toEqual(['approved']);

    const half = recorded();
    approve(half, 'ja');
    tool(['record'], half);
    expect(
      tool(['check', '--require-approved', '--only', 'ja'], half).status
    ).toBe(0);
    expect(
      tool(['check', '--require-approved', '--only', 'ja', 'ko'], half).status
    ).toBe(1);
    expect(tool(['check', '--require-approved'], half).status).toBe(1);
  });

  it('puts an area back to PENDING when its content changes after approval, and says so', () => {
    const root = recorded();
    approve(root, 'fr', 'B. Reader', '2026-10-12');
    tool(['record'], root);
    expect(statusesOf(root, 'fr')).toEqual(['approved']);

    const glossary = readGlossary(root);
    glossary.terms[0].forms.fr.canonical = 'acquérir';
    writeGlossary(root, glossary);

    const stale = tool(['check'], root);
    expect(stale.status).toBe(1);
    expect(stale.stdout).toMatch(/DIFFERENT {2}fr {2}\(PENDING\)/);
    expect(stale.stdout).toMatch(
      /content_sha256 is not the hash of the content \(changed after approval\)/
    );

    const reset = tool(['record'], root);
    expect(reset.status).toBe(0);
    const approval = readApproval(root, 'fr');
    expect(approval.status).toBe('PENDING');
    expect(approval.approved_by).toBeNull();
    expect(approval.note).toMatch(
      /Reset by record: the content changed after B\. Reader approved it on 2026-10-12/
    );
    expect(statusesOf(root, 'fr')).toEqual(['draft']);
    expect(tool(['check'], root).status).toBe(0);
  });

  it('puts an area back to PENDING when one of its texts changes after approval', () => {
    const root = recorded();
    approve(root, 'ja');
    tool(['record'], root);
    const rows = readDictionary(root, 'ja');
    rows['intake.instant.m5'] = '現在のM5チャートを解説してください';
    writeDictionary(root, 'ja', rows);
    const stale = tool(['check'], root);
    expect(stale.stdout).toMatch(/changed after approval/);
    tool(['record'], root);
    expect(readApproval(root, 'ja').status).toBe('PENDING');
  });

  it('does not touch the approval of an area whose content did not change, whatever else changed', () => {
    const root = recorded();
    approve(root, 'de');
    approve(root, 'fr');
    tool(['record'], root);
    const glossary = readGlossary(root);
    glossary.terms[0].forms.fr.canonical = 'acquérir';
    writeGlossary(root, glossary);
    tool(['record'], root);
    expect(readApproval(root, 'de').status).toBe('APPROVED');
    expect(readApproval(root, 'fr').status).toBe('PENDING');
    expect(statusesOf(root, 'de')).toEqual(['approved']);
  });

  it('puts the term list back to PENDING when a definition changes, and leaves every locale area as it was', () => {
    const root = recorded();
    approve(root, 'terms');
    approve(root, 'tr');
    tool(['record'], root);
    const glossary = readGlossary(root);
    glossary.terms[3].definition = 'A different sentence.';
    writeGlossary(root, glossary);
    tool(['record'], root);
    expect(readApproval(root, 'terms').status).toBe('PENDING');
    expect(readApproval(root, 'tr').status).toBe('APPROVED');
  });

  it('refuses an approval that has been tampered with', () => {
    const cases: [string, (a: any) => void, RegExp][] = [
      ['an unknown key', (a) => (a.extra = 1), /unknown key 'extra'/],
      ['a missing key', (a) => delete a.note, /missing key 'note'/],
      ['another area', (a) => (a.area = 'de'), /area is 'de', not 'es'/],
      ['another schema', (a) => (a.schema = 'x/1'), /schema must be/],
      [
        'a status of its own',
        (a) => (a.status = 'DONE'),
        /status must be PENDING or APPROVED/,
      ],
      ['a hash of nothing', (a) => (a.content_sha256 = 'abc'), /not a SHA-256/],
      [
        'another hash',
        (a) => (a.content_sha256 = 'a'.repeat(64)),
        /not the hash of the content/,
      ],
      [
        'no name',
        (a) => ((a.status = 'APPROVED'), (a.approved_on = '2026-10-11')),
        /APPROVED needs approved_by/,
      ],
      [
        'a blank name',
        (a) => (
          (a.status = 'APPROVED'),
          (a.approved_by = '  '),
          (a.approved_on = '2026-10-11')
        ),
        /APPROVED needs approved_by/,
      ],
      [
        'no date',
        (a) => ((a.status = 'APPROVED'), (a.approved_by = 'X')),
        /APPROVED needs approved_on/,
      ],
      [
        'a date that is not one',
        (a) => (
          (a.status = 'APPROVED'),
          (a.approved_by = 'X'),
          (a.approved_on = '11/10/2026')
        ),
        /APPROVED needs approved_on as YYYY-MM-DD/,
      ],
    ];
    for (const [name, change, message] of cases) {
      const root = recorded();
      const approval = readApproval(root, 'es');
      change(approval);
      writeApproval(root, 'es', approval);
      const run = tool(['check'], root);
      expect({ name, status: run.status }).toEqual({ name, status: 1 });
      expect({ name, found: message.test(run.stdout) }).toEqual({
        name,
        found: true,
      });
      // a tampered APPROVED never counts as approved
      expect(run.stdout).toMatch(/DIFFERENT {2}es {2}\(PENDING\)/);
    }
  });

  it('refuses an approval.json that is not JSON or is missing, and a review.md that was edited', () => {
    const root = recorded();
    writeFileSync(approvalPath(root, 'it'), '{ not json');
    expect(tool(['check'], root).stdout).toMatch(
      /approval\.json is not valid JSON/
    );
    rmSync(approvalPath(root, 'it'));
    expect(tool(['check'], root).stdout).toMatch(
      /approval\.json is missing \(run record\)/
    );
    tool(['record'], root);
    const review = join(root, 'config', 'intake', 'review', 'it', 'review.md');
    writeFileSync(
      review,
      readFileSync(review, 'utf8').replace('Glossary version', 'Edited version')
    );
    const run = tool(['check'], root);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/review\.md differs from a fresh run: line \d+/);
    tool(['record'], root);
    expect(tool(['check'], root).status).toBe(0);
  });

  it('exits 2 for an unusable file or request', () => {
    const root = recorded();
    expect(tool(['check', '--only', 'xx'], root).status).toBe(2);
    expect(tool(['check', '--only', 'xx'], root).stderr).toMatch(
      /no such area: xx/
    );
    writeFileSync(glossaryPath(root), '[1, 2');
    const bad = tool(['check'], root);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/is not valid JSON/);
    rmSync(glossaryPath(root));
    expect(tool(['list'], root).status).toBe(2);
    expect(tool(['record'], root).stderr).toMatch(
      /glossary\.v1\.json is missing/
    );
    const empty = mkdtempSync(join(tmpdir(), 'glossary-tool-empty-'));
    made.push(empty);
    expect(tool(['check'], empty).status).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------

describeTool('the rules of check', () => {
  const broken = (
    change: (
      glossary: any,
      rows: (locale: string) => Record<string, string>,
      save: (locale: string, rows: Record<string, string>) => void
    ) => void
  ): { status: number | null; out: string } => {
    const root = recorded();
    const glossary = readGlossary(root);
    const loaded: Record<string, Record<string, string>> = {};
    change(
      glossary,
      (locale) => (loaded[locale] ??= readDictionary(root, locale)),
      (locale, rows) => (loaded[locale] = rows)
    );
    writeGlossary(root, glossary);
    for (const [locale, rows] of Object.entries(loaded))
      writeDictionary(root, locale, rows);
    const run = tool(['check'], root);
    return { status: run.status, out: run.stdout };
  };

  it('finds nothing but the layout when the glossary is only rewritten (the baseline of the cases below)', () => {
    const result = broken(() => undefined);
    expect(result.status).toBe(1);
    expect(result.out).toMatch(
      /20 area\(s\), 0 approved, 20 pending approval, 1 problem\(s\)/
    );
    expect(result.out).toMatch(
      /glossary\.v1\.json is not in the layout record writes/
    );
  });

  it.each<[string, (g: any) => void, RegExp]>([
    [
      'a locale left out of a term',
      (g) => delete g.terms[0].forms.fr,
      /buy: no form for fr/,
    ],
    [
      'a form for a locale that does not exist',
      (g) => (g.terms[0].forms.xx = g.terms[0].forms.es),
      /buy: 'xx' is not a locale/,
    ],
    ['a duplicate id', (g) => (g.terms[1].id = 'buy'), /the id appears twice/],
    ['a bad id', (g) => (g.terms[1].id = 'Sell'), /id 'Sell' is not a term id/],
    [
      'the English form of another term',
      (g) => (g.terms[1].en = 'buy'),
      /en is the English form of buy/,
    ],
    [
      'too many terms',
      (g) => (g.terms = Array.from({ length: 401 }, () => g.terms[0])),
      /terms must be a list of 1 to 400/,
    ],
    [
      'no owner',
      (g) => (g.terms[0].owners = []),
      /owners must be 1 to 4 distinct/,
    ],
    [
      'an owner that is neither a sensor nor a domain',
      (g) => (g.terms[0].owners = ['MCD16']),
      /owners must be 1 to 4 distinct/,
    ],
    [
      'a definition that is empty',
      (g) => (g.terms[0].definition = ''),
      /definition must be a text/,
    ],
    [
      'a definition that is too long',
      (g) => (g.terms[0].definition = 'x'.repeat(301)),
      /definition must be a text of at most 300/,
    ],
    [
      'a status of its own',
      (g) => (g.terms[0].forms.fr.status = 'done'),
      /status must be draft or approved/,
    ],
    [
      'an extra key in a form',
      (g) => (g.terms[0].forms.fr.extra = 1),
      /a form is exactly canonical, variants and status/,
    ],
    [
      'a spelling that is one character',
      (g) => (g.terms[0].forms.fr.variants = ['x']),
      /must have 2 to 80 characters once normalised/,
    ],
    [
      'too many variants',
      (g) =>
        (g.terms[0].forms.fr.variants = Array.from(
          { length: 13 },
          (_, i) => `forme ${i}`
        )),
      /variants must be at most 12/,
    ],
    [
      'a spelling written twice for a term',
      (g) => (g.terms[0].forms.fr.variants = ['ACHETER']),
      /written twice for this term/,
    ],
    [
      'a spelling another term has',
      (g) => (g.terms[1].forms.fr.variants = ['acheter']),
      /already a form of buy in this locale/,
    ],
    [
      'a Chinese form in Latin letters',
      (g) => (g.terms[0].forms.zh.canonical = 'maiRu'),
      /not written in the script of this language/,
    ],
    [
      'a Thai form in Latin letters',
      (g) => (g.terms[0].forms.th.canonical = 'buy'),
      /not written in the script of this language/,
    ],
    [
      'a French form in Han characters',
      (g) => (g.terms[0].forms.fr.canonical = '買入'),
      /not written in the script of this language/,
    ],
    [
      'a never-translated term that is translated',
      (g) =>
        (g.terms.find((t: any) => t.id === 'uoedt').forms.fr.canonical =
          'UOEDT-fr'),
      /never translated is its English form/,
    ],
    [
      'a never-translated term with a variant',
      (g) =>
        (g.terms.find((t: any) => t.id === 'uoedt').forms.fr.variants = [
          'uoedt line',
        ]),
      /never translated is its English form/,
    ],
  ])('refuses %s', (_name, change, message) => {
    const result = broken((g) => change(g));
    expect(result.status).toBe(1);
    expect(result.out).toMatch(message);
  });

  it.each<[string, (rows: Record<string, string>) => void, RegExp]>([
    [
      'a text that lost its placeholder',
      (r) => (r['intake.refusal.question_too_long'] = 'Zu lang.'),
      /de: intake\.refusal\.question_too_long has the placeholders \[\], not \['limit'\]/,
    ],
    [
      'a text with a placeholder of its own',
      (r) => (r['intake.refusal.out_of_scope'] += ' {x}'),
      /intake\.refusal\.out_of_scope has the placeholders \['x'\], not \[\]/,
    ],
    [
      'a missing text',
      (r) => delete r['intake.instant.m5'],
      /de: intake\.instant\.m5 is missing or empty/,
    ],
    [
      'an empty text',
      (r) => (r['intake.instant.m5'] = ' '),
      /de: intake\.instant\.m5 is missing or empty/,
    ],
    [
      'a text with spaces round it',
      (r) => (r['intake.instant.m5'] += ' '),
      /de: intake\.instant\.m5 has spaces around it/,
    ],
    [
      'a text no registry has',
      (r) => (r['intake.extra.thing'] = 'Etwas'),
      /de: intake\.extra\.thing is not a key of en-US/,
    ],
  ])('refuses %s in a dictionary', (_name, change, message) => {
    const result = broken((_g, rows, save) => {
      const de = rows('de');
      change(de);
      save('de', de);
    });
    expect(result.status).toBe(1);
    expect(result.out).toMatch(message);
  });

  it('refuses a Panel C label that is still the English in a locale part 3 translated', () => {
    const result = broken((_g, rows, save) => {
      const ar = rows('ar');
      ar['Ask AI about M5 Chart'] = 'Ask AI about M5 Chart';
      save('ar', ar);
    });
    expect(result.status).toBe(1);
    expect(result.out).toMatch(
      /ar: Ask AI about M5 Chart is still the English/
    );
  });

  it('refuses a Panel C label that is missing in a locale part 3 translated', () => {
    const result = broken((_g, rows, save) => {
      const fr = rows('fr');
      delete fr['Ask AI about M15 Chart'];
      save('fr', fr);
    });
    expect(result.out).toMatch(
      /fr: Ask AI about M15 Chart is missing or empty/
    );
  });

  it('holds the glossary to its one layout: a reformatted file is a difference', () => {
    const root = recorded();
    writeGlossary(root, readGlossary(root)); // the same data, written by JSON.stringify
    const run = tool(['check'], root);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /glossary\.v1\.json is not in the layout record writes/
    );
    tool(['record'], root);
    expect(tool(['check'], root).status).toBe(0);
  });
});
