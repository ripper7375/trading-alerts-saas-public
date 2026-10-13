/**
 * @jest-environment node
 */

/**
 * The boundaries guard of `lib/intake` (build step 6, parts 1 to 5).
 *
 *  1. The pure files (the folder itself and `text/`) import only their siblings and, for the
 *     two files named below, one outside module each. They do no I/O and nothing that
 *     differs from one run to the next: no network, no process, no clock, no randomness,
 *     no browser globals. A client component may import the barrel.
 *  2. What touches a database, Redis, the session or the network (`read/`, part 4, and
 *     `server/`, part 5) is imported BY PATH, never through the barrel, and a pure file may
 *     name its types only. `read/` has an allow-list below: each reader may import its
 *     siblings of the pure folder and the one or two outside modules it is named for, and
 *     nothing that differs from one run to the next (no clock, no randomness, no process).
 *     `server/` (part 5) is the route layer: it reads the session, the database, the network and
 *     the environment, so the clock and the process are its to use, but it may import only the
 *     outside modules named for each of its files below, and nothing pure may import it.
 *     Two ADAPTERS in the pure folders call the network and use a timer (`knowledge-client.ts`
 *     and `text/understand-model.ts`): they may use `fetch` and `setTimeout` and nothing else
 *     that differs from one run to the next, import no outside module, and a pure file may name
 *     their types only.
 *  3. The barrel re-exports no value of `read/`, `server/`, an adapter or `check.ts` (the internal toolkit).
 *  4. Nothing outside `lib/intake` imports it except the files named in ALLOWED_IMPORTERS: the two
 *     routes and the dev preview. Each later part that adds a caller adds that file there on purpose.
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
  'matrix.ts': ['@/config/intake/dispatch-matrix.v1.json'],
  'roster.ts': ['@/config/intake/sensor-roster.json'],
  'text/glossary.ts': ['@/config/intake/glossary.v1.json'],
  // the readers (part 4): each is allowed the modules it is named for and no other
  'read/events.ts': [
    '@/config/engine4/tier1-events.json',
    '@/lib/db/market-prisma',
  ],
  'read/profile.ts': ['@/lib/engine4/store/profile-store'],
  'read/snapshot.ts': [
    'crypto',
    '@/lib/active-indicator/gateway-client',
    '@/lib/db/market-prisma',
  ],
  // the route layer (part 5)
  'server/access.ts': [
    '@/lib/auth/session',
    '@/lib/i18n/server-locale',
    '@/lib/tier-validation',
  ],
  'server/reply.ts': ['@/lib/i18n/get-dictionary'],
  'server/respond.ts': ['crypto'],
};

/**
 * The two adapters that call the network. Each may use the names listed (and no other name the
 * guard forbids), imports no outside module, and is imported by a pure file for its types only.
 */
const ADAPTERS: Readonly<Record<string, readonly string[]>> = {
  'knowledge-client.ts': ['fetch', 'setTimeout'],
  'text/understand-model.ts': ['fetch', 'setTimeout'],
};
const ADAPTER_TARGETS: ReadonlySet<string> = new Set(
  Object.keys(ADAPTERS).map((file) => file.replace(/\.ts$/, ''))
);

/** Files outside `lib/intake` that may import it: the two routes (part 5) and the dev preview. */
const ALLOWED_IMPORTERS: readonly string[] = [
  'app/api/intake/instant/route.ts',
  'app/api/intake/route.ts',
  'app/dev/intake/page.tsx',
  'app/dev/intake/world.ts',
];

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
    if (
      folder !== '' &&
      folder !== 'text' &&
      folder !== 'read' &&
      folder !== 'server'
    ) {
      report(
        sourceFile,
        `a file in ${folder}/: this folder has no allow-list in the guard yet, add one with the code`
      );
      continue;
    }
    const isServer = folder === 'server';
    const allowedNames = ADAPTERS[file] ?? [];

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
            !isServer &&
            ((target.startsWith('read/') && folder !== 'read') ||
              target.startsWith('server/') ||
              (ADAPTER_TARGETS.has(target) && file !== `${target}.ts`)) &&
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
        !isServer &&
        ts.isIdentifier(node) &&
        FORBIDDEN_NAMES.has(node.text) &&
        !allowedNames.includes(node.text) &&
        !isLabel(node)
      ) {
        report(node, `forbidden name ${node.text}`);
      }
      if (
        !isServer &&
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Math' &&
        node.name.text === 'random'
      ) {
        report(node, 'Math.random');
      }
      if (
        !isServer &&
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

  it('has the files of parts 1 to 5', () => {
    expect([...sources.keys()]).toEqual([
      'board.ts',
      'canonical.ts',
      'check.ts',
      'facts.ts',
      'gate.ts',
      'index.ts',
      'intents.ts',
      'knowledge-client.ts',
      'locales.ts',
      'matrix.ts',
      'packet.ts',
      'pipeline.ts',
      'read/events.ts',
      'read/profile.ts',
      'read/snapshot.ts',
      'refusal.ts',
      'roster.ts',
      'router.ts',
      'server/access.ts',
      'server/errors.ts',
      'server/reply.ts',
      'server/request.ts',
      'server/respond.ts',
      'slots.ts',
      'text.ts',
      'text/glossary.ts',
      'text/limits.ts',
      'text/normalize.ts',
      'text/scope.ts',
      'text/understand-fixture.ts',
      'text/understand-model.ts',
      'text/understand.ts',
      'trace.ts',
      'version.ts',
      'warnings.ts',
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
    expect(barrel).not.toMatch(/from '[^']*(read|server)\//);
    expect(barrel).not.toMatch(
      /from '[^']*(knowledge-client|understand-model)'/
    );
  });

  it('keeps the readers apart: a pure file names their types only, and they import no server code', () => {
    for (const [file, text] of sources) {
      const folder = folderOf(file);
      // the imports that survive compilation: `import type` and `export type` are erased
      const values = [
        ...text.matchAll(
          /^(?:import|export)\s+(?!type\b)[^;]*?from '(\.[^']*)'/gm
        ),
      ].map((m) => m[1] as string);
      const all = [...text.matchAll(/from '(\.[^']*)'/g)].map(
        (m) => m[1] as string
      );
      if (folder === 'read') {
        for (const specifier of all) {
          const target = resolveRelative(file, specifier);
          expect({ file, serves: target.startsWith('server/') }).toEqual({
            file,
            serves: false,
          });
        }
      } else if (folder !== 'server') {
        for (const specifier of values) {
          const target = resolveRelative(file, specifier);
          expect({
            file,
            reaches:
              target.startsWith('read/') ||
              target.startsWith('server/') ||
              (ADAPTER_TARGETS.has(target) && file !== `${target}.ts`),
          }).toEqual({ file, reaches: false });
        }
      }
    }
  });

  it('gives each adapter no outside module, and each server file exactly the modules the guard names', () => {
    for (const file of Object.keys(ADAPTERS)) {
      const text = sources.get(file) as string;
      expect({
        file,
        outside: [...text.matchAll(/from '([^.][^']*)'/g)].map((m) => m[1]),
      }).toEqual({ file, outside: [] });
    }
    for (const file of [
      'server/access.ts',
      'server/errors.ts',
      'server/reply.ts',
      'server/request.ts',
      'server/respond.ts',
    ]) {
      const text = sources.get(file) as string;
      const outside = [...text.matchAll(/from '([^.][^']*)'/g)]
        .map((m) => m[1])
        .sort();
      expect({ file, outside }).toEqual({
        file,
        outside: [...(OUTSIDE_IMPORTS[file] ?? [])].sort(),
      });
    }
  });

  it('gives each reader exactly the outside modules the guard names for it', () => {
    for (const file of [
      'read/events.ts',
      'read/profile.ts',
      'read/snapshot.ts',
    ]) {
      const text = sources.get(file) as string;
      const outside = [...text.matchAll(/from '([^.][^']*)'/g)]
        .map((m) => m[1])
        .sort();
      expect({ file, outside }).toEqual({
        file,
        outside: [...(OUTSIDE_IMPORTS[file] ?? [])].sort(),
      });
    }
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

  it('refuses any file in a folder it has no rules for, but accepts text/ and server/', () => {
    expect(rules({ 'server/respond.ts': 'export const a = 1;' })).toEqual([]);
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

  it('lets the route layer use the clock, the process and the network, but only the outside modules named for each file', () => {
    expect(
      rules({
        'server/respond.ts':
          "import { randomUUID } from 'crypto';\nexport const a = [randomUUID(), Date.now(), process.env.X, console.log('x'), fetch('u'), new Date(), Math.random()];",
      })
    ).toEqual([]);
    expect(
      rules({
        'server/access.ts':
          "import { getSession } from '@/lib/auth/session';\nexport const a = getSession;",
      })
    ).toEqual([]);
    // a module named for another server file, or none, is not
    expect(
      rules({
        'server/respond.ts':
          "import { getSession } from '@/lib/auth/session';\nexport const a = getSession;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'server/new-file.ts':
          "import { p } from '@/lib/db/prisma';\nexport const a = p;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'server/request.ts':
          "import { x } from '../../engine4/profile';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
    // the route layer may use a reader, an adapter and a pure sibling by value
    expect(
      rules({
        'server/access.ts':
          "import { r } from '../read/snapshot';\nimport { k } from '../knowledge-client';\nimport { u } from '../text/understand-model';\nimport { b } from '../board';\nexport const a = [r, k, u, b];",
      })
    ).toEqual([]);
  });

  it('lets an adapter use the network and a timer, and nothing else that differs from one run to the next', () => {
    for (const file of ['knowledge-client.ts', 'text/understand-model.ts']) {
      expect(
        rules({
          [file]:
            "export const a = [fetch('u'), setTimeout(() => 1, 1), new AbortController()];",
        })
      ).toEqual([]);
      for (const body of [
        'export const a = Date.now();',
        'export const a = new Date();',
        'export const a = process.env.X;',
        'export const a = Math.random();',
        "export const a = console.log('x');",
        'export const a = globalThis.crypto.randomUUID();',
        "export const a = require('fs');",
        'export const a = setInterval(() => 1, 1);',
      ]) {
        expect(rules({ [file]: body }).length).toBeGreaterThan(0);
      }
      expect(
        rules({
          [file]:
            "import { createHash } from 'crypto';\nexport const a = createHash;",
        }).length
      ).toBeGreaterThan(0);
    }
    // the network is not free for any other pure file
    expect(
      rules({ 'gate.ts': "export const a = fetch('u');" }).length
    ).toBeGreaterThan(0);
    expect(
      rules({ 'pipeline.ts': 'export const a = setTimeout(() => 1, 1);' })
        .length
    ).toBeGreaterThan(0);
    expect(
      rules({ 'text/understand.ts': "export const a = fetch('u');" }).length
    ).toBeGreaterThan(0);
  });

  it('lets a pure file name an adapter’s types only', () => {
    expect(
      rules({
        'pipeline.ts':
          "import { createKnowledgeClient } from './knowledge-client';\nexport const a = createKnowledgeClient;",
      })
    ).toEqual([expect.stringContaining('value import of ./knowledge-client')]);
    expect(
      rules({
        'text/scope.ts':
          "import { createModelUnderstandPort } from './understand-model';\nexport const a = createModelUnderstandPort;",
      })
    ).toEqual([expect.stringContaining('value import of ./understand-model')]);
    expect(
      rules({
        'pipeline.ts':
          "import type { KnowledgePort } from './knowledge-client';\nexport type A = KnowledgePort;",
      })
    ).toEqual([]);
    expect(
      rules({
        'text/understand-model.ts':
          "import { runUnderstand } from './understand';\nexport const a = runUnderstand;",
      })
    ).toEqual([]);
  });

  it('holds a reader to its allow-list: its own modules, and nothing else', () => {
    // the modules a reader is named for are fine
    expect(
      rules({
        'read/snapshot.ts':
          "import { createHash } from 'crypto';\nimport { m } from '@/lib/db/market-prisma';\nimport { f } from '@/lib/active-indicator/gateway-client';\nexport const a = [createHash, m, f];",
      })
    ).toEqual([]);
    // a module named for another reader, or none, is not
    expect(
      rules({
        'read/events.ts':
          "import { createHash } from 'crypto';\nexport const a = createHash;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'read/profile.ts':
          "import { p } from '@/lib/db/prisma';\nexport const a = p;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'read/snapshot.ts':
          "import { x } from '@/lib/engine4';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules({
        'read/new-reader.ts':
          "import { m } from '@/lib/db/market-prisma';\nexport const a = m;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('keeps a reader free of the clock, randomness, the process and the network', () => {
    const header = "import { m } from '@/lib/db/market-prisma';\n";
    for (const body of [
      'export const a = [m, Date.now()];',
      'export const a = [m, new Date()];',
      'export const a = [m, process.env.X];',
      'export const a = [m, Math.random()];',
      "export const a = [m, fetch('https://example.com')];",
      'export const a = [m, setTimeout(() => 1, 1)];',
      "export const a = [m, console.log('x')];",
      'export const a = [m, globalThis.crypto.randomUUID()];',
    ]) {
      expect(
        rules({ 'read/snapshot.ts': header + body }).length
      ).toBeGreaterThan(0);
    }
  });

  it('lets a reader use a pure sibling by value, and a pure file never a reader', () => {
    expect(
      rules({
        'read/snapshot.ts':
          "import { x } from '../board';\nexport const a = x;",
      })
    ).toEqual([]);
    expect(
      rules({
        'read/events.ts':
          "import { s } from './snapshot';\nexport const a = s;",
      })
    ).toEqual([]);
    expect(
      rules({
        'read/snapshot.ts':
          "import { r } from '../server/respond';\nexport const a = r;",
      })
    ).toEqual([expect.stringContaining('value import of ../server/respond')]);
    expect(
      rules({
        'board.ts': "import { r } from './read/snapshot';\nexport const a = r;",
      })
    ).toEqual([expect.stringContaining('value import of ./read/snapshot')]);
    expect(
      rules({
        'text/normalize.ts':
          "import { r } from '../read/snapshot';\nexport const a = r;",
      })
    ).toEqual([expect.stringContaining('value import of ../read/snapshot')]);
    expect(
      rules({
        'board.ts':
          "import type { R } from './read/snapshot';\nexport type A = R;",
      })
    ).toEqual([]);
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
