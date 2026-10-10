/**
 * @jest-environment node
 */

/**
 * The migration `20261010000000_add_engine4_tables` against the Prisma schema, the
 * engine's own bounds and the architecture's rules (build step 5, part 5). Prisma
 * cannot see a CHECK constraint or a trigger, so its drift check says nothing when a
 * model gains a column without the migration's rules, or when a bound is edited in one
 * place only: this test is what notices. The gated spec
 * `__tests__/engine4/engine4-tables.pg.spec.ts` shows what a real PostgreSQL does with
 * the same file.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { PROFILE_BOUNDS } from '@/lib/engine4';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const MIGRATION_NAME = '20261010000000_add_engine4_tables';

const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

const SQL = read(`prisma/migrations/${MIGRATION_NAME}/migration.sql`);
const SCHEMA = read('prisma/non-market-data/schema.prisma');

const TABLES = {
  UserTradePreferences: 'user_trade_preferences',
  UserTradePreferencesHistory: 'user_trade_preferences_history',
  TradeConsentRecord: 'trade_consent_records',
} as const;

// ---------------------------------------------------------------------------
// Reading the two files
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

describe('the migration and the Prisma models agree on every column', () => {
  test.each(Object.entries(TABLES))('%s -> %s', (model, table) => {
    const fromSql = sqlColumns(table);
    const fromModel = modelColumns(model);
    expect(fromSql.size).toBeGreaterThan(8);
    expect([...fromSql.keys()]).toEqual([...fromModel.keys()]);
    for (const [name, column] of fromModel) {
      expect({ name, ...fromSql.get(name)! }).toEqual({ name, ...column });
    }
  });

  test.each(Object.entries(TABLES))('%s is mapped to %s', (model, table) => {
    expect(modelBlock(model)).toContain(`@@map("${table}")`);
  });

  test('the eight profile figures are TEXT in all three tables that hold them, never a number type', () => {
    for (const table of [
      'user_trade_preferences',
      'user_trade_preferences_history',
    ]) {
      for (const name of [
        'trader_type',
        'style',
        'max_risk_pct',
        'max_leverage',
        'target_rrr',
        'equity',
        'min_sld',
        'commission',
      ]) {
        expect(sqlColumns(table).get(name)).toEqual({
          type: 'TEXT',
          notNull: true,
        });
      }
    }
  });
});

describe('types/prisma-stubs.d.ts', () => {
  const STUBS = read('types/prisma-stubs.d.ts');

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

describe('the CHECK constraints', () => {
  const PROFILE_RULES = [
    'trader_type_is_known',
    'style_is_known',
    'figures_are_decimal_text',
    'max_risk_pct_bounds',
    'max_leverage_ceiling',
    'target_rrr_bounds',
    'counter_trend_rrr_cap',
    'equity_is_positive',
    'min_sld_is_positive',
  ];
  const HASH_RULES = ['user_id_hash_is_hex', 'key_version_is_positive'];
  const CONSENT_RULES = [
    'action_is_known',
    'side_is_known',
    'user_id_hash_is_hex',
    'key_version_is_positive',
    'cycle_slot_is_positive',
    'symbol_specs_version_is_positive',
    'names_are_not_empty',
    'setup_text_is_its_copy_and_hash',
    'setup_is_a_validated_setup',
    'cycle_slot_follows_the_setup',
    'side_follows_the_setup',
    'zone_follows_the_setup',
  ];

  const expected = [
    ...PROFILE_RULES.map((rule) => `user_trade_preferences_${rule}`),
    ...[...PROFILE_RULES, ...HASH_RULES].map(
      (rule) => `user_trade_preferences_history_${rule}`
    ),
    ...CONSENT_RULES.map((rule) => `trade_consent_records_${rule}`),
  ];

  test('are exactly these, each on the table its name starts with', () => {
    expect([...CHECKS.keys()].sort()).toEqual([...expected].sort());
    for (const [name, { table }] of CHECKS) {
      expect(name.startsWith(`${table}_`)).toBe(true);
    }
  });

  test('the profile table and the history table carry the same nine profile rules, word for word', () => {
    for (const rule of PROFILE_RULES) {
      expect(CHECKS.get(`user_trade_preferences_history_${rule}`)?.body).toBe(
        CHECKS.get(`user_trade_preferences_${rule}`)?.body
      );
    }
  });

  test('the bounds are the engine’s (PROFILE_BOUNDS), in both profile tables', () => {
    for (const prefix of [
      'user_trade_preferences',
      'user_trade_preferences_history',
    ]) {
      const body = (rule: string): string =>
        CHECKS.get(`${prefix}_${rule}`)!.body;
      expect(body('max_risk_pct_bounds')).toContain(
        `BETWEEN ${PROFILE_BOUNDS.maxRiskPct.min} AND ${PROFILE_BOUNDS.maxRiskPct.max} `
      );
      expect(body('max_leverage_ceiling')).toContain(
        `"max_leverage"::numeric > 0 AND "max_leverage"::numeric <= ${PROFILE_BOUNDS.maxLeverageCeiling} `
      );
      expect(body('target_rrr_bounds')).toContain(
        `BETWEEN ${PROFILE_BOUNDS.targetRrr.min} AND ${PROFILE_BOUNDS.targetRrr.max} `
      );
      expect(body('counter_trend_rrr_cap')).toContain(
        `"style" <> 'TREND_COUNTERING' OR "target_rrr"::numeric <= ${PROFILE_BOUNDS.counterTrendRrrCap})`
      );
      expect(body('equity_is_positive')).toContain('"equity"::numeric > 0');
      expect(body('min_sld_is_positive')).toContain('"min_sld"::numeric > 0');
    }
  });

  test('every bound is guarded by the decimal-text rule, so a cast never raises another error', () => {
    for (const prefix of [
      'user_trade_preferences',
      'user_trade_preferences_history',
    ]) {
      for (const rule of [
        'max_risk_pct_bounds',
        'max_leverage_ceiling',
        'target_rrr_bounds',
        'counter_trend_rrr_cap',
        'equity_is_positive',
        'min_sld_is_positive',
      ]) {
        const body = CHECKS.get(`${prefix}_${rule}`)!.body;
        expect(body).toMatch(
          /^CASE WHEN "[a-z_]+" ~ '\^\(0\|\[1-9\]\[0-9\]\*\)\(\\\.\[0-9\]\*\[1-9\]\)\?\$' THEN /
        );
        expect(body).toMatch(/ ELSE TRUE END$/);
      }
    }
  });

  test('the action list is the three of 6.11, and the sides are BUY and SELL', () => {
    expect(CHECKS.get('trade_consent_records_action_is_known')?.body).toBe(
      `"action" IN ('ACCEPT', 'MODIFY', 'DECLINE')`
    );
    expect(CHECKS.get('trade_consent_records_side_is_known')?.body).toBe(
      `"side" IS NULL OR "side" IN ('BUY', 'SELL')`
    );
  });

  test('the hash is 64 lowercase hex characters', () => {
    for (const name of [
      'user_trade_preferences_history_user_id_hash_is_hex',
      'trade_consent_records_user_id_hash_is_hex',
    ]) {
      expect(CHECKS.get(name)?.body).toBe(`"user_id_hash" ~ '^[0-9a-f]{64}$'`);
    }
  });

  test('every constraint, index, trigger and function name fits PostgreSQL’s 63 bytes', () => {
    const names = [
      ...SQL.matchAll(/(?:CONSTRAINT|INDEX|TRIGGER|FUNCTION) "([^"]+)"/g),
    ].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(30);
    for (const name of names) {
      expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(63);
    }
  });
});

describe('the foreign keys', () => {
  const foreignKeys = new Map<
    string,
    { table: string; column: string; references: string; onDelete: string }
  >();
  for (const match of SQL.matchAll(
    /ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([a-z0-9_]+)" FOREIGN KEY \("([a-z0-9_]+)"\) REFERENCES "([A-Za-z0-9_]+)"\("id"\) ON DELETE ([A-Z ]+?) ON UPDATE/g
  )) {
    foreignKeys.set(match[2]!, {
      table: match[1]!,
      column: match[3]!,
      references: match[4]!,
      onDelete: match[5]!,
    });
  }

  test('are these five, with these delete rules', () => {
    expect(
      Object.fromEntries(
        [...foreignKeys].map(([k, v]) => [k, [v.references, v.onDelete]])
      )
    ).toEqual({
      user_trade_preferences_user_id_fkey: ['User', 'CASCADE'],
      user_trade_preferences_snapshot_id_fkey: [
        'user_trade_preferences_history',
        'RESTRICT',
      ],
      user_trade_preferences_history_user_id_fkey: ['User', 'SET NULL'],
      trade_consent_records_user_id_fkey: ['User', 'SET NULL'],
      trade_consent_records_profile_snapshot_id_fkey: [
        'user_trade_preferences_history',
        'RESTRICT',
      ],
    });
  });

  test('nothing cascades into an audit table: only the CURRENT profile goes with the account', () => {
    for (const fk of foreignKeys.values()) {
      if (fk.onDelete === 'CASCADE')
        expect(fk.table).toBe('user_trade_preferences');
    }
  });

  test('the Prisma relations say the same', () => {
    const rules = (model: string): string[] =>
      [...modelBlock(model).matchAll(/@relation\([^)]*onDelete: (\w+)\)/g)].map(
        (m) => m[1]!
      );
    expect(rules('UserTradePreferences')).toEqual(['Cascade', 'Restrict']);
    expect(rules('UserTradePreferencesHistory')).toEqual(['SetNull']);
    expect(rules('TradeConsentRecord')).toEqual(['SetNull', 'Restrict']);
  });

  test('the user id of an audit row can be NULL, and its hash and key version cannot', () => {
    for (const table of [
      'user_trade_preferences_history',
      'trade_consent_records',
    ]) {
      const columns = sqlColumns(table);
      expect(columns.get('user_id')?.notNull).toBe(false);
      expect(columns.get('user_id_hash')?.notNull).toBe(true);
      expect(columns.get('key_version')?.notNull).toBe(true);
    }
    expect(sqlColumns('user_trade_preferences').get('user_id')?.notNull).toBe(
      true
    );
    expect(sqlColumns('user_trade_preferences').has('user_id_hash')).toBe(
      false
    );
  });
});

describe('the append-only trigger', () => {
  test('the function refuses with restrict_violation and allows one change only', () => {
    const body =
      /CREATE FUNCTION "engine4_audit_append_only"\(\)[\s\S]*?\$\$;/.exec(
        SQL
      )![0];
    expect(body).toContain(`ERRCODE = 'restrict_violation'`);
    expect(body).toContain(`OLD."user_id" IS NOT NULL`);
    expect(body).toContain(`NEW."user_id" IS NULL`);
    expect(body).toContain(
      `(to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id')`
    );
    // OLD and NEW are only touched for an UPDATE (they are not assigned in a TRUNCATE trigger)
    expect(body.indexOf(`TG_OP = 'UPDATE'`)).toBeGreaterThan(-1);
    expect(body.indexOf(`TG_OP = 'UPDATE'`)).toBeLessThan(
      body.indexOf('OLD."user_id"')
    );
  });

  test('both audit tables have a row trigger for UPDATE and DELETE and a statement trigger for TRUNCATE; the current profile has none', () => {
    const triggers = [
      ...SQL.matchAll(
        /CREATE TRIGGER "([a-z0-9_]+)"\n\s+(BEFORE [A-Z ]+) ON "([a-z0-9_]+)"\n\s+(FOR EACH [A-Z]+) EXECUTE FUNCTION "engine4_audit_append_only"\(\);/g
      ),
    ].map((m) => [m[3], m[2], m[4], m[1]]);
    expect(triggers).toEqual([
      [
        'user_trade_preferences_history',
        'BEFORE UPDATE OR DELETE',
        'FOR EACH ROW',
        'user_trade_preferences_history_append_only',
      ],
      [
        'user_trade_preferences_history',
        'BEFORE TRUNCATE',
        'FOR EACH STATEMENT',
        'user_trade_preferences_history_no_truncate',
      ],
      [
        'trade_consent_records',
        'BEFORE UPDATE OR DELETE',
        'FOR EACH ROW',
        'trade_consent_records_append_only',
      ],
      [
        'trade_consent_records',
        'BEFORE TRUNCATE',
        'FOR EACH STATEMENT',
        'trade_consent_records_no_truncate',
      ],
    ]);
  });
});

describe('the migration file', () => {
  test('sorts after the newest earlier migration and is not the lock file', () => {
    const names = readdirSync(resolve(ROOT, 'prisma', 'migrations')).filter(
      (name) => /^\d{14}_/.test(name)
    );
    expect(names).toContain(MIGRATION_NAME);
    expect(MIGRATION_NAME > '20261004000000_add_synthesis_tables').toBe(true);
  });

  test('is additive: it creates and constrains, and drops or alters nothing that exists', () => {
    const statements = SQL.split('\n')
      .filter((line) => !line.startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/\bDROP\b/);
    expect(statements).not.toMatch(
      /\bTRUNCATE TABLE\b|\bDELETE FROM\b|\bINSERT INTO\b|\bUPDATE "/
    );
    for (const match of statements.matchAll(/ALTER TABLE "([A-Za-z0-9_]+)"/g)) {
      expect(Object.values(TABLES)).toContain(match[1]);
    }
  });

  test('says in its header that it is not applied and how to roll it back', () => {
    expect(SQL).toMatch(/NOT APPLIED/);
    expect(SQL).toMatch(/ROLLBACK/);
    expect(SQL).toMatch(
      /migrate resolve --applied 20261010000000_add_engine4_tables/
    );
  });
});
