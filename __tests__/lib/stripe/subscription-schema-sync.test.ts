/**
 * @jest-environment node
 */

/**
 * Manage Subscription S2 (plan v2.1 §9.3): the `Subscription` model is declared in
 * four places and the migration adds six columns to all but one of them.
 *
 *   prisma/non-market-data/schema.prisma   the root client (the truth)
 *   money-service/prisma/schema.prisma     mirrored BY HAND, its own generated client
 *   operation-service/prisma/schema.prisma a narrow 4-column read; needs none of the six
 *   types/prisma-stubs.d.ts                the interface the unit tests compile against
 *
 * Prisma cannot see that two schema files describe the same table, so a column added to
 * one and forgotten in the other would only show up in production, as a failed read.
 * This test is the field-by-field comparison the plan asks for.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

const MIGRATION =
  'prisma/migrations/20261021000000_add_subscription_management_fields';

/** column -> [Prisma type and attributes, SQL type, TypeScript type] */
const S2_COLUMNS: Record<string, [string, string, string]> = {
  cancelAtPeriodEnd: [
    'Boolean @default(false)',
    'BOOLEAN NOT NULL DEFAULT false',
    'boolean',
  ],
  cancelRequestedAt: ['DateTime?', 'TIMESTAMP(3)', 'Date | null'],
  cancellationReason: ['String?', 'TEXT', 'string | null'],
  pendingPlanType: ['String?', 'TEXT', 'string | null'],
  pendingPlanEffectiveAt: ['DateTime?', 'TIMESTAMP(3)', 'Date | null'],
  stripeScheduleId: ['String?', 'TEXT', 'string | null'],
};

/** field name -> "Type attributes", whitespace collapsed, comments dropped */
function modelFields(schema: string, model: string): Map<string, string> {
  const match = new RegExp(`\\nmodel ${model} \\{\\n([\\s\\S]*?)\\n\\}`).exec(
    schema
  );
  if (match === null) throw new Error(`no model ${model}`);
  const fields = new Map<string, string>();
  for (const raw of match[1]!.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (line === '' || line.startsWith('@@')) continue;
    const [name, ...rest] = line.split(/\s+/);
    fields.set(name!, rest.join(' '));
  }
  return fields;
}

const root = modelFields(
  read('prisma/non-market-data/schema.prisma'),
  'Subscription'
);
const money = modelFields(
  read('money-service/prisma/schema.prisma'),
  'Subscription'
);
const operation = modelFields(
  read('operation-service/prisma/schema.prisma'),
  'Subscription'
);

describe('Subscription model: the six S2 columns', () => {
  it.each(Object.entries(S2_COLUMNS))(
    '%s is declared the same way in the root and money-service schemas',
    (name, [prismaType]) => {
      expect(root.get(name)).toBe(prismaType);
      expect(money.get(name)).toBe(prismaType);
    }
  );

  it('is not in operation-service, whose model is a narrow read', () => {
    for (const name of Object.keys(S2_COLUMNS)) {
      expect(operation.has(name)).toBe(false);
    }
  });
});

describe('Subscription model: the hand-mirrored copies', () => {
  it('money-service declares every field of its model exactly as the root does', () => {
    for (const [name, declaration] of money) {
      expect({ name, declaration: root.get(name) }).toEqual({
        name,
        declaration,
      });
    }
  });

  it('money-service differs from the root only by the relation to Payment', () => {
    const onlyInRoot = [...root.keys()].filter((name) => !money.has(name));
    expect(onlyInRoot).toEqual(['payments']);
  });

  it("operation-service's narrow model is a subset of the root's with the same declarations", () => {
    for (const [name, declaration] of operation) {
      expect({ name, declaration: root.get(name) }).toEqual({
        name,
        declaration,
      });
    }
  });
});

describe('Subscription model: types/prisma-stubs.d.ts', () => {
  const stubs = read('types/prisma-stubs.d.ts');
  const body = /export interface Subscription \{\n([\s\S]*?)\n  \}/.exec(stubs);

  it('declares the interface', () => {
    expect(body).not.toBeNull();
  });

  it.each(Object.entries(S2_COLUMNS))('declares %s', (name, [, , tsType]) => {
    expect(body![1]).toContain(`    ${name}: ${tsType};`);
  });

  it('declares every scalar field of the root model', () => {
    for (const name of root.keys()) {
      if (name === 'payments') continue;
      expect(body![1]).toMatch(new RegExp(`^ {4}${name}\\??: `, 'm'));
    }
  });
});

describe('Subscription model: the migration', () => {
  const sql = read(`${MIGRATION}/migration.sql`);
  const statements = sql
    .split('\n')
    .filter((line) => !line.startsWith('--'))
    .join('\n');

  it('adds exactly the six columns, and nothing else', () => {
    const added = [...statements.matchAll(/ADD COLUMN\s+"(\w+)"\s+([^,;]+)/g)];
    expect(Object.fromEntries(added.map((m) => [m[1], m[2]!.trim()]))).toEqual(
      Object.fromEntries(
        Object.entries(S2_COLUMNS).map(([name, [, sqlType]]) => [name, sqlType])
      )
    );
    expect(statements).not.toMatch(
      /\b(DROP|UPDATE|DELETE|CREATE INDEX|ADD CONSTRAINT)\b/i
    );
    expect(statements.match(/ALTER TABLE/g)).toHaveLength(1);
    expect(statements).toContain('ALTER TABLE "Subscription"');
  });

  it('sorts after the deletedAt migration (F21), so Prisma applies it after that one', () => {
    const names = readdirSync(resolve(ROOT, 'prisma/migrations'));
    expect(names).toContain('20261019000000_add_user_deleted_at');
    expect(names).toContain(MIGRATION.split('/').pop());
    expect(
      MIGRATION.split('/').pop()! > '20261019000000_add_user_deleted_at'
    ).toBe(true);
  });

  it('states the rollout order and a rollback in its header', () => {
    expect(sql).toMatch(/Rollout order: apply this migration FIRST/);
    expect(sql).toMatch(/Rollback/);
    expect(sql).toMatch(/expect ZERO rows/);
  });
});
