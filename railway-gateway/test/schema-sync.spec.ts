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
