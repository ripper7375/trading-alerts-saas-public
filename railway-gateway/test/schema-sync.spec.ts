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
