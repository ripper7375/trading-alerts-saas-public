/**
 * @jest-environment node
 */

/**
 * What the platform stores may do to the database, kept by a scan of their TypeScript
 * (the pattern of `__tests__/lib/engine4/store/store-guard.test.ts`).
 *
 *  - `request_traces` is the 7-year audit row: the code may INSERT a trace, attach the risk
 *    group (one `updateMany`, the four columns the trigger lets change), and read one. There is
 *    no `delete` or `deleteMany` of it in `lib/platform`, and no raw SQL anywhere: the
 *    database trigger refuses an unarchived DELETE, and this keeps the code from asking.
 *  - A chat message is created by `appendExchange` and deleted only by its thread's foreign
 *    key; there is no `chatMessage.delete*` and no `chatMessage.update*`.
 *  - The thread store never mentions the trace table: deleting a thread leaves the traces.
 *  - The quota ledger (build step 7 part 6) is the ONE place raw SQL is allowed, because the
 *    reservation must be a single atomic statement: `metering/ledger-store.ts` and
 *    `metering/reaper.ts` call `$queryRawUnsafe` with a CONSTANT statement and values as
 *    parameters, never a built string, never `$executeRaw*`, never a tagged template; the
 *    statements INSERT and UPDATE the two ledger tables and nothing else, and DELETE nothing (a
 *    deleted account's balance goes by the foreign key). No other file names the ledger's tables.
 * Anything outside the lists below fails: a new call is a new decision, made here on purpose.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import * as ts from 'typescript';

const ROOT = resolve(__dirname, '..', '..', '..');
const PLATFORM = join(ROOT, 'lib', 'platform');

/** `delegate.method` calls each file may make. */
const ALLOWED_CALLS: Record<string, string[]> = {
  'traces/store.ts': [
    'requestTrace.create',
    'requestTrace.findUnique',
    'requestTrace.updateMany',
  ],
  'chat/threads-store.ts': [
    'chatThread.create',
    'chatThread.deleteMany',
    'chatThread.findFirst',
    'chatThread.findMany',
    'chatThread.updateMany',
  ],
  'chat/messages-store.ts': [
    'chatMessage.create',
    'chatMessage.findMany',
    'chatThread.findFirst',
    'chatThread.update',
  ],
  'traces/hash.ts': [],
  'traces/retention.ts': [],
  'chat/title.ts': [],
  // build step 7 part 7a: the gate's thread check asks the thread store and uses no delegate itself
  'chat/thread-port.ts': [],
  'delivered.ts': [],
  // build step 7 part 6: the entitlement reader and the quota ledger use no Prisma delegate at all
  'entitlements.ts': [],
  'metering/ledger-port.ts': [],
  'metering/ledger-store.ts': [],
  'metering/period.ts': [],
  'metering/reaper.ts': [],
};

/** Methods the client interfaces of a file may declare. */
const ALLOWED_DECLARATIONS: Record<string, string[]> = {
  'traces/store.ts': ['create', 'findUnique', 'updateMany'],
  'chat/threads-store.ts': [
    'create',
    'deleteMany',
    'findFirst',
    'findMany',
    'updateMany',
  ],
  'chat/messages-store.ts': [
    '$transaction',
    'create',
    'findFirst',
    'findMany',
    'update',
  ],
  'traces/hash.ts': [],
  'traces/retention.ts': [],
  'chat/title.ts': [],
  'chat/thread-port.ts': [],
  'delivered.ts': [],
  'entitlements.ts': [],
  'metering/ledger-port.ts': [],
  'metering/ledger-store.ts': ['$queryRawUnsafe'],
  'metering/period.ts': [],
  'metering/reaper.ts': [],
};

/** The raw-SQL calls a file may make: the quota ledger's two files, `$queryRawUnsafe` only. */
const ALLOWED_RAW: Record<string, string[]> = {
  'metering/ledger-store.ts': ['$queryRawUnsafe'],
  'metering/reaper.ts': ['$queryRawUnsafe'],
};

const DELEGATES = new Set(['requestTrace', 'chatThread', 'chatMessage']);

interface Found {
  calls: string[];
  declared: string[];
  raw: string[];
}

function scan(name: string, text: string): Found {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2020, true);
  const found: Found = { calls: [], declared: [], raw: [] };
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      const target = node.expression.expression;
      if (
        ts.isPropertyAccessExpression(target) &&
        DELEGATES.has(target.name.text)
      ) {
        found.calls.push(`${target.name.text}.${method}`);
      }
      if (/^\$(execute|query)Raw/.test(method)) found.raw.push(method);
    }
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag.getText(file);
      if (/Raw/.test(tag) || /\bsql\b/.test(tag)) found.raw.push(tag);
    }
    if (ts.isMethodSignature(node))
      found.declared.push(node.name.getText(file));
    if (
      ts.isStringLiteralLike(node) &&
      /\b(TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+\s+SET|INSERT\s+INTO)\b/i.test(
        node.text
      )
    ) {
      found.raw.push(node.text.slice(0, 40));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  found.calls.sort();
  found.declared.sort();
  return found;
}

/** The identifiers and string literals of a source, without its comments. */
function codeWords(name: string, text: string): string[] {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2020, true);
  const words: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
      words.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return words;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out.sort();
}

const posix = (path: string): string => path.replace(/\\/g, '/');
const FILES = filesUnder(PLATFORM).map((full) =>
  posix(relative(PLATFORM, full))
);

describe('the scanner itself', () => {
  it('sees a delete, an update, a raw statement and a declared delete', () => {
    const found = scan(
      'bad.ts',
      [
        'async function f(tx: any) {',
        '  await tx.requestTrace.delete({ where: { request_id: "x" } });',
        '  await tx.chatMessage.update({});',
        '  await tx.$executeRaw`DELETE FROM x`;',
        '  await tx.$queryRawUnsafe("select 1");',
        '}',
        'interface C { requestTrace: { deleteMany(a: unknown): void } }',
      ].join('\n')
    );
    expect(found.calls).toEqual(['chatMessage.update', 'requestTrace.delete']);
    expect(found.declared).toEqual(['deleteMany']);
    expect(found.raw).toEqual(expect.arrayContaining(['$queryRawUnsafe']));
    expect(found.raw.length).toBeGreaterThanOrEqual(2);
  });

  it('lists the words of the code and not of its comments', () => {
    expect(
      codeWords(
        'w.ts',
        '// requestTrace\nconst chatThread = "request_traces"; /* chatMessage */'
      )
    ).toEqual(['chatThread', 'request_traces']);
  });

  it('ignores the same words in comments and unrelated calls', () => {
    const found = scan(
      'ok.ts',
      '// tx.requestTrace.delete()\nconst a = list.delete(1);\nconst b = other.requestTraceX.update();'
    );
    expect(found).toEqual({ calls: [], declared: [], raw: [] });
  });
});

describe('lib/platform', () => {
  it('has exactly the files this guard knows', () => {
    expect(FILES).toEqual(Object.keys(ALLOWED_CALLS).sort());
  });

  describe.each(Object.keys(ALLOWED_CALLS))('%s', (name) => {
    const text = readFileSync(join(PLATFORM, name), 'utf8');
    const found = scan(name, text);

    it('calls only the delegate methods listed for it', () => {
      expect([...new Set(found.calls)]).toEqual(
        [...(ALLOWED_CALLS[name] as string[])].sort()
      );
    });

    it('declares only the client methods listed for it', () => {
      expect([...new Set(found.declared)]).toEqual(
        [...(ALLOWED_DECLARATIONS[name] as string[])].sort()
      );
    });

    it('writes no raw SQL, except the quota ledger’s two files and only through $queryRawUnsafe', () => {
      expect([...new Set(found.raw)]).toEqual(ALLOWED_RAW[name] ?? []);
    });
  });

  it('writes the audit row with one create and one updateMany, and has no delete of it anywhere', () => {
    const calls = FILES.flatMap(
      (name) => scan(name, readFileSync(join(PLATFORM, name), 'utf8')).calls
    );
    expect(
      [...new Set(calls.filter((c) => c.startsWith('requestTrace.')))].sort()
    ).toEqual([
      'requestTrace.create',
      'requestTrace.findUnique',
      'requestTrace.updateMany',
    ]);
    expect(
      calls.filter((c) =>
        /^requestTrace\.(delete|deleteMany|update|upsert|createMany)$/.test(c)
      )
    ).toEqual([]);
  });

  it('creates a chat message in one place and never updates or deletes one', () => {
    const calls = FILES.flatMap(
      (name) => scan(name, readFileSync(join(PLATFORM, name), 'utf8')).calls
    );
    expect(
      [...new Set(calls.filter((c) => c.startsWith('chatMessage.')))].sort()
    ).toEqual(['chatMessage.create', 'chatMessage.findMany']);
    expect(
      scan(
        'chat/messages-store.ts',
        readFileSync(join(PLATFORM, 'chat/messages-store.ts'), 'utf8')
      ).calls.filter((c) => c === 'chatMessage.create')
    ).toHaveLength(2);
  });

  it('does not let the thread and message stores name the trace table: deleting a thread leaves the traces', () => {
    for (const name of [
      'chat/threads-store.ts',
      'chat/messages-store.ts',
      'chat/title.ts',
    ]) {
      const words = codeWords(name, readFileSync(join(PLATFORM, name), 'utf8'));
      expect(
        words.filter((w) => /requestTrace|request_traces/.test(w))
      ).toEqual([]);
    }
  });

  describe('the quota ledger’s raw SQL (build step 7 part 6)', () => {
    const LEDGER_FILES = ['metering/ledger-store.ts', 'metering/reaper.ts'];

    /** The first argument of every `$queryRawUnsafe` call of a source, as a kind of node. */
    function firstArguments(name: string, text: string): string[] {
      const file = ts.createSourceFile(
        name,
        text,
        ts.ScriptTarget.ES2020,
        true
      );
      const kinds: string[] = [];
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === '$queryRawUnsafe'
        ) {
          const first = node.arguments[0];
          kinds.push(first === undefined ? 'none' : ts.SyntaxKind[first.kind]!);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
      return kinds;
    }

    it('the scanner tells a constant statement from a built one', () => {
      expect(
        firstArguments(
          'x.ts',
          'c.$queryRawUnsafe(SQL.a, 1); c.$queryRawUnsafe(REAP_SQL); c.$queryRawUnsafe(`select ${x}`); c.$queryRawUnsafe("a" + b); c.$queryRawUnsafe(f(x));'
        )
      ).toEqual([
        'PropertyAccessExpression',
        'Identifier',
        'TemplateExpression',
        'BinaryExpression',
        'CallExpression',
      ]);
    });

    it.each(LEDGER_FILES)(
      '%s sends only a named constant as the statement',
      (name) => {
        const kinds = firstArguments(
          name,
          readFileSync(join(PLATFORM, name), 'utf8')
        );
        expect(kinds.length).toBeGreaterThan(0);
        for (const kind of kinds) {
          expect(['PropertyAccessExpression', 'Identifier']).toContain(kind);
        }
      }
    );

    it.each(LEDGER_FILES)(
      '%s never calls $executeRaw, $queryRaw or a tagged template',
      (name) => {
        const text = readFileSync(join(PLATFORM, name), 'utf8');
        const words = codeWords(name, text);
        expect(
          words.filter(
            (w) =>
              /^\$(execute|query)Raw(?!Unsafe)/.test(w) ||
              w === '$executeRawUnsafe'
          )
        ).toEqual([]);
        expect(
          scan(name, text).raw.filter((r) => r !== '$queryRawUnsafe')
        ).toEqual([]);
      }
    );

    it('the statements INSERT and UPDATE the two ledger tables, and delete and truncate nothing', async () => {
      const { LEDGER_SQL } = await import(
        '@/lib/platform/metering/ledger-store'
      );
      const { REAP_SQL } = await import('@/lib/platform/metering/reaper');
      const statements = [...Object.values(LEDGER_SQL), REAP_SQL];
      for (const sql of statements) {
        expect(sql).not.toMatch(
          /\bDELETE\b|\bTRUNCATE\b|\bDROP\b|\bALTER\b|\bCREATE\b/i
        );
        for (const target of sql.matchAll(
          /\b(?:INSERT INTO|UPDATE)\s+"([a-z_]+)"/g
        )) {
          expect(['ai_quota_periods', 'ai_usage_reservations']).toContain(
            target[1]
          );
        }
        for (const from of sql.matchAll(/\bFROM\s+"([A-Za-z_]+)"/g)) {
          expect(['ai_quota_periods', 'ai_usage_reservations']).toContain(
            from[1]
          );
        }
      }
    });

    it('no other file of the platform names the ledger’s tables, and the ledger names no other table', () => {
      for (const name of FILES) {
        const words = codeWords(
          name,
          readFileSync(join(PLATFORM, name), 'utf8')
        );
        const names = words.filter((w) =>
          /ai_quota_periods|ai_usage_reservations|aiQuotaPeriod|aiUsageReservation/.test(
            w
          )
        );
        if (!LEDGER_FILES.includes(name))
          expect({ name, names }).toEqual({ name, names: [] });
        if (LEDGER_FILES.includes(name)) {
          expect(
            words.filter((w) =>
              /request_traces|requestTrace|chat_|chatThread|chatMessage|trade_|"User"/.test(
                w
              )
            )
          ).toEqual([]);
        }
      }
    });
  });

  it('does not let the trace store name the chat tables', () => {
    const words = codeWords(
      'traces/store.ts',
      readFileSync(join(PLATFORM, 'traces/store.ts'), 'utf8')
    );
    expect(words.filter((w) => /chatThread|chatMessage|chat_/.test(w))).toEqual(
      []
    );
  });
});
