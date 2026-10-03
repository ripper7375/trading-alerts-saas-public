import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  READ_METHODS,
  READER,
  WRITE_METHODS,
  WRITER,
  modelUses,
  scanRoots,
  scanText,
} from './helpers/state-statistics-scan';

/**
 * ADR-022 and section 2.8 as a guard (build step 3 part 6): "a number reaches a prompt only from this
 * table and always with its n". Only `state-statistics.reader.ts` reads `state_statistics`, and only
 * `state-statistics.writer.ts` writes it. The scanner is tried on bad and good snippets first, because
 * a guard that matches nothing passes forever; then it is run over the code of Stack D and the apps
 * that share the database.
 */

const REPO = path.join(__dirname, '..', '..');

describe('the scanner flags code that touches the table outside its two owners', () => {
  const bad: Array<[string, string, string, string]> = [
    [
      'findMany',
      'a.ts',
      'await prisma.stateStatistic.findMany({ where: { n: { gte: 30 } } });',
      'MODEL_ACCESS',
    ],
    [
      'findUnique',
      'a.ts',
      'prisma.stateStatistic.findUnique({ where: { id } })',
      'MODEL_ACCESS',
    ],
    [
      'findFirst',
      'a.ts',
      'this.prisma.stateStatistic.findFirst({})',
      'MODEL_ACCESS',
    ],
    [
      'findFirstOrThrow',
      'a.ts',
      'prisma.stateStatistic.findFirstOrThrow({})',
      'MODEL_ACCESS',
    ],
    [
      'count',
      'a.ts',
      'const n = await prisma.stateStatistic.count();',
      'MODEL_ACCESS',
    ],
    [
      'aggregate',
      'a.ts',
      'prisma.stateStatistic.aggregate({ _avg: { n: true } })',
      'MODEL_ACCESS',
    ],
    [
      'groupBy',
      'a.ts',
      'prisma.stateStatistic.groupBy({ by: ["mcd_id"] })',
      'MODEL_ACCESS',
    ],
    [
      "a write is not the writer's either",
      'a.ts',
      'prisma.stateStatistic.upsert({ where, create, update })',
      'MODEL_ACCESS',
    ],
    [
      'createMany',
      'a.ts',
      'await prisma.stateStatistic.createMany({ data })',
      'MODEL_ACCESS',
    ],
    [
      'deleteMany',
      'a.ts',
      'await prisma.stateStatistic.deleteMany()',
      'MODEL_ACCESS',
    ],
    [
      'an alias hides the read from the next line',
      'a.ts',
      'const table = prisma.stateStatistic;\nawait table.findMany();',
      'MODEL_ACCESS',
    ],
    [
      'a destructuring',
      'a.ts',
      'const { stateStatistic } = prisma;',
      'MODEL_ACCESS',
    ],
    [
      'a bracket access',
      'a.ts',
      "prisma['stateStatistic'].findMany()",
      'MODEL_ACCESS',
    ],
    [
      'inside a transaction array',
      'a.ts',
      'prisma.$transaction([prisma.stateStatistic.findMany()])',
      'MODEL_ACCESS',
    ],
    [
      'in a JavaScript file',
      'a.js',
      'prisma.stateStatistic.findMany()',
      'MODEL_ACCESS',
    ],
    [
      'in a .tsx file',
      'a.tsx',
      'const rows = await marketPrisma.stateStatistic.findMany();',
      'MODEL_ACCESS',
    ],
    [
      'raw SQL, SELECT',
      'a.ts',
      'await prisma.$queryRaw`SELECT * FROM state_statistics WHERE n >= 30`',
      'SQL_READ',
    ],
    [
      'raw SQL, quoted table',
      'a.ts',
      'prisma.$queryRawUnsafe(\'SELECT n FROM "state_statistics"\')',
      'SQL_READ',
    ],
    [
      'raw SQL, a join',
      'a.ts',
      'sql`SELECT o.* FROM mcd_outputs o JOIN state_statistics s ON s.mcd_id = o.mcd_id`',
      'SQL_READ',
    ],
    [
      'raw SQL, a subselect',
      'a.ts',
      'sql`SELECT 1 WHERE EXISTS (SELECT 1 FROM state_statistics)`',
      'SQL_READ',
    ],
    [
      'raw SQL, a CTE',
      'a.ts',
      'sql`WITH s AS (SELECT * FROM state_statistics) SELECT * FROM s`',
      'SQL_READ',
    ],
    [
      'raw SQL, copying out of it',
      'a.ts',
      'sql`INSERT INTO elsewhere SELECT * FROM state_statistics`',
      'SQL_READ',
    ],
    [
      'raw SQL, EXPLAIN',
      'a.ts',
      'sql`EXPLAIN SELECT * FROM state_statistics`',
      'SQL_READ',
    ],
    [
      'SQL in a Python string',
      'a.py',
      'cur.execute("SELECT n FROM state_statistics")',
      'SQL_READ',
    ],
    [
      'SQL in a triple-quoted Python string',
      'a.py',
      'rows = db.query("""\n  SELECT *\n  FROM state_statistics\n""")',
      'SQL_READ',
    ],
    ['a .sql file', 'a.sql', 'SELECT * FROM state_statistics;', 'SQL_READ'],
    [
      'raw SQL, INSERT',
      'a.ts',
      'sql`INSERT INTO state_statistics (id, n) VALUES (1, 2)`',
      'SQL_WRITE',
    ],
    [
      'raw SQL, UPDATE',
      'a.ts',
      'sql`UPDATE state_statistics SET n = 99`',
      'SQL_WRITE',
    ],
    [
      'raw SQL, DELETE',
      'a.ts',
      'sql`DELETE FROM state_statistics`',
      'SQL_WRITE',
    ],
    [
      'raw SQL, TRUNCATE',
      'a.ts',
      'sql`TRUNCATE TABLE state_statistics`',
      'SQL_WRITE',
    ],
    [
      'a Python write',
      'a.py',
      'cur.execute("DELETE FROM state_statistics WHERE n < 30")',
      'SQL_WRITE',
    ],
    [
      'the reader writing through the model',
      READER,
      'this.prisma.stateStatistic.upsert({})',
      'READER_WRITES',
    ],
    [
      'the reader deleting',
      READER,
      'this.prisma.stateStatistic.deleteMany()',
      'READER_WRITES',
    ],
    [
      'the reader aliasing the delegate',
      READER,
      'const table = this.prisma.stateStatistic;',
      'MODEL_ACCESS',
    ],
    [
      'the reader writing in SQL',
      READER,
      'this.prisma.$executeRaw`UPDATE state_statistics SET n = 1`',
      'SQL_WRITE',
    ],
    [
      'the writer reading through the model',
      WRITER,
      'const old = await this.prisma.stateStatistic.findMany();',
      'WRITER_READS',
    ],
    [
      'the writer reading one row',
      WRITER,
      'await this.prisma.stateStatistic.findUnique({ where })',
      'WRITER_READS',
    ],
    [
      'the writer aliasing the delegate',
      WRITER,
      'const table = this.prisma.stateStatistic;',
      'MODEL_ACCESS',
    ],
    [
      'the writer reading in SQL',
      WRITER,
      'this.prisma.$queryRaw`SELECT * FROM state_statistics`',
      'SQL_READ',
    ],
  ];

  it.each(bad)('%s', (_label, file, source, rule) => {
    const found = scanText(file, source);
    expect(found.map((f) => f.rule)).toEqual([rule]);
    expect(found[0].line).toBeGreaterThan(0);
  });

  it('reports the line of the mention, not of the file', () => {
    const source =
      'const a = 1;\nconst b = 2;\nawait prisma.stateStatistic.findMany();\n';
    expect(scanText('a.ts', source)[0].line).toBe(3);
    expect(
      scanText('a.sql', 'SELECT 1;\nSELECT * FROM state_statistics;')[0].line
    ).toBeGreaterThan(0);
  });

  it('says what it found', () => {
    expect(
      scanText('a.ts', 'prisma.stateStatistic.findMany()')[0].snippet
    ).toBe('stateStatistic.findMany(');
    expect(
      scanText('a.ts', 'sql`SELECT * FROM state_statistics`')[0].snippet
    ).toContain('SELECT * FROM state_statistics');
  });

  it('a statement in a .sql file may run over several lines', () => {
    expect(
      scanText(
        'a.sql',
        'SELECT *\n  FROM state_statistics\n WHERE n >= 30;'
      ).map((f) => f.rule)
    ).toEqual(['SQL_READ']);
    expect(
      scanText('a.sql', 'DELETE\n  FROM state_statistics\n WHERE n = 0;').map(
        (f) => f.rule
      )
    ).toEqual(['SQL_WRITE']);
    expect(
      scanText(
        'a.sql',
        'SELECT 1;\nSELECT *\nFROM mcd_outputs;\nSELECT *\nFROM state_statistics;'
      ).map((f) => f.rule)
    ).toEqual(['SQL_READ']);
  });

  it('a declaration file is neither scanned for SQL nor a use of the delegate', () => {
    expect(
      modelUses('a.d.ts', 'stateStatistic: StateStatisticDelegate;')
    ).toEqual([]);
    expect(
      scanText(
        'a.d.ts',
        'export declare const q = "SELECT * FROM state_statistics";'
      )
    ).toEqual([]);
    expect(
      scanText(
        'a.ts',
        'export const q = "SELECT * FROM state_statistics";'
      ).map((f) => f.rule)
    ).toEqual(['SQL_READ']);
  });

  it('a read and a write in one statement are both reported', () => {
    const found = scanText(
      'a.ts',
      'sql`UPDATE state_statistics SET n = s.n FROM state_statistics s WHERE s.id = 1`'
    );
    expect(found.map((f) => f.rule).sort()).toEqual(['SQL_READ', 'SQL_WRITE']);
  });
});

describe('the scanner lets the two owners and everything else through', () => {
  const good: Array<[string, string, string]> = [
    [
      'the reader reading one row',
      READER,
      'return this.prisma.stateStatistic.findUnique({ where: { id } });',
    ],
    [
      'the reader reading many',
      READER,
      'this.prisma.stateStatistic.findMany({})',
    ],
    ['the reader counting', READER, 'await this.prisma.stateStatistic.count()'],
    [
      'the reader in SQL',
      READER,
      'this.prisma.$queryRaw`SELECT * FROM state_statistics`',
    ],
    [
      'the writer upserting',
      WRITER,
      'this.prisma.stateStatistic.upsert({ where, create, update })',
    ],
    [
      'the writer creating many',
      WRITER,
      'this.prisma.stateStatistic.createMany({ data })',
    ],
    [
      'the writer deleting',
      WRITER,
      'this.prisma.stateStatistic.deleteMany({ where })',
    ],
    [
      'the writer in SQL',
      WRITER,
      'this.prisma.$executeRaw`DELETE FROM state_statistics WHERE n = 0`',
    ],
    [
      'a variable that happens to be plural',
      'a.ts',
      'const stateStatistics = []; stateStatistics.push(1);',
    ],
    [
      'the Prisma type with a capital letter',
      'a.ts',
      "import type { StateStatistic } from '@prisma/client';",
    ],
    ['another table', 'a.ts', 'prisma.$queryRaw`SELECT * FROM mcd_outputs`'],
    [
      'a table that starts with the name',
      'a.ts',
      'prisma.$queryRaw`SELECT * FROM state_statistics_archive`',
    ],
    [
      "the constraint's name in a message",
      'a.ts',
      "expect(message).toContain('state_statistics_n_gate');",
    ],
    [
      'prose that names the table',
      'a.ts',
      "throw new Error('could not write state_statistics: the batch was refused');",
    ],
    [
      'a log line naming the table',
      'a.py',
      'print("refused: nothing may select from state_statistics here")',
    ],
    [
      'DDL in a .sql file',
      'a.sql',
      'CREATE TABLE "state_statistics" (id TEXT);\nALTER TABLE "state_statistics" ADD CONSTRAINT "c" CHECK (n >= 30);\nCREATE UNIQUE INDEX x ON "state_statistics"(a);\nDROP TABLE state_statistics;',
    ],
    [
      'DDL in a TypeScript string',
      'a.ts',
      "await prisma.$executeRawUnsafe('ALTER TABLE state_statistics DROP COLUMN x')",
    ],
    ['a declaration file', 'a.d.ts', 'stateStatistic: StateStatisticDelegate;'],
    [
      'a markdown file is not scanned',
      'a.md',
      'prisma.stateStatistic.findMany() SELECT * FROM state_statistics',
    ],
    [
      'a TypeScript test of another model',
      'a.ts',
      'prisma.mcdOutput.findMany(); prisma.marketCycle.count()',
    ],
  ];

  it.each(good)('%s', (_label, file, source) => {
    expect(scanText(file, source)).toEqual([]);
  });

  it('text in comments is not code: the rule can be quoted without tripping itself', () => {
    expect(
      scanText(
        'a.ts',
        `// never: prisma.stateStatistic.findMany()
/* SELECT * FROM state_statistics */
const x = 1;`
      )
    ).toEqual([]);
    expect(
      scanText('a.py', '# SELECT * FROM state_statistics\nx = 1\n')
    ).toEqual([]);
    expect(
      scanText(
        'a.py',
        'x = 1  # cur.execute("SELECT * FROM state_statistics")\n'
      )
    ).toEqual([]);
    expect(
      scanText('a.sql', '-- SELECT * FROM state_statistics\nSELECT 1;')
    ).toEqual([]);
  });

  it('a comment marker inside a string is not a comment', () => {
    expect(
      scanText(
        'a.ts',
        'const q = "http://x"; prisma.stateStatistic.findMany();'
      )
    ).toHaveLength(1);
  });

  it('knows which methods read and which write, and they do not overlap', () => {
    expect(
      READ_METHODS.filter((m) =>
        (WRITE_METHODS as readonly string[]).includes(m)
      )
    ).toEqual([]);
    for (const m of ['findUnique', 'findMany', 'count', 'aggregate', 'groupBy'])
      expect(READ_METHODS).toContain(m);
    for (const m of [
      'create',
      'createMany',
      'update',
      'upsert',
      'delete',
      'deleteMany',
    ])
      expect(WRITE_METHODS).toContain(m);
  });

  it('lists every use of the delegate with its method', () => {
    const uses = modelUses(
      'a.ts',
      "a.stateStatistic.findMany();\nconst t = b.stateStatistic;\nc['stateStatistic'].upsert({});"
    );
    expect(uses.map((u) => [u.line, u.method])).toEqual([
      [1, 'findMany'],
      [2, null],
      [3, 'upsert'],
    ]);
  });
});

describe('the scanner works on files, end to end', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-statistics-scan-'));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('finds a violation in a file on disk and nothing in a clean one', () => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(
      path.join(dir, 'src', 'bad.ts'),
      'export const f = (p: any) => p.stateStatistic.findMany();\n'
    );
    fs.writeFileSync(path.join(dir, 'src', 'good.ts'), 'export const g = 1;\n');
    fs.writeFileSync(
      path.join(dir, 'src', 'bad.py'),
      'cur.execute("SELECT * FROM state_statistics")\n'
    );
    const result = scanRoots(dir, ['src']);
    expect(result.scanned.sort()).toEqual([
      'src/bad.py',
      'src/bad.ts',
      'src/good.ts',
    ]);
    expect(result.violations.map((v) => `${v.file}:${v.rule}`).sort()).toEqual([
      'src/bad.py:SQL_READ',
      'src/bad.ts:MODEL_ACCESS',
    ]);
  });

  it('skips the folders no code of ours lives in', () => {
    fs.mkdirSync(path.join(dir, 'lib', 'node_modules'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'lib', 'node_modules', 'x.ts'),
      'p.stateStatistic.findMany()\n'
    );
    expect(scanRoots(dir, ['lib']).scanned).toEqual([]);
  });

  it('a root that does not exist scans nothing', () => {
    expect(scanRoots(dir, ['nowhere']).scanned).toEqual([]);
  });
});

/**
 * Where code lives that can reach the market-data database: the gateway (the sensors, the readers,
 * its scripts), the MCD kit and the engine, the monolith's `lib`, `app`, `components`, `hooks` and
 * `src` (Section 5 will read through the reader's answers), the two other services, the root scripts,
 * the seed code in `prisma/` and the VPS pipeline. Test folders are not code that runs: the gated
 * specs read the table on purpose, to check what the writer did.
 */
const ROOTS = [
  'railway-gateway/src',
  'railway-gateway/scripts',
  'davintrade-stack-d-and-e/engine-1-5-new',
  'lib',
  'app',
  'components',
  'hooks',
  'src',
  'money-service/src',
  'operation-service/src',
  'scripts',
  'prisma',
  'backend-stack-c',
] as const;

describe('no code outside the reader reads state_statistics, and none outside the writer writes it', () => {
  const scan = scanRoots(REPO, ROOTS);

  it('actually scans the code (a guard that finds no files passes forever)', () => {
    expect(scan.scanned.length).toBeGreaterThan(800);
    for (const file of [
      READER,
      WRITER,
      'railway-gateway/src/sensors/mcd-outputs.writer.ts',
      'railway-gateway/src/cycle/read/cycle-reader.service.ts',
      'lib/indicator-statistics/queries.ts',
      'davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/statistics/aggregate.py',
      'prisma/migrations/20261003000000_add_sensor_tables/migration.sql',
    ])
      expect(scan.scanned).toContain(file);
    expect(scan.scanned.some((f) => f.includes('/legacy/'))).toBe(false);
    expect(scan.scanned.some((f) => f.includes('node_modules'))).toBe(false);
  });

  it('has no violation anywhere', () => {
    expect(scan.violations).toEqual([]);
  });

  it('the reader reads the table through findUnique, so the guard has something to protect', () => {
    const inReader = scan.uses.filter((u) => u.file === READER);
    expect(inReader.length).toBeGreaterThanOrEqual(1);
    expect(inReader.map((u) => u.method)).toContain('findUnique');
    for (const use of inReader) expect(READ_METHODS).toContain(use.method);
  });

  it('the writer writes the table through upsert and never reads it', () => {
    const inWriter = scan.uses.filter((u) => u.file === WRITER);
    expect(inWriter.length).toBeGreaterThanOrEqual(1);
    expect(inWriter.map((u) => u.method)).toContain('upsert');
    for (const use of inWriter) expect(WRITE_METHODS).toContain(use.method);
  });

  it('those two files are the only ones in the repository that name the model', () => {
    expect([...new Set(scan.uses.map((u) => u.file))].sort()).toEqual(
      [READER, WRITER].sort()
    );
  });

  it('the migration that creates the table is DDL, which the guard leaves alone', () => {
    const migration = fs.readFileSync(
      path.join(
        REPO,
        'prisma',
        'migrations',
        '20261003000000_add_sensor_tables',
        'migration.sql'
      ),
      'utf8'
    );
    expect(migration).toContain('state_statistics');
    expect(scanText('prisma/migrations/x/migration.sql', migration)).toEqual(
      []
    );
  });

  it('the reader and the writer are where the guard expects them', () => {
    expect(fs.existsSync(path.join(REPO, READER))).toBe(true);
    expect(fs.existsSync(path.join(REPO, WRITER))).toBe(true);
  });
});
