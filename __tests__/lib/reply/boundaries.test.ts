/**
 * @jest-environment node
 */

/**
 * The boundaries of `lib/reply` and `lib/platform` (build step 7, part 1).
 *
 *  1. `lib/reply` is PURE: it does no I/O and nothing that differs from one run to the next
 *     (no network, no process, no clock, no randomness, no browser globals, no database). Its
 *     files import only their siblings, and `contracts/intake.ts` is the ONE file that reads
 *     the intake path (so `__tests__/lib/intake/boundaries.test.ts` lists one importer for the
 *     whole reply path).
 *  2. `lib/platform` may touch the database, but each file may import only the outside
 *     modules named for it below, and none of it may use the network, the process, the
 *     console or a browser global. The clock is `messages-store.ts`'s alone (its default `now`).
 *  3. Nothing outside `lib/reply` and `lib/platform` imports them yet: step 7 part 1 builds
 *     contracts, tables and stores, and wires no route and no component. A later part that
 *     adds a caller adds it to ALLOWED_IMPORTERS on purpose.
 *
 * The guard is itself tested: the snippets below must be caught, and the allowed forms must not.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, posix, resolve } from 'path';
import * as ts from 'typescript';

const ROOT = resolve(__dirname, '..', '..', '..');
const REPLY_DIR = join(ROOT, 'lib', 'reply');
const PLATFORM_DIR = join(ROOT, 'lib', 'platform');

/** The outside modules each file may import (path inside its own tree). */
const REPLY_OUTSIDE: Readonly<Record<string, readonly string[]>> = {
  'contracts/intake.ts': [
    '@/lib/intake',
    '@/lib/intake/check',
    '@/lib/intake/slots',
  ],
};

const PLATFORM_OUTSIDE: Readonly<Record<string, readonly string[]>> = {
  'delivered.ts': [
    '@/lib/reply/contracts/intake',
    '@/lib/reply/contracts/result',
    '@/lib/reply/contracts/trace-fields',
  ],
  'chat/messages-store.ts': ['@/lib/db/prisma', '@/lib/reply/contracts/intake'],
  'chat/threads-store.ts': ['@/lib/db/prisma', '@/lib/reply/contracts/intake'],
  'chat/title.ts': [
    '@/lib/reply/contracts/intake',
    '@/lib/reply/contracts/shape',
  ],
  'traces/hash.ts': ['@/lib/engine4/store/user-hash'],
  'traces/retention.ts': [],
  'traces/store.ts': [
    '@/lib/db/prisma',
    '@/lib/reply/contracts/intake',
    '@/lib/reply/contracts/trace-fields',
    'crypto',
  ],
};

/** Files outside both trees that may import them: none in part 1. */
const ALLOWED_IMPORTERS: readonly string[] = [];

/** Names that mean input, output, randomness or a browser. `Date` is judged separately. */
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
  'randomUUID',
  'getRandomValues',
]);

/** The one file that may read the clock (its default `now`). */
const CLOCK_FILES: ReadonlySet<string> = new Set(['chat/messages-store.ts']);

interface Violation {
  file: string;
  line: number;
  rule: string;
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

interface Tree {
  /** `@/lib/reply` or `@/lib/platform`: the alias of a sibling inside the same tree is allowed */
  alias: string;
  outside: Readonly<Record<string, readonly string[]>>;
}

/** Check files given as `path inside the tree -> source text`. */
function analyse(tree: Tree, sources: Map<string, string>): Violation[] {
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
      found.push({ file, line: line + 1, rule });
    };
    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('.')) {
          if (
            posix
              .normalize(posix.join(posix.dirname(file), specifier))
              .startsWith('..')
          ) {
            report(node, `import of ${specifier}: it leaves ${tree.alias}`);
          }
        } else if (specifier.startsWith(`${tree.alias}/`)) {
          // a module of the same tree by alias: allowed
        } else if (!(tree.outside[file] ?? []).includes(specifier)) {
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
      // the clock: `Date.now()` and `new Date()` with no argument
      if (!CLOCK_FILES.has(file)) {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'Date' &&
          node.expression.name.text === 'now'
        ) {
          report(node, 'Date.now');
        }
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'Date' &&
          (node.arguments?.length ?? 0) === 0
        ) {
          report(node, 'new Date() with no argument');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return found;
}

function load(dir: string): Map<string, string> {
  const sources = new Map<string, string>();
  for (const full of sourceFilesUnder(dir)) {
    sources.set(
      normal(full).slice(normal(dir).length + 1),
      readFileSync(full, 'utf8')
    );
  }
  return sources;
}

const REPLY: Tree = { alias: '@/lib/reply', outside: REPLY_OUTSIDE };
const PLATFORM: Tree = { alias: '@/lib/platform', outside: PLATFORM_OUTSIDE };

// ---------------------------------------------------------------------------------------

describe('lib/reply', () => {
  const sources = load(REPLY_DIR);

  it('has the files of part 1', () => {
    expect([...sources.keys()]).toEqual([
      'contracts/answer.ts',
      'contracts/fields.ts',
      'contracts/intake.ts',
      'contracts/intent-shapes.ts',
      'contracts/report1.ts',
      'contracts/result.ts',
      'contracts/shape.ts',
      'contracts/stage-events.ts',
      'contracts/trace-fields.ts',
      'version.ts',
    ]);
  });

  it('is pure: no I/O, no clock, no randomness, no database; only its siblings and the one intake door', () => {
    expect(analyse(REPLY, sources)).toEqual([]);
  });

  it('reads the intake path in one file only', () => {
    const importers = [...sources]
      .filter(([, text]) => /from '@\/lib\/intake(\/[^']*)?'/.test(text))
      .map(([file]) => file);
    expect(importers).toEqual(['contracts/intake.ts']);
  });

  it('never imports the platform or the database', () => {
    for (const [file, text] of sources) {
      expect({
        file,
        platform: /lib\/platform|lib\/db|prisma/i.test(
          text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
        ),
      }).toEqual({
        file,
        platform: false,
      });
    }
  });
});

describe('lib/platform', () => {
  const sources = load(PLATFORM_DIR);

  it('has the files of part 1', () => {
    expect([...sources.keys()]).toEqual([
      'chat/messages-store.ts',
      'chat/threads-store.ts',
      'chat/title.ts',
      'delivered.ts',
      'traces/hash.ts',
      'traces/retention.ts',
      'traces/store.ts',
    ]);
  });

  it('imports only the modules named for each file, uses no network, process, console or randomness, and reads the clock in one file', () => {
    expect(analyse(PLATFORM, sources)).toEqual([]);
  });

  it('gives each file exactly the outside modules named for it', () => {
    for (const [file, text] of sources) {
      const outside = [
        ...new Set(
          [...text.matchAll(/from '([^.][^']*)'/g)]
            .map((m) => m[1] as string)
            .filter((m) => !m.startsWith('@/lib/platform/'))
        ),
      ].sort();
      expect({ file, outside }).toEqual({
        file,
        outside: [...(PLATFORM_OUTSIDE[file] ?? [])].sort(),
      });
    }
  });
});

describe('who imports them', () => {
  it('nothing outside lib/reply and lib/platform does (no route, no component, nothing yet)', () => {
    const importer =
      /(?:from|import|require\()\s*['"](?:@\/lib\/(?:reply|platform)|(?:\.\.?\/)+lib\/(?:reply|platform))(?:\/[^'"]*)?['"]/;
    const roots = [
      'app',
      'components',
      'hooks',
      'lib',
      'src',
      'types',
      'pages',
      'config',
      'middleware.ts',
    ];
    const found: string[] = [];
    let scanned = 0;
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (
            normal(full) === normal(REPLY_DIR) ||
            normal(full) === normal(PLATFORM_DIR)
          )
            continue;
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
        const full = join(ROOT, root);
        if (statSync(full).isDirectory()) scan(full);
      } catch {
        // a root that does not exist in this checkout
      }
    }
    expect(scanned).toBeGreaterThan(500);
    expect(found.sort()).toEqual([...ALLOWED_IMPORTERS].sort());
  });

  it('lib/reply is not imported by lib/engine4 either: the engine stays apart', () => {
    for (const full of sourceFilesUnder(join(ROOT, 'lib', 'engine4'))) {
      expect(/lib\/(reply|platform)/.test(readFileSync(full, 'utf8'))).toBe(
        false
      );
    }
  });
});

// ---------------------------------------------------------------------------------------
// The guard must itself bite
// ---------------------------------------------------------------------------------------

const rules = (tree: Tree, files: Record<string, string>): string[] =>
  analyse(tree, new Map(Object.entries(files))).map((v) => v.rule);

describe('the guard', () => {
  const BAD: Record<string, string> = {
    'fetch.ts': "export const a = fetch('https://example.com');",
    'process.ts': 'export const a = process.env.X;',
    'random.ts': 'export const a = Math.random();',
    'now.ts': 'export const a = Date.now();',
    'new-date.ts': 'export const a = new Date();',
    'require.ts': "export const a = require('fs');",
    'window.ts': 'export const a = window.innerWidth;',
    'storage.ts': "export const a = localStorage.getItem('x');",
    'timer.ts': 'export const a = setTimeout(() => 1, 1);',
    'console.ts': "export const a = console.log('x');",
    'uuid.ts': 'export const a = globalThis.crypto.randomUUID();',
    'import-fs.ts':
      "import { readFileSync } from 'fs';\nexport const a = readFileSync;",
    'import-prisma.ts':
      "import { p } from '@/lib/db/prisma';\nexport const a = p;",
    'import-up.ts':
      "import { x } from '../engine4/profile';\nexport const a = x;",
    'dynamic-import.ts': "export const a = () => import('./x');",
  };

  it.each(Object.entries(BAD))('catches %s in both trees', (name, text) => {
    expect(rules(REPLY, { [name]: text }).length).toBeGreaterThan(0);
    expect(rules(PLATFORM, { [name]: text }).length).toBeGreaterThan(0);
  });

  it('catches an import that is allowed for another file', () => {
    expect(
      rules(REPLY, {
        'contracts/shape.ts':
          "import { x } from '@/lib/intake';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules(REPLY, {
        'contracts/intake.ts':
          "import { x } from '@/lib/intake';\nexport const a = x;",
      })
    ).toEqual([]);
    expect(
      rules(REPLY, {
        'contracts/intake.ts':
          "import { x } from '@/lib/intake/other';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules(PLATFORM, {
        'traces/retention.ts':
          "import { p } from '@/lib/db/prisma';\nexport const a = p;",
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules(PLATFORM, {
        'traces/store.ts':
          "import { createHash } from 'crypto';\nexport const a = createHash;",
      })
    ).toEqual([]);
  });

  it('lets the platform use its own tree by alias, and a sibling, but not a path that leaves the tree', () => {
    expect(
      rules(PLATFORM, {
        'chat/title.ts':
          "import { x } from '@/lib/platform/delivered';\nexport const a = x;",
      })
    ).toEqual([]);
    expect(
      rules(PLATFORM, {
        'chat/title.ts':
          "import { x } from './threads-store';\nexport const a = x;",
      })
    ).toEqual([]);
    expect(
      rules(PLATFORM, {
        'chat/title.ts':
          "import { x } from '../../intake/check';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('lets exactly one platform file read the clock, and only for its default `now`', () => {
    expect(
      rules(PLATFORM, {
        'chat/messages-store.ts': 'export const a = [Date.now(), new Date()];',
      })
    ).toEqual([]);
    expect(
      rules(PLATFORM, {
        'chat/threads-store.ts': 'export const a = new Date();',
      }).length
    ).toBeGreaterThan(0);
    expect(
      rules(PLATFORM, {
        'traces/retention.ts': 'export const a = new Date(0);',
      })
    ).toEqual([]);
    expect(
      rules(PLATFORM, {
        'traces/retention.ts': 'export const a = Date.UTC(2026, 0, 1);',
      })
    ).toEqual([]);
  });

  const GOOD: Record<string, string> = {
    'sibling.ts': "import { x } from './check';\nexport const a = x;",
    'type-only.ts': "export type { Issue } from './check';",
    'a-property-called-process.ts':
      'const x = { process: 1, now: 2, console: 3, Date: 4 };\nexport const a = x.process + x.now + x.console + x.Date;',
    'math.ts': 'export const a = Math.floor(2.5) + Math.max(1, 2);',
    'json.ts': 'export const a = JSON.stringify({ k: 1 });',
    'date-utc.ts': 'export const a = new Date(Date.UTC(2026, 0, 1));',
  };

  it.each(Object.entries(GOOD))('leaves %s alone', (name, text) => {
    expect(rules(REPLY, { [name]: text })).toEqual([]);
  });
});
