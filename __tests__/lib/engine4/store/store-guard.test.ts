/**
 * @jest-environment node
 */

/**
 * The audit tables are append-only (decision D10 (c)); the database refuses an UPDATE
 * or a DELETE, and this guard keeps the stores from ever trying. It reads the
 * TypeScript of `lib/engine4/store/` and lists every call made on a database delegate
 * and every method the stores' client interfaces declare. Anything outside the lists
 * below fails: a new write on an audit table is a new decision, made here on purpose.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as ts from 'typescript';

const STORE_DIR = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'lib',
  'engine4',
  'store'
);

/** `delegate.method` calls the stores may make, per file. */
const ALLOWED_CALLS: Record<string, string[]> = {
  'profile-store.ts': [
    'userTradePreferences.findUnique',
    'userTradePreferences.upsert',
    'userTradePreferencesHistory.create',
  ],
  'consent-store.ts': [
    'tradeConsentRecord.create',
    'userTradePreferencesHistory.findUnique',
  ],
  'user-hash.ts': [],
};

/** Methods the stores' client interfaces may declare, per file. */
const ALLOWED_DECLARATIONS: Record<string, string[]> = {
  'profile-store.ts': ['$transaction', 'create', 'findUnique', 'upsert'],
  'consent-store.ts': ['create', 'findUnique'],
  'user-hash.ts': [],
};

const DELEGATES = new Set([
  'userTradePreferences',
  'userTradePreferencesHistory',
  'tradeConsentRecord',
]);

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
      /\b(TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/i.test(node.text)
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

describe('the scanner itself', () => {
  test('sees a delete, an update and a raw statement', () => {
    const found = scan(
      'bad.ts',
      [
        'async function f(tx: any) {',
        '  await tx.tradeConsentRecord.delete({ where: { id: "x" } });',
        '  await tx.userTradePreferencesHistory.update({});',
        '  await tx.$executeRaw`DELETE FROM x`;',
        '  await tx.$queryRawUnsafe("select 1");',
        '}',
        'interface C { tradeConsentRecord: { deleteMany(a: unknown): void } }',
      ].join('\n')
    );
    expect(found.calls).toEqual([
      'tradeConsentRecord.delete',
      'userTradePreferencesHistory.update',
    ]);
    expect(found.declared).toEqual(['deleteMany']);
    expect(found.raw).toEqual(expect.arrayContaining(['$queryRawUnsafe']));
    expect(found.raw.length).toBeGreaterThanOrEqual(2);
  });

  test('ignores the same words in comments and unrelated calls', () => {
    const found = scan(
      'ok.ts',
      '// tx.tradeConsentRecord.delete()\nconst a = list.delete(1);\nconst b = other.tradeConsentRecordX.update();'
    );
    expect(found).toEqual({ calls: [], declared: [], raw: [] });
  });
});

describe.each(Object.keys(ALLOWED_CALLS))('lib/engine4/store/%s', (name) => {
  const found = scan(name, readFileSync(resolve(STORE_DIR, name), 'utf8'));

  test('calls only the delegate methods listed for it', () => {
    expect([...new Set(found.calls)]).toEqual([...ALLOWED_CALLS[name]!].sort());
  });

  test('declares only the client methods listed for it', () => {
    expect(found.declared).toEqual([...ALLOWED_DECLARATIONS[name]!].sort());
  });

  test('writes no raw SQL', () => {
    expect(found.raw).toEqual([]);
  });
});

test('the audit tables have exactly one write path each: one create', () => {
  const all = Object.keys(ALLOWED_CALLS).flatMap(
    (name) => scan(name, readFileSync(resolve(STORE_DIR, name), 'utf8')).calls
  );
  const writes = all.filter((call) =>
    /\.(create|update|upsert|delete)/.test(call)
  );
  expect(writes.sort()).toEqual([
    'tradeConsentRecord.create',
    'userTradePreferences.upsert',
    'userTradePreferencesHistory.create',
  ]);
  // upsert is on the CURRENT profile only, never on an audit table
  expect(writes.filter((w) => /upsert/.test(w))).toEqual([
    'userTradePreferences.upsert',
  ]);
});
