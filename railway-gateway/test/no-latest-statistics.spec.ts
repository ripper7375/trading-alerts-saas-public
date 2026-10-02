import * as fs from 'fs';
import * as path from 'path';
import {
  blankComments,
  languageOf,
  scanRoots,
  scanText,
} from './helpers/latest-statistics-scan';

/**
 * Rule 5 as a guard (STACK-D-ARCHITECTURE.md section 1.4 item 5): "No
 * `ORDER BY captured_at DESC LIMIT 1` without a slot match anywhere in Stack D."
 *
 * The reader (getStatisticsAtSlot) cannot fall back to "latest available", and
 * these tests keep the REST of Stack D from doing it: they scan the code for a
 * read of indicator_statistics that asks for the newest row without pinning
 * `captured_at` to one value. The scanner is itself tested on bad and good
 * snippets first, because a guard that matches nothing passes forever.
 */

const REPO = path.join(__dirname, '..', '..');

describe('the scanner flags a "latest available" read', () => {
  const bad: Array<[string, string, string]> = [
    [
      'findFirst, newest by captured_at (the textbook case)',
      'a.ts',
      `await prisma.indicatorStatistic.findFirst({
         where: { symbol: 'XAUUSD', timeframe: 'M5', source: 'best_fit_a' },
         orderBy: { captured_at: 'desc' },
       });`,
    ],
    [
      'findMany with distinct (newest per group: the existing monolith pattern)',
      'a.ts',
      `prisma.indicatorStatistic.findMany({
         orderBy: [{ symbol: 'asc' }, { captured_at: 'desc' }],
         distinct: ['symbol', 'timeframe', 'source'],
       })`,
    ],
    [
      'newest by another column is the same bug (createdAt)',
      'a.ts',
      `marketPrisma.indicatorStatistic.findFirst({ orderBy: { createdAt: 'desc' } })`,
    ],
    [
      'a range on captured_at is still "latest available as of the slot"',
      'a.ts',
      `prisma.indicatorStatistic.findFirst({
         where: { captured_at: { lte: slot } },
         orderBy: { captured_at: 'desc' },
       })`,
    ],
    [
      'findFirstOrThrow too',
      'a.ts',
      `prisma.indicatorStatistic.findFirstOrThrow({ orderBy: { captured_at: "desc" } })`,
    ],
    [
      'raw SQL, ORDER BY captured_at DESC LIMIT 1',
      'a.ts',
      'await prisma.$queryRaw`SELECT * FROM indicator_statistics WHERE symbol = ${s} AND source = ${src} ORDER BY captured_at DESC LIMIT 1`',
    ],
    [
      'raw SQL with a range on captured_at',
      'a.ts',
      "const q = 'SELECT * FROM indicator_statistics WHERE captured_at <= $1 ORDER BY captured_at DESC LIMIT 1'",
    ],
    [
      'raw SQL, DISTINCT ON',
      'a.ts',
      'prisma.$queryRawUnsafe(`SELECT DISTINCT ON (source) * FROM indicator_statistics ORDER BY source, captured_at DESC`)',
    ],
    [
      'raw SQL, DISTINCT ON alone (no DESC to give it away)',
      'a.ts',
      'prisma.$queryRawUnsafe(`SELECT DISTINCT ON (source) * FROM indicator_statistics ORDER BY source`)',
    ],
    [
      'Prisma distinct alone (no descending order to give it away)',
      'a.ts',
      `prisma.indicatorStatistic.findMany({ where: { symbol: 'XAUUSD' }, distinct: ['symbol', 'timeframe', 'source'] })`,
    ],
    [
      'raw SQL, MAX(captured_at)',
      'a.ts',
      'sql`SELECT * FROM indicator_statistics WHERE captured_at = (SELECT MAX(captured_at) FROM indicator_statistics)`',
    ],
    [
      'SQL in a Python string',
      'a.py',
      'cur.execute("SELECT * FROM indicator_statistics ORDER BY captured_at DESC LIMIT 1")',
    ],
    [
      'SQL in a triple-quoted Python string',
      'a.py',
      'rows = db.query("""\n  SELECT *\n  FROM indicator_statistics\n  ORDER BY captured_at DESC\n  LIMIT 1\n""")',
    ],
    [
      'a .sql file',
      'a.sql',
      "SELECT * FROM indicator_statistics WHERE source = 'non_b' ORDER BY captured_at DESC LIMIT 1;",
    ],
  ];

  it.each(bad)('%s', (_label, file, source) => {
    const found = scanText(file, source);
    expect(found).toHaveLength(1);
    expect(found[0].line).toBeGreaterThan(0);
  });

  it('reports the line of the call, not of the file', () => {
    const source = `const a = 1;\nconst b = 2;\nawait prisma.indicatorStatistic.findFirst({ orderBy: { captured_at: 'desc' } });\n`;
    expect(scanText('a.ts', source)[0].line).toBe(3);
  });
});

describe('the scanner lets an exact read through', () => {
  const good: Array<[string, string, string]> = [
    [
      'findUnique on the full key (exact by construction)',
      'a.ts',
      `prisma.indicatorStatistic.findUnique({ where: { symbol_timeframe_source_captured_at: { symbol, timeframe, source, captured_at: slot } } })`,
    ],
    [
      'findMany pinned to one captured_at, ordered by something else',
      'a.ts',
      `prisma.indicatorStatistic.findMany({
         where: { symbol: 'XAUUSD', timeframe: 'M5', captured_at: slot },
         orderBy: { source: 'asc' },
       })`,
    ],
    [
      'findMany pinned with equals, even ordered descending',
      'a.ts',
      `prisma.indicatorStatistic.findMany({ where: { captured_at: { equals: slot } }, orderBy: { containment_rate: 'desc' } })`,
    ],
    [
      'findFirst pinned to the slot, no ordering',
      'a.ts',
      `prisma.indicatorStatistic.findFirst({ where: { source, captured_at: slot } })`,
    ],
    [
      'oldest first is a drain, not "latest"',
      'a.ts',
      `prisma.indicatorStatistic.findMany({ orderBy: { captured_at: 'asc' }, take: 100 })`,
    ],
    [
      'the writes the gateway makes',
      'a.ts',
      `prisma.indicatorStatistic.create({ data }); prisma.indicatorStatistic.count({ where: { captured_at: slot } });`,
    ],
    [
      'SQL pinned to one captured_at',
      'a.ts',
      'prisma.$queryRaw`SELECT * FROM indicator_statistics WHERE captured_at = ${slot} ORDER BY source`',
    ],
    [
      'the sender-side outbox drain, oldest first (Stack C SQL)',
      'a.py',
      'conn.execute("SELECT * FROM indicator_statistics WHERE synced_at IS NULL ORDER BY captured_at ASC LIMIT 100")',
    ],
    [
      'SQL about another table',
      'a.ts',
      'prisma.$queryRaw`SELECT * FROM economic_events ORDER BY captured_at DESC LIMIT 1`',
    ],
    [
      'another model with the same column',
      'a.ts',
      `prisma.economicEvent.findMany({ orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }], distinct: ['value_id'] })`,
    ],
    [
      'a migration that creates the table',
      'a.sql',
      'CREATE TABLE "indicator_statistics" (id TEXT, captured_at INTEGER); CREATE INDEX ON indicator_statistics (captured_at DESC)',
    ],
  ];

  it.each(good)('%s', (_label, file, source) => {
    expect(scanText(file, source)).toEqual([]);
  });

  it('text in comments is not code: the rule can be quoted without tripping itself', () => {
    const source = `// never: prisma.indicatorStatistic.findFirst({ orderBy: { captured_at: 'desc' } })
/* ORDER BY captured_at DESC LIMIT 1 on indicator_statistics */
const x = 1;`;
    expect(scanText('a.ts', source)).toEqual([]);
    // a quoted statement inside a # comment is a comment, not code (the same text in code is flagged above)
    expect(
      scanText(
        'a.py',
        'x = 1  # was: cur.execute("SELECT * FROM indicator_statistics ORDER BY captured_at DESC LIMIT 1")\n'
      )
    ).toEqual([]);
    expect(
      scanText(
        'a.py',
        '# SELECT * FROM indicator_statistics ORDER BY captured_at DESC LIMIT 1\nx = 1\n'
      )
    ).toEqual([]);
    expect(
      scanText(
        'a.sql',
        '-- SELECT * FROM indicator_statistics ORDER BY captured_at DESC LIMIT 1\nSELECT 1;'
      )
    ).toEqual([]);
  });

  it('a comment marker inside a string is not a comment', () => {
    const source = `const q = "http://x"; prisma.indicatorStatistic.findFirst({ orderBy: { captured_at: 'desc' } });`;
    expect(scanText('a.ts', source)).toHaveLength(1);
  });

  it('keeps offsets: blanking comments never moves a line', () => {
    const text = `a // c\n/* x\ny */ b\n`;
    const blanked = blankComments(text, 'ts');
    expect(blanked).toHaveLength(text.length);
    expect(blanked.split('\n')).toHaveLength(text.split('\n').length);
  });

  it('only scans the languages it understands', () => {
    expect(languageOf('a.ts')).toBe('ts');
    expect(languageOf('a.tsx')).toBe('ts');
    expect(languageOf('a.py')).toBe('py');
    expect(languageOf('a.sql')).toBe('sql');
    expect(languageOf('a.md')).toBeNull();
    expect(
      scanText(
        'a.md',
        'SELECT * FROM indicator_statistics ORDER BY captured_at DESC'
      )
    ).toEqual([]);
  });
});

/**
 * Where Stack D code lives: the gateway (readers now, the sensor worker next), the MCD
 * kit and evaluators, and the monolith's `lib`, `app`, `components` and `hooks`, which
 * Section 5 will read through. `legacy/` archives of superseded evaluators are skipped
 * by the scanner (the retrofitted evaluators replaced them).
 */
const STACK_D_ROOTS = [
  'railway-gateway/src',
  'davintrade-stack-d-and-e/engine-1-5-new',
  'lib',
  'app',
  'components',
  'hooks',
  'src',
] as const;

/**
 * Known offenders that exist TODAY and are reported, not fixed (the build step 2
 * plan: "checked against the same rule and reported, not changed"). Each entry is
 * one file and one reason. The test below fails when an entry stops being true, so
 * the list can only shrink: fix the file, delete the entry.
 */
const KNOWN_LEGACY: ReadonlyArray<{ file: string; rule: string; why: string }> =
  [
    {
      file: 'lib/indicator-statistics/queries.ts',
      rule: 'PRISMA_LATEST',
      why:
        'getLatestContainmentRates() returns the newest containment rate per (symbol, timeframe, source) with `distinct` ' +
        'and `captured_at desc`, for the existing market-sessions UI strip. It is the "latest available" read rule 5 bans ' +
        'for sensors and prompts. Not a Stack D input today; Section 5 must read statistics through getStatisticsAtSlot ' +
        'instead (build step 5).',
    },
  ];

describe('Stack D code has no "latest available" statistics read', () => {
  const scan = scanRoots(REPO, STACK_D_ROOTS);

  it('actually scans the code (a guard that finds no files passes forever)', () => {
    expect(scan.scanned.length).toBeGreaterThan(200);
    expect(scan.scanned).toContain(
      'railway-gateway/src/cycle/read/cycle-reader.service.ts'
    );
    expect(scan.scanned).toContain(
      'railway-gateway/src/worker/indicator-statistics.processor.ts'
    );
    expect(scan.scanned).toContain('lib/indicator-statistics/queries.ts');
    expect(
      scan.scanned.some((f) =>
        f.startsWith('davintrade-stack-d-and-e/engine-1-5-new/mcd_common/')
      )
    ).toBe(true);
    expect(scan.scanned.some((f) => f.includes('/legacy/'))).toBe(false);
  });

  it('has no offender outside the known legacy list', () => {
    const known = new Set(KNOWN_LEGACY.map((k) => k.file));
    const unexpected = scan.violations.filter((v) => !known.has(v.file));
    expect(unexpected).toEqual([]);
  });

  it('every known legacy entry is still an offender (fix the file, then delete the entry)', () => {
    for (const entry of KNOWN_LEGACY) {
      const hits = scan.violations.filter((v) => v.file === entry.file);
      expect(hits.map((h) => h.rule)).toContain(entry.rule);
      expect(entry.why.length).toBeGreaterThan(40);
    }
  });

  it('the legacy file is still the only one: no new "latest" read joined it', () => {
    expect(scan.violations.map((v) => v.file)).toEqual(
      KNOWN_LEGACY.map((k) => k.file)
    );
  });
});

describe('the read side itself', () => {
  const readDir = path.join(REPO, 'railway-gateway', 'src', 'cycle', 'read');
  const files = fs.readdirSync(readDir).filter((f) => f.endsWith('.ts'));
  const code = (f: string) =>
    blankComments(fs.readFileSync(path.join(readDir, f), 'utf8'), 'ts');

  it('reads statistics ONLY by the full unique key: findUnique and nothing else', () => {
    const used: string[] = [];
    for (const f of files) {
      for (const m of code(f).matchAll(/\bindicatorStatistic\s*\.\s*(\w+)/g))
        used.push(m[1]);
    }
    expect(used).toEqual(['findUnique']);
  });

  it('never orders statistics, takes the first of many, or asks for a distinct', () => {
    const source = files.map(code).join('\n');
    // the only `orderBy` in the read side is on market_cycles (the newest READY cycle)
    // and on market_data_v6 (the closed-bar window)
    for (const f of files) {
      const text = code(f);
      for (const m of text.matchAll(/\bindicatorStatistic\b/g)) {
        const around = text.slice(m.index, m.index! + 400);
        expect(around).not.toMatch(/\b(orderBy|distinct|take)\s*:/);
      }
    }
    // (not the compound key `symbol_timeframe_source_captured_at: {`)
    expect(source).not.toMatch(/(?<![\w])captured_at\s*:\s*\{/);
  });

  it('every market_cycles read in it is findFirst or findMany with state READY (findUnique cannot say READY)', () => {
    let calls = 0;
    for (const f of files) {
      const text = code(f);
      for (const m of text.matchAll(/\bmarketCycle\s*\.\s*(\w+)\s*\(/g)) {
        calls += 1;
        expect(['findFirst', 'findMany']).toContain(m[1]);
        const open = m.index! + m[0].length - 1;
        let depth = 0;
        let end = open;
        for (; end < text.length; end += 1) {
          if (text[end] === '(') depth += 1;
          if (text[end] === ')' && --depth === 0) break;
        }
        expect(text.slice(open, end)).toMatch(/\bstate\s*:\s*'READY'/);
      }
    }
    expect(calls).toBeGreaterThanOrEqual(2); // the by-slot lookup and the newest-READY lookup
  });

  it('writes nothing: the read side never creates, updates or deletes', () => {
    for (const f of files) {
      expect(code(f)).not.toMatch(
        /\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/
      );
    }
  });
});
