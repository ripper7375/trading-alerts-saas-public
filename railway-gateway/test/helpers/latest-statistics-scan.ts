import * as fs from 'fs';
import * as path from 'path';

/**
 * A static scan for "latest available" reads of indicator_statistics
 * (STACK-D-ARCHITECTURE.md section 1.4 item 5: "No `ORDER BY captured_at DESC
 * LIMIT 1` without a slot match anywhere in Stack D").
 *
 * WHAT COUNTS AS A LATEST READ. A read of the statistics table that asks for the
 * newest row of something and does not pin `captured_at` to ONE value:
 *   - Prisma: `indicatorStatistic.findFirst / findFirstOrThrow / findMany` whose
 *     arguments carry a descending `orderBy` (on any column: newest by `createdAt`
 *     is the same bug) or `distinct`, with no exact `captured_at` in `where`;
 *   - SQL naming `indicator_statistics`: `ORDER BY ... DESC`, `DISTINCT ON` or
 *     `MAX(captured_at)`, with no `captured_at = <value>`.
 * A RANGE is not a slot match: `captured_at <= $slot ORDER BY captured_at DESC
 * LIMIT 1` is "the latest available as of the slot", the exact thing rule 5 bans.
 * `findUnique` on the full key (symbol, timeframe, source, captured_at) is exact by
 * construction and never flagged.
 *
 * WHAT IT CANNOT SEE: a value computed elsewhere and then passed as the exact
 * `captured_at` (a "max" taken in one query and used in the next), and statistics
 * read out of workbooks or fixtures in Python (the MCD kit enforces rule 5 there:
 * `mcd_common/cycle_inputs.py`, `captured_at == stats_slot[tf]`, with its own tests).
 * It is a net for the common mistake, not a proof.
 */

export interface Violation {
  file: string;
  line: number;
  rule: 'PRISMA_LATEST' | 'SQL_LATEST';
  snippet: string;
}

type Lang = 'ts' | 'py' | 'sql';

export function languageOf(file: string): Lang | null {
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) return 'ts';
  if (file.endsWith('.py')) return 'py';
  if (file.endsWith('.sql')) return 'sql';
  return null;
}

/** Comments replaced by spaces (newlines kept), strings left alone, so offsets and line numbers survive. */
export function blankComments(text: string, lang: Lang): string {
  let out = '';
  let i = 0;
  const n = text.length;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    // strings first, so a comment marker inside one is not a comment
    if (
      lang === 'py' &&
      (text.startsWith('"""', i) || text.startsWith("'''", i))
    ) {
      const quote = text.slice(i, i + 3);
      const end = text.indexOf(quote, i + 3);
      const stop = end === -1 ? n : end + 3;
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || (c === '`' && lang === 'ts')) {
      let j = i + 1;
      while (j < n && text[j] !== c) {
        if (text[j] === '\\') j += 1;
        if (text[j] === '\n' && c !== '`') break;
        j += 1;
      }
      out += text.slice(i, Math.min(j + 1, n));
      i = Math.min(j + 1, n);
      continue;
    }
    if (lang === 'ts' && c === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if ((lang === 'ts' || lang === 'sql') && c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if (lang === 'py' && c === '#') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if (lang === 'sql' && c === '-' && next === '-') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** The text between the parenthesis at `open` and its match (strings skipped). */
function balanced(
  text: string,
  open: number,
  left: string,
  right: string
): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i += 1;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (c === left) depth += 1;
    if (c === right) {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1);
}

const lineOf = (text: string, index: number) =>
  text.slice(0, index).split('\n').length;

/** Does the object text pin `captured_at` to a single value? */
function pinsCapturedAt(where: string): boolean {
  return (
    /\bcaptured_at\s*:(?!\s*\{)/.test(where) ||
    /\bcaptured_at\s*:\s*\{\s*equals\b/.test(where)
  );
}

function scanPrisma(file: string, code: string): Violation[] {
  const found: Violation[] = [];
  const call =
    /\bindicatorStatistic\s*\.\s*(findFirst|findFirstOrThrow|findMany)\s*\(/g;
  for (let m = call.exec(code); m; m = call.exec(code)) {
    const open = m.index + m[0].length - 1;
    const args = balanced(code, open, '(', ')');
    const wantsNewest =
      /\bdistinct\s*:/.test(args) ||
      (/\borderBy\s*:/.test(args) && /['"]desc['"]/i.test(args));
    if (!wantsNewest) continue;
    const whereAt = args.search(/\bwhere\s*:\s*\{/);
    const where =
      whereAt === -1
        ? ''
        : balanced(args, args.indexOf('{', whereAt), '{', '}');
    if (pinsCapturedAt(where)) continue;
    found.push({
      file,
      line: lineOf(code, m.index),
      rule: 'PRISMA_LATEST',
      snippet: `indicatorStatistic.${m[1]}(${args.replace(/\s+/g, ' ').trim().slice(0, 140)})`,
    });
  }
  return found;
}

/** The SQL-looking strings of a file: string literals for ts and py, statements for .sql. */
function sqlTexts(
  code: string,
  lang: Lang
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

function scanSql(file: string, code: string, lang: Lang): Violation[] {
  const found: Violation[] = [];
  for (const { text, index } of sqlTexts(code, lang)) {
    if (!/indicator_statistics/i.test(text)) continue;
    const newest =
      /\bDISTINCT\s+ON\b/i.test(text) ||
      /\bMAX\s*\(\s*(?:\w+\.)?captured_at\s*\)/i.test(text) ||
      /\bORDER\s+BY\b[^;]*?\bDESC\b/i.test(text);
    if (!newest) continue;
    // `captured_at = $1` pins it; `captured_at = (SELECT MAX(...))` is the same bug in a coat
    const pinned = /\bcaptured_at\s*=(?!=)(?!\s*\(?\s*SELECT\b)/i.test(text);
    if (pinned) continue;
    found.push({
      file,
      line: lineOf(code, index),
      rule: 'SQL_LATEST',
      snippet: text.replace(/\s+/g, ' ').trim().slice(0, 160),
    });
  }
  return found;
}

export function scanText(file: string, text: string): Violation[] {
  const lang = languageOf(file);
  if (!lang) return [];
  const code = blankComments(text, lang);
  return [
    ...(lang === 'ts' ? scanPrisma(file, code) : []),
    ...scanSql(file, code, lang),
  ];
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.git',
  '__pycache__',
  'legacy',
]);

/** Every scannable file under a directory (comments and `legacy/` archives excluded by name). */
export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name))
        out.push(...listFiles(path.join(dir, entry.name)));
    } else if (languageOf(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

export function scanRoots(repoRoot: string, roots: readonly string[]) {
  const files = roots.flatMap((r) => listFiles(path.join(repoRoot, r)));
  const violations: Violation[] = [];
  for (const file of files) {
    const rel = path.relative(repoRoot, file).split(path.sep).join('/');
    violations.push(...scanText(rel, fs.readFileSync(file, 'utf8')));
  }
  return {
    scanned: files.map((f) =>
      path.relative(repoRoot, f).split(path.sep).join('/')
    ),
    violations,
  };
}
