/**
 * @jest-environment node
 */

/**
 * The boundaries guard of `lib/intake` (build step 6, parts 1 and 2).
 *
 *  1. The pure files (the folder itself and `text/`) import only their siblings and, for the
 *     two files named below, one outside module each. They do no I/O and nothing that
 *     differs from one run to the next: no network, no process, no clock, no randomness,
 *     no browser globals. A client component may import the barrel.
 *  2. What touches a database, Redis, the session or the network (`read/`, `server/`, parts
 *     4 and 5) is imported BY PATH, never through the barrel, and a pure file may name its
 *     types only. Those two folders have no allow-list yet: the part that creates one adds
 *     its rules here, and until then the guard refuses a file in it.
 *  3. The barrel re-exports no value of `read/`, `server/` or `check.ts` (the internal toolkit).
 *  4. Nothing outside `lib/intake` imports it yet. Each later part that adds a caller (a
 *     route, a page, a component) adds that file to ALLOWED_IMPORTERS on purpose.
 *
 * The guard is itself tested: the snippets below must be caught, and the allowed forms must not.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, posix, resolve } from 'path';
import * as ts from 'typescript';

const ROOT = resolve(__dirname, '..', '..', '..');
const INTAKE_DIR = join(ROOT, 'lib', 'intake');

/** The one outside module a pure file may import, by file (path inside `lib/intake`). */
const OUTSIDE_IMPORTS: Readonly<Record<string, readonly string[]>> = {
  'locales.ts': ['@/lib/i18n/languages'],
  'roster.ts': ['@/config/intake/sensor-roster.json'],
  'text/glossary.ts': ['@/config/intake/glossary.v1.json'],
};

/** Files outside `lib/intake` that may import it. Parts 1 and 2: none. */
const ALLOWED_IMPORTERS: readonly string[] = [];

/** Names that mean input, output, time, randomness or a browser. */
const FORBIDDEN_NAMES = new Set([
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'process',
  'require',
  'module',
  '__dirname',
  '__filename',
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'console',
  'Date',
  'randomUUID',
  'getRandomValues',
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
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out.sort();
}

function isTypeOnly(
  node: ts.ImportDeclaration | ts.ExportDeclaration
): boolean {
  return ts.isImportDeclaration(node)
    ? node.importClause?.isTypeOnly === true
    : node.isTypeOnly;
}

/** The name of a node in a position where it is a label, not a use of a variable. */
function isLabel(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === node;
  if (
    ts.isPropertyAssignment(parent) ||
    ts.isPropertySignature(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isMethodSignature(parent) ||
    ts.isShorthandPropertyAssignment(parent)
  ) {
    return parent.name === node;
  }
  if (ts.isBindingElement(parent)) return parent.propertyName === node;
  return false;
}

/** Where a relative specifier leads, as a path inside `lib/intake` (or outside it). */
function resolveRelative(file: string, specifier: string): string {
  return posix.normalize(posix.join(posix.dirname(file), specifier));
}

const folderOf = (file: string): string =>
  file.includes('/') ? (file.split('/')[0] as string) : '';

/** Check a set of files, given as `relative path -> source text`. */
function analyse(sources: Map<string, string>): Violation[] {
  const found: Violation[] = [];
  for (const [file, text] of sources) {
    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.ES2020,
      true
    );
    const report = (node: ts.Node, rule: string): void => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
      );
      found.push({
        file,
        line: line + 1,
        rule,
        text: node.getText(sourceFile).slice(0, 80),
      });
    };

    const folder = folderOf(file);
    if (folder !== '' && folder !== 'text') {
      report(
        sourceFile,
        `a file in ${folder}/: this folder has no allow-list in the guard yet, add one with the code`
      );
      continue;
    }

    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        const typeOnly = isTypeOnly(node);
        if (specifier.startsWith('.')) {
          const target = resolveRelative(file, specifier);
          if (target.startsWith('..')) {
            report(node, `import of ${specifier}: it leaves lib/intake`);
          } else if (
            (target.startsWith('read/') || target.startsWith('server/')) &&
            !typeOnly
          ) {
            report(node, `value import of ${specifier}: name its types only`);
          } else if (target === 'check' && file === 'index.ts' && !typeOnly) {
            report(node, 'the barrel exports a value of the internal toolkit');
          }
        } else if (!(OUTSIDE_IMPORTS[file] ?? []).includes(specifier)) {
          report(node, `import of ${specifier}: not allowed in this file`);
        }
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        report(node, 'dynamic import');
      }
      if (
        ts.isIdentifier(node) &&
        FORBIDDEN_NAMES.has(node.text) &&
        !isLabel(node)
      ) {
        report(node, `forbidden name ${node.text}`);
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Math' &&
        node.name.text === 'random'
      ) {
        report(node, 'Math.random');
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ['randomUUID', 'getRandomValues'].includes(node.name.text)
      ) {
        report(node, `forbidden name ${node.name.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return found;
}

function loadSources(): Map<string, string> {
  const sources = new Map<string, string>();
  for (const full of sourceFilesUnder(INTAKE_DIR)) {
    const rel = normal(full).slice(normal(INTAKE_DIR).length + 1);
    sources.set(rel, readFileSync(full, 'utf8'));
  }
  return sources;
}

// ---------------------------------------------------------------------------------------

describe('lib/intake', () => {
  const sources = loadSources();

  it('has the files of parts 1 and 2', () => {
    expect([...sources.keys()]).toEqual([
      'canonical.ts',
      'check.ts',
      'index.ts',
      'intents.ts',
      'locales.ts',
      'packet.ts',
      'refusal.ts',
      'roster.ts',
      'text/glossary.ts',
      'text/limits.ts',
      'text/normalize.ts',
      'text/scope.ts',
      'text/understand-fixture.ts',
      'text/understand.ts',
      'version.ts',
    ]);
  });

  it('keeps its pure files pure: siblings only, no I/O, no clock, no randomness', () => {
    expect(analyse(sources)).toEqual([]);
  });

  it('exports its public surface from the barrel and not the toolkit’s values', () => {
    const barrel = sources.get('index.ts') as string;
    expect(barrel).toMatch(
      /export type \{ Issue, IssueCode \} from '\.\/check'/
    );
    expect(barrel).not.toMatch(/export \{[^}]*\} from '\.\/check'/);
    expect(barrel).not.toMatch(/from '\.\/(read|server)\//);
  });

  it('is imported by nothing outside it (parts 1 and 2)', () => {
    const importer =
      /(?:from|import|require\()\s*['"](?:@\/lib\/intake|(?:\.\.?\/)+lib\/intake)(?:\/[^'"]*)?['"]/;
    const roots = [
      'app',
      'components',
      'hooks',
      'lib',
      'src',
      'types',
      'pages',
      'config',
    ];
    const found: string[] = [];
    let scanned = 0;
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (normal(full) === normal(INTAKE_DIR)) continue;
          scan(full);
        } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
          scanned += 1;
          if (importer.test(readFileSync(full, 'utf8'))) {
            found.push(normal(full).slice(normal(ROOT).length + 1));
          }
        }
      }
    };
    for (const root of roots) {
      try {
        scan(join(ROOT, root));
      } catch {
        // a root that does not exist in this checkout
      }
    }
    expect(scanned).toBeGreaterThan(500);
    expect(found.sort()).toEqual([...ALLOWED_IMPORTERS].sort());
  });
});

describe('Engine 4 and lib/intake', () => {
  it('stay apart: the engine imports nothing of the intake path', () => {
    const importer = /lib\/intake|from ['"]\.\.\/intake/;
    for (const full of sourceFilesUnder(join(ROOT, 'lib', 'engine4'))) {
      expect({
        full,
        found: importer.test(readFileSync(full, 'utf8')),
      }).toEqual({
        full,
        found: false,
      });
    }
  });
});

// ---------------------------------------------------------------------------------------
// The guard must itself bite
// ---------------------------------------------------------------------------------------

const rules = (files: Record<string, string>): string[] =>
  analyse(new Map(Object.entries(files))).map((v) => v.rule);

describe('the guard', () => {
  const BAD: Record<string, string> = {
    'fetch.ts': "export const a = fetch('https://example.com');",
    'process.ts': 'export const a = process.env.X;',
    'random.ts': 'export const a = Math.random();',
    'now.ts': 'export const a = Date.now();',
    'new-date.ts': 'export const a = new Date();',
    'date-type-only-name.ts': 'export const a: Date | null = null;',
    'require.ts': "export const a = require('fs');",
    'window.ts': 'export const a = window.innerWidth;',
    'document.ts': 'export const a = document.title;',
    'storage.ts': "export const a = localStorage.getItem('x');",
    'timer.ts': 'export const a = setTimeout(() => 1, 1);',
    'console.ts': "export const a = console.log('x');",
    'uuid.ts': 'export const a = globalThis.crypto.randomUUID();',
    'random-values.ts':
      'export const a = globalThis.crypto.getRandomValues(new Uint8Array(1));',
    'import-fs.ts':
      "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
    'import-crypto.ts':
      "import { createHash } from 'crypto';\nexport const a = createHash;",
    'import-alias.ts':
      "import { x } from '@/lib/engine4';\nexport const a = x;",
    'import-prisma.ts':
      "import { p } from '@/lib/db/prisma';\nexport const a = p;",
    'import-package.ts': "import React from 'react';\nexport const a = React;",
    'import-up.ts':
      "import { x } from '../engine4/profile';\nexport const a = x;",
    'import-up-from-text.ts':
      "import { x } from '../../elsewhere';\nexport const a = x;",
    'value-import-read.ts':
      "import { r } from './read/snapshot';\nexport const a = r;",
    'value-export-server.ts': "export { r } from './server/respond';",
    'dynamic-import.ts': "export const a = () => import('./read/snapshot');",
    'outside-allow-list.ts':
      "import l from '@/lib/i18n/languages';\nexport const a = l;",
  };

  it.each(Object.entries(BAD))('catches %s', (name, text) => {
    expect(rules({ [name]: text }).length).toBeGreaterThan(0);
  });

  it('catches an import that is allowed for another file', () => {
    expect(
      rules({
        'packet.ts':
          "import l from '@/lib/i18n/languages';\nexport const a = l;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'locales.ts':
          "import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';\nexport const a = SUPPORTED_LANGUAGES;",
      })
    ).toEqual([]);
    expect(
      rules({
        'roster.ts':
          "import r from '@/config/intake/sensor-roster.json';\nexport const a = r;",
      })
    ).toEqual([]);
    expect(
      rules({
        'roster.ts':
          "import r from '@/config/intake/other.json';\nexport const a = r;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'text/glossary.ts':
          "import g from '@/config/intake/glossary.v1.json';\nexport const a = g;",
      })
    ).toEqual([]);
    expect(
      rules({
        'text/scope.ts':
          "import g from '@/config/intake/glossary.v1.json';\nexport const a = g;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('refuses any file in a folder it has no rules for, but accepts text/ as pure', () => {
    expect(rules({ 'read/snapshot.ts': 'export const a = 1;' })).toEqual([
      expect.stringContaining('a file in read/'),
    ]);
    expect(rules({ 'server/respond.ts': 'export const a = 1;' })).toEqual([
      expect.stringContaining('a file in server/'),
    ]);
    expect(rules({ 'other/x.ts': 'export const a = 1;' })).toEqual([
      expect.stringContaining('a file in other/'),
    ]);
    expect(
      rules({
        'text/normalize.ts':
          "import { x } from '../check';\nexport const a = x;",
      })
    ).toEqual([]);
    expect(
      rules({
        'text/normalize.ts':
          "import { x } from './glossary';\nexport const a = x;",
      })
    ).toEqual([]);
    expect(
      rules({
        'text/normalize.ts':
          "import { x } from '../../engine4/profile';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('catches the barrel exporting a value of the toolkit', () => {
    expect(rules({ 'index.ts': "export { Issues } from './check';" })).toEqual([
      expect.stringContaining('internal toolkit'),
    ]);
  });

  const GOOD: Record<string, string> = {
    'sibling.ts': "import { x } from './check';\nexport const a = x;",
    'type-of-read.ts':
      "import type { Row } from './read/snapshot';\nexport type A = Row;",
    'type-export-of-server.ts':
      "export type { Answer } from './server/respond';",
    'barrel-type-of-toolkit.ts': "export type { Issue } from './check';",
    'web-crypto.ts':
      'export const a = (text: string) => globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));',
    'a-property-called-process.ts':
      'const x = { process: 1, now: 2, console: 3, Date: 4 };\nexport const a = x.process + x.now + x.console + x.Date;',
    'math.ts': 'export const a = Math.floor(2.5) + Math.max(1, 2);',
    'destructured-label.ts':
      'const { process: p } = { process: 1 };\nexport const a = p;',
    'json.ts': 'export const a = JSON.stringify({ k: 1 });',
  };

  it.each(Object.entries(GOOD))('leaves %s alone', (name, text) => {
    expect(rules({ [name]: text })).toEqual([]);
  });
});
