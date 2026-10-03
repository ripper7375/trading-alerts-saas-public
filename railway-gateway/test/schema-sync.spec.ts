import * as fs from 'fs';
import * as path from 'path';

/**
 * Guards against drift between this service's own Prisma schema (used only
 * to `prisma generate` a typed client) and the monolith's real source of
 * truth for `market_data_v6` migrations. See both files' own header
 * comments and `docs/migration-orders/8-2-gateway-deployment-schema-dedup.migration-order.md`
 * Decision 1 for why there are two files instead of one shared package.
 */

const LOCAL_SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const SOURCE_OF_TRUTH_SCHEMA_PATH = path.join(
  __dirname,
  '../../prisma/market-data/schema.prisma'
);

function extractModelBody(schemaSource: string, modelName: string): string {
  const match = schemaSource.match(
    new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`)
  );
  if (!match) {
    throw new Error(`model ${modelName} not found in schema`);
  }
  return match[1];
}

/**
 * Normalizes a model body into a comparable list of field/attribute
 * declarations: strips full-line and trailing comments, blank lines, and
 * collapses whitespace, so byte-for-byte comment/formatting differences
 * (each file has its own header prose) don't fail the drift check while a
 * real field/type/attribute difference still does.
 */
function normalizeFields(modelBody: string): string[] {
  return modelBody
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\/\/.*/, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\s+/g, ' '));
}

describe('MarketDataV6 schema drift (railway-gateway vs. monolith source of truth)', () => {
  const localSchema = fs.readFileSync(LOCAL_SCHEMA_PATH, 'utf-8');
  const sourceOfTruthSchema = fs.readFileSync(
    SOURCE_OF_TRUTH_SCHEMA_PATH,
    'utf-8'
  );

  const localFields = normalizeFields(
    extractModelBody(localSchema, 'MarketDataV6')
  );
  const sourceOfTruthFields = normalizeFields(
    extractModelBody(sourceOfTruthSchema, 'MarketDataV6')
  );

  it('parsed a non-trivial number of field declarations from both schemas', () => {
    expect(localFields.length).toBeGreaterThan(50);
    expect(sourceOfTruthFields.length).toBeGreaterThan(50);
  });

  it('is field-for-field identical (name, type, modifiers, attributes) to the monolith source of truth', () => {
    expect(localFields).toEqual(sourceOfTruthFields);
  });

  it('maps to the same physical table', () => {
    expect(localSchema).toMatch(/@@map\("market_data_v6"\)/);
    expect(sourceOfTruthSchema).toMatch(/@@map\("market_data_v6"\)/);
  });
});

/**
 * The same drift guard for the append-only statistics models. Without this,
 * only MarketDataV6 was covered and the two other shared models could diverge
 * silently — the exact failure mode this suite exists to prevent.
 */
describe.each([
  ['IndicatorStatistic', 'indicator_statistics'],
  ['IndicatorConfig', 'indicator_configs'],
  ['EconomicEvent', 'economic_events'],
  ['CurrencyGoldIndex', 'currency_gold_indices'],
  // Stack D chapter 1 (build step 2, part 2).
  ['MarketCycle', 'market_cycles'],
  ['ActiveIndicatorSetting', 'active_indicator_settings'],
  ['SymbolSpec', 'symbol_specs'],
  ['CycleEvent', 'cycle_events'],
  // Stack D chapter 2 (build step 3, part 2).
  ['McdOutput', 'mcd_outputs'],
  ['MarketCycleInput', 'market_cycle_inputs'],
  ['StateStatistic', 'state_statistics'],
])(
  '%s schema drift (railway-gateway vs. monolith source of truth)',
  (model, table) => {
    const localSchema = fs.readFileSync(LOCAL_SCHEMA_PATH, 'utf-8');
    const sourceOfTruthSchema = fs.readFileSync(
      SOURCE_OF_TRUTH_SCHEMA_PATH,
      'utf-8'
    );

    it('exists in both schemas', () => {
      expect(() => extractModelBody(localSchema, model)).not.toThrow();
      expect(() => extractModelBody(sourceOfTruthSchema, model)).not.toThrow();
    });

    it('is field-for-field identical to the monolith source of truth', () => {
      expect(normalizeFields(extractModelBody(localSchema, model))).toEqual(
        normalizeFields(extractModelBody(sourceOfTruthSchema, model))
      );
    });

    it('maps to the same physical table', () => {
      const mapping = new RegExp(`@@map\\("${table}"\\)`);
      expect(localSchema).toMatch(mapping);
      expect(sourceOfTruthSchema).toMatch(mapping);
    });
  }
);

/**
 * The append-only guarantee is enforced by the KEY, not by a trigger: a row is
 * identified by which fit AND when it was observed, so a new observation can
 * never collide with an old one. If that unique key is ever narrowed, history
 * silently starts being overwritten and this whole dataset stops being usable
 * for walk-forward scoring — which is the only reason it exists.
 */
describe('IndicatorStatistic append-only invariant', () => {
  const sourceOfTruthSchema = fs.readFileSync(
    SOURCE_OF_TRUTH_SCHEMA_PATH,
    'utf-8'
  );
  const body = extractModelBody(sourceOfTruthSchema, 'IndicatorStatistic');

  it('is keyed on (symbol, timeframe, source, captured_at) — including captured_at', () => {
    expect(normalizeFields(body)).toContain(
      '@@unique([symbol, timeframe, source, captured_at])'
    );
  });

  it('has no updatedAt field (rows are never modified after insert)', () => {
    expect(body).not.toMatch(/@updatedAt/);
  });
});

/**
 * The same invariant for the economic-events stream, and it matters more here
 * than anywhere else in the pipeline. A forecast is revised and an actual is
 * published only AFTER the event, so narrowing this key to value_id alone
 * would make each release overwrite itself and erase what the market knew
 * beforehand — permanently, and with no error to notice it by.
 */
describe('EconomicEvent append-only invariant', () => {
  const sourceOfTruthSchema = fs.readFileSync(
    SOURCE_OF_TRUTH_SCHEMA_PATH,
    'utf-8'
  );
  const body = extractModelBody(sourceOfTruthSchema, 'EconomicEvent');

  it('is keyed on (value_id, captured_at) — including captured_at', () => {
    expect(normalizeFields(body)).toContain(
      '@@unique([value_id, captured_at])'
    );
  });

  it('has no updatedAt field (rows are never modified after insert)', () => {
    expect(body).not.toMatch(/@updatedAt/);
  });

  it('keeps ids as String so 64-bit upstream ids survive JSON transport', () => {
    expect(normalizeFields(body)).toContain('value_id String');
    expect(normalizeFields(body)).toContain('event_id String');
  });

  it('leaves every published value nullable (missing is not zero)', () => {
    for (const field of [
      'actual_value',
      'forecast_value',
      'prev_value',
      'revised_prev_value',
    ]) {
      expect(normalizeFields(body)).toContain(`${field} Float?`);
    }
  });
});

/**
 * CurrencyGoldIndex is NOT append-only like the two models above -- it is
 * upserted in place, since (index_name, bar_time) has exactly one correct,
 * deterministically-recomputable value (see currency_gold_index_engine.py's
 * index_value() docstring). The invariant that matters here is narrower: if
 * the unique key were ever widened to include something that legitimately
 * varies per push (like terminal_id), a retry would stop being a true no-op
 * and could silently duplicate rows for the same bar.
 */
describe('CurrencyGoldIndex upsert-key invariant', () => {
  const sourceOfTruthSchema = fs.readFileSync(
    SOURCE_OF_TRUTH_SCHEMA_PATH,
    'utf-8'
  );
  const body = extractModelBody(sourceOfTruthSchema, 'CurrencyGoldIndex');

  it('is keyed on exactly (index_name, bar_time)', () => {
    expect(normalizeFields(body)).toContain('@@unique([index_name, bar_time])');
  });
});

/**
 * Stack D chapter 1 tables (docs/STACK-D-ARCHITECTURE.md section 1, build step 2
 * part 2). Four places must say the same thing about each table: the monolith
 * schema (which owns the migration), the gateway's mirror, the migration SQL and
 * the type stubs. The first pair is covered by the drift block above; this block
 * covers the other two, and pins the keys that carry the rules.
 */
const MIGRATION_PATH = path.join(
  __dirname,
  '../../prisma/migrations/20261002000000_add_cycle_pipeline_tables/migration.sql'
);
const STUBS_PATH = path.join(__dirname, '../../types/prisma-stubs.d.ts');

/** Scalar field names of a model body, in declaration order. */
function fieldNames(modelBody: string): string[] {
  return normalizeFields(modelBody)
    .filter((line) => !line.startsWith('@@'))
    .map((line) => line.split(' ')[0]);
}

function stubInterfaceFields(stubs: string, name: string): string[] {
  const match = stubs.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n  \\}`)
  );
  if (!match) throw new Error(`stub interface ${name} not found`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
    .map((line) => line.split(':')[0]);
}

function createTableColumns(sql: string, table: string): string[] {
  const match = sql.match(
    new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`)
  );
  if (!match) throw new Error(`CREATE TABLE "${table}" not found`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('"'))
    .map((line) => line.split('"')[1]);
}

describe.each([
  ['MarketCycle', 'market_cycles'],
  ['ActiveIndicatorSetting', 'active_indicator_settings'],
  ['SymbolSpec', 'symbol_specs'],
  ['CycleEvent', 'cycle_events'],
])('%s agrees with its migration and its type stub', (model, table) => {
  const source = fs.readFileSync(SOURCE_OF_TRUTH_SCHEMA_PATH, 'utf-8');
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  const stubs = fs.readFileSync(STUBS_PATH, 'utf-8');
  const schemaFields = fieldNames(extractModelBody(source, model));

  it('has the same columns, in the same order, in the migration', () => {
    expect(createTableColumns(sql, table)).toEqual(schemaFields);
  });

  it('has the same fields in the type stub', () => {
    expect([...stubInterfaceFields(stubs, model)].sort()).toEqual(
      [...schemaFields].sort()
    );
  });

  it('has a delegate on the stub client', () => {
    const delegate = model.charAt(0).toLowerCase() + model.slice(1);
    expect(stubs).toContain(`${delegate}: ModelDelegate<${model}>;`);
  });
});

describe('Stack D chapter 1 table invariants', () => {
  const source = fs.readFileSync(SOURCE_OF_TRUTH_SCHEMA_PATH, 'utf-8');
  const body = (model: string) =>
    normalizeFields(extractModelBody(source, model));

  it('market_cycles: one row per (symbol, slot), and attempts is required', () => {
    // The unique key is what makes a re-delivered manifest a no-op. `attempts`
    // is an input of the ready deadline (2 minutes, or 4 after a retry), so a
    // cycle without it could not be given a status.
    expect(body('MarketCycle')).toContain('@@unique([symbol, slot])');
    expect(body('MarketCycle')).toContain('attempts Int');
    expect(body('MarketCycle')).toContain('data_status String?');
    expect(body('MarketCycle')).toContain('retuning Boolean @default(false)');
  });

  it('market_cycles is updated in place (PENDING to READY), so it has updatedAt', () => {
    expect(body('MarketCycle')).toContain('updatedAt DateTime @updatedAt');
  });

  it.each(['ActiveIndicatorSetting', 'SymbolSpec', 'CycleEvent'])(
    '%s is append-only: it has no updatedAt',
    (model) => {
      // Declarations only: the models' own comments say "No @updatedAt".
      expect(body(model).join('\n')).not.toMatch(/@updatedAt/);
    }
  );

  it('active_indicator_settings has no unique key, so a not-yet-effective entry can be superseded', () => {
    expect(body('ActiveIndicatorSetting').join('\n')).not.toMatch(/@@?unique/);
  });

  it('symbol_specs: a re-delivered capture is a no-op and a version is unique per symbol', () => {
    expect(body('SymbolSpec')).toContain('@@unique([symbol, captured_at])');
    expect(body('SymbolSpec')).toContain('@@unique([symbol, version])');
  });

  it('cycle_events: the producer-chosen dedupe_key is unique', () => {
    expect(body('CycleEvent')).toContain('dedupe_key String @unique');
  });
});

describe('the migration that creates them', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  it('is additive only: it creates tables and indexes and changes nothing that exists', () => {
    expect(sql.match(/^CREATE TABLE /gm)).toHaveLength(4);
    expect(sql).not.toMatch(
      /^\s*(ALTER TABLE|DROP|TRUNCATE|DELETE|UPDATE)\b/im
    );
  });

  it('seeds the ADR-010 starting values at slot 0 and nothing else', () => {
    expect(sql.match(/^INSERT INTO /gm)).toHaveLength(1);
    expect(sql).toContain(
      "('seed_active_indicator_m15_non_b', 'M15', 'non_b', 0, 'migration', 'ADR-010 starting value')"
    );
    expect(sql).toContain(
      "('seed_active_indicator_m5_best_fit_a', 'M5', 'best_fit_a', 0, 'migration', 'ADR-010 starting value')"
    );
    expect(sql).toContain('ON CONFLICT ("id") DO NOTHING');
  });
});

/**
 * Stack D chapter 2 tables (docs/STACK-D-ARCHITECTURE.md section 2, build step 3
 * part 2): mcd_outputs, market_cycle_inputs, state_statistics. The same four places
 * must agree (monolith schema, gateway mirror, migration SQL, type stubs); the
 * first pair is in the drift block above. Two rules are CHECK constraints that
 * Prisma cannot see, so a column added to the model without the CHECK would
 * slip past `prisma migrate diff`: the tests below compare the CHECKs with the
 * model.
 */
const SENSOR_MIGRATION_PATH = path.join(
  __dirname,
  '../../prisma/migrations/20261003000000_add_sensor_tables/migration.sql'
);

/** The text between the parentheses of `ADD CONSTRAINT "<name>" CHECK (...)`. */
function checkBody(sql: string, constraint: string): string {
  const match = sql.match(
    new RegExp(`ADD CONSTRAINT "${constraint}" CHECK \\(([\\s\\S]*?)\\n?\\);`)
  );
  if (!match) throw new Error(`CHECK "${constraint}" not found`);
  return match[1];
}

/** Names of the declarations of a model whose normalized type is `type`. */
function columnsOfType(modelBody: string, type: string): string[] {
  return normalizeFields(modelBody)
    .filter((line) => !line.startsWith('@@'))
    .filter((line) => line.split(' ')[1] === type)
    .map((line) => line.split(' ')[0]);
}

describe.each([
  ['McdOutput', 'mcd_outputs'],
  ['MarketCycleInput', 'market_cycle_inputs'],
  ['StateStatistic', 'state_statistics'],
])('%s agrees with its sensor migration and its type stub', (model, table) => {
  const source = fs.readFileSync(SOURCE_OF_TRUTH_SCHEMA_PATH, 'utf-8');
  const sql = fs.readFileSync(SENSOR_MIGRATION_PATH, 'utf-8');
  const stubs = fs.readFileSync(STUBS_PATH, 'utf-8');
  const schemaFields = fieldNames(extractModelBody(source, model));

  it('has the same columns, in the same order, in the migration', () => {
    expect(createTableColumns(sql, table)).toEqual(schemaFields);
  });

  it('has the same fields in the type stub', () => {
    expect([...stubInterfaceFields(stubs, model)].sort()).toEqual(
      [...schemaFields].sort()
    );
  });

  it('has a delegate on the stub client', () => {
    const delegate = model.charAt(0).toLowerCase() + model.slice(1);
    expect(stubs).toContain(`${delegate}: ModelDelegate<${model}>;`);
  });

  it('types every stub field as the schema says (Bytes is Uint8Array, a list is an array, optional adds null)', () => {
    expect(stubInterfaceTypes(stubs, model)).toEqual(
      schemaTypesAsStubTypes(extractModelBody(source, model))
    );
  });
});

/** `name: type` of every field of a stub interface. */
function stubInterfaceTypes(
  stubs: string,
  name: string
): Record<string, string> {
  const match = stubs.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n  \\}`)
  );
  if (!match) throw new Error(`stub interface ${name} not found`);
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'))
      .map((line) => {
        const [field, ...rest] = line.split(':');
        return [field, rest.join(':').trim().replace(/;$/, '')];
      })
  );
}

/** What each Prisma scalar is in the stubs. A list is an array; an optional field adds `| null`. */
const STUB_TYPE: Record<string, string> = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  DateTime: 'Date | string',
  Json: 'JsonValue',
  Bytes: 'Uint8Array',
};

function schemaTypesAsStubTypes(modelBody: string): Record<string, string> {
  return Object.fromEntries(
    normalizeFields(modelBody)
      .filter((line) => !line.startsWith('@@'))
      .map((line) => {
        const [field, rawType] = line.split(' ');
        const list = rawType.endsWith('[]');
        const optional = rawType.endsWith('?');
        const base = STUB_TYPE[rawType.replace(/(\[\]|\?)$/, '')];
        if (base === undefined) throw new Error(`unmapped type ${rawType}`);
        return [field, list ? `${base}[]` : optional ? `${base} | null` : base];
      })
  );
}

describe('Stack D chapter 2 table invariants', () => {
  const source = fs.readFileSync(SOURCE_OF_TRUTH_SCHEMA_PATH, 'utf-8');
  const rawBody = (model: string) => extractModelBody(source, model);
  const body = (model: string) => normalizeFields(rawBody(model));

  it('mcd_outputs: one row per (symbol, cycle_slot, mcd_id), so a re-delivered cycle writes nothing new', () => {
    expect(body('McdOutput')).toContain(
      '@@unique([symbol, cycle_slot, mcd_id])'
    );
  });

  it('mcd_outputs: INVALID and STALE readings have no state and no bias, so both are nullable; the hashes of a reading are not', () => {
    for (const nullable of ['state_code String?', 'bias String?']) {
      expect(body('McdOutput')).toContain(nullable);
    }
    for (const required of [
      'envelope_json String',
      'envelope Json',
      'envelope_sha256 String',
      'evaluator_envelope_sha256 String',
      'retuning_observed Boolean',
      'retuning_applied Boolean',
      'flag String',
    ]) {
      expect(body('McdOutput')).toContain(required);
    }
  });

  it('mcd_outputs: the reason lists default to an empty array', () => {
    expect(body('McdOutput')).toContain(
      'inherited_reasons String[] @default([])'
    );
    expect(body('McdOutput')).toContain('guard_problems String[] @default([])');
  });

  it('market_cycle_inputs: one frozen bundle per (symbol, cycle_slot); an index on cycle_slot serves retention', () => {
    expect(body('MarketCycleInput')).toContain(
      '@@unique([symbol, cycle_slot])'
    );
    expect(body('MarketCycleInput')).toContain('@@index([cycle_slot])');
    expect(body('MarketCycleInput')).toContain('bundle_gz Bytes');
    expect(body('MarketCycleInput')).toContain('inputs_sha256 String');
  });

  it.each(['McdOutput', 'MarketCycleInput'])(
    '%s is write-once: it has no updated_at',
    (model) => {
      // Declarations only: the models' own comments say "No @updatedAt".
      expect(body(model).join('\n')).not.toMatch(/@updatedAt/);
      expect(fieldNames(rawBody(model))).not.toContain('updated_at');
    }
  );

  it('state_statistics: a series is (mcd, evaluator MAJOR.MINOR, config_hash_key, state, horizon), and it is updated in place', () => {
    expect(body('StateStatistic')).toContain(
      '@@unique([mcd_id, evaluator_version_series, config_hash_key, state_code, horizon_hours], map: "state_statistics_series_key")'
    );
    expect(body('StateStatistic')).toContain('updated_at DateTime @updatedAt');
  });

  it('state_statistics: n and the series notes are required', () => {
    expect(body('StateStatistic')).toContain('n Int');
    expect(body('StateStatistic')).toContain('series_notes String');
  });
});

describe('the CHECK constraints of the sensor migration', () => {
  const source = fs.readFileSync(SOURCE_OF_TRUTH_SCHEMA_PATH, 'utf-8');
  const sql = fs.readFileSync(SENSOR_MIGRATION_PATH, 'utf-8');

  it('state_statistics_n_gate: below n = 30 (ADR-022) every measured column is NULL', () => {
    const check = checkBody(sql, 'state_statistics_n_gate');
    expect(check).toMatch(/"n" >= 30\b/);
    // Every nullable Float of the model is a measured column, and every column
    // the CHECK names must be one. A measured column added to the model without
    // the CHECK would let a number below n = 30 through and Prisma would not say so.
    const measured = columnsOfType(
      extractModelBody(source, 'StateStatistic'),
      'Float?'
    ).sort();
    const gated = [...check.matchAll(/"(\w+)" IS NULL/g)]
      .map((m) => m[1])
      .sort();
    expect(measured.length).toBeGreaterThanOrEqual(6);
    expect(gated).toEqual(measured);
  });

  it('state_statistics_n_gate joins the measured columns with AND and the threshold with OR', () => {
    const check = checkBody(sql, 'state_statistics_n_gate');
    expect(check.match(/\bOR\b/g)).toHaveLength(1);
    expect(check.match(/\bAND\b/g)).toHaveLength(
      (check.match(/IS NULL/g) ?? []).length - 1
    );
  });

  it('mcd_outputs_flag_is_shadow_or_live: a row for an MCD whose flag is off cannot exist', () => {
    expect(checkBody(sql, 'mcd_outputs_flag_is_shadow_or_live').trim()).toBe(
      "\"flag\" IN ('shadow', 'live')"
    );
  });

  it('mcd_outputs_reason_lists_not_null: every TEXT[] column of the model is covered (Prisma leaves them nullable)', () => {
    const lists = columnsOfType(
      extractModelBody(source, 'McdOutput'),
      'String[]'
    ).sort();
    const covered = [
      ...checkBody(sql, 'mcd_outputs_reason_lists_not_null').matchAll(
        /"(\w+)" IS NOT NULL/g
      ),
    ]
      .map((m) => m[1])
      .sort();
    expect(lists).toEqual(['guard_problems', 'inherited_reasons']);
    expect(covered).toEqual(lists);
  });
});

describe('the migration that creates the sensor tables', () => {
  const sql = fs.readFileSync(SENSOR_MIGRATION_PATH, 'utf-8');
  const statements = sql.replace(/^--.*$/gm, '');

  it('creates three tables and four indexes, and nothing else besides the three CHECKs', () => {
    expect(statements.match(/^CREATE TABLE /gm)).toHaveLength(3);
    expect(statements.match(/^CREATE (UNIQUE )?INDEX /gm)).toHaveLength(4);
    expect(statements.match(/^ALTER TABLE /gm)).toHaveLength(3);
    expect(
      statements.match(/^ALTER TABLE .* ADD CONSTRAINT .* CHECK \(/gm)
    ).toHaveLength(3);
  });

  it('is additive only: it drops, deletes, updates and seeds nothing, and has no foreign key', () => {
    expect(statements).not.toMatch(
      /^\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im
    );
    expect(statements).not.toMatch(/\b(REFERENCES|FOREIGN KEY)\b/i);
  });

  it('is dated after the chapter 1 migration, so history order is unaffected', () => {
    const dir = path.basename(path.dirname(SENSOR_MIGRATION_PATH));
    expect(dir > '20261002000000_add_cycle_pipeline_tables').toBe(true);
  });
});
