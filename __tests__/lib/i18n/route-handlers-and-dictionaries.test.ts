/**
 * @jest-environment node
 */

/**
 * No route handler may reach the dictionaries (`lib/i18n/dictionaries/*.json`), directly or
 * through any module it imports.
 *
 * Why: `lib/i18n/get-dictionary.ts` holds all 19 dictionaries (6.5 MB of text). The pages share one
 * chunk of it, but Turbopack gave every group of route handlers that reached it its own 7.8 MB
 * copy plus a 7.7 MB source map: four copies, 62 MB of `.next` on 2026-11-23, the +50 MB and
 * +61 MB jumps of build steps 6 and 7 that left the Bundle Size Monitor 4 MB under its limit. A
 * copy also grows by about 0.8 MB with every language that is added, and nothing in the build
 * says that a new route handler caused it. A route handler that needs a few keys reads a small
 * generated file instead: `lib/i18n/intake-refusal-messages.json`
 * (`scripts/i18n/generate-intake-refusal-messages.cjs`) or `lib/i18n/world-gold-messages.json`.
 *
 * The guard follows the imports of the source files: `import`, `export ... from`, `import()` and
 * `require()` with a string, through `@/` and relative paths. It does not follow a package, a
 * type-only import (erased) or the imports of a module that starts with 'use client' (on the
 * server that module is a reference; what it imports goes to the browser's bundle). It is itself
 * tested on small cases below.
 *
 * @module __tests__/lib/i18n/route-handlers-and-dictionaries.test
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import * as ts from 'typescript';

const ROOT = resolve(__dirname, '..', '..', '..');

/** What a route handler must not reach: any of the dictionary files. */
const FORBIDDEN_DIRECTORY = 'lib/i18n/dictionaries/';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const IS_CODE = /\.[cm]?[jt]sx?$/;
const IS_ROUTE_HANDLER = /^route\.[cm]?[jt]sx?$/;

/** The module specifiers a source file loads by value. */
function importsFromSource(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest);
  const first = source.statements[0];
  if (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use client'
  ) {
    return [];
  }
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            bindings !== undefined &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly)));
      if (!typeOnly) specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (!node.isTypeOnly) specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node)) {
      const [argument] = node.arguments;
      const callee = node.expression;
      const loads =
        callee.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(callee) && callee.text === 'require');
      if (loads && argument !== undefined && ts.isStringLiteralLike(argument)) {
        specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

/** A project file for `@/x` or a relative specifier; nothing for a package or a Node built-in. */
function resolveSpecifier(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith('@/')
    ? join(ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : undefined;
  if (base === undefined) return undefined;
  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => join(base, 'index' + extension)),
  ];
  return candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile()
  );
}

type Graph = ReadonlyMap<string, readonly string[]>;

/** Every file reachable from the entries, with the files each one loads by value. */
function buildGraph(entries: readonly string[]): Graph {
  const graph = new Map<string, string[]>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (graph.has(file)) continue;
    const next: string[] = [];
    if (IS_CODE.test(file)) {
      for (const specifier of importsFromSource(
        file,
        readFileSync(file, 'utf8')
      )) {
        const target = resolveSpecifier(file, specifier);
        if (target !== undefined) next.push(target);
      }
    }
    graph.set(file, next);
    stack.push(...next);
  }
  return graph;
}

/** The shortest chain of files from the entry to a forbidden file, or nothing. */
function shortestChain(
  graph: Graph,
  entry: string,
  isForbidden: (file: string) => boolean
): string[] | undefined {
  const parent = new Map<string, string | undefined>([[entry, undefined]]);
  const queue = [entry];
  for (let index = 0; index < queue.length; index += 1) {
    const file = queue[index] as string;
    for (const next of graph.get(file) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, file);
      if (isForbidden(next)) {
        const chain = [next];
        for (
          let step = parent.get(next);
          step !== undefined;
          step = parent.get(step)
        ) {
          chain.unshift(step);
        }
        return chain;
      }
      queue.push(next);
    }
  }
  return undefined;
}

function routeHandlers(): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (IS_ROUTE_HANDLER.test(entry.name)) found.push(path);
    }
  };
  visit(join(ROOT, 'app'));
  // the middleware is its own bundle that runs for every request
  const middleware = join(ROOT, 'middleware.ts');
  if (existsSync(middleware)) found.push(middleware);
  return found;
}

const inProject = (file: string): string =>
  relative(ROOT, file).split(sep).join('/');
const isDictionary = (file: string): boolean =>
  inProject(file).startsWith(FORBIDDEN_DIRECTORY);

describe('route handlers and the dictionaries', () => {
  it('no route handler reaches lib/i18n/dictionaries, directly or through a module it imports', () => {
    const entries = routeHandlers();
    // the scan found the app's handlers (153 on 2026-11-23), and its middleware
    expect(entries.length).toBeGreaterThan(100);
    const graph = buildGraph(entries);
    const offenders = entries.flatMap((entry) => {
      const chain = shortestChain(graph, entry, isDictionary);
      return chain === undefined ? [] : [chain.map(inProject).join('\n  -> ')];
    });
    // Each entry below is a chain from a route handler to a dictionary. Read the text from the
    // small generated file instead (see the header of this test), or from a page.
    expect(offenders).toEqual([]);
  }, 120_000);
});

describe('the guard', () => {
  it('reads value imports, re-exports, dynamic imports and requires, and skips type-only ones', () => {
    const text = [
      "import a from './a';",
      "import type { T } from './type-only';",
      "import { type U } from './inline-type-only';",
      "import { v, type W } from './mixed';",
      "export * from './star';",
      "export { x } from './named';",
      "export type { Y } from './type-reexport';",
      "const loader = () => import('./dynamic');",
      "const r = require('./required');",
      'const computed = () => import(`./dictionaries/${locale}.json`);',
      "import 'side-effect';",
    ].join('\n');
    expect(importsFromSource('f.ts', text).sort()).toEqual([
      './a',
      './dynamic',
      './mixed',
      './named',
      './required',
      './star',
      'side-effect',
    ]);
  });

  it("does not follow the imports of a 'use client' module", () => {
    expect(
      importsFromSource('c.tsx', "'use client';\nimport a from './a';")
    ).toEqual([]);
    expect(importsFromSource('c.tsx', "import a from './a';")).toEqual(['./a']);
  });

  it('finds the shortest chain to a dictionary, and none for a route that reads only a small file', () => {
    const graph: Graph = new Map([
      ['app/a/route.ts', ['lib/x.ts', 'lib/small.json']],
      ['app/b/route.ts', ['lib/small.json']],
      ['lib/x.ts', ['lib/y.ts', 'lib/i18n/get-dictionary.ts']],
      ['lib/y.ts', ['lib/i18n/get-dictionary.ts']],
      ['lib/i18n/get-dictionary.ts', ['lib/i18n/dictionaries/en-GB.json']],
      ['lib/i18n/dictionaries/en-GB.json', []],
      ['lib/small.json', []],
    ]);
    const forbidden = (file: string): boolean =>
      file.startsWith(FORBIDDEN_DIRECTORY);
    const target = 'lib/i18n/dictionaries/en-GB.json';
    expect(shortestChain(graph, 'app/a/route.ts', forbidden)).toEqual([
      'app/a/route.ts',
      'lib/x.ts',
      'lib/i18n/get-dictionary.ts',
      target,
    ]);
    expect(shortestChain(graph, 'app/b/route.ts', forbidden)).toBeUndefined();
  });

  it('survives a cycle', () => {
    const graph: Graph = new Map([
      ['app/a/route.ts', ['lib/x.ts']],
      ['lib/x.ts', ['lib/y.ts']],
      ['lib/y.ts', ['lib/x.ts']],
    ]);
    expect(shortestChain(graph, 'app/a/route.ts', () => false)).toBeUndefined();
  });
});
