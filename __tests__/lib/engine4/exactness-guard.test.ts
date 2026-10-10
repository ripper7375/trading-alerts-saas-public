/**
 * @jest-environment node
 */

/**
 * The exactness guard (build step 5, part 1): no floating-point arithmetic in
 * Engine 4's money maths.
 *
 * It reads the TypeScript of every file under `lib/engine4/` and fails on:
 *  - a use of `Math`, `parseFloat`, `parseInt`, `Number`, `toFixed`,
 *    `toPrecision`, `toExponential` or `toLocaleString`;
 *  - a number literal with a fraction or an exponent (`0.25`, `1e3`);
 *  - arithmetic (`+ - * / % **`, the bit operators, their assignment forms,
 *    `++`, `--`, unary `+ - ~`) on an operand the compiler types as `number`
 *    or `any`. BigInt arithmetic and string joining are fine; comparing two
 *    numbers is fine;
 *  - an import of anything but a sibling file (the engine has no dependency
 *    and does no I/O).
 *
 * The guard is itself tested: the snippets below must be caught, and the
 * allowed forms must not be.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import * as ts from 'typescript';

jest.setTimeout(120_000);

const ENGINE_DIR = resolve(__dirname, '..', '..', '..', 'lib', 'engine4');

const FORBIDDEN_NAMES = new Set([
  'Math',
  'parseFloat',
  'parseInt',
  'Number',
  'toFixed',
  'toPrecision',
  'toExponential',
  'toLocaleString',
]);

const ARITHMETIC = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.AmpersandToken,
  ts.SyntaxKind.BarToken,
  ts.SyntaxKind.CaretToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
]);

/**
 * The prefix operators that compute with their operand. `!` is logical negation and
 * works on any type; a value the guard's small program cannot resolve (a path alias)
 * is `any`, and `!x` on it is not arithmetic.
 */
const ARITHMETIC_PREFIX = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.TildeToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
]);

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

const normal = (path: string): string => path.replace(/\\/g, '/');

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFilesUnder(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
      out.push(normal(full));
  }
  return out.sort();
}

/**
 * `Number(x)` with exactly one argument that the compiler types as a `bigint`
 * (and nothing wider) is an exact conversion, not arithmetic: it is how a
 * whole-second time becomes the integer a database query takes (`toDbInt`
 * range-checks it first). `Number('5')`, `Number(a)` for a `number | bigint`
 * and every other use stay forbidden.
 */
function isBigIntConversion(
  node: ts.Identifier,
  checker: ts.TypeChecker
): boolean {
  if (node.text !== 'Number') return false;
  const call = node.parent;
  if (
    !ts.isCallExpression(call) ||
    call.expression !== node ||
    call.arguments.length !== 1
  ) {
    return false;
  }
  const [argument] = call.arguments;
  if (argument === undefined) return false;
  const type = checker.getTypeAtLocation(argument);
  return (type.flags & ts.TypeFlags.BigIntLike) !== 0;
}

/** True when the compiler cannot rule out a JavaScript number (or any). */
function numberish(type: ts.Type): boolean {
  if (type.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.Any)) return true;
  if (type.isUnion() || type.isIntersection())
    return type.types.some(numberish);
  return false;
}

/**
 * The pure modules import sibling files only: no dependency, no I/O. The one
 * place that reads a database is `read/`, which may also import its parent's
 * files (`../`), the database client, the Tier-1 config file, `crypto` and
 * `zlib`, and nothing else.
 */
const READER_IMPORTS: readonly string[] = [
  '@/lib/db/market-prisma',
  '@/config/engine4/tier1-events.json',
  'crypto',
  'zlib',
];

function isTypeOnly(
  node: ts.ImportDeclaration | ts.ExportDeclaration
): boolean {
  return ts.isImportDeclaration(node)
    ? node.importClause?.isTypeOnly === true
    : node.isTypeOnly;
}

/**
 * The stores (`store/`, part 5) write the audit tables: they may import the user
 * database client, `crypto` and the parent's files, and nothing else.
 */
const STORE_IMPORTS: readonly string[] = ['@/lib/db/prisma', 'crypto'];

/**
 * The route layer (`server/`, part 6) reaches the world through the session, the tier
 * helper, the language list, the gateway client and Redis, and through the readers and
 * stores of its parent (`../`). It never imports a database client itself.
 */
const SERVER_IMPORTS: readonly string[] = [
  '@/lib/auth/session',
  '@/lib/tier-validation',
  '@/lib/i18n/languages',
  '@/lib/active-indicator/gateway-client',
  '@/lib/redis/client',
  'crypto',
];

function importAllowed(
  file: string,
  specifier: string,
  typeOnly: boolean
): boolean {
  // the templates (`templates/`, part 7) are pure and reach up into their parent's
  // pure files; the parts that touch a database, Redis or a session are named by
  // TYPE only (a client component imports the templates)
  if (file.includes('/templates/')) {
    if (/^\.\.\/(read|store|server)\//.test(specifier)) return typeOnly;
    return specifier.startsWith('./') || specifier.startsWith('../');
  }
  // a pure file may name the reader's or a store's TYPES, never its code: they pull
  // in the database client, and a client component imports the pure files
  if (specifier.startsWith('./read/'))
    return typeOnly || file.includes('/read/');
  if (specifier.startsWith('./store/'))
    return typeOnly || file.includes('/store/');
  if (specifier.startsWith('./server/'))
    return typeOnly || file.includes('/server/');
  if (specifier.startsWith('./')) return true;
  return (
    (file.includes('/read/') &&
      (specifier.startsWith('../') || READER_IMPORTS.includes(specifier))) ||
    (file.includes('/store/') &&
      (specifier.startsWith('../') || STORE_IMPORTS.includes(specifier))) ||
    (file.includes('/server/') &&
      (specifier.startsWith('../') || SERVER_IMPORTS.includes(specifier)))
  );
}

function analyse(sources: Map<string, string>): Violation[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    lib: ['lib.es2020.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  const base = ts.createCompilerHost(options, true);
  const host: ts.CompilerHost = {
    ...base,
    fileExists: (file) => sources.has(normal(file)) || base.fileExists(file),
    readFile: (file) => sources.get(normal(file)) ?? base.readFile(file),
    getSourceFile: (file, languageVersion, onError, shouldCreate) => {
      const text = sources.get(normal(file));
      return text === undefined
        ? base.getSourceFile(file, languageVersion, onError, shouldCreate)
        : ts.createSourceFile(file, text, languageVersion, true);
    },
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  const checker = program.getTypeChecker();
  const found: Violation[] = [];

  for (const name of sources.keys()) {
    const file = program.getSourceFile(name);
    if (file === undefined) throw new Error(`the guard could not read ${name}`);
    const report = (node: ts.Node, rule: string): void => {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      found.push({
        file: name,
        line: line + 1,
        rule,
        text: node.getText(file).slice(0, 80),
      });
    };
    const visit = (node: ts.Node): void => {
      if (
        ts.isIdentifier(node) &&
        FORBIDDEN_NAMES.has(node.text) &&
        !isBigIntConversion(node, checker)
      ) {
        report(node, `forbidden name ${node.text}`);
      }
      if (ts.isNumericLiteral(node)) {
        const raw = node.getText(file);
        if (!/^0[xXbBoO]/.test(raw) && /[.eE]/.test(raw))
          report(node, 'fractional number literal');
      }
      if (
        ts.isBinaryExpression(node) &&
        ARITHMETIC.has(node.operatorToken.kind)
      ) {
        const left = checker.getTypeAtLocation(node.left);
        const right = checker.getTypeAtLocation(node.right);
        if (numberish(left) || numberish(right))
          report(node, 'arithmetic on a number');
      }
      if (ts.isPrefixUnaryExpression(node)) {
        // `-1` is a negative integer literal (`cmp()` returns -1, 0 or 1), not arithmetic;
        // `-x` on a variable still is
        const negativeLiteral =
          node.operator === ts.SyntaxKind.MinusToken &&
          ts.isNumericLiteral(node.operand) &&
          /^\d+$/.test(node.operand.getText(file));
        if (node.operator === ts.SyntaxKind.PlusToken) {
          report(node, 'unary plus (a number coercion)');
        } else if (
          ARITHMETIC_PREFIX.has(node.operator) &&
          !negativeLiteral &&
          numberish(checker.getTypeAtLocation(node.operand))
        ) {
          report(node, 'unary arithmetic on a number');
        }
      }
      if (
        ts.isPostfixUnaryExpression(node) &&
        numberish(checker.getTypeAtLocation(node.operand))
      ) {
        report(node, 'increment or decrement of a number');
      }
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        !importAllowed(name, node.moduleSpecifier.text, isTypeOnly(node))
      ) {
        report(
          node,
          `import of ${node.moduleSpecifier.text} (not allowed in this file)`
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

/** Snippets the guard must catch (`bad`) and must leave alone (`good`). */
const BAD: Record<string, string> = {
  'math.ts': 'export const a = Math.floor(2);',
  'parse-float.ts': "export const a = parseFloat('1');",
  'parse-int.ts': "export const a = parseInt('1', 10);",
  'to-fixed.ts': 'export const a = (1).toFixed(2);',
  'number-call.ts': "export const a = Number('5');",
  'number-of-a-number.ts': 'const a: number = 1;\nexport const b = Number(a);',
  'number-of-a-union.ts':
    'declare const a: number | bigint;\nexport const b = Number(a);',
  'number-with-two-arguments.ts': 'export const b = Number(1n, 2n);',
  'number-by-reference.ts': 'export const f = [1n].map(Number);',
  'locale.ts': 'export const a = (1).toLocaleString();',
  'multiply.ts': 'const a: number = 1;\nexport const b = a * 2;',
  'add-assign.ts': 'let a = 1;\na += 2;\nexport { a };',
  'increment.ts': 'let i = 0;\ni++;\nexport { i };',
  'negate.ts': 'const a: number = 1;\nexport const b = -a;',
  'bitwise-not.ts': 'const a: number = 1;\nexport const b = ~a;',
  'pre-increment.ts': 'let i = 0;\n++i;\nexport { i };',
  'negate-any.ts': 'declare const a: any;\nexport const b = -a;',
  'negative-fraction.ts': 'export const a = -0.5;',
  'unary-plus.ts': "const s = '5';\nexport const n = +s;",
  'fraction.ts': 'export const a = 0.25;',
  'exponent.ts': 'export const a = 1e3;',
  'any-arithmetic.ts': 'const a: any = 1;\nexport const b = a - 1;',
  'union-arithmetic.ts':
    'declare const a: number | bigint;\nexport const b = a % 2;',
  'bit-or.ts': 'const a: number = 1;\nexport const b = a | 0;',
  'import-package.ts':
    "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
  'import-alias.ts': "import { x } from '@/lib/engine4';\nexport const a = x;",
  'value-import-of-the-reader.ts':
    "import { read } from './read/structure';\nexport const a = read;",
  'value-reexport-of-the-reader.ts': "export { read } from './read/structure';",
  'parent-import-outside-read.ts':
    "import { x } from '../elsewhere';\nexport const a = x;",
};

/**
 * Snippets that sit in a `read/` folder: the database client, crypto, zlib and
 * the parent's files are allowed there, nothing else.
 */
const BAD_IN_READ: Record<string, string> = {
  'fs.ts': "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
  'other-alias.ts': "import { x } from '@/lib/db/prisma';\nexport const a = x;",
  'other-config.ts':
    "import config from '@/config/engine4/other.json';\nexport const a = config;",
  'math.ts': 'export const a = Math.floor(2);',
};
const GOOD_IN_READ: Record<string, string> = {
  'client.ts':
    "import { createHash } from 'crypto';\nimport { gunzipSync } from 'zlib';\nimport { marketPrisma } from '@/lib/db/market-prisma';\nimport { x } from '../parent';\nexport const a = [createHash, gunzipSync, marketPrisma, x];",
  'tier1-config.ts':
    "import config from '@/config/engine4/tier1-events.json';\nexport const a = config;",
};

/** Snippets in a `store/` folder: the user database client, crypto and the parent's files only. */
const BAD_IN_STORE: Record<string, string> = {
  'fs.ts': "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
  'market-client.ts':
    "import { marketPrisma } from '@/lib/db/market-prisma';\nexport const a = marketPrisma;",
  'zlib.ts': "import { gunzipSync } from 'zlib';\nexport const a = gunzipSync;",
  'tier1-config.ts':
    "import config from '@/config/engine4/tier1-events.json';\nexport const a = config;",
  'math.ts': 'export const a = Math.floor(2);',
};
const GOOD_IN_STORE: Record<string, string> = {
  'client.ts':
    "import { createHmac } from 'crypto';\nimport { prisma } from '@/lib/db/prisma';\nimport { x } from '../parent';\nimport { y } from './sibling';\nexport const a = [createHmac, prisma, x, y];",
};

/** Snippets in a `server/` folder: the session, tier, language, gateway and Redis modules, crypto and the parent's files only. */
const BAD_IN_SERVER: Record<string, string> = {
  'fs.ts': "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
  'market-client.ts':
    "import { marketPrisma } from '@/lib/db/market-prisma';\nexport const a = marketPrisma;",
  'user-client.ts':
    "import { prisma } from '@/lib/db/prisma';\nexport const a = prisma;",
  'zlib.ts': "import { gunzipSync } from 'zlib';\nexport const a = gunzipSync;",
  'tier1-config.ts':
    "import config from '@/config/engine4/tier1-events.json';\nexport const a = config;",
  'next-server.ts':
    "import { NextResponse } from 'next/server';\nexport const a = NextResponse;",
  'math.ts': 'export const a = Math.floor(2);',
  'number-arithmetic.ts':
    'const started: number = Date.now();\nexport const ms = Date.now() - started;',
  'parse-int.ts': "export const a = parseInt('5', 10);",
};
const GOOD_IN_SERVER: Record<string, string> = {
  'modules.ts':
    "import { randomUUID } from 'crypto';\nimport { getSession } from '@/lib/auth/session';\nimport { canAccessAiAnalyst } from '@/lib/tier-validation';\nimport { isSupportedLanguage } from '@/lib/i18n/languages';\nimport { fetchCurrentCycle } from '@/lib/active-indicator/gateway-client';\nimport { getRedisClient } from '@/lib/redis/client';\nimport { x } from '../parent';\nimport { y } from './sibling';\nexport const a = [randomUUID, getSession, canAccessAiAnalyst, isSupportedLanguage, fetchCurrentCycle, getRedisClient, x, y];",
  'bigint-time.ts':
    'const began = BigInt(Date.now());\nexport const ms = Number(BigInt(Date.now()) - began);',
};

/**
 * Snippets in a `templates/` folder (part 7): pure, the parent's files only, the
 * route layer, the readers and the stores by type alone, and no framework.
 */
const BAD_IN_TEMPLATES: Record<string, string> = {
  'fs.ts': "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
  'react.ts': "import { useState } from 'react';\nexport const a = useState;",
  'locale-context.ts':
    "import { useLocale } from '@/lib/context/locale-context';\nexport const a = useLocale;",
  'value-import-of-the-route-layer.ts':
    "import { authorize } from '../server/session';\nexport const a = authorize;",
  'value-import-of-a-reader.ts':
    "import { read } from '../read/bars';\nexport const a = read;",
  'value-import-of-a-store.ts':
    "import { save } from '../store/profile';\nexport const a = save;",
  'value-reexport-of-the-route-layer.ts':
    "export { authorize } from '../server/session';",
  'database-client.ts':
    "import { prisma } from '@/lib/db/prisma';\nexport const a = prisma;",
  'math.ts': 'export const a = Math.floor(2);',
  'number-of-a-string.ts': "export const a = Number('5');",
  'length-arithmetic.ts':
    "const text = 'a.b';\nexport const a = text.length - text.indexOf('.') - 1;",
  'to-locale-string.ts': 'export const a = (1).toLocaleString();',
};
const GOOD_IN_TEMPLATES: Record<string, string> = {
  'parent-and-sibling.ts':
    "import { x } from '../parent';\nimport { y } from './sibling';\nexport const a = [x, y];",
  'type-only-from-the-route-layer.ts':
    "import type { Caller } from '../server/session';\nexport type A = Caller;",
  'type-only-reexport-from-a-reader.ts':
    "export type { Read } from '../read/bars';",
};

const GOOD: Record<string, string> = {
  'bigint.ts':
    'const a = 5n * 3n;\nconst b = -a;\nconst c = a ** 2n;\nlet d = 1n;\nd += 2n;\nd -= 1n;\nexport const e = d % 2n === 0n ? a / 3n : b;',
  'strings.ts':
    "const a = 'x' + 'y';\nconst b = `${a}${1n}`;\nexport const c = b.slice(1).padStart(3, '0');",
  'comparison.ts':
    'const list = [1n, 2n];\nexport const a = list.length > 1 && list.length <= 2 && 3 < 4;',
  'conversions.ts':
    "export const a = BigInt(3);\nexport const b = String(a);\nexport const c = BigInt('7') + 1n;",
  'number-of-a-bigint.ts':
    'const a: bigint = 5n;\nexport const b = Number(a);\nexport const c = Number(7n);',
  'integers.ts': 'export const a = [10, 20].slice(1, 2);',
  'logical-not.ts':
    'declare const a: any;\ndeclare const b: number;\nexport const c = [!a, !b, !!a];',
  'negative-integer-literal.ts':
    'export function sign(a: bigint): -1 | 0 | 1 {\n  return a < 0n ? -1 : a > 0n ? 1 : 0;\n}',
  'words-in-comments.ts':
    "// Math, parseFloat and Number(…) are only words here\n/* toFixed */\nexport const a = 'Math.floor 0.25 1e3';",
  'sibling-import.ts': "export { x } from './elsewhere';",
  'type-only-export-of-the-reader.ts':
    "export type { Read } from './read/structure';",
  'type-only-import-of-the-reader.ts':
    "import type { Read } from './read/structure';\nexport type A = Read;",
  'type-only-import-of-a-store.ts':
    "import type { Store } from './store/profile';\nexport type A = Store;",
  'type-only-import-of-the-route-layer.ts':
    "import type { Caller } from './server/session';\nexport type A = Caller;",
};

/** More snippets for the pure files: a store's code must never be reached from them. */
Object.assign(BAD, {
  'value-import-of-a-store.ts':
    "import { save } from './store/profile';\nexport const a = save;",
  'value-reexport-of-a-store.ts': "export { save } from './store/profile';",
  'database-client-in-a-pure-file.ts':
    "import { prisma } from '@/lib/db/prisma';\nexport const a = prisma;",
  'value-import-of-the-route-layer.ts':
    "import { authorize } from './server/session';\nexport const a = authorize;",
  'value-reexport-of-the-route-layer.ts':
    "export { authorize } from './server/session';",
});

describe('the guard itself', () => {
  const sources = new Map<string, string>();
  for (const [name, text] of Object.entries(BAD))
    sources.set(`/guard-self-test/bad/${name}`, text);
  for (const [name, text] of Object.entries(GOOD))
    sources.set(`/guard-self-test/good/${name}`, text);
  // a sibling for the allowed re-export
  sources.set('/guard-self-test/good/elsewhere.ts', 'export const x = 1n;');
  for (const [name, text] of Object.entries(BAD_IN_READ))
    sources.set(`/guard-self-test/bad/read/${name}`, text);
  for (const [name, text] of Object.entries(GOOD_IN_READ))
    sources.set(`/guard-self-test/good/read/${name}`, text);
  sources.set('/guard-self-test/good/parent.ts', 'export const x = 1n;');
  for (const [name, text] of Object.entries(BAD_IN_STORE))
    sources.set(`/guard-self-test/bad/store/${name}`, text);
  for (const [name, text] of Object.entries(GOOD_IN_STORE))
    sources.set(`/guard-self-test/good/store/${name}`, text);
  sources.set('/guard-self-test/good/store/sibling.ts', 'export const y = 1n;');
  for (const [name, text] of Object.entries(BAD_IN_SERVER))
    sources.set(`/guard-self-test/bad/server/${name}`, text);
  for (const [name, text] of Object.entries(GOOD_IN_SERVER))
    sources.set(`/guard-self-test/good/server/${name}`, text);
  sources.set(
    '/guard-self-test/good/server/sibling.ts',
    'export const y = 1n;'
  );
  for (const [name, text] of Object.entries(BAD_IN_TEMPLATES))
    sources.set(`/guard-self-test/bad/templates/${name}`, text);
  for (const [name, text] of Object.entries(GOOD_IN_TEMPLATES))
    sources.set(`/guard-self-test/good/templates/${name}`, text);
  sources.set(
    '/guard-self-test/good/templates/sibling.ts',
    'export const y = 1n;'
  );
  const found = analyse(sources);

  test.each(Object.keys(BAD_IN_TEMPLATES))(
    'catches %s in a templates/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/bad/templates/${name}`)
          .length
      ).toBeGreaterThan(0);
    }
  );

  test.each(Object.keys(GOOD_IN_TEMPLATES))(
    'leaves %s alone in a templates/ folder',
    (name) => {
      expect(
        found.filter(
          (v) => v.file === `/guard-self-test/good/templates/${name}`
        )
      ).toEqual([]);
    }
  );

  test.each(Object.keys(BAD_IN_SERVER))(
    'catches %s in a server/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/bad/server/${name}`)
          .length
      ).toBeGreaterThan(0);
    }
  );

  test.each(Object.keys(GOOD_IN_SERVER))(
    'leaves %s alone in a server/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/good/server/${name}`)
      ).toEqual([]);
    }
  );

  test.each(Object.keys(BAD_IN_STORE))(
    'catches %s in a store/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/bad/store/${name}`)
          .length
      ).toBeGreaterThan(0);
    }
  );

  test.each(Object.keys(GOOD_IN_STORE))(
    'leaves %s alone in a store/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/good/store/${name}`)
      ).toEqual([]);
    }
  );

  test.each(Object.keys(BAD_IN_READ))(
    'catches %s in a read/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/bad/read/${name}`)
          .length
      ).toBeGreaterThan(0);
    }
  );

  test.each(Object.keys(GOOD_IN_READ))(
    'leaves %s alone in a read/ folder',
    (name) => {
      expect(
        found.filter((v) => v.file === `/guard-self-test/good/read/${name}`)
      ).toEqual([]);
    }
  );

  test.each(Object.keys(BAD))('catches %s', (name) => {
    expect(
      found.filter((v) => v.file === `/guard-self-test/bad/${name}`).length
    ).toBeGreaterThan(0);
  });

  test.each(Object.keys(GOOD))('leaves %s alone', (name) => {
    expect(
      found.filter((v) => v.file === `/guard-self-test/good/${name}`)
    ).toEqual([]);
  });
});

describe('lib/engine4', () => {
  const files = sourceFilesUnder(ENGINE_DIR);

  test('holds the files of parts 1 to 7', () => {
    const names = files.map((file) => file.slice(file.lastIndexOf('/') + 1));
    expect(names).toEqual(
      expect.arrayContaining([
        'exact.ts',
        'index.ts',
        'profile.ts',
        'scenarios.ts',
        'sizing.ts',
        'types.ts',
        'underflow.ts',
        'badge.ts',
        'levels.ts',
        'room.ts',
        'stops.ts',
        'zone.ts',
        'structure-levels.ts',
        'time.ts',
        'blackout.ts',
        'broker.ts',
        'offer.ts',
        'cycle.ts',
        'specs.ts',
        'events.ts',
        'entry-bound.ts',
        'modal-definition.ts',
        'validate.ts',
        'version.ts',
        'user-hash.ts',
        'profile-store.ts',
        'consent-store.ts',
        'bars.ts',
        'synthesis.ts',
        'context.ts',
        'errors.ts',
        'handlers.ts',
        'idempotency.ts',
        'request.ts',
        'respond.ts',
        'session.ts',
        'setup.ts',
        'trace.ts',
        'versions.ts',
        'wire.ts',
        'text.ts',
        'messages.ts',
        'fields.ts',
        'report2.ts',
      ])
    );
  });

  test('has no Math, parseFloat, toFixed, Number, fractional literal or arithmetic on a number', () => {
    const sources = new Map<string, string>();
    for (const file of files) sources.set(file, readFileSync(file, 'utf8'));
    expect(analyse(sources)).toEqual([]);
  });
});
