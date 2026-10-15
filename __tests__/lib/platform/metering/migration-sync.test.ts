/**
 * @jest-environment node
 */

/**
 * The migration `20261014010000_add_ai_metering_tables` against the Prisma schema, the stubs, the
 * store's constants and the architecture's rules (build step 7 part 6). Prisma cannot see a CHECK
 * constraint or a trigger, so its drift check says nothing when a model gains a column without the
 * migration's rules, or when a bound is edited in one place only: this test is what notices. The
 * gated spec `__tests__/reply/ledger.pg.spec.ts` shows what a real PostgreSQL does with the same file.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  MAX_LEDGER_UNITS,
  RESERVATION_STATUSES,
} from '@/lib/platform/metering/ledger-store';
import { MONTH } from '@/lib/platform/metering/period';
import { ID, MODEL_SLUG } from '@/lib/reply/contracts/fields';
import { MAX_UNITS } from '@/lib/reply/meter/units';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const MIGRATION_NAME = '20261014010000_add_ai_metering_tables';

const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

const SQL = read(`prisma/migrations/${MIGRATION_NAME}/migration.sql`);
const SCHEMA = read('prisma/non-market-data/schema.prisma');
const STUBS = read('types/prisma-stubs.d.ts');

const TABLES = {
  AiQuotaPeriod: 'ai_quota_periods',
  AiUsageReservation: 'ai_usage_reservations',
} as const;

interface Column {
  type: string;
  notNull: boolean;
}

function sqlColumns(table: string): Map<string, Column> {
  const match = new RegExp(
    `CREATE TABLE "${table}" \\(\\n([\\s\\S]*?)\\n\\);`
  ).exec(SQL);
  if (match === null) throw new Error(`no CREATE TABLE for ${table}`);
  const columns = new Map<string, Column>();
  for (const line of match[1]!.split('\n')) {
    const column =
      /^\s+"([a-z0-9_]+)" ([A-Z0-9()]+)( NOT NULL)?( DEFAULT .+?)?,?$/.exec(
        line
      );
    if (column !== null) {
      columns.set(column[1]!, {
        type: column[2]!,
        notNull: column[3] !== undefined,
      });
    }
  }
  return columns;
}

const PRISMA_TO_SQL: Record<string, string> = {
  String: 'TEXT',
  Int: 'INTEGER',
  DateTime: 'TIMESTAMP(3)',
  Json: 'JSONB',
};

function modelBlock(model: string): string {
  const match = new RegExp(`\\nmodel ${model} \\{\\n([\\s\\S]*?)\\n\\}`).exec(
    SCHEMA
  );
  if (match === null) throw new Error(`no model ${model}`);
  return match[1]!;
}

function modelColumns(model: string): Map<string, Column> {
  const columns = new Map<string, Column>();
  for (const line of modelBlock(model).split('\n')) {
    const field =
      /^\s+([a-z0-9_]+)\s+(String|Int|DateTime|Json)(\?)?(\s|$)/.exec(line);
    if (field !== null) {
      columns.set(field[1]!, {
        type: PRISMA_TO_SQL[field[2]!]!,
        notNull: field[3] === undefined,
      });
    }
  }
  return columns;
}

function checkConstraints(): Map<string, { table: string; body: string }> {
  const found = new Map<string, { table: string; body: string }>();
  const pattern =
    /ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([a-z0-9_]+)" CHECK \(([\s\S]*?)\);\n/g;
  for (const match of SQL.matchAll(pattern)) {
    found.set(match[2]!, {
      table: match[1]!,
      body: match[3]!.replace(/\s+/g, ' ').trim(),
    });
  }
  return found;
}

const CHECKS = checkConstraints();
const body = (name: string): string => {
  const found = CHECKS.get(name);
  if (found === undefined) throw new Error(`no CHECK ${name}`);
  return found.body;
};
const quoted = (text: string): string[] =>
  [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]!);

describe('the migration and the Prisma models agree on every column', () => {
  test.each(Object.entries(TABLES))('%s -> %s', (model, table) => {
    const fromSql = sqlColumns(table);
    const fromModel = modelColumns(model);
    expect(fromSql.size).toBeGreaterThanOrEqual(8);
    expect([...fromSql.keys()]).toEqual([...fromModel.keys()]);
    for (const [name, column] of fromModel) {
      expect({ name, ...fromSql.get(name)! }).toEqual({ name, ...column });
    }
  });

  test.each(Object.entries(TABLES))('%s is mapped to %s', (model, table) => {
    expect(modelBlock(model)).toContain(`@@map("${table}")`);
  });

  test('every number of the ledger is an INTEGER, and the request id is the key of a reservation', () => {
    for (const column of ['limit', 'used', 'reserved']) {
      expect(sqlColumns('ai_quota_periods').get(column)).toEqual({
        type: 'INTEGER',
        notNull: true,
      });
    }
    for (const column of ['reserved_units']) {
      expect(sqlColumns('ai_usage_reservations').get(column)).toEqual({
        type: 'INTEGER',
        notNull: true,
      });
    }
    for (const column of [
      'actual_units',
      'cost_micro_usd',
      'prompt_tokens',
      'completion_tokens',
    ]) {
      expect(sqlColumns('ai_usage_reservations').get(column)).toEqual({
        type: 'INTEGER',
        notNull: false,
      });
    }
    expect(SQL).toContain(
      'CONSTRAINT "ai_usage_reservations_pkey" PRIMARY KEY ("request_id")'
    );
  });

  test('the columns nothing has settled yet are nullable, and the deadline is not', () => {
    const columns = sqlColumns('ai_usage_reservations');
    expect(columns.get('status')?.notNull).toBe(true);
    expect(columns.get('expires_at')?.notNull).toBe(true);
    expect(columns.get('model')?.notNull).toBe(false);
  });

  test('a ledger table has no column that could hold a question or a hash key', () => {
    const names = [
      ...sqlColumns('ai_quota_periods').keys(),
      ...sqlColumns('ai_usage_reservations').keys(),
    ];
    expect(
      names.filter((n) => /question|prompt_text|text|query|hash|key/.test(n))
    ).toEqual([]);
  });
});

describe('types/prisma-stubs.d.ts', () => {
  test.each(Object.keys(TABLES))(
    '%s has the model’s columns and a delegate',
    (model) => {
      const block = new RegExp(
        `export interface ${model} \\{\\n([\\s\\S]*?)\\n  \\}`
      ).exec(STUBS);
      expect(block).not.toBeNull();
      const fields = [...block![1]!.matchAll(/^\s+([a-z0-9_]+): /gm)].map(
        (m) => m[1]
      );
      expect(fields).toEqual([...modelColumns(model).keys()]);
      const delegate = model.charAt(0).toLowerCase() + model.slice(1);
      expect(STUBS).toContain(`${delegate}: ModelDelegate<${model}>;`);
    }
  );
});

describe('the indexes', () => {
  function sqlIndexes(): string[] {
    return [
      ...SQL.matchAll(
        /CREATE (UNIQUE )?INDEX "[a-z0-9_]+" ON "([a-z0-9_]+)"\(([^)]*)\);/g
      ),
    ]
      .map((m) => {
        const columns = m[3]!
          .split(',')
          .map((c) => c.trim().replace(/"/g, ''))
          .join(',');
        return `${m[2]}:${m[1] === undefined ? 'index' : 'unique'}:${columns}`;
      })
      .sort();
  }

  function modelIndexes(): string[] {
    const out: string[] = [];
    for (const [model, table] of Object.entries(TABLES)) {
      for (const line of modelBlock(model).split('\n')) {
        const attribute = /^\s+@@(index|unique)\(\[([^\]]*)\]/.exec(line);
        if (attribute === null) continue;
        out.push(
          `${table}:${attribute[1]}:${attribute[2]!
            .split(',')
            .map((c) => c.trim())
            .join(',')}`
        );
      }
    }
    return out.sort();
  }

  test('the schema and the file have the same indexes', () => {
    expect(sqlIndexes()).toEqual(modelIndexes());
    expect(sqlIndexes()).toHaveLength(5);
  });

  test('a trader has one row a month, the reservations can reference a period by id and user, and the reaper has its index', () => {
    expect(sqlIndexes()).toEqual(
      expect.arrayContaining([
        'ai_quota_periods:unique:user_id,month',
        'ai_quota_periods:unique:id,user_id',
        'ai_usage_reservations:index:status,expires_at',
      ])
    );
  });
});

describe('the CHECK constraints', () => {
  const PERIOD_RULES = [
    'month_is_a_month',
    'limit_is_bounded',
    'used_is_not_negative',
    'reserved_is_not_negative',
    'balance_fits_the_limit',
  ];
  const RESERVATION_RULES = [
    'request_id_is_an_id',
    'reserved_is_positive',
    'status_is_known',
    'figures_are_in_range',
    'state_fits_the_fields',
    'model_is_a_slug',
    'expires_after_it_began',
  ];
  const expected = [
    ...PERIOD_RULES.map((r) => `ai_quota_periods_${r}`),
    ...RESERVATION_RULES.map((r) => `ai_usage_reservations_${r}`),
  ];

  test('are exactly these, each on the table its name starts with', () => {
    expect([...CHECKS.keys()].sort()).toEqual([...expected].sort());
    for (const [name, { table }] of CHECKS) {
      expect(name.startsWith(`${table}_`)).toBe(true);
    }
    expect(CHECKS.size).toBe(12);
  });

  test('every constraint, index, trigger and function name fits PostgreSQL’s 63 bytes', () => {
    const names = [
      ...SQL.matchAll(/(?:CONSTRAINT|INDEX|TRIGGER|FUNCTION) "([^"]+)"/g),
    ].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(15);
    for (const name of names)
      expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(63);
  });

  test('the bounds are the code’s: 2,000,000,000 units, in the store and in the meter', () => {
    expect(MAX_LEDGER_UNITS).toBe(2_000_000_000);
    expect(MAX_UNITS).toBe(MAX_LEDGER_UNITS);
    expect(body('ai_quota_periods_limit_is_bounded')).toBe(
      `"limit" BETWEEN 0 AND ${MAX_LEDGER_UNITS}`
    );
    expect(body('ai_usage_reservations_reserved_is_positive')).toBe(
      `"reserved_units" BETWEEN 1 AND ${MAX_LEDGER_UNITS}`
    );
    const figures = body('ai_usage_reservations_figures_are_in_range');
    for (const column of [
      'actual_units',
      'cost_micro_usd',
      'prompt_tokens',
      'completion_tokens',
    ]) {
      expect(figures).toContain(
        `("${column}" IS NULL OR "${column}" BETWEEN 0 AND ${MAX_LEDGER_UNITS})`
      );
    }
  });

  test('the arithmetic of a period is in 64 bits: used + reserved <= limit', () => {
    expect(body('ai_quota_periods_balance_fits_the_limit')).toBe(
      '"used"::bigint + "reserved"::bigint <= "limit"::bigint'
    );
    expect(body('ai_quota_periods_used_is_not_negative')).toBe('"used" >= 0');
    expect(body('ai_quota_periods_reserved_is_not_negative')).toBe(
      '"reserved" >= 0'
    );
  });

  test('the month, the id and the model slug are the code’s patterns', () => {
    expect(body('ai_quota_periods_month_is_a_month')).toBe(
      `"month" ~ '${MONTH.source}'`
    );
    expect(body('ai_usage_reservations_request_id_is_an_id')).toBe(
      `"request_id" ~ '${ID.source}'`
    );
    expect(body('ai_usage_reservations_model_is_a_slug')).toBe(
      `"model" IS NULL OR "model" ~ '${MODEL_SLUG.source}'`
    );
  });

  test('the states are the store’s', () => {
    expect(quoted(body('ai_usage_reservations_status_is_known'))).toEqual([
      ...RESERVATION_STATUSES,
    ]);
  });

  test('the state machine, as the shape of each state: only a SETTLED row has a charge', () => {
    const text = body('ai_usage_reservations_state_fits_the_fields');
    expect(text).toContain(
      `("status" = 'SETTLED' AND "actual_units" IS NOT NULL)`
    );
    expect(text).toContain(`"status" IN ('RESERVED', 'RELEASED', 'EXPIRED')`);
    for (const column of [
      'actual_units',
      'cost_micro_usd',
      'model',
      'prompt_tokens',
      'completion_tokens',
    ]) {
      expect(text).toContain(`"${column}" IS NULL`);
    }
  });

  test('a reservation has a deadline after it began', () => {
    expect(body('ai_usage_reservations_expires_after_it_began')).toBe(
      '"expires_at" > "created_at"'
    );
  });
});

describe('the foreign keys', () => {
  const foreignKeys = new Map<
    string,
    { table: string; columns: string; references: string; onDelete: string }
  >();
  for (const match of SQL.matchAll(
    /ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([a-z0-9_]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "([A-Za-z0-9_]+)"\(([^)]+)\) ON DELETE ([A-Z ]+?) ON UPDATE/g
  )) {
    foreignKeys.set(match[2]!, {
      table: match[1]!,
      columns: match[3]!.replace(/"/g, ''),
      references: `${match[4]!}(${match[5]!.replace(/"/g, '')})`,
      onDelete: match[6]!,
    });
  }

  test('are these three, and all of them cascade: a balance is the trader’s own', () => {
    expect(
      Object.fromEntries(
        [...foreignKeys].map(([k, v]) => [
          k,
          [v.columns, v.references, v.onDelete],
        ])
      )
    ).toEqual({
      ai_quota_periods_user_id_fkey: ['user_id', 'User(id)', 'CASCADE'],
      ai_usage_reservations_user_id_fkey: ['user_id', 'User(id)', 'CASCADE'],
      ai_usage_reservations_period_id_user_id_fkey: [
        'period_id, user_id',
        'ai_quota_periods(id, user_id)',
        'CASCADE',
      ],
    });
  });

  test('the Prisma relations say the same', () => {
    const rules = (model: string): string[] =>
      [...modelBlock(model).matchAll(/@relation\([^)]*onDelete: (\w+)\)/g)].map(
        (m) => m[1]!
      );
    expect(rules('AiQuotaPeriod')).toEqual(['Cascade']);
    expect(rules('AiUsageReservation')).toEqual(['Cascade', 'Cascade']);
  });

  test('the User model names the relations', () => {
    expect(SCHEMA).toMatch(/\n  aiQuotaPeriods\s+AiQuotaPeriod\[\]\n/);
    expect(SCHEMA).toMatch(
      /\n  aiUsageReservations\s+AiUsageReservation\[\]\n/
    );
  });

  test('the ledger holds no hash and no key: deleting the account deletes the balance, and the trace is the audit', () => {
    expect(SQL).not.toMatch(/ON DELETE SET NULL/);
    expect(sqlColumns('ai_quota_periods').has('user_id_hash')).toBe(false);
    expect(sqlColumns('ai_usage_reservations').has('user_id_hash')).toBe(false);
  });
});

describe('the guard on ai_usage_reservations', () => {
  const fn =
    /CREATE FUNCTION "ai_usage_reservations_guard"\(\)[\s\S]*?\$\$;/.exec(
      SQL
    )![0];

  test('refuses with restrict_violation', () => {
    expect(fn).toContain(`ERRCODE = 'restrict_violation'`);
    expect(SQL.match(/RAISE EXCEPTION/g)).toHaveLength(3);
  });

  test('seals request_id, period_id, reserved_units, created_at and expires_at', () => {
    for (const column of [
      'request_id',
      'period_id',
      'reserved_units',
      'created_at',
      'expires_at',
    ]) {
      expect(fn).toContain(`NEW."${column}" IS DISTINCT FROM OLD."${column}"`);
    }
    // the user id is not sealed: an account whose id changes (ON UPDATE CASCADE) must not be blocked
    expect(fn).not.toContain('NEW."user_id" IS DISTINCT FROM OLD."user_id"');
  });

  test('a row that keeps its state keeps its figures', () => {
    for (const column of [
      'actual_units',
      'cost_micro_usd',
      'model',
      'prompt_tokens',
      'completion_tokens',
    ]) {
      expect(fn).toContain(`NEW."${column}" IS DISTINCT FROM OLD."${column}"`);
    }
  });

  test('allows exactly RESERVED to SETTLED, RELEASED or EXPIRED, and EXPIRED to SETTLED', () => {
    expect(fn).toContain(
      `(OLD."status" = 'RESERVED' AND NEW."status" IN ('SETTLED', 'RELEASED', 'EXPIRED'))`
    );
    expect(fn).toContain(
      `(OLD."status" = 'EXPIRED' AND NEW."status" = 'SETTLED')`
    );
  });

  test('is one row trigger for UPDATE and none for DELETE (a DELETE is the cascade of a deleted account)', () => {
    const triggers = [
      ...SQL.matchAll(
        /CREATE TRIGGER "([a-z0-9_]+)"\n\s+(BEFORE [A-Z ]+) ON "([a-z0-9_]+)"\n\s+(FOR EACH [A-Z]+) EXECUTE FUNCTION "ai_usage_reservations_guard"\(\);/g
      ),
    ].map((m) => [m[3], m[2], m[4], m[1]]);
    expect(triggers).toEqual([
      [
        'ai_usage_reservations',
        'BEFORE UPDATE',
        'FOR EACH ROW',
        'ai_usage_reservations_guard_rows',
      ],
    ]);
    expect(SQL.match(/CREATE TRIGGER/g)).toHaveLength(1);
  });
});

describe('the migration file', () => {
  test('sorts after every earlier migration and is the newest', () => {
    const names = readdirSync(resolve(ROOT, 'prisma', 'migrations')).filter(
      (name) => /^\d{14}_/.test(name)
    );
    expect(names).toContain(MIGRATION_NAME);
    expect(
      MIGRATION_NAME > '20261014000000_add_reply_trace_and_chat_tables'
    ).toBe(true);
    expect(
      names
        .filter((name) => name <= MIGRATION_NAME)
        .sort()
        .pop()
    ).toBe(MIGRATION_NAME);
  });

  test('is additive: it creates and constrains, and drops or alters nothing that exists', () => {
    const statements = SQL.split('\n')
      .filter((line) => !line.startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/\bDROP\b/);
    expect(statements).not.toMatch(
      /\bTRUNCATE\b|\bDELETE FROM\b|\bINSERT INTO\b|\bUPDATE "/
    );
    for (const match of statements.matchAll(/ALTER TABLE "([A-Za-z0-9_]+)"/g)) {
      expect(Object.values(TABLES)).toContain(match[1]);
    }
  });

  test('says in its header that it is NOT APPLIED, the rollout order, how to roll it back, what a unit is and what deleting a User does', () => {
    expect(SQL).toMatch(/NOT APPLIED/);
    expect(SQL).toMatch(/ROLLOUT ORDER/);
    expect(SQL).toMatch(/ROLLBACK/);
    expect(SQL).toMatch(
      /migrate resolve --applied 20261014010000_add_ai_metering_tables/
    );
    expect(SQL).toMatch(
      /migrate resolve --rolled-back 20261014010000_add_ai_metering_tables/
    );
    expect(SQL).toMatch(/WHAT A UNIT IS/);
    expect(SQL).toMatch(/one micro-dollar/);
    expect(SQL).toMatch(/WHAT DELETING A User DOES/);
    expect(SQL).toMatch(/WHAT THE TRIGGER ON ai_usage_reservations DOES/);
    expect(SQL).toMatch(/PRO_MONTHLY_UNITS/);
    expect(SQL.startsWith('-- Stack D quota ledger')).toBe(true);
  });

  test('the DDL part is the Prisma diff and the rest comes after the last foreign key', () => {
    const lastForeignKey = SQL.lastIndexOf('-- AddForeignKey');
    const firstCheck = SQL.indexOf(
      'ADD CONSTRAINT "ai_quota_periods_month_is_a_month"'
    );
    expect(lastForeignKey).toBeGreaterThan(0);
    expect(firstCheck).toBeGreaterThan(lastForeignKey);
    expect(SQL.indexOf('CREATE FUNCTION')).toBeGreaterThan(firstCheck);
  });
});
