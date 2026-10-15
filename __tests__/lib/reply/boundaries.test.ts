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
 *     whole reply path). The one exception is the folder `read/` (build step 7 part 2): the
 *     readers that fetch what the prompt is made of, imported by path and never through a
 *     barrel, like `lib/engine4/read/`. A reader may import the database client named for it
 *     below and nothing else from outside; the other rules (no network, no process, no clock,
 *     no randomness) hold for it too. `context/caps.ts` also imports its one data file, the
 *     caps table.
 *     The other exception is the model gateway (build step 7 part 3), `gateway/`: the registry
 *     reads its one table (`config/ai-models.ts`), and `gateway/openrouter.ts` is the ONE file of
 *     the tree that calls the network, uses a timer and reads the clock (for the latency it
 *     reports). It is also the one file that names the `Authorization` header: the key lives there
 *     and nowhere else (a test below reads every file for it).
 *  2. `lib/platform` may touch the database, but each file may import only the outside
 *     modules named for it below, and none of it may use the network, the process, the
 *     console or a browser global. The clock is `messages-store.ts`'s alone (its default `now`).
 *  1b. The orchestrator (build step 7 part 7a) is pure like the rest: `orchestrator.ts` and `run/` do
 *     no I/O, read no clock and make no randomness (all of it is a port), and they reach the intake
 *     path through `contracts/intake.ts` alone. `run/answer-step.ts` imports the two JSON Schemas
 *     the model's reply is asked to follow, like `context/caps.ts` imports its table.
 *     The folder `server/` is the other side of the ports: it is the one place of `lib/reply`
 *     that may touch the platform, the database, the environment, a timer and the clock, and each
 *     of its files may import only the outside modules named for it below. Like `read/`, it is
 *     imported by path and never through a barrel, and nothing but the routes (part 7b) imports it.
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
  'context/caps.ts': ['@/config/reply/context-caps.v1.json'],
  // the wording lists (build step 7 part 4): the categories and one file per language, and nothing else from outside
  'checks/wording-lists.ts': [
    '@/config/reply/wording/categories.json',
    '@/config/reply/wording/phrases/ar.json',
    '@/config/reply/wording/phrases/de.json',
    '@/config/reply/wording/phrases/en.json',
    '@/config/reply/wording/phrases/es.json',
    '@/config/reply/wording/phrases/fr.json',
    '@/config/reply/wording/phrases/hi.json',
    '@/config/reply/wording/phrases/id.json',
    '@/config/reply/wording/phrases/it.json',
    '@/config/reply/wording/phrases/ja.json',
    '@/config/reply/wording/phrases/ko.json',
    '@/config/reply/wording/phrases/pt.json',
    '@/config/reply/wording/phrases/th.json',
    '@/config/reply/wording/phrases/tr.json',
    '@/config/reply/wording/phrases/ur.json',
    '@/config/reply/wording/phrases/vi.json',
    '@/config/reply/wording/phrases/zh.json',
    '@/config/reply/wording/phrases/zh-TW.json',
  ],
  // the model gateway (build step 7 part 3): the registry table, and nothing else from outside
  'gateway/registry.ts': ['@/config/ai-models'],
  'gateway/types.ts': ['@/config/ai-models'],
  'gateway/understand-adapter.ts': ['@/config/ai-models'],
  // the model's two JSON Schemas (build step 7 part 7a), and nothing else from outside
  'run/answer-step.ts': [
    '@/config/reply/answer-1.schema.json',
    '@/config/reply/report1-1.schema.json',
  ],
  'read/day-bars.ts': ['@/lib/db/market-prisma'],
  // the chart rule (build step 7 part 5): the dependency-free chart keys, never the AWS client (the port is handed in)
  'read/chart.ts': ['@/lib/storage/chart-keys'],
  // the earlier cycle's states (part 5): the market database client, like the day's bars
  'read/snapshot-at.ts': ['@/lib/db/market-prisma'],
  // the language-specific invalidation line (part 5): its one data file
  'report1/invalidation-line.ts': [
    '@/config/reply/report1/invalidation-line.v1.json',
  ],
};

/** The folder of `lib/reply` whose files may read (and only they may be imported by path). */
const READER_DIR = 'read/';

/** The database client each reader may import: the chart reader reaches storage through a port and imports none. */
const READER_CLIENTS: Readonly<Record<string, readonly string[]>> = {
  'read/chart.ts': [],
  'read/day-bars.ts': ['@/lib/db/market-prisma'],
  'read/snapshot-at.ts': ['@/lib/db/market-prisma'],
};

const PLATFORM_OUTSIDE: Readonly<Record<string, readonly string[]>> = {
  'delivered.ts': [
    '@/lib/reply/contracts/intake',
    '@/lib/reply/contracts/result',
    '@/lib/reply/contracts/trace-fields',
  ],
  // the entitlement table (build step 7 part 6): its one data file, and nothing else from outside
  'entitlements.ts': ['@/config/entitlements'],
  // the quota ledger (part 6): the store and the reaper touch the database; the port is the meter's
  // interface in the platform's hands (its types are the one thing it takes from lib/reply)
  'metering/ledger-port.ts': ['@/lib/reply/meter/quota-port'],
  'metering/ledger-store.ts': ['@/lib/db/prisma'],
  'metering/period.ts': [],
  'metering/reaper.ts': ['@/lib/db/prisma'],
  'chat/messages-store.ts': ['@/lib/db/prisma', '@/lib/reply/contracts/intake'],
  'chat/thread-port.ts': ['@/lib/reply/contracts/intake'],
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

/** The outside modules each file of `lib/reply/server/` may import (path inside `lib/reply`). */
const SERVER_OUTSIDE: Readonly<Record<string, readonly string[]>> = {
  // the error format of the chat routes: the intake routes' statuses and messages
  'server/errors.ts': ['@/lib/intake/server/errors'],
  // the staging switches read an env object the caller passes: no outside module at all
  'server/flags.ts': [],
  // the real ports of the orchestrator (build step 7 part 7a): the intake path's own real ports, the
  // quota ledger and the entitlement table, and the chart in storage
  'server/ports.ts': [
    '@/lib/intake/server/access',
    '@/lib/platform/entitlements',
    '@/lib/platform/metering/ledger-port',
    '@/lib/storage/r2',
    'crypto',
  ],
  // the body reader of the intake routes, and its failure type
  'server/request.ts': [
    '@/lib/intake/server/errors',
    '@/lib/intake/server/request',
  ],
  // the message route's body: the orchestrator, the ports, the stream (all inside lib/reply)
  'server/respond.ts': [],
  // the chat panel's state in one call: the registry's table, the intake path's profile and snapshot,
  // the quota ledger and the entitlement table
  'server/state-api.ts': [
    '@/config/ai-models',
    '@/lib/intake/read/snapshot',
    '@/lib/intake/server/access',
    '@/lib/platform/entitlements',
    '@/lib/platform/metering/ledger-port',
    '@/lib/platform/metering/period',
  ],
  'server/stream.ts': [],
  // the threads API: the chat stores, the entitlement table, the session of the intake path
  'server/threads-api.ts': [
    '@/lib/intake/server/access',
    '@/lib/platform/chat/messages-store',
    '@/lib/platform/chat/threads-store',
    '@/lib/platform/entitlements',
  ],
  // the thread, message and trace stores as the orchestrator's ports
  'server/store-ports.ts': [
    '@/lib/platform/chat/messages-store',
    '@/lib/platform/chat/threads-store',
    '@/lib/platform/chat/title',
    '@/lib/platform/delivered',
    '@/lib/platform/traces/hash',
    '@/lib/platform/traces/store',
  ],
};

/**
 * Files outside both trees that may import them. Build step 7 part 3: the Understand adapter of the
 * intake path is now a thin wrapper over the gateway's Understand adapter, so it imports ONE module
 * of `lib/reply` (`__tests__/lib/intake/boundaries.test.ts` holds it to that one). Part 6: the
 * gate's adapters (`lib/intake/server/access.ts`) read the entitlement table and build the quota
 * port, so they import the platform's entitlement reader and ledger port and the meter.
 */
const ALLOWED_IMPORTERS: readonly string[] = [
  // the chat routes (build step 7 part 7b): the message route, the threads API and the state route
  'app/api/chat/message/route.ts',
  'app/api/chat/state/route.ts',
  'app/api/chat/threads/[id]/route.ts',
  'app/api/chat/threads/route.ts',
  // the gate's real edges (build step 7 part 6): the entitlement table, the quota ledger's port and the meter
  'lib/intake/server/access.ts',
  'lib/intake/text/understand-model.ts',
];

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

/** The one file of each tree that may read the clock (its default `now`). */
const REPLY_CLOCK_FILES: ReadonlySet<string> = new Set([
  'gateway/openrouter.ts',
]);
const PLATFORM_CLOCK_FILES: ReadonlySet<string> = new Set([
  'chat/messages-store.ts',
]);

/**
 * The names a file may use although they are forbidden elsewhere: the gateway adapter is the ONE
 * file of `lib/reply` that calls the network (`fetch`) and uses a timer (the wait of an attempt).
 */
const REPLY_ALLOWED_NAMES: Readonly<Record<string, readonly string[]>> = {
  'gateway/openrouter.ts': ['fetch', 'setTimeout'],
};

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
  clockFiles: ReadonlySet<string>;
  allowedNames: Readonly<Record<string, readonly string[]>>;
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
        !(tree.allowedNames[file] ?? []).includes(node.text) &&
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
      if (!tree.clockFiles.has(file)) {
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

const REPLY: Tree = {
  alias: '@/lib/reply',
  outside: REPLY_OUTSIDE,
  clockFiles: REPLY_CLOCK_FILES,
  allowedNames: REPLY_ALLOWED_NAMES,
};
const SERVER: Tree = {
  alias: '@/lib/reply',
  outside: SERVER_OUTSIDE,
  // the real clock of the request, for the quota meter
  clockFiles: new Set<string>(['server/ports.ts', 'server/state-api.ts']),
  // the environment (the default of `createReplyPorts` and of the route bodies), a timer (the
  // deadline), a random id and the log
  allowedNames: {
    'server/ports.ts': ['console', 'process', 'randomUUID', 'setTimeout'],
    'server/respond.ts': ['process'],
    'server/state-api.ts': ['process'],
    'server/threads-api.ts': ['process'],
  },
};
const PLATFORM: Tree = {
  alias: '@/lib/platform',
  outside: PLATFORM_OUTSIDE,
  clockFiles: PLATFORM_CLOCK_FILES,
  allowedNames: {},
};

// ---------------------------------------------------------------------------------------

/** The files of `lib/reply` that are not under `server/`: the pure tree. */
function loadPure(): Map<string, string> {
  const all = load(REPLY_DIR);
  for (const key of [...all.keys()]) {
    if (key.startsWith('server/')) all.delete(key);
  }
  return all;
}

describe('lib/reply', () => {
  const sources = loadPure();

  it('has the files of parts 1 to 7a', () => {
    expect([...sources.keys()]).toEqual([
      'checks/extract.ts',
      'checks/matcher.ts',
      'checks/number-check.ts',
      'checks/report.ts',
      'checks/value-dictionary.ts',
      'checks/wording-check.ts',
      'checks/wording-lists.ts',
      'context/assemble.ts',
      'context/budget.ts',
      'context/caps.ts',
      'context/cut.ts',
      'context/history.ts',
      'context/ohlc-compact.ts',
      'context/prompt.ts',
      'context/readings.ts',
      'context/sections.ts',
      'context/segments.ts',
      'context/static-text.ts',
      'context/tokens.ts',
      'context/values.ts',
      'contracts/answer.ts',
      'contracts/fields.ts',
      'contracts/intake.ts',
      'contracts/intent-shapes.ts',
      'contracts/report1.ts',
      'contracts/result.ts',
      'contracts/shape.ts',
      'contracts/stage-events.ts',
      'contracts/trace-fields.ts',
      'gate/answer-gate.ts',
      'gate/shape.ts',
      'gateway/fallback.ts',
      'gateway/fixture.ts',
      'gateway/messages.ts',
      'gateway/openrouter.ts',
      'gateway/registry.ts',
      'gateway/types.ts',
      'gateway/understand-adapter.ts',
      'gateway/usage.ts',
      'meter/estimate.ts',
      'meter/quota-port.ts',
      'meter/reserve-plan.ts',
      'meter/units.ts',
      'orchestrator.ts',
      'read/chart.ts',
      'read/day-bars.ts',
      'read/snapshot-at.ts',
      'report1/changes.ts',
      'report1/compose.ts',
      'report1/fixed-answer.ts',
      'report1/invalidation-line.ts',
      'report1/resolve.ts',
      'report1/sections.ts',
      'report1/stamp.ts',
      'run/answer-step.ts',
      'run/calls.ts',
      'run/hold.ts',
      'run/regenerate.ts',
      'run/request-id.ts',
      'run/stages.ts',
      'run/trace.ts',
      'run/types.ts',
      'version.ts',
    ]);
  });

  it('is pure: no I/O, no clock, no randomness, no database; only its siblings and the one intake door', () => {
    expect(analyse(REPLY, sources)).toEqual([]);
  });

  it('lets only the readers touch the database, and each only the client named for it', () => {
    for (const [file, text] of sources) {
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      const clients = [...code.matchAll(/from '(@\/lib\/db\/[^']*)'/g)].map(
        (m) => m[1]
      );
      expect({ file, clients }).toEqual({
        file,
        clients: READER_CLIENTS[file] ?? [],
      });
    }
  });

  it('names every reader in the client table, and no file that is not one', () => {
    const readers = [...sources.keys()].filter((file) =>
      file.startsWith(READER_DIR)
    );
    expect(readers.sort()).toEqual(Object.keys(READER_CLIENTS).sort());
  });

  it('keeps the readers apart: nothing outside read/ imports one that reaches a database, and no reader imports the platform', () => {
    for (const [file, text] of sources) {
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (!file.startsWith(READER_DIR)) {
        // a type is erased and costs nothing at run time; a value import of a reader runs its module, so
        // only a reader that has no database client of its own (the chart rule, which reaches storage
        // through a port) may be imported by a file outside read/ (the orchestrator calls it)
        const values = code.replace(/import type[^;]*;/g, '');
        const readers = [
          ...values.matchAll(/from '(?:\.\.?\/)+(read\/[a-z0-9-]+)'/g),
        ].map((m) => `${m[1]}.ts`);
        for (const reader of readers) {
          expect({ file, reader, clients: READER_CLIENTS[reader] }).toEqual({
            file,
            reader,
            clients: [],
          });
        }
      }
      expect({ file, platform: /lib\/platform/.test(code) }).toEqual({
        file,
        platform: false,
      });
    }
  });

  it('keeps the key in one place: only the gateway adapter names the Authorization header or a bearer token', () => {
    for (const [file, text] of sources) {
      expect({
        file,
        header: /Authorization|Bearer/i.test(text),
      }).toEqual({ file, header: file === 'gateway/openrouter.ts' });
    }
  });

  it('lets only the gateway adapter call the network, use a timer and read the clock', () => {
    for (const [file, text] of sources) {
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect({
        file,
        network: /\bfetch\b|\bsetTimeout\b|Date\.now\(\)/.test(code),
      }).toEqual({ file, network: file === 'gateway/openrouter.ts' });
    }
  });

  it('reads the intake path in one file only', () => {
    const importers = [...sources]
      .filter(([, text]) => /from '@\/lib\/intake(\/[^']*)?'/.test(text))
      .map(([file]) => file);
    expect(importers).toEqual(['contracts/intake.ts']);
  });

  it('never imports the platform, and the database only in the readers', () => {
    for (const [file, text] of sources) {
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect({
        file,
        platform: /lib\/platform/i.test(code),
        database: file.startsWith(READER_DIR)
          ? false
          : /lib\/db|prisma/i.test(code),
      }).toEqual({
        file,
        platform: false,
        database: false,
      });
    }
  });
});

describe('lib/platform', () => {
  const sources = load(PLATFORM_DIR);

  it('has the files of parts 1, 6 and 7a', () => {
    expect([...sources.keys()]).toEqual([
      'chat/messages-store.ts',
      'chat/thread-port.ts',
      'chat/threads-store.ts',
      'chat/title.ts',
      'delivered.ts',
      'entitlements.ts',
      'metering/ledger-port.ts',
      'metering/ledger-store.ts',
      'metering/period.ts',
      'metering/reaper.ts',
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

describe('lib/reply/server', () => {
  const sources = new Map(
    [...load(REPLY_DIR)].filter(([file]) => file.startsWith('server/'))
  );

  it('has the files of part 7', () => {
    expect([...sources.keys()]).toEqual([
      'server/errors.ts',
      'server/flags.ts',
      'server/ports.ts',
      'server/request.ts',
      'server/respond.ts',
      'server/state-api.ts',
      'server/store-ports.ts',
      'server/stream.ts',
      'server/threads-api.ts',
    ]);
  });

  it('imports only the modules named for each file, uses no network, console or browser global', () => {
    expect(analyse(SERVER, sources)).toEqual([]);
  });

  it('gives each file exactly the outside modules named for it', () => {
    for (const [file, text] of sources) {
      const outside = [
        ...new Set(
          [...text.matchAll(/from '([^.][^']*)'/g)]
            .map((m) => m[1] as string)
            .filter((m) => !m.startsWith('@/lib/reply/'))
        ),
      ].sort();
      expect({ file, outside }).toEqual({
        file,
        outside: [...(SERVER_OUTSIDE[file] ?? [])].sort(),
      });
    }
  });

  it('is imported by nothing in the pure tree', () => {
    for (const [file, text] of load(REPLY_DIR)) {
      if (file.startsWith('server/')) continue;
      expect({
        file,
        server: /(?:\/|'\.?\.?\/)server\//.test(text),
      }).toEqual({ file, server: false });
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

  it('lets a reader import its market client, and no other file, and no other client', () => {
    const source =
      "import { marketPrisma } from '@/lib/db/market-prisma';\nexport const a = marketPrisma;";
    expect(rules(REPLY, { 'read/day-bars.ts': source })).toEqual([]);
    expect(
      rules(REPLY, { 'context/assemble.ts': source }).length
    ).toBeGreaterThan(0);
    expect(rules(REPLY, { 'read/other.ts': source }).length).toBeGreaterThan(0);
    expect(
      rules(REPLY, {
        'read/day-bars.ts':
          "import { prisma } from '@/lib/db/prisma';\nexport const a = prisma;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('still holds a reader to the other rules: no network, no clock, no randomness, no process', () => {
    for (const text of [
      "export const a = fetch('https://example.com');",
      'export const a = Date.now();',
      'export const a = new Date();',
      'export const a = Math.random();',
      'export const a = process.env.X;',
      "import { x } from '../contracts/shape';\nexport const a = x; export const b = console.log(1);",
      "export const a = () => import('./x');",
    ]) {
      expect(rules(REPLY, { 'read/day-bars.ts': text }).length).toBeGreaterThan(
        0
      );
    }
  });

  it('lets the chart reader import the chart keys and nothing else, and the earlier-cycle reader its market client', () => {
    const keys =
      "import { chartMatchesCycle } from '@/lib/storage/chart-keys';\nexport const a = chartMatchesCycle;";
    const market =
      "import { marketPrisma } from '@/lib/db/market-prisma';\nexport const a = marketPrisma;";
    expect(rules(REPLY, { 'read/chart.ts': keys })).toEqual([]);
    // the keys are for the chart reader alone: the pure tree does not read them anywhere else
    expect(
      rules(REPLY, { 'context/assemble.ts': keys }).length
    ).toBeGreaterThan(0);
    expect(rules(REPLY, { 'read/day-bars.ts': keys }).length).toBeGreaterThan(
      0
    );
    // the AWS-backed storage module is never imported: the port is handed in by the orchestrator
    expect(
      rules(REPLY, {
        'read/chart.ts':
          "import { getChartStamp } from '@/lib/storage/r2';\nexport const a = getChartStamp;",
      }).length
    ).toBeGreaterThan(0);
    // the chart reader has no database client, the earlier-cycle reader has the market one
    expect(rules(REPLY, { 'read/chart.ts': market }).length).toBeGreaterThan(0);
    expect(rules(REPLY, { 'read/snapshot-at.ts': market })).toEqual([]);
    expect(
      rules(REPLY, { 'report1/changes.ts': market }).length
    ).toBeGreaterThan(0);
  });

  it('lets the invalidation line import its data file and no other file', () => {
    const source =
      "import file from '@/config/reply/report1/invalidation-line.v1.json';\nexport const a = file;";
    expect(rules(REPLY, { 'report1/invalidation-line.ts': source })).toEqual(
      []
    );
    expect(
      rules(REPLY, { 'report1/compose.ts': source }).length
    ).toBeGreaterThan(0);
    expect(
      rules(REPLY, {
        'report1/invalidation-line.ts':
          "import file from '@/config/intake/glossary.v1.json';\nexport const a = file;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('lets the caps file import its table and no other file', () => {
    const source =
      "import caps from '@/config/reply/context-caps.v1.json';\nexport const a = caps;";
    expect(rules(REPLY, { 'context/caps.ts': source })).toEqual([]);
    expect(
      rules(REPLY, { 'context/budget.ts': source }).length
    ).toBeGreaterThan(0);
    expect(
      rules(REPLY, {
        'context/caps.ts':
          "import caps from '@/config/intake/glossary.v1.json';\nexport const a = caps;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('lets the gateway registry import its table and no other file, and no other table', () => {
    const source =
      "import { AI_MODELS } from '@/config/ai-models';\nexport const a = AI_MODELS;";
    expect(rules(REPLY, { 'gateway/registry.ts': source })).toEqual([]);
    expect(rules(REPLY, { 'gateway/types.ts': source })).toEqual([]);
    expect(rules(REPLY, { 'gateway/usage.ts': source }).length).toBeGreaterThan(
      0
    );
    expect(
      rules(REPLY, { 'context/budget.ts': source }).length
    ).toBeGreaterThan(0);
    expect(
      rules(REPLY, {
        'gateway/registry.ts':
          "import { x } from '@/config/intake/glossary.v1.json';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
  });

  it('lets the gateway adapter call the network, use a timer and read the clock, and nothing else that differs from one run to the next', () => {
    expect(
      rules(REPLY, {
        'gateway/openrouter.ts':
          "export const a = [fetch('u'), setTimeout(() => 1, 1), Date.now(), new AbortController()];",
      })
    ).toEqual([]);
    for (const body of [
      'export const a = process.env.X;',
      'export const a = Math.random();',
      "export const a = console.log('x');",
      'export const a = setInterval(() => 1, 1);',
      "export const a = require('fs');",
      'export const a = globalThis.crypto.randomUUID();',
      "import { createHash } from 'crypto';\nexport const a = createHash;",
    ]) {
      expect(
        rules(REPLY, { 'gateway/openrouter.ts': body }).length
      ).toBeGreaterThan(0);
    }
    // no other file of the tree, the other gateway files included, has the same freedom
    for (const file of [
      'gateway/fallback.ts',
      'gateway/fixture.ts',
      'gateway/registry.ts',
      'gateway/understand-adapter.ts',
      'gateway/usage.ts',
      'context/assemble.ts',
    ]) {
      for (const body of [
        "export const a = fetch('u');",
        'export const a = setTimeout(() => 1, 1);',
        'export const a = Date.now();',
      ]) {
        expect(rules(REPLY, { [file]: body }).length).toBeGreaterThan(0);
      }
    }
    // and the platform has no such file at all
    expect(
      rules(PLATFORM, {
        'gateway/openrouter.ts': "export const a = fetch('u');",
      }).length
    ).toBeGreaterThan(0);
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

  it('lets the metering files import what is named for them and nothing else (build step 7 part 6)', () => {
    const prisma =
      "import { prisma } from '@/lib/db/prisma';\nexport const a = prisma;";
    expect(rules(PLATFORM, { 'metering/ledger-store.ts': prisma })).toEqual([]);
    expect(rules(PLATFORM, { 'metering/reaper.ts': prisma })).toEqual([]);
    expect(
      rules(PLATFORM, { 'metering/period.ts': prisma }).length
    ).toBeGreaterThan(0);
    expect(
      rules(PLATFORM, { 'metering/ledger-port.ts': prisma }).length
    ).toBeGreaterThan(0);
    expect(
      rules(PLATFORM, {
        'metering/ledger-port.ts':
          "import type { LedgerPort } from '@/lib/reply/meter/quota-port';\nexport type A = LedgerPort;",
      })
    ).toEqual([]);
    // the port takes the meter's types and nothing else of lib/reply
    expect(
      rules(PLATFORM, {
        'metering/ledger-port.ts':
          "import { x } from '@/lib/reply/meter/units';\nexport const a = x;",
      }).length
    ).toBeGreaterThan(0);
    // the table is read through its own config file only
    expect(
      rules(PLATFORM, {
        'entitlements.ts':
          "import { ENTITLEMENTS } from '@/config/entitlements';\nexport const a = ENTITLEMENTS;",
      })
    ).toEqual([]);
    expect(
      rules(PLATFORM, {
        'entitlements.ts':
          "import { AI_MODELS } from '@/config/ai-models';\nexport const a = AI_MODELS;",
      }).length
    ).toBeGreaterThan(0);
    // the ledger reads no clock: the time is an argument
    for (const file of [
      'metering/ledger-store.ts',
      'metering/reaper.ts',
      'metering/period.ts',
      'metering/ledger-port.ts',
      'entitlements.ts',
    ]) {
      expect(
        rules(PLATFORM, { [file]: 'export const a = Date.now();' }).length
      ).toBeGreaterThan(0);
      expect(
        rules(PLATFORM, { [file]: 'export const a = new Date();' }).length
      ).toBeGreaterThan(0);
    }
  });

  it('keeps the meter pure: no outside module, no platform, no clock, no network (build step 7 part 6)', () => {
    for (const file of [
      'meter/units.ts',
      'meter/estimate.ts',
      'meter/reserve-plan.ts',
      'meter/quota-port.ts',
    ]) {
      for (const body of [
        "import { prisma } from '@/lib/db/prisma';\nexport const a = prisma;",
        "import { x } from '@/lib/platform/metering/ledger-store';\nexport const a = x;",
        "import { x } from '@/config/entitlements';\nexport const a = x;",
        'export const a = Date.now();',
        'export const a = new Date();',
        "export const a = fetch('u');",
        'export const a = process.env.PRO_MONTHLY_UNITS;',
        'export const a = Math.random();',
      ]) {
        expect(rules(REPLY, { [file]: body }).length).toBeGreaterThan(0);
      }
    }
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
