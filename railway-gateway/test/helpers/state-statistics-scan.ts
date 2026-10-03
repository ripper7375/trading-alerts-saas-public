import * as fs from 'fs';
import * as path from 'path';
import { blankComments, languageOf, listFiles } from './latest-statistics-scan';

/**
 * A static scan for code that touches `state_statistics` outside its two owners (STACK-D-ARCHITECTURE.md
 * section 2.8, ADR-022; build step 3 part 6): "a number reaches a prompt only from this table, always
 * with its n", so ONE file reads the table (`state-statistics.reader.ts`, which answers provisional
 * below n = 30 and always returns n) and ONE file writes it (`state-statistics.writer.ts`, which holds
 * the gate). Any other code that reads the table could quote a figure with no n, or below 30.
 *
 * WHAT COUNTS AS A VIOLATION
 *   - MODEL_ACCESS: the Prisma delegate `stateStatistic` named anywhere but the reader and the writer
 *     (a call, an alias, a destructuring, a bracket access: an alias would hide a read from the next
 *     rule), or named in the reader or the writer without a call to one of its methods;
 *   - READER_WRITES / WRITER_READS: the reader calling a write method, the writer calling a read
 *     method (the writer never reads: it cannot then say what it replaced, and the reader stays the
 *     only consumer);
 *   - SQL_READ: a SQL statement (a string in TypeScript or Python, or a `.sql` file) that SELECTs
 *     from, joins or otherwise reads `state_statistics`, outside the reader;
 *   - SQL_WRITE: INSERT, UPDATE, DELETE, TRUNCATE, MERGE or COPY on it, outside the writer.
 *   DDL (`CREATE`, `ALTER`, `DROP`) is the migration's business and is not a query. Prose that names
 *   the table (an error message, a log line) is not SQL and is not flagged. Comments are blanked first.
 *
 * WHAT IT CANNOT SEE: a table name assembled at run time, a query built in another language than
 * TypeScript, JavaScript, Python or SQL, and a database user's own tool. It is a net for the common
 * mistake, not a proof; the database's CHECK is the backstop for what is written, and the reader's
 * own gate for what is read.
 */

export const READER = 'railway-gateway/src/sensors/state-statistics.reader.ts';
export const WRITER = 'railway-gateway/src/sensors/state-statistics.writer.ts';

export const READ_METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
] as const;
export const WRITE_METHODS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
] as const;

export interface Violation {
  file: string;
  line: number;
  rule:
    | 'MODEL_ACCESS'
    | 'READER_WRITES'
    | 'WRITER_READS'
    | 'SQL_READ'
    | 'SQL_WRITE';
  snippet: string;
}

/** A call to a method of the delegate: where, and which. `method` is null when the delegate is named without a call. */
export interface ModelUse {
  file: string;
  line: number;
  method: string | null;
}

const lineOf = (text: string, index: number) =>
  text.slice(0, index).split('\n').length;

const isOneOf = (list: readonly string[], value: string | null) =>
  value !== null && list.includes(value);

/** Every place a TypeScript or JavaScript file names the delegate, with the method called on it. */
export function modelUses(file: string, text: string): ModelUse[] {
  if (languageOf(file) !== 'ts' || file.endsWith('.d.ts')) return [];
  const code = blankComments(text, 'ts');
  const uses: ModelUse[] = [];
  const name = /\bstateStatistic\b/g;
  for (let m = name.exec(code); m; m = name.exec(code)) {
    const after = code.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const call = /^['"]?\s*\]?\s*\.\s*(\w+)\s*\(/.exec(after);
    uses.push({
      file,
      line: lineOf(code, m.index),
      method: call ? call[1] : null,
    });
  }
  return uses;
}

/** The SQL-looking strings of a file: string literals for ts and py, statements for .sql. */
function sqlTexts(
  code: string,
  lang: 'ts' | 'py' | 'sql'
): Array<{ text: string; index: number }> {
  if (lang === 'sql') {
    const out: Array<{ text: string; index: number }> = [];
    let start = 0;
    for (const part of code.split(';')) {
      out.push({ text: part, index: start });
      start += part.length + 1;
    }
    return out;
  }
  const literal =
    lang === 'py'
      ? /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g
      : /`[^`]*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g;
  const out: Array<{ text: string; index: number }> = [];
  for (let m = literal.exec(code); m; m = literal.exec(code)) {
    out.push({ text: m[0], index: m.index });
  }
  return out;
}

const TABLE = /(?<![\w])["`]?state_statistics["`]?(?![\w])/i;
const WRITE_CLAUSE =
  /\b(?:DELETE\s+FROM|INSERT\s+INTO|UPDATE|TRUNCATE(?:\s+TABLE)?|MERGE\s+INTO|COPY)\s+(?:ONLY\s+)?(?:\w+\.)?["`]?state_statistics["`]?(?![\w])/gi;
const DML =
  /^[\s("'`]*(?:SELECT|WITH|EXPLAIN|INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/i;

function scanSql(
  file: string,
  code: string,
  lang: 'ts' | 'py' | 'sql'
): Violation[] {
  const found: Violation[] = [];
  for (const { text, index } of sqlTexts(code, lang)) {
    if (!TABLE.test(text) || !DML.test(text)) continue;
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    const writes = text.match(WRITE_CLAUSE) !== null;
    const reads = TABLE.test(text.replace(WRITE_CLAUSE, ' '));
    if (reads && file !== READER)
      found.push({
        file,
        line: lineOf(code, index),
        rule: 'SQL_READ',
        snippet,
      });
    if (writes && file !== WRITER)
      found.push({
        file,
        line: lineOf(code, index),
        rule: 'SQL_WRITE',
        snippet,
      });
  }
  return found;
}

export function scanText(file: string, text: string): Violation[] {
  const lang = languageOf(file);
  if (!lang || file.endsWith('.d.ts')) return [];
  const code = blankComments(text, lang);
  const found: Violation[] = [];
  for (const use of modelUses(file, text)) {
    const here = (rule: Violation['rule']): Violation => ({
      file,
      line: use.line,
      rule,
      snippet: `stateStatistic${use.method ? `.${use.method}(` : ''}`,
    });
    if (file === READER) {
      if (isOneOf(READ_METHODS, use.method)) continue;
      found.push(
        here(
          isOneOf(WRITE_METHODS, use.method) ? 'READER_WRITES' : 'MODEL_ACCESS'
        )
      );
    } else if (file === WRITER) {
      if (isOneOf(WRITE_METHODS, use.method)) continue;
      found.push(
        here(
          isOneOf(READ_METHODS, use.method) ? 'WRITER_READS' : 'MODEL_ACCESS'
        )
      );
    } else {
      found.push(here('MODEL_ACCESS'));
    }
  }
  found.push(...scanSql(file, code, lang));
  return found;
}

export function scanRoots(repoRoot: string, roots: readonly string[]) {
  const files = roots.flatMap((r) => listFiles(path.join(repoRoot, r)));
  const violations: Violation[] = [];
  const uses: ModelUse[] = [];
  const scanned: string[] = [];
  for (const file of files) {
    const rel = path.relative(repoRoot, file).split(path.sep).join('/');
    const text = fs.readFileSync(file, 'utf8');
    scanned.push(rel);
    violations.push(...scanText(rel, text));
    uses.push(...modelUses(rel, text));
  }
  return { scanned, violations, uses };
}
